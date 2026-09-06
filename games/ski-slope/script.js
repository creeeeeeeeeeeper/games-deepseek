/* ============================================================
   滑雪大冒险 · 竞速冒险（单人无尽变道）
   雪坡持续下滑，三车道变道，躲障碍 + 吃星星
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const distEl = document.getElementById("dist");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 400, H = 520;
  canvas.width = W; canvas.height = H;

  const LANES = 3, LANE_W = W / LANES;
  const SKIER_W = 34, SKIER_H = 40;
  const BEST_KEY = "ski-slope-best";

  let lane = 1, targetLane = 1, score = 0, dist = 0, best = 0, over = false;
  let speed = 260, lastSpeed = 260;
  let obstacles = [], stars = [];
  let raf = 0, last = 0, scroll = 0;
  let keys = { left: false, right: false };

  function reset() {
    obstacles = []; stars = []; lane = 1; targetLane = 1;
    score = 0; dist = 0; speed = 260; lastSpeed = 260; over = false; scroll = 0;
  }

  function spawnFlag() {
    // 里程：随时间增长
    dist += speed / 1000;
    const t = performance.now();
    // 障碍生成
    if (Math.random() < 0.006 * (speed / 260)) {
      const l = (Math.random() * LANES) | 0;
      obstacles.push({ lane: l, y: -80, h: 44, w: 40, kind: Math.random() < 0.3 ? "ice" : "tree" });
    }
    // 星星
    if (Math.random() < 0.004) {
      const l = (Math.random() * LANES) | 0;
      stars.push({ lane: l, y: -60 });
    }
  }

  function update(dt) {
    if (over) return;
    // 加速：越来越快，直到一个上限
    lastSpeed = speed;
    speed = Math.min(speed + dt * 9, 620);
    const acc = speed / 260;

    // 变道过渡
    if (lane < targetLane) lane = Math.min(targetLane, lane + dt * 7);
    else if (lane > targetLane) lane = Math.max(targetLane, lane - dt * 7);

    scroll += speed * dt;
    // 障碍 & 星星下落
    for (const o of obstacles) o.y += speed * dt;
    for (const s of stars) s.y += speed * dt;
    obstacles = obstacles.filter((o) => o.y < H + 60);
    stars = stars.filter((s) => s.y < H + 60);

    spawnFlag();

    // 碰撞检测（用中心点所在的矩形）
    const sx = lane * LANE_W + LANE_W / 2;
    const sy = H - 130;
    for (const o of obstacles) {
      const ox = o.lane * LANE_W + LANE_W / 2;
      if (Math.abs(sx - ox) < SKIER_W && Math.abs(sy - o.y) < SKIER_H / 2 + o.h / 2) {
        endGame("❄️ 撞上障碍！");
        break;
      }
    }
    // 星星收集
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      const ox = s.lane * LANE_W + LANE_W / 2;
      if (Math.abs(sx - ox) < 34 && Math.abs(sy - s.y) < 36) {
        score += 50;
        scoreEl.textContent = score;
        stars.splice(i, 1);
      }
    }

    scoreEl.textContent = score;
    distEl.textContent = Math.floor(dist / 40);
  }

  function endGame(title) {
    over = true;
    const finalSc = score + Math.floor(dist / 40);
    best = Math.max(best, finalSc);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = title;
    endMsg.textContent = "距离 " + Math.floor(dist / 40) + " m · 分数 " + score + " · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 雪坡背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#cfe7f7"); g.addColorStop(0.7, "#f3f8fd");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 车道线
    ctx.strokeStyle = "rgba(120,150,170,0.4)"; ctx.lineWidth = 3;
    for (let i = 1; i < LANES; i++) {
      ctx.beginPath(); ctx.moveTo(i * LANE_W, 0); ctx.lineTo(i * LANE_W, H); ctx.stroke();
    }
    // 路肩雪纹
    ctx.strokeStyle = "rgba(160,190,210,0.4)"; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath(); ctx.moveTo(x, ((scroll * 0.6) % H)); ctx.lineTo(x + 12, ((scroll * 0.6) % H) + 20); ctx.stroke();
    }

    // 障碍
    for (const o of obstacles) {
      const ox = o.lane * LANE_W + LANE_W / 2;
      const oy = o.y;
      if (o.kind === "tree") {
        ctx.fillStyle = "#8a5a33"; ctx.fillRect(ox - 5, oy + 8, 10, 26);
        ctx.fillStyle = "#2f9e4f";
        ctx.beginPath(); ctx.arc(ox, oy - 2, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#237a3b";
        ctx.beginPath(); ctx.arc(ox - 10, oy + 4, 14, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#8fd0f0";
        ctx.fillRect(ox - 22, oy - 6, 44, 12);
      }
    }
    // 星星
    for (const s of stars) {
      const ox = s.lane * LANE_W + LANE_W / 2;
      ctx.fillStyle = "#f3b93a";
      drawStar(ox, s.y, 14);
    }

    // 滑雪者
    const sx = lane * LANE_W + LANE_W / 2;
    const sy = H - 130;
    ctx.fillStyle = "#d94b3a";
    ctx.fillRect(sx - SKIER_W / 2, sy - SKIER_H / 2, SKIER_W, SKIER_H);
    ctx.fillStyle = "#fff"; ctx.fillRect(sx - SKIER_W / 2, sy - SKIER_H / 2, SKIER_W, 8);
    // 头
    ctx.fillStyle = "#f0c29a"; ctx.beginPath(); ctx.arc(sx, sy - SKIER_H / 2 - 6, 10, 0, Math.PI * 2); ctx.fill();
    // 雪杖
    ctx.strokeStyle = "#555"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx - 16, sy + 10); ctx.lineTo(sx - 22, sy + 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 16, sy + 10); ctx.lineTo(sx + 22, sy + 26); ctx.stroke();
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.5;
      ctx[i === 0 ? "moveTo" : "lineTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  function setLane(dir) {
    if (over) return;
    const nl = Math.max(0, Math.min(LANES - 1, targetLane + dir));
    if (nl !== targetLane) targetLane = nl;
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    reset();
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    bestEl.textContent = best;
    msgEl.textContent = "← / → 变道。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); setLane(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); setLane(1); }
  });
  // 点击左/右半屏变道
  canvas.addEventListener("pointerdown", (e) => {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < W / 2) setLane(-1); else setLane(1);
  }, { passive: true });

  start();
})();
