/* ============================================================
   接苹果 · 移动篮子接住掉落苹果
   限时 30 秒；金苹果 +3；连击统计；最高分记录
   ============================================================ */
(function () {
  "use strict";

  const TIME = 30;

  const area = document.getElementById("area");
  const basket = document.getElementById("basket");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("apple-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "count";      // count | play | over
  let timeLeft = TIME;
  let score = 0;
  let combo = 0;
  let comboT = 0;
  let caught = 0;
  let spawnT = 1.0;
  let keys = { left: false, right: false };
  let basketX = 0.5;         // 0..1 归一化位置
  let tickTimer = null;
  let countTimer = null;
  let rafId = null;
  let lastMs = 0;
  let now = 0;

  const items = [];          // {el, x(归一), y, vy, kind, rot}

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function areaSize() { return { w: area.clientWidth, h: area.clientHeight }; }

  function setBasket() {
    basket.style.left = basketX * 100 + "%";
  }

  function spawn() {
    const { w } = areaSize();
    const gold = Math.random() < 0.12;
    const el = document.createElement("div");
    el.className = "apple" + (gold ? " gold" : "");
    el.textContent = gold ? "🍎" : "🍎";
    el.style.left = Math.random() * (w - 36) + "px";
    area.appendChild(el);
    items.push({
      el,
      x: parseFloat(el.style.left),
      y: -40,
      vy: 110 + Math.random() * 90,
      kind: gold ? "gold" : "apple",
      rot: Math.random() * 6.28,
    });
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "part";
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.background = color;
      const a = Math.random() * 6.283, sp = 60 + Math.random() * 180;
      p.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: "translate(" + Math.cos(a) * sp + "px," + (Math.sin(a) * sp + 60) + "px) scale(0.2)", opacity: 0 },
        ],
        { duration: 480 + Math.random() * 160, easing: "ease-out" }
      );
      area.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }
  function floatText(x, y, text, cls) {
    const f = document.createElement("span");
    f.className = "float " + cls;
    f.textContent = text;
    f.style.left = Math.max(2, x - 14) + "px";
    f.style.top = y + "px";
    area.appendChild(f);
    setTimeout(() => f.remove(), 820);
  }

  function catchItem(it) {
    const nowS = now;
    if (nowS - comboT < 1.1) combo += 1; else combo = 1;
    comboT = nowS;
    const pts = it.kind === "gold" ? 3 : 1;
    score += pts;
    caught += 1;
    it.el.classList.add("caught");
    setTimeout(() => it.el.remove(), 340);
    it.dead = true;
    floatText(it.x + 10, it.y - 6, "+" + pts, it.kind === "gold" ? "gold" : "");
    burst(it.x + 18, it.y + 10, it.kind === "gold" ? "#ffd166" : "#ff5d6c", 8);
    scoreEl.textContent = score;
    comboEl.textContent = combo;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;
    basket.classList.remove("catch"); void basket.offsetWidth;
    basket.classList.add("catch");
  }

  function update(dt) {
    now += dt;
    if (state !== "play") return;
    const { w, h } = areaSize();

    // 篮子移动
    const spd = 0.75 * dt; // 归一化速度
    if (keys.left) basketX = Math.max(0.06, basketX - spd);
    if (keys.right) basketX = Math.min(0.94, basketX + spd);
    setBasket();

    // 生成
    spawnT -= dt;
    const gap = Math.max(0.4, 1.05 - score * 0.005);
    if (spawnT <= 0) { spawnT = gap * (0.7 + Math.random() * 0.6); spawn(); }

    // 苹果下落
    const catchZone = h - 64;      // 篮子口纵坐标
    const basketCenter = basketX * w;
    const basketHalf = 48;         // 捕获半宽
    for (const it of items) {
      if (it.dead) continue;
      it.y += it.vy * dt;
      it.rot += 3 * dt;
      it.el.style.top = it.y + "px";
      it.el.style.transform = "rotate(" + it.rot + "rad)";
      // 命中判定：接近篮口且横向重叠
      if (it.y >= catchZone - 6 && Math.abs(it.x + 18 - basketCenter) < basketHalf) {
        catchItem(it);
        continue;
      }
      if (it.y > h + 30) {
        it.el.classList.add("miss");
        setTimeout(() => it.el.remove(), 500);
        it.dead = true;
        combo = 0;
        comboEl.textContent = 0;
      }
    }
    // 清理
    for (let i = items.length - 1; i >= 0; i--) if (items[i].dead) items.splice(i, 1);
  }

  function drawReady() {}

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    if (state === "play") rafId = requestAnimationFrame(frame);
  }

  /* ---------- 流程 ---------- */
  function countShow(t) {
    overlay.textContent = t;
    overlay.classList.remove("pop"); void overlay.offsetWidth;
    overlay.classList.add("pop");
  }
  function startCountdown() {
    state = "count";
    timeLeft = TIME;
    score = 0; combo = 0; caught = 0; spawnT = 1.0;
    keys.left = keys.right = false;
    items.forEach((it) => it.el.remove());
    items.length = 0;
    document.querySelectorAll(".part, .float").forEach((n) => n.remove());
    scoreEl.textContent = 0;
    comboEl.textContent = 0;
    timeEl.textContent = TIME;
    timeEl.classList.remove("danger");
    endModal.classList.remove("show");
    const seq = ["3", "2", "1", "接住它们！"];
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
        clearInterval(tickTimer);
        tickTimer = setInterval(() => {
          if (state !== "play") return;
          timeLeft -= 1;
          timeEl.textContent = timeLeft;
          timeEl.classList.toggle("danger", timeLeft <= 5);
          if (timeLeft <= 0) endGame();
        }, 1000);
      }
    }, 650);
  }

  function endGame() {
    state = "over";
    clearInterval(tickTimer);
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("apple-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = isNew ? "🏆 新纪录！" : "⏰ 时间到！";
    endMsg.innerHTML = "接到 <b>" + caught + "</b> 个苹果 · 得分 <b>" + score + "</b> · 最高连击 " + combo +
      "<br>" + (isNew ? "🏆 新纪录！" : "最高分 " + best);
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
  startCountdown();
})();
