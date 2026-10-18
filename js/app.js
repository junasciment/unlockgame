/*
 * UnlockGame — interface: tela de título, HUD, mapa de fases, modal e recompensas.
 */
(function (UG) {
  const { levelsData, escapeHtml, hash, clock, save, sound, haptic, formatCountdown } = UG;

  const els = {
    startScreen: document.querySelector("#startScreen"),
    startButton: document.querySelector("#startButton"),
    startSave: document.querySelector("#startSave"),
    list: document.querySelector("#levelsList"),
    map: document.querySelector("#levelMap"),
    mapPath: document.querySelector("#mapPath"),
    playerLevel: document.querySelector("#playerLevel"),
    xpFill: document.querySelector("#xpFill"),
    starCount: document.querySelector("#starCount"),
    progressTrack: document.querySelector("#progressTrack"),
    progressFill: document.querySelector("#progressFill"),
    nextUnlockTimer: document.querySelector("#nextUnlockTimer"),
    statusHeadline: document.querySelector("#statusHeadline"),
    statusSubline: document.querySelector("#statusSubline"),
    bunnySays: document.querySelector("#bunnySays"),
    mascot: document.querySelector("#mascot"),
    keyInventory: document.querySelector("#keyInventory"),
    closingTitle: document.querySelector("#closingTitle"),
    closingText: document.querySelector("#closingText"),
    modal: document.querySelector("#challengeModal"),
    modalContent: document.querySelector("#modalContent"),
    modalDay: document.querySelector("#modalDay"),
    modalState: document.querySelector("#modalState"),
    closeModal: document.querySelector("#closeModal"),
    soundToggle: document.querySelector("#soundToggle"),
    confetti: document.querySelector("#confetti"),
    toast: document.querySelector("#toast"),
    toastIcon: document.querySelector("#toastIcon"),
    toastMessage: document.querySelector("#toastMessage")
  };

  const XP_PER_LEVEL = 150;
  const MAP_ROW = 180;
  const MAP_X = [28, 72, 28, 72, 30];

  let selectedLevel = null;
  let cleanupGame = null;
  let toastTimeout;
  let typingTimer;
  let knownStates = {};

  /* ---------- Estado ---------- */
  const releaseDateOf = (level) => new Date(level.releaseDate);
  const isReleased = (level) => clock.now() >= releaseDateOf(level);
  const getState = (level) => save.isCompleted(level.day) ? "completed" : isReleased(level) ? "available" : "locked";
  const pad = (day) => String(day).padStart(2, "0");
  const finalWord = () => levelsData.map((level) => level.keyFragment || "").join("").toUpperCase();

  /* ---------- Mapa de fases ---------- */
  function starsMarkup(count) {
    return [1, 2, 3].map((n) => `<span class="${n <= count ? "on" : ""}">★</span>`).join("");
  }

  function levelCardMarkup(level, state) {
    const stars = save.level(level.day).stars || 0;
    const tag = { completed: "COMPLETA", available: "LIBERADO!", locked: "BLOQUEADO" }[state];
    const icon = { completed: "✓", available: "▶", locked: "🔒" }[state];
    const opensAt = releaseDateOf(level).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const detail = state === "locked"
      ? `<span class="countdown" data-release="${escapeHtml(level.releaseDate)}">${formatCountdown(releaseDateOf(level) - clock.now())}</span>`
      : state === "completed" ? `<span class="level-stars" aria-label="${stars} de 3 estrelas">${starsMarkup(stars)}</span>` : `<span class="level-play">jogar agora</span>`;

    return `
      <button class="level-node" type="button" aria-label="Fase ${level.day}: ${escapeHtml(level.title)}, ${tag.toLowerCase()}${state === "locked" ? `, abre em ${opensAt}` : ""}">
        <span class="node-ring"><small>DAY</small><strong>${pad(level.day)}</strong></span>
        <span class="node-badge" aria-hidden="true">${icon}</span>
      </button>
      <div class="level-label">
        <h3>${escapeHtml(level.title.replace(/^Nível \d+:\s*/, ""))}</h3>
        <span class="level-tag">${tag}</span>
        ${detail}
      </div>`;
  }

  function currentDay() {
    const pending = levelsData.find((level) => getState(level) === "available");
    if (pending) return pending.day;
    const completed = levelsData.filter((level) => save.isCompleted(level.day));
    return completed.length ? completed[completed.length - 1].day : levelsData[0].day;
  }

  function renderLevels() {
    const avatarDay = currentDay();
    els.map.style.setProperty("--map-height", `${levelsData.length * MAP_ROW}px`);
    els.list.innerHTML = levelsData.map((level, index) => {
      const state = getState(level);
      knownStates[level.day] = state;
      const avatar = level.day === avatarDay ? `<img class="map-avatar" src="assets/opt/puppybyte.png" alt="" aria-hidden="true" />` : "";
      const x = MAP_X[index % MAP_X.length];
      return `<li class="level-card ${state}${x > 50 ? " avatar-left" : ""}" data-day="${level.day}" style="--x:${x}%; --y:${index * MAP_ROW + MAP_ROW / 2}px">${avatar}${levelCardMarkup(level, state)}</li>`;
    }).join("");
    drawMapPath();
    updateSummary();
  }

  // Trilha pontilhada ligando as fases (curvas em S entre os nós).
  function drawMapPath() {
    const height = levelsData.length * MAP_ROW;
    const points = levelsData.map((_, index) => [MAP_X[index % MAP_X.length], index * MAP_ROW + MAP_ROW / 2]);
    const d = points.map(([x, y], index) => {
      if (!index) return `M ${x} ${y}`;
      const [px, py] = points[index - 1];
      const mid = (py + y) / 2;
      return `C ${px} ${mid}, ${x} ${mid}, ${x} ${y}`;
    }).join(" ");
    const doneUntil = levelsData.filter((level) => save.isCompleted(level.day)).length;
    const doneD = d.split(" C ").slice(0, Math.max(1, doneUntil)).join(" C ");
    els.mapPath.setAttribute("viewBox", `0 0 100 ${height}`);
    els.mapPath.innerHTML = `
      <path class="path-base" d="${d}" vector-effect="non-scaling-stroke" />
      <path class="path-dash" d="${d}" vector-effect="non-scaling-stroke" />
      ${doneUntil > 1 ? `<path class="path-done" d="${doneD}" vector-effect="non-scaling-stroke" />` : ""}`;
  }

  /* ---------- HUD, status e falas ---------- */
  function updateSummary() {
    const completed = levelsData.filter((level) => save.isCompleted(level.day)).length;
    const stars = levelsData.reduce((total, level) => total + (save.level(level.day).stars || 0), 0);
    const xp = save.data.xp;
    const firstPending = levelsData.find((level) => !save.isCompleted(level.day));
    const nextLocked = levelsData.find((level) => getState(level) === "locked");

    els.playerLevel.textContent = `LV${Math.floor(xp / XP_PER_LEVEL) + 1}`;
    els.xpFill.style.width = `${((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100}%`;
    els.starCount.textContent = stars;
    els.progressFill.style.width = `${(completed / levelsData.length) * 100}%`;
    els.progressTrack.setAttribute("aria-valuenow", completed);
    els.nextUnlockTimer.textContent = nextLocked ? formatCountdown(releaseDateOf(nextLocked) - clock.now()) : "READY!";

    if (!firstPending) {
      els.statusHeadline.textContent = "Jornada concluída! Você zerou o mapa ♥";
      els.statusSubline.textContent = "PuppyByte liberou a fase infinita: eu e tu";
    } else if (getState(firstPending) === "available") {
      els.statusHeadline.textContent = `Fase ${firstPending.day} liberada!`;
      els.statusSubline.textContent = "Seu próximo portal já pode ser aberto";
    } else {
      els.statusHeadline.textContent = "A próxima fase está esperando";
      els.statusSubline.textContent = `Fase ${firstPending.day} de ${levelsData.length} · o mapa está quase lá`;
    }

    renderInventory();
    renderClosing(completed === levelsData.length);
  }

  function renderInventory() {
    els.keyInventory.innerHTML = levelsData.filter((level) => level.keyFragment).map((level) => {
      const owned = save.isCompleted(level.day);
      return `<span class="key-chip ${owned ? "" : "missing"}" aria-label="Fragmento da fase ${level.day}${owned ? `: ${escapeHtml(level.keyFragment)}` : ", ainda não conquistado"}">${owned ? escapeHtml(level.keyFragment) : "?"}<small>F${level.day}</small></span>`;
    }).join("");
  }

  function renderClosing(allDone) {
    if (!allDone) return;
    els.closingTitle.textContent = `GAME CLEAR · ${finalWord()} ♥`;
    els.closingText.textContent = "Você zerou o UnlockGame.";
  }

  function bunnyLine() {
    const pending = levelsData.find((level) => getState(level) === "available");
    const nextLocked = levelsData.find((level) => getState(level) === "locked");
    const completed = levelsData.filter((level) => save.isCompleted(level.day)).length;
    if (completed === levelsData.length) return `Você zerou! A palavra secreta era ${finalWord()}.`;
    if (pending) return completed ? `A fase ${pending.day} tá liberada! Toca nela no mapa e bora jogar.` : `Oi, Laélia! Eu sou PuppyByte. Toca na fase ${pending.day} no mapa pra começar.`;
    if (nextLocked) return `Fase ${nextLocked.day} abre à meia-noite. Enquanto isso, rejoga uma fase e caça 3 estrelas ★`;
    return "Bora jogar?";
  }

  const mascotQuips = [
    "Ei! Eu tô aqui torcendo por você ♥",
    "Dica: os fragmentos de chave formam uma palavra…",
    "Saudade carregando… 99%… 99%… 99%…",
    "Se as nuvens de saudade aparecerem, desvia!",
    "Já bebeu água hoje?",
    "Espero que esteja comendo direitinho."
  ];

  function say(text) {
    clearInterval(typingTimer);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { els.bunnySays.textContent = text; return; }
    let index = 0;
    els.bunnySays.textContent = "";
    typingTimer = setInterval(() => {
      index += 1;
      els.bunnySays.textContent = text.slice(0, index);
      if (index >= text.length) clearInterval(typingTimer);
    }, 24);
  }

  /* ---------- Relógio ---------- */
  function tick() {
    document.querySelectorAll("[data-release]").forEach((timer) => {
      timer.textContent = formatCountdown(new Date(timer.dataset.release) - clock.now());
    });
    const opened = levelsData.filter((level) => knownStates[level.day] === "locked" && getState(level) !== "locked");
    if (opened.length) {
      renderLevels();
      say(bunnyLine());
      sound.play("fanfare");
      haptic([20, 40, 20]);
      showToast(`Fase ${opened[0].day} liberada! Corre pro mapa.`, "⚡");
      burstConfetti(40);
      return;
    }
    updateSummary();
  }

  /* ---------- Modal ---------- */
  function handleLevelClick(level, card) {
    sound.unlock();
    const state = getState(level);
    if (state === "locked") {
      sound.play("blocked");
      haptic([20, 30, 20]);
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
      showToast(`Fase ${level.day} abre em ${formatCountdown(releaseDateOf(level) - clock.now())}.`, "🔒");
      return;
    }
    sound.play(state === "completed" ? "open" : "available");
    haptic(10);
    if (state === "completed") openReward(level);
    else openChallenge(level);
  }

  function setModal(level, label, html) {
    stopGame();
    selectedLevel = level;
    els.modalDay.textContent = `FASE ${pad(level.day)}`;
    els.modalState.textContent = label;
    els.modalContent.innerHTML = html;
    if (!els.modal.open) els.modal.showModal();
    els.modal.querySelector(".dialog-inner").scrollTop = 0;
  }

  function openChallenge(level, replay = false) {
    setModal(level, replay ? "REPLAY" : "DESAFIO", `
      <h2 id="modalTitle">${escapeHtml(level.title)}</h2>
      <p class="challenge-lead">${escapeHtml(level.game.intro || "Vença o minijogo para liberar a recompensa.")}</p>
      <div class="game-root" id="gameRoot"></div>
      ${replay ? "" : `
      <details class="code-unlock">
        <summary>Recebeu um código do Player 2?</summary>
        <form id="codeForm" autocomplete="off">
          <input id="codeInput" type="text" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="EX: CODIGO-123" aria-label="Código do Player 2" />
          <button class="small-button" type="submit">usar</button>
        </form>
      </details>`}`);

    const game = UG.games[level.game.type];
    const root = els.modalContent.querySelector("#gameRoot");
    if (!game) {
      root.innerHTML = `<p class="game-message">Minijogo "${escapeHtml(level.game.type)}" não encontrado.</p>`;
      return;
    }
    cleanupGame = game.mount(root, level, {
      levels: levelsData,
      isCompleted: (day) => save.isCompleted(day),
      win: (stars) => winLevel(level, stars)
    });
  }

  function useCode(event) {
    event.preventDefault();
    const input = els.modalContent.querySelector("#codeInput");
    if (!selectedLevel || !input.value.trim()) return;
    if (selectedLevel.unlockCodeHash && hash(input.value) === selectedLevel.unlockCodeHash) {
      showToast("Código aceito! Player 2 liberou a fase.", "🗝");
      winLevel(selectedLevel, 3);
      return;
    }
    sound.play("wrong");
    haptic([30, 40, 30]);
    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
    showToast("Código inválido.", "×");
  }

  function winLevel(level, stars) {
    stopGame();
    const before = save.level(level.day).stars || 0;
    const { firstTime, xpGained } = save.complete(level.day, stars);
    sound.play("fanfare");
    haptic([20, 50, 20, 50, 80]);
    burstConfetti(90);
    renderLevels();
    say(bunnyLine());

    const fragment = firstTime && level.keyFragment
      ? `<div class="victory-key"><span>FRAGMENTO DE CHAVE OBTIDO</span><strong class="key-chip">${escapeHtml(level.keyFragment)}<small>F${level.day}</small></strong></div>` : "";
    const record = !firstTime && stars > before ? `<p class="victory-record">NOVO RECORDE!</p>` : "";

    setModal(level, "CLEAR!", `
      <div class="victory">
        <p class="victory-kicker">STAGE CLEAR</p>
        <h2 id="modalTitle">Fase ${level.day} concluída!</h2>
        <div class="victory-stars" aria-label="${stars} de 3 estrelas">${[1, 2, 3].map((n) => `<span class="${n <= stars ? "on" : ""}" style="--i:${n}">★</span>`).join("")}</div>
        ${record}
        <p class="victory-xp">+${xpGained} XP</p>
        ${fragment}
        <button class="modal-cta" id="openReward" type="button">abrir recompensa ♥</button>
      </div>`);
    els.modalContent.querySelector("#openReward").focus();
  }

  function openReward(level) {
    const stars = save.level(level.day).stars || 0;
    setModal(level, "RECOMPENSA", `
      <div class="reward-intro"><span>♥</span> recompensa desbloqueada <em class="level-stars">${starsMarkup(stars)}</em></div>
      <h2 id="modalTitle">${escapeHtml(level.title)}</h2>
      <div class="quote-card"><p>${escapeHtml(level.quote)}</p><small>frase do dia</small></div>
      <div class="spotify-wrap">
        <span class="spotify-label">♫ trilha sonora</span>
        <iframe class="spotify-frame" src="${escapeHtml(level.spotifyEmbedUrl)}" title="Player do Spotify da fase ${level.day}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
      </div>
      <div class="diary-card"><p>${escapeHtml(level.diary)}</p></div>
      <div class="challenge-box side-quest"><p>${escapeHtml(level.challenge)}</p></div>
      <div class="reward-actions">
        <button class="modal-cta secondary" id="replayLevel" type="button">↻ jogar de novo</button>
        <button class="modal-cta reward-close" id="closeReward" type="button">guardar no coração ♥</button>
      </div>`);
  }

  function stopGame() {
    if (cleanupGame) cleanupGame();
    cleanupGame = null;
  }

  function closeModal() {
    stopGame();
    if (els.modal.open) els.modal.close();
    selectedLevel = null;
  }

  /* ---------- Efeitos ---------- */
  function showToast(message, icon = "♥") {
    els.toastMessage.textContent = message;
    els.toastIcon.textContent = icon;
    els.toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => els.toast.classList.remove("show"), 3200);
  }

  function burstConfetti(amount) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const symbols = ["♥", "✦", "★", "♥", "✿"];
    const colors = ["#e987ad", "#fff1b6", "#b9dce0", "#cdb8d9", "#ffffff"];
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < amount; i++) {
      const piece = document.createElement("span");
      piece.textContent = symbols[i % symbols.length];
      piece.style.cssText = `left:${Math.random() * 100}%; color:${colors[i % colors.length]}; font-size:${12 + Math.random() * 16}px; animation-duration:${1.6 + Math.random() * 1.6}s; animation-delay:${Math.random() * .4}s; --drift:${(Math.random() - .5) * 160}px; --spin:${(Math.random() - .5) * 720}deg`;
      fragment.appendChild(piece);
    }
    els.confetti.appendChild(fragment);
    setTimeout(() => { els.confetti.innerHTML = ""; }, 3800);
  }

  function setSound(enabled, announce = true) {
    sound.enabled = enabled;
    save.setSound(enabled);
    els.soundToggle.setAttribute("aria-pressed", String(enabled));
    els.soundToggle.setAttribute("aria-label", enabled ? "Desligar sons" : "Ligar sons");
    els.soundToggle.textContent = enabled ? "♫" : "×";
    if (!announce) return;
    if (enabled) sound.play("click");
    showToast(enabled ? "Sons 8-bit ativados." : "Sons silenciados.", enabled ? "♫" : "×");
  }

  /* ---------- Tela de título ---------- */
  function setupStartScreen() {
    const completed = levelsData.filter((level) => save.isCompleted(level.day)).length;
    els.startSave.textContent = completed ? `save encontrado · ${completed}/${levelsData.length} fases` : "novo jogo";
    let seen = false;
    try { seen = sessionStorage.getItem("unlockgame_started") === "1"; } catch { /* sem storage */ }
    if (seen) { els.startScreen.remove(); return; }
    document.body.classList.add("is-starting");
    els.startButton.focus();
    els.startButton.addEventListener("click", () => {
      sound.unlock();
      sound.play("success");
      haptic(20);
      try { sessionStorage.setItem("unlockgame_started", "1"); } catch { /* sem storage */ }
      els.startScreen.classList.add("leaving");
      document.body.classList.remove("is-starting");
      setTimeout(() => els.startScreen.remove(), 450);
      say(bunnyLine());
    });
  }

  /* ---------- Eventos ---------- */
  els.list.addEventListener("click", (event) => {
    const card = event.target.closest(".level-card");
    if (!card) return;
    const level = levelsData.find((item) => item.day === Number(card.dataset.day));
    handleLevelClick(level, card);
  });
  els.closeModal.addEventListener("click", closeModal);
  els.modal.addEventListener("click", (event) => {
    if (event.target === els.modal) closeModal();
    if (event.target.closest("#closeReward")) closeModal();
    if (event.target.closest("#openReward") && selectedLevel) openReward(selectedLevel);
    if (event.target.closest("#replayLevel") && selectedLevel) openChallenge(selectedLevel, true);
  });
  els.modal.addEventListener("submit", (event) => { if (event.target.id === "codeForm") useCode(event); });
  els.modal.addEventListener("cancel", (event) => { event.preventDefault(); closeModal(); });
  els.soundToggle.addEventListener("click", () => setSound(!sound.enabled));
  els.mascot.addEventListener("click", () => {
    sound.unlock();
    sound.play("click");
    haptic(8);
    els.mascot.classList.remove("boing");
    void els.mascot.offsetWidth;
    els.mascot.classList.add("boing");
    say(mascotQuips[Math.floor(Math.random() * mascotQuips.length)]);
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) clock.sync().then(tick); });

  /* ---------- Início ---------- */
  // Abrir o site com ?reset zera o progresso deste aparelho (pede confirmação antes).
  function handleResetLink() {
    const params = new URLSearchParams(location.search);
    if (!params.has("reset")) return;
    params.delete("reset");
    const cleanUrl = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    if (window.confirm("Zerar todo o progresso do UnlockGame neste aparelho? Fases, estrelas e letras-chave voltam ao início.")) {
      save.reset(levelsData);
    }
    history.replaceState(null, "", cleanUrl);
  }

  UG.validateLevels(levelsData);
  handleResetLink();
  save.load(levelsData);
  setSound(save.data.sound !== false, false);
  renderLevels();
  setupStartScreen();
  if (!document.body.classList.contains("is-starting")) say(bunnyLine());
  clock.sync().then(() => { renderLevels(); if (!document.body.classList.contains("is-starting")) say(bunnyLine()); });
  setInterval(tick, 1000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})(window.UG);
