/* ============================================================
   飞扬的小鸟 · canvas 实现
   点击/空格扇翅；穿管道 +1；碰撞结束；奖牌与最高分记录
   ============================================================ */
(function () {
  "use strict";

  const W = 420, H = 640;
  const GROUND = 580;        // 地面顶部
  const GRAVITY = 1500;
  const FLAP = -430;
  const PIPE_W = 72;

  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("flappy-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  // 状态
  let state = "ready";       // ready | play | dead
  let score = 0;
  let time = 0;
  let bird = { x: 150, y: H * 0.42, vy: 0 };
  let pipes = [];
  let pipeTimer = 0;
  let speed = 150;
  let groundOff = 0;
  let shake = 0;
  let last = 0;
  let rafId = null;
  let deathAt = 0;

  // 云
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    clouds.push({ x: Math.random() * W, y: 40 + Math.random() * 180, s: 0.6 + Math.random() * 0.8, v: 8 + Math.random() * 12 });
  }

  const medal = (s) => (s >= 50 ? "🥇 金" : s >= 25 ? "🥈 银" : s >= 10 ? "🥉 铜" : "—");

  /* ---------- 辅助 ---------- */
  function reset() {
    score = 0;
    bird = { x: 150, y: H * 0.42, vy: 0 };
    pipes = [];
    pipeTimer = 1.1;
    speed = 150;
    shake = 0;
    state = "ready";
    scoreEl.textContent = 0;
    endModal.classList.remove("show");
  }

  function flap() {
    if (state === "ready") {
      state = "play";
      last = performance.now();
    }
    if (state === "play") bird.vy = FLAP;
  }

  function gapHeight() { return Math.max(132, 172 - score * 1.6); }

  /* ---------- 更新 ---------- */
  function update(dt) {
    time += dt;

    // 云
    clouds.forEach((c) => {
      c.x -= c.v * dt;
      if (c.x < -90) { c.x = W + 80; c.y = 30 + Math.random() * 200; }
    });

    if (state === "ready") {
      // 小鸟悬停浮动
      bird.y = H * 0.42 + Math.sin(time * 3) * 8;
      return;
    }
    if (state === "dead") {
      // 坠落动画
      bird.vy += GRAVITY * dt;
      bird.y += bird.vy * dt;
      if (bird.y > GROUND - 12) { bird.y = GROUND - 12; cancelAnimationFrame(rafId); showEnd(); }
      return;
    }

    // 小鸟物理
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;

    // 管道
    pipeTimer -= dt;
    if (pipeTimer <= 0) {
      pipeTimer = Math.max(1.35, 1.9 - score * 0.012);
      const gap = gapHeight();
      const gy = 70 + Math.random() * (GROUND - 160 - gap);
      pipes.push({ x: W + 10, gapY: gy, gapH: gap, passed: false });
    }
    pipes.forEach((p) => (p.x -= speed * dt));

    // 记分
    pipes.forEach((p) => {
      if (!p.passed && p.x + PIPE_W < bird.x) {
        p.passed = true;
        score += 1;
        scoreEl.textContent = score;
        scoreEl.classList.remove("bump"); void scoreEl.offsetWidth;
        scoreEl.classList.add("bump");
        if (score > best) bestEl.textContent = score;
      }
    });
    pipes = pipes.filter((p) => p.x > -PIPE_W - 20);

    // 速度随分数
    speed = Math.min(260, 150 + score * 1.4);

    // 地面滚动
    groundOff = (groundOff + speed * dt) % 24;

    // 碰撞
    const r = 13;
    for (const p of pipes) {
      if (bird.x + r > p.x && bird.x - r < p.x + PIPE_W) {
        if (bird.y - r < p.gapY || bird.y + r > p.gapY + p.gapH) { die(); return; }
      }
    }
    if (bird.y + r >= GROUND || bird.y - r < 0) { die(); }
  }

  function die() {
    if (state !== "play") return;
    state = "dead";
    shake = 1;
    deathAt = time;
    bird.vy = -260;   // 轻微弹起再坠落
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // 震屏
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake * 8, (Math.random() - 0.5) * shake * 8);
      shake = Math.max(0, shake - 0.04);
    }

    // 天空
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#7ed0ff");
    sky.addColorStop(1, "#d8f2ff");
    ctx.fillStyle = sky;
    ctx.fillRect(-10, -10, W + 20, H + 20);

    // 云
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    clouds.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22 * c.s, 0, 7);
      ctx.arc(c.x + 18 * c.s, c.y + 6 * c.s, 16 * c.s, 0, 7);
      ctx.arc(c.x - 18 * c.s, c.y + 6 * c.s, 16 * c.s, 0, 7);
      ctx.fill();
    });

    // 管道
    pipes.forEach((p) => {
      drawPipe(p.x, 0, p.gapY - 2, "#3fbf5f", "#2f9e4a");
      drawPipe(p.x, p.gapY + p.gapH + 2, GROUND - (p.gapY + p.gapH + 2), "#3fbf5f", "#2f9e4a");
    });

    // 地面
    ctx.fillStyle = "#e8c97e";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#d4a94f";
    for (let x = -24 + groundOff; x < W; x += 24) {
      ctx.fillRect(x, GROUND, 12, H - GROUND);
    }

    // 小鸟
    const ang = Math.max(-1.25, Math.min(1.25, (bird.vy / 700) * 1.6));
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(ang);
    // 身体
    ctx.fillStyle = "#ffd93d";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#d99a1b";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 翅膀（扇动）
    const wing = Math.sin(time * (state === "play" ? 16 : 6)) * 0.8;
    ctx.save();
    ctx.translate(-4, 2);
    ctx.rotate(wing * 0.9);
    ctx.fillStyle = "#f7b733";
    ctx.beginPath();
    ctx.ellipse(-9, 0, 9, 6, 0.4, 0, 7);
    ctx.fill();
    ctx.restore();
    // 眼睛
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(7, -5, 5, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(8.5, -5, 2.4, 0, 7);
    ctx.fill();
    // 嘴
    ctx.fillStyle = "#ff7a3d";
    ctx.beginPath();
    ctx.moveTo(13, 1);
    ctx.lineTo(22, 3);
    ctx.lineTo(13, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 状态文字
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(20,30,50,0.75)";
    if (state === "ready") {
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("🐤 飞扬的小鸟", W / 2, 200);
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("点击 / 空格 扇翅起飞", W / 2, 238);
      ctx.fillText("穿过管道得分", W / 2, 264);
    } else if (state === "dead") {
      // 无
    }
    ctx.restore();
  }

  function drawPipe(x, y, h, c, edge) {
    if (h <= 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, PIPE_W, h);
    // 帽
    ctx.fillRect(x - 4, y, PIPE_W + 8, 24);
    ctx.fillStyle = edge;
    ctx.fillRect(x + 4, y, 6, h);
    ctx.fillRect(x + PIPE_W - 10, y, 6, h);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(x + 12, y, 5, h);
  }

  /* ---------- 结束 ---------- */
  function showEnd() {
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("flappy-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = score >= 10 ? "🎉 玩得不错！" : "💥 撞到了！";
    endMsg.innerHTML =
      "得分 <b>" + score + "</b> · 奖牌：" + medal(score) + "<br>" +
      (isNew ? "🏆 新纪录！" : "最高分 " + best);
    endModal.classList.add("show");
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (state !== "dead" || bird.y < GROUND - 12) update(dt);
    else update(dt); // dead 时仅掉落
    draw();
    if (!(state === "dead" && bird.y >= GROUND - 12)) rafId = requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  function onInput(e) {
    if (e.type === "keydown") {
      if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); flap(); }
    } else {
      flap();
    }
  }
  document.addEventListener("keydown", (e) => {
    // 空格 / ↑ 扇翅
    if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); flap(); }
    // R 重开
    if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); startLoop(); }
  });
  cv.addEventListener("pointerdown", onInput);

  againBtn.addEventListener("click", () => { reset(); startLoop(); });

  /* ---------- 启动 ---------- */
  function startLoop() {
    cancelAnimationFrame(rafId);
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  reset();
  startLoop();
})();
