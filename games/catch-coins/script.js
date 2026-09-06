/* ============================================================
   接金币 · 接金币避炸弹
   🪙 +1 / 💰 +5 / 💣 扣 1 命；3 条命；速度随得分加快
   ============================================================ */
(function () {
  "use strict";

  const area = document.getElementById("area");
  const basket = document.getElementById("basket");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("coins-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "count";     // count | play | over
  let score = 0;
  let lives = 3;
  let spawnT = 0.9;
  let keys = { left: false, right: false };
  let basketX = 0.5;
  let countTimer = null;
  let rafId = null;
  let lastMs = 0;
  let now = 0;
  let overT = 0;

  const items = [];

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function setLives() { livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives)); }
  function setBasket() { basket.style.left = basketX * 100 + "%"; }
  function areaSize() { return { w: area.clientWidth, h: area.clientHeight }; }

  function spawn() {
    const { w } = areaSize();
    // 类型权重：随分数升高炸弹比例略增
    const bombChance = Math.min(0.3, 0.08 + score * 0.0012);
    const purseChance = 0.07;
    const r = Math.random();
    let kind = "coin", sym = "🪙";
    if (r < bombChance) { kind = "bomb"; sym = "💣"; }
    else if (r < bombChance + purseChance) { kind = "purse"; sym = "💰"; }
    const el = document.createElement("div");
    el.className = "item";
    el.textContent = sym;
    el.style.left = Math.random() * (w - 34) + "px";
    area.appendChild(el);
    const speedBase = 120 + score * 0.6;
    items.push({
      el, kind,
      x: parseFloat(el.style.left),
      y: -40,
      vy: speedBase * (0.7 + Math.random() * 0.6),
      rot: Math.random() * 6.28,
    });
  }

  function fx(x, y, text, cls, color) {
    const f = document.createElement("span");
    f.className = "float " + (cls || "");
    f.textContent = text;
    if (color) f.style.color = color;
    f.style.left = Math.max(2, x - 14) + "px";
    f.style.top = y + "px";
    area.appendChild(f);
    setTimeout(() => f.remove(), 820);
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "part";
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.background = color;
      const a = Math.random() * 6.283, sp = 70 + Math.random() * 200;
      p.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: "translate(" + Math.cos(a) * sp + "px," + (Math.sin(a) * sp + 70) + "px) scale(0.2)", opacity: 0 },
        ],
        { duration: 500 + Math.random() * 160, easing: "ease-out" }
      );
      area.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }

  function catchItem(it) {
    if (it.kind === "bomb") {
      it.el.classList.add("bombHit");
      setTimeout(() => it.el.remove(), 400);
      lives -= 1;
      setLives();
      area.classList.remove("bad"); void area.offsetWidth;
      area.classList.add("bad");
      burst(it.x + 16, it.y + 10, "#ff5d6c", 16);
      fx(it.x + 16, it.y, "💥 -1 命", "bad");
      if (lives <= 0) {
        state = "over";
        overT = 0;
      }
    } else {
      const pts = it.kind === "purse" ? 5 : 1;
      score += pts;
      it.el.classList.add("caught");
      setTimeout(() => it.el.remove(), 320);
      burst(it.x + 16, it.y + 10, it.kind === "purse" ? "#ffd166" : "#f5c542", it.kind === "purse" ? 14 : 8);
      fx(it.x + 16, it.y, "+" + pts);
      scoreEl.textContent = score;
      bump(scoreEl);
      if (score > best) bestEl.textContent = score;
      basket.classList.remove("catch"); void basket.offsetWidth;
      basket.classList.add("catch");
    }
    it.dead = true;
  }

  function update(dt) {
    now += dt;
    if (state === "count") return;
    if (state === "over") { overT += dt; if (overT > 0.7) showEnd(); return; }
    const { w, h } = areaSize();

    const spd = 0.75 * dt;
    if (keys.left) basketX = Math.max(0.06, basketX - spd);
    if (keys.right) basketX = Math.min(0.94, basketX + spd);
    setBasket();

    spawnT -= dt;
    if (spawnT <= 0) { spawnT = Math.max(0.35, 0.9 - score * 0.004) * (0.7 + Math.random() * 0.6); spawn(); }

    const catchZone = h - 64;
    const basketCenter = basketX * w;
    const basketHalf = 48;
    for (const it of items) {
      if (it.dead) continue;
      it.y += it.vy * dt;
      it.rot += 3 * dt;
      it.el.style.top = it.y + "px";
      it.el.style.transform = "rotate(" + it.rot + "rad)";
      if (it.y >= catchZone - 6 && Math.abs(it.x + 17 - basketCenter) < basketHalf) {
        catchItem(it);
        continue;
      }
      if (it.y > h + 30) { it.el.remove(); it.dead = true; }
    }
    for (let i = items.length - 1; i >= 0; i--) if (items[i].dead) items.splice(i, 1);
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    if (state === "play" || state === "over") rafId = requestAnimationFrame(frame);
  }

  /* ---------- 流程 ---------- */
  function countShow(t) {
    overlay.textContent = t;
    overlay.classList.remove("pop"); void overlay.offsetWidth;
    overlay.classList.add("pop");
  }
  function startCountdown() {
    state = "count";
    score = 0; lives = 3; spawnT = 0.8; overT = 0;
    keys.left = keys.right = false;
    items.forEach((it) => it.el.remove());
    items.length = 0;
    document.querySelectorAll(".part, .float").forEach((n) => n.remove());
    scoreEl.textContent = 0;
    setLives();
    endModal.classList.remove("show");
    const seq = ["3", "2", "1", "开接！"];
    let i = 0;
    countShow(seq[0]);
    clearInterval(countTimer);
    countTimer = setInterval(() => {
      i += 1;
      if (i < seq.length) countShow(seq[i]);
      else {
        clearInterval(countTimer);
        overlay.textContent = "";
        state = "play";
        lastMs = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    }, 650);
  }

  function showEnd() {
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("coins-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = "💥 接住炸弹了！";
    endMsg.innerHTML = "得分 <b>" + score + "</b>" + (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
    endModal.classList.add("show");
  }

  /* ---------- 输入 ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); startCountdown(); return; }
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });
  area.addEventListener("pointermove", (e) => {
    if (state !== "play") return;
    const rect = area.getBoundingClientRect();
    basketX = Math.max(0.06, Math.min(0.94, (e.clientX - rect.left) / rect.width));
    setBasket();
  });
  againBtn.addEventListener("click", startCountdown);

  setBasket();
  setLives();
  startCountdown();
})();
