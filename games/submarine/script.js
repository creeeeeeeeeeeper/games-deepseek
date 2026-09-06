/* ============================================================
   深海潜艇 · 竞速冒险（单人无尽）
   前后自动前进，上下控制深度；躲雷 + 吃氧气瓶
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const distEl = document.getElementById("dist");
  const o2El = document.getElementById("o2");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const TOP = 40, BOTTOM = H - 20;
  const SUB_W = 40, SUB_H = 22;
  const SPEED = 240;
  const BEST_KEY = "submarine-best";

  let subY = H / 2, vy = 0, o2 = 100, dist = 0, best = 0, over = false;
  let mines = [], o2packs = [], raf = 0, last = 0, keys = { up: false, down: false };
  let scrollOff = 0;

  function reset() {
    subY = H / 2; vy = 0; o2 = 100; dist = 0; over = false; mines = []; o2packs = []; scrollOff = 0;
  }

  function spawn() {
    if (Math.random() < 0.012) mines.push({ y: TOP + 20 + Math.random() * (BOTTOM - TOP - 40), r: 13, x: W + 30 });
    if (Math.random() < 0.004) o2packs.push({ y: TOP + 20 + Math.random() * (BOTTOM - TOP - 40), x: W + 30 });
  }

  function update(dt) {
    if (over) return;
    // 深度控制
    if (keys.up) vy = Math.max(vy - 500 * dt, -300);
    else if (keys.down) vy = Math.min(vy + 500 * dt, 300);
    else vy *= 0.9;
    subY += vy * dt;
    subY = Math.max(SUB_H / 2 + 6, Math.min(BOTTOM - SUB_H / 2 - 6, subY));

    // 前进 & 里程
    dist += SPEED * dt / 90;
    scrollOff += SPEED * dt;
    distEl.textContent = Math.floor(dist);

    // 消耗氧气
    const depth = (subY - TOP) / (BOTTOM - TOP);   // 0..1
    o2 -= dt * (2.5 + depth * 3.5);
    o2El.textContent = Math.max(0, Math.round(o2));
    if (o2 <= 0) { crash("缺氧！补充氧气瓶。"); return; }

    for (const m of mines) m.x -= SPEED * dt;
    for (const o of o2packs) o.x -= SPEED * dt;
    mines = mines.filter((m) => m.x > -40);
    o2packs = o2packs.filter((o) => o.x > -40);
    spawn();

    // 吃氧气瓶
    for (let i = o2packs.length - 1; i >= 0; i--) {
      const o = o2packs[i];
      if (Math.abs(o.x - 60) < 40 && Math.abs(o.y - subY) < SUB_H + 10) {
        o2 = Math.min(100, o2 + 40); o2packs.splice(i, 1);
      }
    }
    // 撞雷
    for (const m of mines) {
      if (Math.abs(m.x - 60) < 40 && Math.abs(m.y - subY) < SUB_H / 2 + m.r) { crash("撞上水雷！"); return; }
    }
  }

  function crash(reason) {
    over = true;
    const d = Math.floor(dist);
    best = Math.max(best, d);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = "💥 潜艇受损";
    endMsg.textContent = reason + " 前进 " + d + " 米 · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 水深渐变
    const g = ctx.createLinearGradient(0, TOP, 0, BOTTOM);
    g.addColorStop(0, "#1c5a8a"); g.addColorStop(1, "#05141c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 上浮气泡
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const y = (i * 60 + (scrollOff % 60));
      ctx.beginPath(); ctx.moveTo((i * 37) % W + 20, y); ctx.lineTo((i * 37) % W + 20, y + 12); ctx.stroke();
    }
    // 海面
    ctx.fillStyle = "#2aa6ad"; ctx.fillRect(0, TOP - 8, W, 8);

    // 氧气瓶
    for (const o of o2packs) {
      ctx.fillStyle = "#6fd98a"; ctx.fillRect(o.x - 7, o.y - 10, 14, 20);
      ctx.fillStyle = "#fff"; ctx.fillRect(o.x - 2, o.y - 10, 4, 20);
    }
    // 水雷
    for (const m of mines) {
      ctx.fillStyle = "#3a4150"; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#2a2f3a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, m.r - 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#f0a32a"; ctx.fillRect(m.x - 1, m.y - m.r - 8, 2, 8);
      ctx.fillStyle = "#f0a32a"; ctx.fillRect(m.x - 14, m.y + m.r - 2, 7, 2);
    }
    // 潜艇
    ctx.save();
    ctx.translate(60, subY);
    ctx.rotate(vy * 0.001);
    ctx.fillStyle = "#9fb4c8"; ctx.beginPath(); ctx.ellipse(0, 0, SUB_W / 2, SUB_H / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6f86ac"; ctx.beginPath(); ctx.arc(SUB_W / 2 - 2, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(SUB_W / 2 - 1, -3, 6, 6);
    ctx.fillStyle = "#2f9e4f"; ctx.fillRect(-SUB_W / 2 - 6, -5, 7, 10);   // 方向舵
    ctx.fillStyle = "#6fd98a"; ctx.fillRect(-14, 8, 28, 6);   // 艇身条纹
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
    bestEl.textContent = best; distEl.textContent = 0; o2El.textContent = 100;
    msgEl.textContent = "↑ / ↓ 或按住上下控制深度。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); keys.up = true; }
    if (e.key === "ArrowDown") { e.preventDefault(); keys.down = true; }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp") keys.up = false;
    if (e.key === "ArrowDown") keys.down = false;
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    if (y < H / 2) { keys.up = true; keys.down = false; } else { keys.down = true; keys.up = false; }
  }, { passive: true });
  window.addEventListener("pointerup", () => { keys.up = false; keys.down = false; });

  start();
})();
