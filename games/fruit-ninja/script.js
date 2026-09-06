/* ============================================================
   水果忍者 · canvas 实现
   滑动切割水果；炸弹即败；漏接扣命；连切加分；刀光轨迹
   ============================================================ */
(function () {
  "use strict";

  const W = 640, H = 480;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const wrap = document.querySelector(".board-wrap");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const FRUITS = [
    { e: "🍉", c: "#ff5d6c" }, { e: "🍊", c: "#ffb23e" }, { e: "🍎", c: "#ff3b52" },
    { e: "🍓", c: "#ff4f6d" }, { e: "🍏", c: "#7ed957" }, { e: "🍌", c: "#ffd93d" },
    { e: "🍇", c: "#b06bff" },
  ];

  let best = 0;
  try { best = parseInt(localStorage.getItem("fruit-ninja-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  // 状态
  const S = {
    state: "ready",       // ready | play | over
    score: 0,
    lives: 3,
    combo: 0,
    comboT: 0,
    maxCombo: 1,
    sliced: 0,
    items: [],            // {kind:'fruit'|'bomb', x,y,vx,vy,e,c,rot,vr,sliced,halves:false}
    juice: [],            // 粒子
    trail: [],            // 刀光 {x,y,t}
    spawnT: 0.8,
    shake: 0,
    overT: 0,
    now: 0,
  };
  let lastMs = 0;

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function setLives() {
    livesEl.textContent = "❤".repeat(Math.max(0, S.lives)) + "🖤".repeat(Math.max(0, 3 - S.lives));
  }

  /* ---------- 生成 ---------- */
  function spawnItem() {
    const bomb = S.score > 8 && Math.random() < 0.12;
    const f = FRUITS[(Math.random() * FRUITS.length) | 0];
    const x = 70 + Math.random() * (W - 140);
    const vy = -(560 + Math.random() * 180);
    const vx = (Math.random() - 0.5) * 260;
    S.items.push({
      kind: bomb ? "bomb" : "fruit",
      x, y: H + 30,
      vx, vy,
      e: bomb ? "💣" : f.e,
      c: bomb ? "#8a8fa0" : f.c,
      r: bomb ? 20 : 24,
      rot: (Math.random() - 0.5) * 0.6,
      vr: (Math.random() - 0.5) * 4,
      sliced: false,
      halves: null,
    });
  }

  /* ---------- 切割判定：点到线段距离 ---------- */
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function sliceItem(it) {
    it.sliced = true;
    if (it.kind === "bomb") {
      bombBurst(it.x, it.y);
      // 切中炸弹 = 立即结束（符合"炸弹即败"的说明）
      loseAll();
    } else {
      // 计分与连击
      const now = S.now;
      if (now - S.comboT < 1.2) S.combo += 1; else S.combo = 1;
      S.comboT = now;
      if (S.combo > S.maxCombo) S.maxCombo = S.combo;
      const pts = S.combo;
      S.score += pts;
      S.sliced += 1;
      scoreEl.textContent = S.score;
      bump(scoreEl);
      if (S.combo >= 2) addFloat(it.x, it.y - 24, "×" + S.combo + " 连切!", "#ffd166");
      addFloat(it.x, it.y, "+" + pts, "#fff");
      if (S.score > best) bestEl.textContent = S.score;
      // 果汁粒子
      juice(it.x, it.y, it.c, 14);
      // 两半飞散（视觉上 emoji 旋转分飞）
      it.halves = [
        { x: it.x, y: it.y, vx: it.vx - 90, vy: it.vy - 60, e: it.e, rot: it.rot },
        { x: it.x, y: it.y, vx: it.vx + 90, vy: it.vy - 40, e: it.e, rot: it.rot + 3 },
      ];
    }
  }

  function juice(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 80 + Math.random() * 240;
      S.juice.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.55, t: 0, c: color });
    }
  }
  function bombBurst(x, y) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * 6.283, sp = 60 + Math.random() * 300;
      S.juice.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, t: 0, c: Math.random() < 0.5 ? "#ffb23e" : "#5b5f6e" });
    }
    addFloat(x, y - 20, "💥 炸弹！", "#ff5d6c");
    S.shake = 1;
  }

  function loseLife(x, y) {
    S.lives -= 1;
    setLives();
    wrap.classList.remove("bad"); void wrap.offsetWidth;
    wrap.classList.add("bad");
    if (S.lives <= 0) {
      S.state = "over";
      S.overT = 0;
    }
  }

  function loseAll() {
    S.lives = 0;
    setLives();
    wrap.classList.remove("bad"); void wrap.offsetWidth;
    wrap.classList.add("bad");
    S.state = "over";
    S.overT = 0;
  }

  function addFloat(x, y, text, color) {
    S.juice.push({ float: true, x, y, text, color, t: 0, life: 0.85 });
  }

  /* ---------- 更新 ---------- */
  function update(dt) {
    S.now += dt;
    S.shake = Math.max(0, S.shake - dt * 2.4);

    if (S.state === "ready") return;

    // 生成
    S.spawnT -= dt;
    const gap = Math.max(0.55, 1.25 - S.score * 0.004);
    if (S.spawnT <= 0) {
      S.spawnT = gap * (0.75 + Math.random() * 0.5);
      spawnItem();
      if (S.score > 40 && Math.random() < 0.25) spawnItem(); // 双飞
    }

    // 物理
    const G = 1500;
    S.items.forEach((it) => {
      if (it.sliced) return;
      it.vy += G * dt;
      it.x += it.vx * dt;
      it.y += it.vy * dt;
      it.rot += it.vr * dt;
    });
    // 半片
    S.items.forEach((it) => {
      if (it.halves) {
        it.halves.forEach((h) => {
          h.vy += G * 0.7 * dt;
          h.x += h.vx * dt;
          h.y += h.vy * dt;
          h.rot += 7 * dt;
        });
        if (it.halves[0].y > H + 60) it.halves = null;
      }
    });
    // 移除（漏接扣命只针对未切水果）
    S.items = S.items.filter((it) => {
      if (it.sliced && !it.halves) return false;
      if (!it.sliced && it.y > H + 60) {
        if (it.kind === "fruit" && S.state === "play") loseLife(it.x, H - 20);
        return false;
      }
      return true;
    });
    // 粒子
    S.juice.forEach((p) => {
      p.t += dt;
      if (!p.float) {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    });
    S.juice = S.juice.filter((p) => p.t < p.life);
    // 刀光
    S.trail.forEach((t) => (t.t += dt));
    S.trail = S.trail.filter((t) => t.t < 0.16);

    if (S.state === "over") {
      S.overT += dt;
      if (S.overT > 0.8) showEnd();
    }
  }

  /* ---------- 切割处理 ---------- */
  function cut(x1, y1, x2, y2) {
    if (S.state !== "play") return;
    S.trail.push({ x: x2, y: y2, t: 0 });
    S.items.forEach((it) => {
      if (it.sliced) return;
      const d = segDist(it.x, it.y, x1, y1, x2, y2);
      if (d < it.r + 6) sliceItem(it);
    });
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 14, (Math.random() - 0.5) * S.shake * 14);

    // 背景渐变
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a1038");
    bg.addColorStop(1, "#0a0818");
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -12, W + 24, H + 24);

    // 装饰圆点
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#9aa7bd";
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.arc(((i * 97 + 30) % W), ((i * 53 + 20) % H), 1.5 + (i % 3), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 刀光轨迹
    if (S.trail.length > 1) {
      ctx.lineCap = "round";
      for (let i = 1; i < S.trail.length; i++) {
        const a = S.trail[i - 1], b = S.trail[i];
        ctx.strokeStyle = "rgba(255,255,255," + (0.5 * (1 - b.t / 0.16)) + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // 果汁 / 飘字
    S.juice.forEach((p) => {
      const a = 1 - p.t / p.life;
      if (p.float) {
        ctx.globalAlpha = a;
        ctx.font = "bold 17px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y - p.t * 46);
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
      }
    });
    ctx.globalAlpha = 1;

    // 水果 / 炸弹
    ctx.textAlign = "center";
    S.items.forEach((it) => {
      if (it.halves) {
        it.halves.forEach((h) => {
          ctx.save();
          ctx.translate(h.x, h.y);
          ctx.rotate(h.rot);
          ctx.globalAlpha = 0.92;
          ctx.font = "34px sans-serif";
          ctx.fillText(h.e, 0, 11);
          ctx.restore();
        });
        return;
      }
      if (it.sliced) return;
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot);
      // 水果光晕
      const pulse = 1 + Math.sin(S.now * 5 + it.x) * 0.05;
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = it.c;
      ctx.beginPath();
      ctx.arc(0, 0, it.r + 8, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = (it.kind === "bomb" ? "36px" : "46px") + " sans-serif";
      ctx.fillText(it.e, 0, 13);
      ctx.restore();
    });
    ctx.globalAlpha = 1;

    // 提示文字
    ctx.textAlign = "center";
    if (S.state === "ready") {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("🍉 水果忍者", W / 2, H / 2 - 70);
      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#ffe9b3";
      ctx.fillText("按住鼠标 / 手指滑动切割水果", W / 2, H / 2 - 32);
      ctx.fillText("切中 💣 炸弹立即失败 · 漏接水果扣命", W / 2, H / 2 - 4);
      ctx.fillStyle = "#9adcff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("点击任意处开始", W / 2, H / 2 + 40);
    }
    ctx.restore();
  }

  /* ---------- 结束 ---------- */
  function showEnd() {
    const isNew = S.score > best;
    if (isNew) {
      best = S.score;
      try { localStorage.setItem("fruit-ninja-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = "💥 游戏结束";
    endMsg.innerHTML =
      "得分 <b>" + S.score + "</b> · 切中 " + S.sliced + " 个 · 最大连切 ×" + S.maxCombo +
      "<br>" + (isNew ? "🏆 新纪录！" : "最高分 " + best);
    endModal.classList.add("show");
  }

  function reset() {
    S.state = "ready";
    S.score = 0; S.lives = 3; S.combo = 0; S.maxCombo = 1; S.sliced = 0;
    S.items = []; S.juice = []; S.trail = []; S.spawnT = 0.8; S.shake = 0;
    scoreEl.textContent = 0;
    setLives();
    endModal.classList.remove("show");
  }

  function beginPlay() {
    if (S.state === "ready") S.state = "play";
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  let lastPt = null;
  function getPos(e) {
    const rect = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  }
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    beginPlay();
    lastPt = getPos(e);
    S.trail.push({ x: lastPt.x, y: lastPt.y, t: 0 });
  });
  cv.addEventListener("pointermove", (e) => {
    if (!lastPt) return;
    const p = getPos(e);
    if (S.state === "play") cut(lastPt.x, lastPt.y, p.x, p.y);
    lastPt = p;
  });
  window.addEventListener("pointerup", () => { lastPt = null; });

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); }
    if (e.key === " " || e.key === "Enter") beginPlay();
  });
  againBtn.addEventListener("click", reset);

  reset();
  requestAnimationFrame(frame);
})();
