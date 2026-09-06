/* ============================================================
   扎气球 · 限时点击挑战
   普通 🎈 +1 / 金色 ✨ +5 / 炸弹 💣 -3；30 秒倒计时
   ============================================================ */
(function () {
  "use strict";

  const TIME = 30;
  const COLORS = [
    ["#ff5d6c", "#ff9aa3"], ["#3aa0ff", "#8cc4ff"], ["#34d399", "#8cebc4"],
    ["#b06bff", "#d3abff"], ["#ffb23e", "#ffd493"], ["#22d3ee", "#8cecfc"],
  ];

  const area = document.getElementById("area");
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
  try { best = parseInt(localStorage.getItem("balloon-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "count";       // count | play | over
  let timeLeft = TIME;
  let score = 0;
  let combo = 0;
  let hits = 0;
  let spawnGap = 900;        // ms
  let spawnAcc = 0;
  let parts = [];
  let floats = 0;
  let rafId = null;
  let last = 0;
  let countTimer = null;

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function areaSize() { return { w: area.clientWidth, h: area.clientHeight }; }

  /* ---------- 生成气球 ---------- */
  function spawnBalloon() {
    const { w } = areaSize();
    const roll = Math.random();
    const el = document.createElement("div");
    let kind = "normal", speed, size = 46;
    if (roll < 0.1) { kind = "bomb"; speed = 46 + Math.random() * 30; }
    else if (roll < 0.19) { kind = "gold"; speed = 66 + Math.random() * 40; }
    else { kind = "normal"; speed = 40 + Math.random() * 55; }

    // 随时间整体略加快
    const boost = 1 + (TIME - timeLeft) / 26;

    const colors = COLORS[(Math.random() * COLORS.length) | 0];
    el.className = "balloon " + kind;
    el.style.setProperty("--c", colors[0]);
    el.style.setProperty("--hi", colors[1]);
    if (kind === "normal") {
      el.style.left = 6 + Math.random() * (w - size - 12) + "px";
    } else {
      el.style.left = 6 + Math.random() * (w - 40) + "px";
      if (kind === "gold") size = 34;
      if (kind === "bomb") { el.textContent = "💣"; size = 46; }
    }
    el.dataset.kind = kind;
    area.appendChild(el);

    const obj = { el, kind, y: -70, speed: speed * boost, wob: Math.random() * 6.28, wobAmp: kind === "normal" ? 14 : 6 };
    el.dataset.wobAmp = String(obj.wobAmp);
    el.dataset.speed = String(obj.speed);
    el.dataset.wob = String(obj.wob);
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (state !== "play") return;
      pop(obj, e.clientX, e.clientY);
    });
    return obj;
  }

  function getBalls() {
    return Array.from(area.querySelectorAll(".balloon")).map((el) => ({
      el,
      kind: el.dataset.kind,
      y: parseFloat(el.dataset.y || "-70"),
      speed: parseFloat(el.dataset.speed || "60"),
      wob: parseFloat(el.dataset.wob || "0"),
      wobAmp: parseFloat(el.dataset.wobAmp || "14"),
    }));
  }

  /* ---------- 粒子 & 飘字 ---------- */
  function burst(x, y, color, n, big) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement("span");
      p.className = "part" + (big ? " big" : "");
      p.style.left = x + "px";
      p.style.top = y + "px";
      p.style.background = color;
      const ang = Math.random() * 6.283, sp = 90 + Math.random() * 200;
      p.animate(
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          { transform: "translate(" + Math.cos(ang) * sp + "px," + Math.sin(ang) * sp + "px) scale(0.3)", opacity: 0 },
        ],
        { duration: 520 + Math.random() * 180, easing: "ease-out" }
      );
      area.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }
  function floatText(x, y, text, cls) {
    const f = document.createElement("span");
    f.className = "float " + cls;
    f.textContent = text;
    f.style.left = Math.max(2, x - 16) + "px";
    f.style.top = y - 10 + "px";
    area.appendChild(f);
    setTimeout(() => f.remove(), 820);
  }

  /* ---------- 扎破 ---------- */
  function pop(obj, cx, cy) {
    const rect = area.getBoundingClientRect();
    const x = cx - rect.left, y = cy - rect.top;
    let color;
    if (obj.kind === "bomb") {
      score = Math.max(0, score - 3);
      combo = 0;
      color = "#ff5d6c";
      area.classList.remove("bad"); void area.offsetWidth; area.classList.add("bad");
      floatText(x, y, "-3", "bad");
      burst(x, y, "#ff5d6c", 14, true);
    } else if (obj.kind === "gold") {
      score += 5; combo += 1;
      color = "#ffd166";
      floatText(x, y, "+5 ✨", "gold");
      burst(x, y, "#ffd166", 16, true);
    } else {
      score += 1; combo += 1;
      color = obj.el.style.getPropertyValue("--c") || "#fff";
      floatText(x, y, combo > 3 ? "+1 ×" + combo : "+1", "good");
      burst(x, y, color, 10, false);
    }
    hits += 1;
    obj.el.remove();
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    comboEl.textContent = combo;
    if (score > best) bestEl.textContent = score;
    bump(scoreEl);
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    if (state !== "play") return;
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    const { h } = areaSize();

    // 生成
    spawnAcc += dt * 1000;
    if (spawnAcc >= spawnGap) {
      spawnAcc = 0;
      getBalls();
      spawnBalloon();
      // 后期偶尔一次出两个
      if (score > 60 && Math.random() < 0.3) spawnBalloon();
    }

    // 上浮 & 摆动
    getBalls().forEach((b) => {
      b.y += b.speed * dt;
      b.wob += 2.2 * dt;
      b.el.dataset.y = String(b.y);
      b.el.dataset.speed = String(b.speed);
      b.el.dataset.wob = String(b.wob);
      const wob = b.kind === "bomb" ? 0 : Math.sin(b.wob) * b.wobAmp;
      b.el.style.transform = "translateX(" + wob + "px) rotate(" + (Math.sin(b.wob) * 4) + "deg)";
      b.el.style.bottom = b.y + "px";
      if (b.y > h + 40) b.el.remove();
    });

    // 粒子推进
    parts.forEach((p) => {
      p.t += dt;
      if (p.t > 0.6) { p.el.remove(); p.dead = true; }
    });
    parts = parts.filter((p) => !p.dead);

    rafId = requestAnimationFrame(frame);
  }

  /* ---------- 流程 ---------- */
  function countdownShow(text) {
    overlay.textContent = text;
    overlay.classList.remove("pop"); void overlay.offsetWidth;
    overlay.classList.add("pop");
  }
  function startCountdown() {
    state = "count";
    timeLeft = TIME;
    score = 0; combo = 0; hits = 0;
    spawnGap = 900; spawnAcc = 300;
    document.querySelectorAll(".balloon, .part, .float").forEach((n) => n.remove());
    scoreEl.textContent = 0; comboEl.textContent = 0;
    timeEl.textContent = TIME;
    timeEl.classList.remove("danger");
    endModal.classList.remove("show");
    const seq = ["3", "2", "1", "🎈 开始！"];
    let i = 0;
    countdownShow(seq[0]);
    clearInterval(countTimer);
    countTimer = setInterval(() => {
      i += 1;
      if (i < seq.length) countdownShow(seq[i]);
      else {
        clearInterval(countTimer);
        overlay.textContent = "";
        state = "play";
        last = performance.now();
        spawnBalloon();
        cancelAnimationFrame(rafId);
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
  let tickTimer = null;

  function endGame() {
    state = "over";
    clearInterval(tickTimer);
    cancelAnimationFrame(rafId);
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("balloon-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = isNew ? "🏆 新纪录！" : "⏰ 时间到！";
    endMsg.innerHTML = "得分 <b>" + score + "</b> · 扎破 " + hits + " 个 · 最高连击 " + combo + "<br>最高分 " + best;
    endModal.classList.add("show");
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); startCountdown(); }
  });
  againBtn.addEventListener("click", startCountdown);

  startCountdown();
})();
