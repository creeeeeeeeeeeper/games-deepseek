/* ============================================================
   激流勇进 · 竞速冒险（单人顺流躲避）
   筏子顺流下滑，左右躲石头/漩涡，吃浮标加分
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

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const RAFT_W = 40, RAFT_H = 26;
  const BASE_SPEED = 300;
  const BEST_KEY = "river-raft-best";

  let raft = { x: W / 2, y: 80 }, vx = 0;
  let score = 0, dist = 0, best = 0, over = false;
  let rocks = [], buoys = [], speed = BASE_SPEED, scroll = 0;
  let raf = 0, last = 0, aim = 0;
  const keys = { left: false, right: false };

  function reset() {
    raft = { x: W / 2, y: 80 }; vx = 0; rocks = []; buoys = [];
    score = 0; dist = 0; speed = BASE_SPEED; over = false; aim = 0; scroll = 0;
  }

  function spawn() {
    if (Math.random() < 0.02) {
      rocks.push({ x: 30 + Math.random() * (W - 60), y: -40, r: 12 + Math.random() * 14, kind: Math.random() < 0.25 ? "swirl" : "rock" });
    }
    if (Math.random() < 0.01) {
      buoys.push({ x: 30 + Math.random() * (W - 60), y: -30 });
    }
  }

  function update(dt) {
    if (over) return;
    const steer = aim || ((keys.right ? 1 : 0) - (keys.left ? 1 : 0));
    speed = Math.min(speed + dt * 8, 560);
    raft.x += steer * 260 * dt;
    // 筏子在固定高度，障碍物相对向下滚（顺流从上方来）
    scroll += speed * dt;

    raft.x = Math.max(RAFT_W / 2 + 6, Math.min(W - RAFT_W / 2 - 6, raft.x));

    // 障碍物向下移动
    for (const r of rocks) r.y += speed * dt;
    for (const b of buoys) b.y += speed * dt;
    rocks = rocks.filter((r) => r.y < H + 50);
    buoys = buoys.filter((b) => b.y < H + 40);
    spawn();

    dist = Math.max(dist, scroll / 36);

    // 碰撞
    for (const r of rocks) {
      const dx = raft.x - r.x, dy = raft.y - r.y;
      if (dx * dx + dy * dy < (RAFT_W / 2 + r.r) * (RAFT_W / 2 + r.r)) { crash(); return; }
    }
    for (let i = buoys.length - 1; i >= 0; i--) {
      const b = buoys[i];
      const dx = raft.x - b.x, dy = raft.y - b.y;
      if (dx * dx + dy * dy < 30 * 30) { score += 10; scoreEl.textContent = score; buoys.splice(i, 1); }
    }

    scoreEl.textContent = score;
    distEl.textContent = Math.floor(dist);
  }

  function crash() {
    over = true;
    const final = Math.floor(dist);
    best = Math.max(best, final);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = "🌊 撞上急流！";
    endMsg.textContent = "顺流 " + final + " 米 · 分数 " + score + " · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 水流
    ctx.fillStyle = "#1f5a7a"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const px = (i * 33 + ((speed * 0.5) % 90)) % W;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px + 14, H); ctx.stroke();
    }
    // 浮标
    for (const b of buoys) {
      ctx.fillStyle = "#f3b93a";
      ctx.beginPath(); ctx.moveTo(b.x, b.y - 12); ctx.lineTo(b.x + 10, b.y); ctx.lineTo(b.x, b.y + 12); ctx.lineTo(b.x - 10, b.y); ctx.closePath(); ctx.fill();
    }
    // 石头/漩涡
    for (const r of rocks) {
      if (r.kind === "rock") {
        ctx.fillStyle = "#6a7a8c";
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4a5a6c";
        ctx.beginPath(); ctx.arc(r.x - r.r * 0.25, r.y - r.r * 0.25, r.r * 0.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.arc(r.x, r.y, r.r * (1 - k * 0.25), 0, Math.PI * 1.5); ctx.stroke();
        }
      }
    }
    // 筏子
    const rx = raft.x, ry = raft.y;
    ctx.fillStyle = "#8a5a33";
    ctx.beginPath();
    ctx.moveTo(rx - RAFT_W / 2, ry - RAFT_H / 2); ctx.lineTo(rx + RAFT_W / 2, ry - RAFT_H / 2);
    ctx.lineTo(rx + RAFT_W / 2 + 4, ry); ctx.lineTo(rx + RAFT_W / 2, ry + RAFT_H / 2);
    ctx.lineTo(rx - RAFT_W / 2, ry + RAFT_H / 2); ctx.lineTo(rx - RAFT_W / 2 - 4, ry);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#a86c3c";
    for (let i = -1; i <= 1; i++) ctx.fillRect(rx - RAFT_W / 2 - 2, ry + i * 7, RAFT_W + 4, 3);
    // 人
    ctx.fillStyle = "#f0c29a"; ctx.beginPath(); ctx.arc(rx, ry - 14, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2f9e4f";
    ctx.beginPath(); ctx.moveTo(rx, ry - 8); ctx.lineTo(rx + 8, ry - 4); ctx.lineTo(rx - 8, ry - 4); ctx.closePath(); ctx.fill();
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
    bestEl.textContent = best; scoreEl.textContent = 0; distEl.textContent = 0;
    msgEl.textContent = "← / → 控制筏子。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); keys.left = true; aim = -1; }
    if (e.key === "ArrowRight") { e.preventDefault(); keys.right = true; aim = 1; }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") { keys.left = false; aim = keys.right ? 1 : 0; }
    if (e.key === "ArrowRight") { keys.right = false; aim = keys.left ? -1 : 0; }
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    aim = (e.clientX - rect.left) < W / 2 ? -1 : 1;
  }, { passive: true });
  window.addEventListener("pointerup", () => { aim = 0; });

  start();
})();
