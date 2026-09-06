/* ============================================================
   攀岩 · 竞速冒险（单人向上攀爬）
   点击可够到的岩点向上爬，体力爬满可续，体力耗尽坠落
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const heightEl = document.getElementById("height");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const REACH = 105, CLIMB_SPEED = 150, STAMINA_MAX = 100, DRAIN = 16;
  const BEST_KEY = "rock-climb-best";

  let holds = [], climber = { x: W / 2, y: H - 60, tx: W / 2, ty: H - 60 }, stamina = STAMINA_MAX;
  let nextId = 0, topY = H - 60, best = 0, over = false, falling = false, fallVy = 0, raf = 0, last = 0;

  function makeHold(x, y) { return { id: nextId++, x, y, done: false }; }

  function seed() {
    holds = [makeHold(W / 2, H - 60)];
    holds[0].done = true;
    climber = { x: W / 2, y: H - 60, tx: W / 2, ty: H - 60 };
    nextId = 1; stamina = STAMINA_MAX; over = false; falling = false; fallVy = 0; topY = H - 60;
  }

  function ensure() {
    // 往上生成岩点，保证 climber 上方始终有可够的岩点
    let prevX = holds.length ? holds[holds.length - 1].x : W / 2;
    while (topY > climber.y - 320) {
      const dy = 55 + Math.random() * 45;
      const y = topY - dy;
      // 横向偏移不得超过剩余可达距离，保证下一岩点始终可够到
      const maxDx = Math.max(10, Math.sqrt(Math.max(0, REACH * REACH - dy * dy)));
      const x = Math.max(45, Math.min(W - 45, prevX + (Math.random() - 0.5) * 2 * maxDx));
      holds.push(makeHold(x, y));
      topY = y; prevX = x;
    }
    // 清理远在 climber 下方、不再需要的岩点
    holds = holds.filter((h) => climber.y - h.y < 420);
  }

  function reachable(h) {
    const dx = h.x - climber.x, dy = h.y - climber.y;
    return Math.sqrt(dx * dx + dy * dy) <= REACH;
  }

  function clickHold(h) {
    if (over || falling) return;
    if (!reachable(h)) return;
    climber.tx = h.x; climber.ty = h.y;
  }

  function update(dt) {
    if (over) return;
    ensure();
    if (falling) {
      fallVy += 1200 * dt;
      climber.y += fallVy * dt;
      if (climber.y > H + 40) {
        const final = Math.floor((H - 60 - topY) / 70);
        finish(final, "💨 摔落崖底！");
      }
      return;
    }

    const dx = climber.tx - climber.x, dy = climber.ty - climber.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1) {
      const step = CLIMB_SPEED * dt;
      const k = Math.min(1, step / d);
      climber.x += dx * k; climber.y += dy * k;
    } else {
      climber.x = climber.tx; climber.y = climber.ty;
      // 到达岩点：仅首次抓稳才回体力
      for (const h of holds) {
        if (Math.abs(h.x - climber.x) < 2 && Math.abs(h.y - climber.y) < 2 && !h.done) {
          h.done = true;
          stamina = Math.min(STAMINA_MAX, stamina + 34);
          break;
        }
      }
    }

    // 体力持续消耗
    stamina -= DRAIN * dt;
    if (stamina <= 0 && !falling) { falling = true; stamina = 0; }

    const height = Math.floor((H - 60 - climber.y) / 70);
    heightEl.textContent = height;
  }

  function finish(final, title) {
    over = true;
    best = Math.max(best, final);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = title;
    endMsg.textContent = "爬到 " + final + " 米 · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const camY = climber.y - H * 0.62;
    // 背景
    ctx.fillStyle = "#1c212b"; ctx.fillRect(0, 0, W, H);
    // 岩点
    for (const h of holds) {
      const sy = h.y - camY;
      if (sy < -20 || sy > H + 20) continue;
      const can = !h.done && reachable(h);
      ctx.fillStyle = h.done ? "#4a5a7a" : (can ? "#e2c266" : "#6f86ac");
      ctx.beginPath(); ctx.arc(h.x, sy, 7, 0, Math.PI * 2); ctx.fill();
      if (can) {
        ctx.strokeStyle = "rgba(226,194,102,0.5)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(h.x, sy, 12, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // 攀岩者
    const cx = climber.x, cy = climber.y - camY;
    ctx.fillStyle = "#d94b3a";
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f0c29a";
    ctx.beginPath(); ctx.arc(cx, cy - 12, 7, 0, Math.PI * 2); ctx.fill();
    // 手臂朝目标
    const adx = climber.tx - climber.x, ady = (climber.ty - camY) - cy;
    ctx.strokeStyle = "#d94b3a"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + adx * 0.4 - 4, cy + ady * 0.4 + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + adx * 0.4 + 6, cy + ady * 0.4 + 2); ctx.stroke();
    // 体力条
    ctx.fillStyle = "#2a2f3a"; ctx.fillRect(20, 14, W - 40, 10);
    ctx.fillStyle = stamina > 35 ? "#6fd98a" : "#d94b3a";
    ctx.fillRect(20, 14, (W - 40) * stamina / STAMINA_MAX, 10);
    ctx.fillStyle = "#8b93a3"; ctx.font = "12px sans-serif";
    ctx.fillText("体力", 20, 12);
  }

  function onTap(e) {
    if (over) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const camY = climber.y - H * 0.62;
    // 找最近可够岩点
    let bestH = null, bd = 99999;
    for (const h of holds) {
      const sy = h.y - camY;
      const d = Math.abs(h.x - px) + Math.abs(sy - py);
      if (d < 30 && reachable(h) && d < bd) { bd = d; bestH = h; }
    }
    if (bestH) clickHold(bestH);
    else msgEl.textContent = "还没够到，先选发亮的岩点。";
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    seed();
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    bestEl.textContent = best; heightEl.textContent = 0;
    msgEl.textContent = "点击发亮的岩点向上爬，抓紧岩点回复体力。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  canvas.addEventListener("pointerdown", onTap, { passive: true });
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });

  start();
})();
