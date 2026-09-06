/* ============================================================
   叠塔 · 经典方块堆叠
   移动方块在塔顶对齐落下；未对齐部分切除；宽度耗尽即失败
   ============================================================ */
(function () {
  "use strict";

  const W = 400, H = 600;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const wrap = document.querySelector(".board-wrap");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("stack-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  const BASE_W = 130;
  const BLOCK_H = 26;
  const GROUND_Y = H - 30;

  const PALETTE = ["#3aa0ff", "#34d399", "#ffd166", "#ff5d6c", "#b06bff", "#22d3ee", "#ff9f43"];

  // 状态
  let state = "ready";       // ready | play | over
  let score = 0;
  let blocks = [];           // 已落方块 {x, w, h, color}（自下而上）
  let cur = null;            // 移动中的方块
  let dir = 1;
  let speed = 0;
  let falling = [];          // 被切掉的碎片
  let shakeT = 0;
  let floatTexts = [];
  let now = 0;
  let overT = 0;
  let lastMs = 0;

  // 塔顶视觉基准：所有 y 都基于 GROUND_Y 向上累计
  function stackTop() {
    return GROUND_Y - score * BLOCK_H;
  }

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function startRound() {
    state = "ready";
    score = 0;
    blocks = [];
    falling = [];
    floatTexts = [];
    shakeT = 0;
    overT = 0;
    blocks.push({ x: (W - BASE_W) / 2, w: BASE_W, color: PALETTE[0] });
    scoreEl.textContent = 0;
    endModal.classList.remove("show");
    spawnNext();
  }

  function spawnNext() {
    const top = blocks[blocks.length - 1];
    speed = 150 + score * 4.5;
    dir = 1;                              // 一律从左向右出发，随后全场往返
    cur = { x: -top.w, w: top.w, color: PALETTE[score % PALETTE.length] };
    state = "play";
  }

  function drop() {
    if (state !== "play" || !cur) return;
    const top = blocks[blocks.length - 1];
    // 重叠区间
    const a = cur.x, b = cur.x + cur.w;
    const c = top.x, d = top.x + top.w;
    const lo = Math.max(a, c), hi = Math.min(b, d);
    const over = hi - lo;
    if (over <= 0.5) {
      // 完全错开 → 失败
      state = "over";
      overT = 0;
      cur = null;
      return;
    }
    const perfect = Math.abs(lo - c) < 2.5 && Math.abs(hi - d) < 2.5;
    let placed = { x: lo, w: over, color: cur.color };
    // 被切掉的一侧掉落
    if (a < lo - 0.5) falling.push({ x: a, w: lo - a, h: BLOCK_H, vy: 0, vx: dir * 40, rot: 0, vr: 6 });
    if (b > hi + 0.5) falling.push({ x: hi, w: b - hi, h: BLOCK_H, vy: 0, vx: dir * 40, rot: 0, vr: -6 });
    blocks.push(placed);
    score += 1;
    scoreEl.textContent = score;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;

    if (perfect) {
      floatTexts.push({ x: W / 2, y: stackTop() - 40, text: "完美！+0", t: 0, color: "#ffd166" });
      placed.perfect = true;
    }
    cur = null;
    spawnNext();
  }

  function update(dt) {
    now += dt;
    shakeT = Math.max(0, shakeT - dt * 3);

    // 移动方块：水平往返滑动，等待玩家点击落下
    if (state === "play" && cur) {
      cur.x += dir * speed * dt;
      if (cur.x >= W) dir = -1;            // 右端出屏 → 折返
      else if (cur.x + cur.w <= 0) dir = 1; // 左端出屏 → 折返
    }

    // 碎片
    falling.forEach((f) => {
      f.vy += 1400 * dt;
      f.fallY = (f.fallY || 0) + f.vy * dt;
      f.fallX = (f.fallX || 0) + f.vx * dt;
      f.rot = (f.rot || 0) + f.vr * dt;
    });

    // 飘字
    floatTexts.forEach((f) => (f.t += dt));
    floatTexts = floatTexts.filter((f) => f.t < 1);

    if (state === "over") {
      overT += dt;
      if (overT > 0.6) showEnd();
    }
  }

  function showEnd() {
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("stack-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = "🧱 塔倒了！";
    endMsg.innerHTML = "叠了 <b>" + score + "</b> 层" +
      (isNew ? "<br>🏆 新纪录！" : "<br>最高纪录 " + best + " 层");
    endModal.classList.add("show");
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * shakeT * 8, 0);

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#101a33");
    g.addColorStop(1, "#0a0f1e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 星星
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 30; i++) {
      const sx = (i * 97) % W, sy = ((i * 53) % (H - 120));
      ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(now + i));
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // 底座平台
    ctx.fillStyle = "#2b3850";
    ctx.fillRect(0, GROUND_Y + BLOCK_H, W, H - GROUND_Y - BLOCK_H);
    ctx.fillStyle = "#3aa0ff55";
    ctx.fillRect((W - BASE_W) / 2 - 6, GROUND_Y + BLOCK_H, BASE_W + 12, 4);

    // 已落方块（含 perfect 闪光）
    blocks.forEach((b, i) => {
      const y = GROUND_Y - i * BLOCK_H;
      drawBlock(b.x, y, b.w, b.color, i === blocks.length - 1 && b.perfect);
    });

    // 移动方块投影（落点提示）
    if (state === "play" && cur) {
      const top = blocks[blocks.length - 1];
      const y = stackTop();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#fff";
      ctx.fillRect(cur.x, y - 2, cur.w, 4);
      ctx.globalAlpha = 1;
    }

    // 当前移动方块
    if (state === "play" && cur) {
      drawBlock(cur.x, stackTop() - BLOCK_H, cur.w, cur.color, false);
      // 边缘高光
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cur.x + 0.5, stackTop() - BLOCK_H + 0.5, cur.w - 1, BLOCK_H - 1);
    }

    // 碎片下落
    falling.forEach((f) => {
      const startY = stackTop() + BLOCK_H;
      const y = startY + f.fallY;
      ctx.save();
      ctx.translate(f.x + f.fallX + f.w / 2, y);
      ctx.rotate(f.rot);
      ctx.fillStyle = f.color;
      ctx.fillRect(-f.w / 2, -BLOCK_H / 2, f.w, BLOCK_H);
      ctx.restore();
    });

    // 飘字
    ctx.textAlign = "center";
    floatTexts.forEach((f) => {
      ctx.globalAlpha = 1 - f.t;
      ctx.fillStyle = f.color;
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(f.text, f.x, f.y - f.t * 40);
    });
    ctx.globalAlpha = 1;

    // 准备 / 结束提示
    if (state === "over" && overT <= 0.6) {
      ctx.fillStyle = "rgba(255,93,108,0.9)";
      ctx.font = "bold 34px sans-serif";
      ctx.fillText("💥", W / 2, 150);
    }
    if (state === "ready") {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("点击开始叠塔", W / 2, 200);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#9adcff";
      ctx.fillText("对准时机落下，越齐越高！", W / 2, 236);
    }
    ctx.restore();
  }

  function drawBlock(x, y, w, color, glow) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, BLOCK_H);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x, y, w, BLOCK_H * 0.35);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, y + BLOCK_H * 0.75, w, BLOCK_H * 0.25);
    if (glow) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(x, y, w, BLOCK_H);
      setTimeout(() => { if (blocks.length) blocks[blocks.length - 1].perfect = false; }, 220);
    }
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
  function tap() {
    // 仅在进行中时落下；错过（完全错开）会判负
    if (state === "play" && cur) drop();
  }
  cv.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); }
    if (e.key === "r" || e.key === "R") { e.preventDefault(); startRound(); }
  });
  againBtn.addEventListener("click", startRound);

  startRound();
  requestAnimationFrame(frame);
})();
