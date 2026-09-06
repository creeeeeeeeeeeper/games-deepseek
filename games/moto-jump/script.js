/* ============================================================
   摩托飞跃 · 竞速冒险（单人坡台飞跃）
   加速冲向坡台 → 腾空 → 压头落地，飞得越远分越高
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 420, H = 300;
  canvas.width = W; canvas.height = H;

  const GROUND = H - 34;
  const GRAV = 900;
  const BEST_KEY = "moto-jump-best";

  let speed = 60, moto = { x: 60, y: GROUND, vy: 0, angle: 0, vAng: 0, air: false };
  let score = 0, best = 0, over = false, boost = false;
  let ramps = [], spawnX = 0, scroll = 0, raf = 0, last = 0;

  function makeRamp(x) { return { x, h: 40 + Math.random() * 34 }; }
  function reset() {
    speed = 60; moto = { x: 60, y: GROUND, vy: 0, angle: 0, vAng: 0, air: false };
    score = 0; over = false; boost = false; scroll = 0;
    ramps = []; spawnX = 320;
    // 起步放一个近距离坡台
    ramps.push(makeRamp(220));
  }

  function groundAt(x) {
    // 在坡台处抬升地面
    let gy = GROUND;
    for (const r of ramps) {
      const dx = x - r.x;
      if (dx >= 0 && dx <= 48) {
        const t = dx / 48;
        gy = GROUND - Math.sin(t * Math.PI) * r.h;
      }
    }
    return gy;
  }

  function update(dt) {
    if (over) return;
    if (boost) speed = Math.min(speed + dt * 420, 560);
    else speed = Math.max(speed - dt * 40, 60);

    moto.x += speed * dt;
    const gy = groundAt(moto.x);

    if (moto.air) {
      moto.vy += GRAV * dt;
      moto.y += moto.vy * dt;
      moto.angle += moto.vAng * dt;
      // 落地
      if (moto.vy > 0 && moto.y >= gy) {
        moto.y = gy; moto.air = false;
        moto.vAng = 0;
        // 先落地/后落地判定
        const flips = Math.round(Math.abs(moto.angle) / (Math.PI * 2));
        if (flips > 0) { score += 30 + flips * 20; scoreEl.textContent = score; msgEl.textContent = "‍🔄 空翻 " + flips + " 圈！"; }
        moto.angle = moto.angle % (Math.PI * 2) - 0;
        // 摔车：落地角度太歪
        if (Math.abs(moto.angle % (Math.PI * 2)) > 1.0) { crash(); }
      }
    } else {
      moto.y = gy;
      // 冲上坡台后腾空：由坡顶速度决定
      if (moto.x > 0) {
        for (const r of ramps) {
          if (Math.abs(moto.x - r.x) < 26 && !moto.air && moto.x >= r.x) {
            moto.air = true;
            // 起跳角度由坡台高度和速度决定
            const launch = Math.min(speed * r.h / 1200, 880);
            moto.vy = -launch;
            moto.vAng = (Math.random() < 0.5 ? -1 : 1) * (0.6 + speed / 1200);
            break;
          }
        }
      }
    }

    // 分数：行进距离
    const d = Math.floor(moto.x / 30);
    if (d > score && !moto.air) { score = Math.max(score, d); }

    // 生成坡台
    while (spawnX < moto.x + 700) { ramps.push(makeRamp(spawnX)); spawnX += 260 + Math.random() * 160; }
    ramps = ramps.filter((r) => r.x > moto.x - 80 && r.x < moto.x + 900);

    scoreEl.textContent = score;
  }

  function crash() {
    over = true;
    best = Math.max(best, score);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = "💥 翻车了！";
    endMsg.textContent = "飞跃得分 " + score + " · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 远山
    ctx.fillStyle = "#2b3a44";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 120 - 60 - (scroll * 0.2) % 120, H);
      ctx.lineTo(i * 120 - 60 + 40 - (scroll * 0.2) % 120, 120);
      ctx.lineTo(i * 120 - 60 + 100 - (scroll * 0.2) % 120, H);
      ctx.closePath(); ctx.fill();
    }
    // 地面
    ctx.fillStyle = "#22303a"; ctx.fillRect(0, GROUND, W, H - GROUND);
    // 坡台（绿色）
    for (const r of ramps) {
      const x = r.x;
      ctx.fillStyle = "#3aa65a";
      ctx.beginPath();
      ctx.moveTo(x, GROUND);
      ctx.quadraticCurveTo(x + 24, GROUND - r.h, x + 48, GROUND);
      ctx.closePath(); ctx.fill();
    }
    // 摩托
    const mx = moto.x, my = moto.y;
    drawBike(mx, my, moto.angle);
  }

  function drawBike(x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    // 车体
    ctx.fillStyle = "#d94b3a";
    ctx.beginPath(); ctx.ellipse(0, -12, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    // 车轮
    ctx.fillStyle = "#15181f";
    ctx.beginPath(); ctx.arc(-18, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(18, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#4a5a7a";
    ctx.beginPath(); ctx.arc(-18, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(18, 0, 3, 0, Math.PI * 2); ctx.fill();
    // 把手
    ctx.strokeStyle = "#6f86ac"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, -16); ctx.lineTo(20, -22); ctx.stroke();
    ctx.restore();
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
    bestEl.textContent = best; scoreEl.textContent = 0;
    msgEl.textContent = "按住加速，冲上坡台，腾空后松手。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if (e.key === " " || e.code === "Space") { e.preventDefault(); boost = true; }
  });
  document.addEventListener("keyup", (e) => {
    if ((e.key === " " || e.code === "Space") && !over) { e.preventDefault(); boost = false; }
  });
  canvas.addEventListener("pointerdown", (e) => { if (e.cancelable) e.preventDefault(); if (!over) boost = true; }, { passive: false });
  window.addEventListener("pointerup", () => { if (!over) boost = false; });

  start();
})();
