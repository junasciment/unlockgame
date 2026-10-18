/*
 * UnlockGame — núcleo: hash, relógio confiável, save, áudio e vibração.
 * Sem dependências; tudo pendurado em window.UG.
 */
window.UG = window.UG || {};

(function (UG) {
  /* ---------- Texto e hash ---------- */

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
  ));

  // Ignora acentos, maiúsculas, espaços e pontuação: "Pão de Açúcar!" === "paodeacucar".
  const normalize = (value) => String(value ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");

  // cyrb53: hash rápido e síncrono (não é criptografia — só tira as respostas da vista).
  function cyrb53(text, seed = 0) {
    let h1 = 0xdeadbeef ^ seed;
    let h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
  }

  const hash = (value) => cyrb53(`unlockgame:${normalize(value)}`);

  /* ---------- Relógio confiável ----------
   * O desbloqueio usa a hora do servidor (header Date da própria página) quando disponível,
   * então adiantar o relógio do celular não abre fases antes da hora.
   * Em localhost, ?agora=2026-10-20T08:00 simula uma data para testes.
   */
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const clock = {
    offset: 0,
    trusted: false,
    now() { return new Date(Date.now() + this.offset); },
    async sync() {
      const simulated = isLocalhost && new URLSearchParams(location.search).get("agora");
      if (simulated && !Number.isNaN(new Date(simulated).getTime())) {
        this.offset = new Date(simulated).getTime() - Date.now();
        this.trusted = true;
        return;
      }
      if (location.protocol === "file:") return;
      try {
        const sentAt = Date.now();
        const response = await fetch(`${location.pathname}?__clock=${sentAt}`, { method: "HEAD", cache: "no-store" });
        const serverDate = response.headers.get("date");
        if (!serverDate) return;
        const latency = (Date.now() - sentAt) / 2;
        const drift = new Date(serverDate).getTime() + latency - Date.now();
        // O header tem precisão de 1s; só corrige quando o desvio é relevante.
        this.offset = Math.abs(drift) > 90_000 ? drift : 0;
        this.trusted = true;
      } catch {
        // Offline: segue com a hora do aparelho.
      }
    }
  };

  /* ---------- Save ----------
   * Formato novo em "unlockgame_save" + chaves legadas unlocked_level_[dia] = "true",
   * mantidas para não perder progresso de quem já jogou a versão anterior.
   */
  const SAVE_KEY = "unlockgame_save";
  const legacyKey = (day) => `unlocked_level_${day}`;

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* modo privado */ } }
  };

  const save = {
    data: { version: 1, levels: {}, sound: true, xp: 0 },
    load(levels) {
      try {
        const parsed = JSON.parse(storage.get(SAVE_KEY) || "null");
        if (parsed && parsed.version === 1) this.data = { ...this.data, ...parsed };
      } catch { /* save corrompido: recomeça */ }
      levels.forEach((level) => {
        if (storage.get(legacyKey(level.day)) === "true" && !this.data.levels[level.day]) {
          this.data.levels[level.day] = { completed: true, stars: 3, completedAt: null };
          this.data.xp += 100;
        }
      });
      this.persist();
    },
    persist() { storage.set(SAVE_KEY, JSON.stringify(this.data)); },
    level(day) { return this.data.levels[day] || { completed: false, stars: 0 }; },
    isCompleted(day) { return Boolean(this.data.levels[day]?.completed); },
    complete(day, stars) {
      const previous = this.level(day);
      const firstTime = !previous.completed;
      const gainedStars = Math.max(0, stars - (previous.stars || 0));
      const xpGained = (firstTime ? 100 : 0) + gainedStars * 20;
      this.data.levels[day] = {
        completed: true,
        stars: Math.max(stars, previous.stars || 0),
        completedAt: previous.completedAt || new Date().toISOString()
      };
      this.data.xp += xpGained;
      storage.set(legacyKey(day), "true");
      this.persist();
      return { firstTime, xpGained };
    },
    setSound(enabled) { this.data.sound = enabled; this.persist(); },
    // Apaga todo o progresso (save novo + chaves legadas), como se ninguém tivesse jogado.
    reset(levels) {
      try {
        localStorage.removeItem(SAVE_KEY);
        levels.forEach((level) => localStorage.removeItem(legacyKey(level.day)));
        sessionStorage.removeItem("unlockgame_started");
      } catch { /* sem storage */ }
      this.data = { version: 1, levels: {}, sound: true, xp: 0 };
    }
  };

  /* ---------- Áudio 8-bit e vibração ---------- */
  let audioContext;
  const sequences = {
    click: [[440, .05]],
    blocked: [[130, .09], [110, .12]],
    available: [[440, .06], [660, .08]],
    open: [[392, .06], [523, .08]],
    flip: [[620, .03]],
    match: [[660, .05], [880, .08]],
    coin: [[988, .05], [1319, .1]],
    hurt: [[220, .06], [160, .12]],
    wrong: [[196, .1], [147, .16]],
    success: [[523, .07], [659, .07], [784, .13]],
    fanfare: [[523, .08], [659, .08], [784, .08], [1047, .1], [784, .07], [1047, .22]]
  };

  const sound = {
    enabled: true,
    unlock() {
      if (!this.enabled) return;
      try {
        audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === "suspended") audioContext.resume();
      } catch { this.enabled = false; }
    },
    notes(sequence, wave = "square") {
      if (!this.enabled) return;
      this.unlock();
      if (!audioContext) return;
      let offset = 0;
      sequence.forEach(([frequency, duration]) => {
        const start = audioContext.currentTime + offset;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(.04, start);
        gain.gain.exponentialRampToValueAtTime(.001, start + duration);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + duration);
        offset += duration + .03;
      });
    },
    play(kind) { this.notes(sequences[kind] || sequences.click); }
  };

  const haptic = (pattern = 12) => {
    try { navigator.vibrate?.(pattern); } catch { /* sem suporte */ }
  };

  /* ---------- Utilidades ---------- */
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const formatCountdown = (milliseconds) => {
    if (milliseconds <= 0) return "00:00:00";
    const totalSeconds = Math.floor(milliseconds / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const time = [hours, minutes, seconds].map((unit) => String(unit).padStart(2, "0")).join(":");
    return days > 0 ? `${days}d ${time}` : time;
  };

  // Confere se os dados das fases estão completos; avisa no console em vez de quebrar a tela.
  function validateLevels(levels) {
    const required = ["day", "title", "releaseDate", "game", "challenge", "quote", "spotifyEmbedUrl", "diary"];
    levels.forEach((level) => {
      required.filter((field) => level[field] === undefined).forEach((field) => {
        console.warn(`[UnlockGame] Fase ${level.day}: campo "${field}" ausente.`);
      });
      if (Number.isNaN(new Date(level.releaseDate).getTime())) {
        console.warn(`[UnlockGame] Fase ${level.day}: releaseDate inválida.`);
      }
      if (level.unlockCodeHash && !/^[0-9a-f]{14}$/.test(level.unlockCodeHash)) {
        console.warn(`[UnlockGame] Fase ${level.day}: unlockCodeHash precisa ser o hash gerado em tools/gerar-hash.html, não o código em si.`);
      }
    });
  }

  Object.assign(UG, { escapeHtml, normalize, hash, clock, save, sound, haptic, shuffle, formatCountdown, validateLevels, isLocalhost });
})(window.UG);
