/*
 * UnlockGame — minijogos.
 * Cada jogo expõe mount(root, level, ctx) e devolve uma função de limpeza.
 * ctx = { win(stars), levels, isCompleted(day) }.
 */
window.UG = window.UG || {};

(function (UG) {
  const { escapeHtml, sound, haptic, shuffle } = UG;

  const shakeElement = (element) => {
    element.classList.remove("shake");
    void element.offsetWidth;
    element.classList.add("shake");
  };

  const heartsMarkup = (current, total) => Array.from({ length: total }, (_, index) => (
    `<span class="${index < current ? "" : "lost"}">♥</span>`
  )).join("");

  /* ---------- Fase 1: jogo da memória ---------- */
  const memory = {
    mount(root, level, ctx) {
      const fallback = ["heart-pixel", "potion", "joycons", "handheld"].map((name) => `assets/opt/${name}.png`);
      const photos = (level.game.photos || []).concat(fallback).slice(0, level.game.pairs || 4);
      const pairs = photos.length;
      const deck = shuffle([...photos.keys(), ...photos.keys()]);
      const timers = [];
      let first = null;
      let locked = false;
      let moves = 0;
      let matched = 0;

      root.innerHTML = `
        <div class="game-hud"><span>JOGADAS <b data-moves>0</b></span><span>PARES <b data-pairs>0/${pairs}</b></span></div>
        <div class="memory-grid">
          ${deck.map((photo, index) => `
            <button class="memory-card" type="button" data-index="${index}" data-name="${photo}" aria-label="Carta ${index + 1}, virada para baixo">
              <span class="card-face card-back" aria-hidden="true">♥</span>
              <span class="card-face card-front" aria-hidden="true"><img src="${escapeHtml(photos[photo])}" data-fallback="${fallback[photo]}" alt="" draggable="false" /></span>
            </button>`).join("")}
        </div>`;

      root.querySelectorAll(".card-front img").forEach((img) => {
        img.addEventListener("error", () => {
          if (img.src.endsWith(img.dataset.fallback)) return;
          img.src = img.dataset.fallback;
          img.classList.add("is-art");
        }, { once: true });
      });

      const movesEl = root.querySelector("[data-moves]");
      const pairsEl = root.querySelector("[data-pairs]");

      const onClick = (event) => {
        const card = event.target.closest(".memory-card");
        if (!card || locked || card === first || card.classList.contains("flipped")) return;
        card.classList.add("flipped");
        card.setAttribute("aria-label", `Carta ${Number(card.dataset.index) + 1}: foto ${Number(card.dataset.name) + 1}`);
        sound.play("flip");
        if (!first) { first = card; return; }

        moves += 1;
        movesEl.textContent = moves;
        const second = card;
        if (first.dataset.name === second.dataset.name) {
          [first, second].forEach((item) => item.classList.add("matched"));
          first = null;
          matched += 1;
          pairsEl.textContent = `${matched}/${pairs}`;
          sound.play("match");
          haptic(15);
          if (matched === pairs) {
            const stars = moves <= pairs + 3 ? 3 : moves <= pairs + 8 ? 2 : 1;
            timers.push(setTimeout(() => ctx.win(stars), 650));
          }
          return;
        }
        locked = true;
        const previous = first;
        first = null;
        timers.push(setTimeout(() => {
          [previous, second].forEach((item) => {
            item.classList.remove("flipped");
            item.setAttribute("aria-label", `Carta ${Number(item.dataset.index) + 1}, virada para baixo`);
          });
          locked = false;
        }, 750));
      };

      root.addEventListener("click", onClick);
      return () => { root.removeEventListener("click", onClick); timers.forEach(clearTimeout); };
    }
  };

  /* ---------- Fase 2: melodia (estilo Genius) ---------- */
  const melody = {
    mount(root, level, ctx) {
      const pads = [
        { symbol: "♥", note: 523, tone: "pink" },
        { symbol: "✦", note: 659, tone: "yellow" },
        { symbol: "♫", note: 784, tone: "mint" },
        { symbol: "✿", note: 1047, tone: "lilac" }
      ];
      const rounds = level.game.rounds || 6;
      const maxLives = 3;
      const timers = [];
      let sequence = [];
      let round = 1;
      let step = 0;
      let lives = maxLives;
      let accepting = false;

      root.innerHTML = `
        <div class="game-hud"><span>RODADA <b data-round>1/${rounds}</b></span><span class="hud-hearts" data-lives>${heartsMarkup(lives, maxLives)}</span></div>
        <p class="game-message" data-message aria-live="polite">Toque em começar e preste atenção na melodia.</p>
        <div class="melody-pads">
          ${pads.map((pad, index) => `<button class="melody-pad tone-${pad.tone}" type="button" data-pad="${index}" aria-label="Nota ${index + 1}" disabled>${pad.symbol}</button>`).join("")}
        </div>
        <button class="modal-cta" type="button" data-start>▶ começar</button>`;

      const roundEl = root.querySelector("[data-round]");
      const livesEl = root.querySelector("[data-lives]");
      const messageEl = root.querySelector("[data-message]");
      const startButton = root.querySelector("[data-start]");
      const padEls = [...root.querySelectorAll(".melody-pad")];

      const later = (fn, ms) => timers.push(setTimeout(fn, ms));
      const setPadsEnabled = (enabled) => padEls.forEach((pad) => { pad.disabled = !enabled; });

      const flash = (index, duration = 320) => {
        const pad = padEls[index];
        pad.classList.add("lit");
        sound.notes([[pads[index].note, duration / 1000]], "triangle");
        later(() => pad.classList.remove("lit"), duration);
      };

      const playRound = () => {
        accepting = false;
        setPadsEnabled(false);
        step = 0;
        roundEl.textContent = `${round}/${rounds}`;
        messageEl.textContent = "Escuta…";
        const gap = Math.max(380, 640 - round * 40);
        sequence.slice(0, round).forEach((padIndex, i) => later(() => flash(padIndex, gap - 120), 500 + i * gap));
        later(() => {
          accepting = true;
          setPadsEnabled(true);
          messageEl.textContent = "Sua vez! Repita a sequência.";
        }, 500 + round * gap);
      };

      const newGame = () => {
        sequence = Array.from({ length: rounds }, () => Math.floor(Math.random() * pads.length));
        round = 1;
        lives = maxLives;
        livesEl.innerHTML = heartsMarkup(lives, maxLives);
        startButton.hidden = true;
        playRound();
      };

      const onPad = (event) => {
        const pad = event.target.closest(".melody-pad");
        if (!pad || !accepting) return;
        const index = Number(pad.dataset.pad);
        flash(index, 220);
        haptic(8);

        if (index !== sequence[step]) {
          accepting = false;
          setPadsEnabled(false);
          lives -= 1;
          livesEl.innerHTML = heartsMarkup(lives, maxLives);
          haptic([30, 40, 30]);
          later(() => sound.play("wrong"), 220);
          shakeElement(root.querySelector(".melody-pads"));
          if (lives <= 0) {
            messageEl.textContent = "Game over! A melodia mudou — bora de novo?";
            startButton.hidden = false;
            startButton.textContent = "↻ tentar de novo";
            return;
          }
          messageEl.textContent = "Quase! Vou tocar de novo…";
          later(playRound, 1200);
          return;
        }

        step += 1;
        if (step < round) return;
        accepting = false;
        setPadsEnabled(false);
        if (round >= rounds) {
          messageEl.textContent = "Combo perfeito!";
          later(() => ctx.win(lives), 700);
          return;
        }
        round += 1;
        messageEl.textContent = "Isso! Próxima rodada…";
        later(playRound, 900);
      };

      root.addEventListener("click", onPad);
      startButton.addEventListener("click", newGame);
      return () => { root.removeEventListener("click", onPad); timers.forEach(clearTimeout); };
    }
  };

  /* ---------- Fase 3: pegar corações (canvas) ---------- */
  const SPRITES = {
    heart: { color: "#e987ad", rows: [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."] },
    star: { color: "#f5c94c", rows: ["...X...", "..XXX..", "XXXXXXX", ".XXXXX.", ".XX.XX.", "X.....X"] },
    cloud: { color: "#8a7a96", rows: ["...XX....", "..XXXX.X.", ".XXXXXXXX", "XXXXXXXXX", ".XXXXXXX.", "..X..X..."] }
  };

  function buildSprite({ color, rows }, pixel) {
    const canvas = document.createElement("canvas");
    canvas.width = (rows[0].length + 1) * pixel;
    canvas.height = (rows.length + 1) * pixel;
    const context = canvas.getContext("2d");
    const paint = (fill, dx) => {
      context.fillStyle = fill;
      rows.forEach((row, y) => [...row].forEach((cell, x) => {
        if (cell === "X") context.fillRect((x + dx) * pixel, (y + dx) * pixel, pixel, pixel);
      }));
    };
    paint("#6b4564", 1);
    paint(color, 0);
    return canvas;
  }

  const catchGame = {
    mount(root, level, ctx) {
      const goal = level.game.goal || 20;
      const maxLives = level.game.lives || 3;

      root.innerHTML = `
        <div class="game-hud"><span>CORAÇÕES <b data-score>0/${goal}</b></span><span class="hud-hearts" data-lives>${heartsMarkup(maxLives, maxLives)}</span></div>
        <div class="catch-stage">
          <canvas aria-label="Arraste para mover a poção e pegar corações"></canvas>
          <div class="catch-overlay" data-overlay>
            <p data-overlay-text>Arraste o dedo para mover a poção.<br />♥ e ★ contam pontos · nuvens tiram vida.</p>
            <button class="modal-cta" type="button" data-start>▶ começar</button>
          </div>
        </div>`;

      const canvas = root.querySelector("canvas");
      const stage = root.querySelector(".catch-stage");
      const scoreEl = root.querySelector("[data-score]");
      const livesEl = root.querySelector("[data-lives]");
      const overlay = root.querySelector("[data-overlay]");
      const overlayText = root.querySelector("[data-overlay-text]");
      const startButton = root.querySelector("[data-start]");
      const context = canvas.getContext("2d");
      const potion = new Image();
      potion.src = "assets/opt/potion.png";

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let width = 0;
      let height = 0;
      let sprites = {};
      const resize = () => {
        width = stage.clientWidth;
        height = Math.round(Math.min(440, Math.max(320, width * 1.15)));
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.height = `${height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        const pixel = Math.max(3, Math.round(width / 110));
        sprites = { heart: buildSprite(SPRITES.heart, pixel), star: buildSprite(SPRITES.star, pixel), cloud: buildSprite(SPRITES.cloud, pixel) };
      };
      resize();

      const player = { x: 0, target: 0, w: 52, h: 70 };
      let items = [];
      let score = 0;
      let lives = maxLives;
      let running = false;
      let paused = false;
      let frame = 0;
      let lastTime = 0;
      let spawnIn = 0;
      let elapsed = 0;
      let hurtFlash = 0;

      const reset = () => {
        player.x = player.target = width / 2;
        items = [];
        score = 0;
        lives = maxLives;
        elapsed = 0;
        spawnIn = .4;
        scoreEl.textContent = `0/${goal}`;
        livesEl.innerHTML = heartsMarkup(lives, maxLives);
      };

      const spawn = () => {
        const roll = Math.random();
        const kind = roll < .62 ? "heart" : roll < .7 ? "star" : "cloud";
        const sprite = sprites[kind];
        const speed = (height / 3.2) * (1 + Math.min(elapsed / 40, 1.1)) * (kind === "cloud" ? 1.15 : 1);
        items.push({ kind, x: sprite.width / 2 + Math.random() * (width - sprite.width), y: -sprite.height, vy: speed * (.85 + Math.random() * .3) });
      };

      const end = (won) => {
        running = false;
        cancelAnimationFrame(frame);
        if (won) {
          ctx.win(Math.max(1, lives));
          return;
        }
        overlayText.innerHTML = "As nuvens de saudade venceram dessa vez.<br />Respira e tenta de novo!";
        startButton.textContent = "↻ tentar de novo";
        overlay.hidden = false;
      };

      const update = (dt) => {
        elapsed += dt;
        spawnIn -= dt;
        if (spawnIn <= 0) {
          spawn();
          spawnIn = Math.max(.32, .85 - elapsed / 60) * (.7 + Math.random() * .6);
        }
        player.x += (player.target - player.x) * Math.min(1, dt * 14);
        const top = height - player.h - 12;
        items = items.filter((item) => {
          item.y += item.vy * dt;
          const sprite = sprites[item.kind];
          const hit = item.y + sprite.height > top + 10 && item.y < height - 16 && Math.abs(item.x - player.x) < (player.w + sprite.width) / 2 - 8;
          if (hit) {
            if (item.kind === "cloud") {
              lives -= 1;
              hurtFlash = .25;
              livesEl.innerHTML = heartsMarkup(lives, maxLives);
              sound.play("hurt");
              haptic([30, 40, 30]);
            } else {
              score = Math.min(goal, score + (item.kind === "star" ? 2 : 1));
              scoreEl.textContent = `${score}/${goal}`;
              sound.play("coin");
              haptic(8);
            }
            return false;
          }
          return item.y < height + 10;
        });
        if (score >= goal) end(true);
        else if (lives <= 0) end(false);
      };

      const draw = () => {
        context.clearRect(0, 0, width, height);
        items.forEach((item) => {
          const sprite = sprites[item.kind];
          context.drawImage(sprite, Math.round(item.x - sprite.width / 2), Math.round(item.y));
        });
        const top = height - player.h - 12;
        context.fillStyle = "rgba(107,69,100,.18)";
        context.fillRect(player.x - player.w / 2 + 4, height - 10, player.w - 8, 5);
        if (potion.complete && potion.naturalWidth) context.drawImage(potion, player.x - player.w / 2, top, player.w, player.h);
        if (hurtFlash > 0) {
          context.fillStyle = `rgba(233,135,173,${hurtFlash * 1.6})`;
          context.fillRect(0, 0, width, height);
        }
      };

      const loop = (time) => {
        const dt = Math.min(.05, (time - lastTime) / 1000 || 0);
        lastTime = time;
        hurtFlash = Math.max(0, hurtFlash - dt);
        update(dt);
        draw();
        if (running) frame = requestAnimationFrame(loop);
      };

      const start = () => {
        reset();
        overlay.hidden = true;
        running = true;
        lastTime = performance.now();
        frame = requestAnimationFrame(loop);
      };

      const moveTo = (clientX) => {
        const rect = canvas.getBoundingClientRect();
        player.target = Math.max(player.w / 2, Math.min(width - player.w / 2, clientX - rect.left));
      };
      const onPointer = (event) => { if (running) { event.preventDefault(); moveTo(event.clientX); } };
      const onKey = (event) => {
        if (!running) return;
        if (event.key === "ArrowLeft") player.target = Math.max(player.w / 2, player.target - 40);
        if (event.key === "ArrowRight") player.target = Math.min(width - player.w / 2, player.target + 40);
      };
      const resume = () => {
        paused = false;
        overlay.hidden = true;
        running = true;
        lastTime = performance.now();
        frame = requestAnimationFrame(loop);
      };
      const onVisibility = () => {
        if (!document.hidden || !running) return;
        running = false;
        paused = true;
        cancelAnimationFrame(frame);
        overlayText.textContent = "Jogo pausado.";
        startButton.textContent = "▶ continuar";
        overlay.hidden = false;
      };

      reset();
      draw();
      potion.addEventListener("load", draw);
      canvas.addEventListener("pointerdown", onPointer);
      canvas.addEventListener("pointermove", onPointer);
      document.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVisibility);
      startButton.addEventListener("click", () => (paused ? resume() : start()));
      const onResize = () => { resize(); player.x = player.target = Math.min(player.x, width - player.w / 2); if (!running) draw(); };
      window.addEventListener("resize", onResize);

      return () => {
        running = false;
        cancelAnimationFrame(frame);
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onResize);
      };
    }
  };

  /* ---------- Fase 4: labirinto até o Player 2 ---------- */
  const DIRECTIONS = {
    up: { dx: 0, dy: -1, wall: "n", back: "down" },
    down: { dx: 0, dy: 1, wall: "s", back: "up" },
    left: { dx: -1, dy: 0, wall: "w", back: "right" },
    right: { dx: 1, dy: 0, wall: "e", back: "left" }
  };
  const OPPOSITE_WALL = { n: "s", s: "n", e: "w", w: "e" };

  function buildMaze(cols, rows) {
    const cells = Array.from({ length: cols * rows }, () => ({ n: true, e: true, s: true, w: true }));
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const current = stack[stack.length - 1];
      const x = current % cols;
      const y = Math.floor(current / cols);
      const options = shuffle(Object.values(DIRECTIONS)).filter(({ dx, dy }) => {
        const nx = x + dx;
        const ny = y + dy;
        return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen.has(ny * cols + nx);
      });
      if (!options.length) { stack.pop(); continue; }
      const { dx, dy, wall } = options[0];
      const next = (y + dy) * cols + (x + dx);
      cells[current][wall] = false;
      cells[next][OPPOSITE_WALL[wall]] = false;
      seen.add(next);
      stack.push(next);
    }
    return cells;
  }

  const maze = {
    mount(root, level, ctx) {
      const cols = level.game.cols || 7;
      const rows = level.game.rows || 9;
      const starTotal = 3;
      const goal = cols * rows - 1;
      const cells = buildMaze(cols, rows);
      const openDirs = (index) => Object.keys(DIRECTIONS).filter((dir) => !cells[index][DIRECTIONS[dir].wall]);
      const deadEnds = shuffle(cells.map((_, i) => i).filter((i) => i !== 0 && i !== goal && openDirs(i).length === 1));
      const stars = new Set(deadEnds.slice(0, starTotal));
      const visited = new Set([0]);
      const timers = [];
      let player = 0;
      let steps = 0;
      let collected = 0;
      let moving = false;
      let finished = false;

      root.innerHTML = `
        <div class="game-hud"><span>ESTRELAS <b data-stars>0/${starTotal}</b></span><span>PASSOS <b data-steps>0</b></span></div>
        <div class="maze-stage"><canvas role="img" aria-label="Labirinto: deslize ou use as setas para levar o PuppyByte até o coração"></canvas></div>
        <div class="dpad" role="group" aria-label="Controles do labirinto">
          <button class="dpad-up" type="button" data-dir="up" aria-label="Cima">▲</button>
          <button class="dpad-left" type="button" data-dir="left" aria-label="Esquerda">◀</button>
          <button class="dpad-right" type="button" data-dir="right" aria-label="Direita">▶</button>
          <button class="dpad-down" type="button" data-dir="down" aria-label="Baixo">▼</button>
        </div>`;

      const stage = root.querySelector(".maze-stage");
      const canvas = root.querySelector("canvas");
      const context = canvas.getContext("2d");
      const starsEl = root.querySelector("[data-stars]");
      const stepsEl = root.querySelector("[data-steps]");
      const bunny = new Image();
      const heart = new Image();
      bunny.src = "assets/opt/puppybyte.png";
      heart.src = "assets/opt/heart-pixel.png";
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      let cell = 0;
      let starSprite;

      const drawImageIn = (image, index, padding) => {
        if (!image.complete || !image.naturalWidth) return;
        const x = (index % cols) * cell;
        const y = Math.floor(index / cols) * cell;
        const box = cell - padding * 2;
        const ratio = Math.min(box / image.naturalWidth, box / image.naturalHeight);
        const w = image.naturalWidth * ratio;
        const h = image.naturalHeight * ratio;
        context.drawImage(image, x + (cell - w) / 2, y + (cell - h) / 2, w, h);
      };

      const draw = () => {
        context.clearRect(0, 0, cell * cols, cell * rows);
        context.fillStyle = "rgba(233,135,173,.22)";
        visited.forEach((index) => context.fillRect((index % cols) * cell, Math.floor(index / cols) * cell, cell, cell));
        stars.forEach((index) => {
          context.drawImage(starSprite, (index % cols) * cell + (cell - starSprite.width) / 2, Math.floor(index / cols) * cell + (cell - starSprite.height) / 2);
        });
        drawImageIn(heart, goal, cell * .14);

        context.strokeStyle = "#6b4564";
        context.lineWidth = Math.max(3, Math.round(cell * .1));
        context.lineCap = "round";
        context.beginPath();
        cells.forEach((walls, index) => {
          const x = (index % cols) * cell;
          const y = Math.floor(index / cols) * cell;
          if (walls.n) { context.moveTo(x, y); context.lineTo(x + cell, y); }
          if (walls.w) { context.moveTo(x, y); context.lineTo(x, y + cell); }
          if (walls.s && Math.floor(index / cols) === rows - 1) { context.moveTo(x, y + cell); context.lineTo(x + cell, y + cell); }
          if (walls.e && index % cols === cols - 1) { context.moveTo(x + cell, y); context.lineTo(x + cell, y + cell); }
        });
        context.stroke();
        drawImageIn(bunny, player, cell * .08);
      };

      const resize = () => {
        cell = Math.floor(Math.min(stage.clientWidth - 6, 420) / cols);
        canvas.width = cell * cols * dpr;
        canvas.height = cell * rows * dpr;
        canvas.style.width = `${cell * cols}px`;
        canvas.style.height = `${cell * rows}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        starSprite = buildSprite(SPRITES.star, Math.max(2, Math.round(cell / 14)));
        draw();
      };

      const go = (dir) => {
        if (moving || finished) return;
        if (cells[player][DIRECTIONS[dir].wall]) { sound.play("blocked"); haptic(10); return; }
        moving = true;
        let heading = dir;
        const stepOnce = () => {
          const { dx, dy } = DIRECTIONS[heading];
          player += dy * cols + dx;
          visited.add(player);
          steps += 1;
          stepsEl.textContent = steps;
          sound.play("flip");
          if (stars.delete(player)) {
            collected += 1;
            starsEl.textContent = `${collected}/${starTotal}`;
            sound.play("coin");
            haptic(15);
          }
          draw();
          if (player === goal) {
            finished = true;
            moving = false;
            sound.play("success");
            haptic([20, 40, 20]);
            timers.push(setTimeout(() => ctx.win(Math.max(1, collected)), 500));
            return;
          }
          const exits = openDirs(player).filter((option) => option !== DIRECTIONS[heading].back);
          if (exits.length !== 1) { moving = false; return; }
          heading = exits[0];
          timers.push(setTimeout(stepOnce, 70));
        };
        stepOnce();
      };

      let swipeStart = null;
      const onPointerDown = (event) => { swipeStart = { x: event.clientX, y: event.clientY }; };
      const onPointerUp = (event) => {
        if (!swipeStart) return;
        const dx = event.clientX - swipeStart.x;
        const dy = event.clientY - swipeStart.y;
        swipeStart = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
        go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
      };
      const onDpad = (event) => {
        const button = event.target.closest("[data-dir]");
        if (button) { haptic(6); go(button.dataset.dir); }
      };
      const keys = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const onKey = (event) => {
        if (!keys[event.key]) return;
        event.preventDefault();
        go(keys[event.key]);
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointerup", onPointerUp);
      root.querySelector(".dpad").addEventListener("click", onDpad);
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", resize);
      bunny.addEventListener("load", draw);
      heart.addEventListener("load", draw);
      resize();

      return () => {
        timers.forEach(clearTimeout);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", resize);
      };
    }
  };

  /* ---------- Fase 5: cofre com a palavra secreta ---------- */
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const lock = {
    mount(root, level, ctx) {
      const sources = ctx.levels.filter((item) => item.day < level.day && item.keyFragment);
      const missing = sources.filter((item) => !ctx.isCompleted(item.day));
      const timers = [];

      if (missing.length) {
        root.innerHTML = `
          <div class="word-locked">
            <p class="game-message">O cofre precisa de todas as letras-chave.</p>
            <div class="key-inventory">${sources.map((item) => `<span class="key-chip ${ctx.isCompleted(item.day) ? "" : "missing"}">${ctx.isCompleted(item.day) ? escapeHtml(item.keyFragment) : "?"}<small>F${item.day}</small></span>`).join("")}</div>
            <p class="modal-hint">Conclua ${missing.map((item) => `a fase ${item.day}`).join(", ")} para abrir o cofre.</p>
          </div>`;
        return () => {};
      }

      const answer = sources.map((item) => item.keyFragment).join("").toUpperCase();
      const letters = [...answer];
      let hint = shuffle(letters);
      while (letters.length > 1 && hint.join("") === answer) hint = shuffle(letters);
      const positions = letters.map((letter) => {
        let position;
        do { position = Math.floor(Math.random() * ALPHABET.length); } while (ALPHABET[position] === letter);
        return position;
      });
      let tries = 0;
      let opened = false;

      root.innerHTML = `
        <p class="game-message" data-message>Gire as roletas e forme a palavra com as letras que você coletou.</p>
        <div class="key-inventory vault-hint" aria-label="Letras coletadas">${hint.map((letter) => `<span class="key-chip">${escapeHtml(letter)}</span>`).join("")}</div>
        <div class="vault" data-vault>
          <div class="vault-bolts" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div class="vault-reels">
            ${letters.map((_, i) => `
              <div class="reel">
                <button type="button" data-reel="${i}" data-step="-1" aria-label="Roleta ${i + 1}: letra anterior">▲</button>
                <button type="button" class="reel-window" data-reel="${i}" data-step="1"><i data-prev></i><b data-letter></b><i data-next></i></button>
                <button type="button" data-reel="${i}" data-step="1" aria-label="Roleta ${i + 1}: próxima letra">▼</button>
              </div>`).join("")}
          </div>
          <span class="vault-light" aria-hidden="true"></span>
        </div>
        <button class="modal-cta" type="button" data-open>🔓 abrir cofre</button>`;

      const vault = root.querySelector("[data-vault]");
      const messageEl = root.querySelector("[data-message]");
      const reelEls = [...root.querySelectorAll(".reel")];

      const paint = () => reelEls.forEach((reel, i) => {
        const at = (offset) => ALPHABET[(positions[i] + offset + ALPHABET.length) % ALPHABET.length];
        reel.querySelector("[data-prev]").textContent = at(-1);
        reel.querySelector("[data-letter]").textContent = at(0);
        reel.querySelector("[data-next]").textContent = at(1);
        reel.querySelector(".reel-window").setAttribute("aria-label", `Roleta ${i + 1}: ${at(0)}`);
      });

      const onClick = (event) => {
        if (opened) return;
        const control = event.target.closest("[data-reel]");
        if (control) {
          const i = Number(control.dataset.reel);
          positions[i] = (positions[i] + Number(control.dataset.step) + ALPHABET.length) % ALPHABET.length;
          const windowEl = reelEls[i].querySelector(".reel-window");
          windowEl.classList.remove("spin");
          void windowEl.offsetWidth;
          windowEl.classList.add("spin");
          sound.play("flip");
          haptic(6);
          paint();
          return;
        }
        if (!event.target.closest("[data-open]")) return;
        const guess = positions.map((position) => ALPHABET[position]).join("");
        if (guess === answer) {
          opened = true;
          vault.classList.add("opened");
          messageEl.textContent = `${answer} ♥`;
          sound.play("fanfare");
          haptic([20, 50, 20, 50, 80]);
          timers.push(setTimeout(() => ctx.win(tries === 0 ? 3 : tries <= 2 ? 2 : 1), 1300));
          return;
        }
        tries += 1;
        sound.play("wrong");
        haptic([30, 40, 30]);
        shakeElement(vault);
        messageEl.textContent = "Clunk! O cofre continua trancado. Tenta outra ordem.";
      };

      paint();
      root.addEventListener("click", onClick);
      return () => { root.removeEventListener("click", onClick); timers.forEach(clearTimeout); };
    }
  };

  UG.games = { memory, melody, catch: catchGame, maze, lock };
})(window.UG);
