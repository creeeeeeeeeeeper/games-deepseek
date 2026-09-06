/* ============================================================
   跳跳兔 · 竞速冒险（单人无尽跳跃）
   世界向左滚动，兔子原地跳；落到平台上安全，踩到尖刺或踩空就结束
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const distEl = document.getElementById("dist");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const W = 360, H = 520;
  canvas.width = W; canvas.height = H;

  const GROUND = H - 54;
  const RX = 82, RW = 34, RH = 30;
  const SPEED = 205, GRAV = 1500;
  const TILE_W = 46;
  const MIN_JUMPV = 520, MAX_JUMPV = 900;
  const BEST_KEY = "bunny-hop-best";

  let world = 0, spawnX = 0, tiles = [], dist = 0, best = 0;
  let y = 0, vy = 0, onGround = true, charging = false, power = 0;
  let state = "play", fallRate = 0, over = false;
  let raf = 0, last = 0;

  function tile(type, x, w) { return { type, x, w }; }
  function randomTileType() {
    const r = Math.random();
    if (r < 0.68) return "flat";
    if (r < 0.84) return "spike";
    return "gap";
  }

  function spawn() {
    tiles = [tile("flat", -TILE_W, W + TILE_W)];   // 起步整段安全地面
    spawnX = W + TILE_W;
    world = 0; dist = 0; y = 0; vy = 0; onGround = true; power = 0; fallRate = 0;
  }

  function ensure() {
    const ahead = world + W + 80;
    while (spawnX < ahead) {
      let type = randomTileType();
      let count = 1;
      if (type === "gap") {
        // 限制连续缺口总宽度 ≤ 3 格，避免生成无法跳过的深渊
        count = 1 + ((Math.random() * 2) | 0);   // 1 或 2 格
        // 追踪上一个生成类型，防止缺口叠加
      }
      for (let i = 0; i < count; i++) tiles.push(tile(type, spawnX + i * TILE_W, TILE_W));
      // 缺口后强制一块平地，保证有落点
      if (type === "gap") tiles.push(tile("flat", spawnX + count * TILE_W, TILE_W));
      spawnX += count * TILE_W + (type === "gap" ? TILE_W : 0);
    }
  }

  function tileAtScreenX(sx) {
    for (const t of tiles) {
      const x = t.x - world;
      if (sx >= x && sx < x + t.w) return t;
    }
    return null;
  }

  function jump() {
    onGround = false;
    vy = -(MIN_JUMPV + (MAX_JUMPV - MIN_JUMPV) * power);
  }

  function endGame(title, finalDist) {
    over = true;
    best = Math.max(best, finalDist);
    localStorage.setItem(BEST_KEY, String(best));
    bestEl.textContent = best;
    endTitle.textContent = title;
    endMsg.textContent = "跳了 " + finalDist + " 格 · 最好 " + best;
    setTimeout(() => endModal.classList.add("show"), 420);
  }

  function update(dt) {
    if (over) return;
    if (charging && onGround) power = Math.min(1, power + dt * 2.2);

    world += SPEED * dt;
    const final = Math.floor(world / 46);
    dist = Math.max(dist, final);
    distEl.textContent = final;
    ensure();
    tiles = tiles.filter((t) => t.x + t.w - world > -60);

    if (state === "play") {
      if (!onGround) {
        vy += GRAV * dt;
        y += vy * dt;
        if (y >= 0) {
          y = 0; vy = 0; onGround = true;
          const t = tileAtScreenX(RX);
          if (!t || t.type === "gap") { state = "fall"; fallRate = 0; }
          else if (t.type === "spike") { endGame("💥 撞到尖刺！", final); }
        }
      }
    } else if (state === "fall") {
      fallRate += 1400 * dt;
      y += fallRate * dt;
      if (y > H) { endGame("🕳️ 踩空了！", Math.floor(dist)); }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      let sx = (i * 53 - world * 0.2) % W; if (sx < 0) sx += W;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fillRect(sx, (i * 37) % H, 2, 2);
    }
    for (const t of tiles) {
      const x = t.x - world;
      if (x > W || x + t.w < -10) continue;
      if (t.type === "flat") {
        ctx.fillStyle = "#4a5a7a"; ctx.fillRect(x, GROUND, t.w, H - GROUND);
        ctx.fillStyle = "#6f86ac"; ctx.fillRect(x, GROUND, t.w, 5);
      } else if (t.type === "spike") {
        ctx.fillStyle = "#a8b4c8"; ctx.fillRect(x, GROUND, t.w, H - GROUND);
        ctx.fillStyle = "#e2c266";
        ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + t.w, GROUND); ctx.lineTo(x + t.w / 2, GROUND - 26); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = "#141a26"; ctx.fillRect(x, GROUND, t.w, H - GROUND);
      }
    }
    const bodyY = GROUND - RH - y;
    ctx.fillStyle = "#f2f2f2";
    ctx.beginPath(); ctx.ellipse(RX + RW / 2, bodyY + RH / 2, RW / 2, RH / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(RX + RW / 2 + 14, bodyY + 4, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(RX + RW / 2 + 12, bodyY - 10, 3, 9, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(RX + RW / 2 + 18, bodyY - 12, 3, 9, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffb3c1";
    ctx.beginPath(); ctx.ellipse(RX + RW / 2 + 12, bodyY - 8, 1.5, 5, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(RX + RW / 2 + 18, bodyY - 10, 1.5, 5, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath(); ctx.arc(RX + RW / 2 + 17, bodyY + 3, 1.6, 0, Math.PI * 2); ctx.fill();
    if (charging && onGround) {
      const barW = power * 90;
      ctx.fillStyle = "#2a2f3a"; ctx.fillRect(RX - 4, GROUND - RH - 34, 90, 7);
      ctx.fillStyle = "#e2c266"; ctx.fillRect(RX - 4, GROUND - RH - 34, barW, 7);
    }
  }

  function onDown(e) { if (over) return; if (e.cancelable) e.preventDefault(); charging = true; }
  function onUp(e) {
    if (over) return; if (e.cancelable) e.preventDefault();
    if (charging) {
      charging = false;
      if (onGround && state === "play") jump();
      power = 0;
    }
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    spawn();
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
    bestEl.textContent = best;
    over = false; state = "play"; charging = false; power = 0;
    msgEl.textContent = "长按蓄力，松开起跳。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if ((e.key === " " || e.code === "Space") && !e.repeat) { e.preventDefault(); onDown(e); }
  });
  document.addEventListener("keyup", (e) => {
    if (e.key === " " || e.code === "Space") { e.preventDefault(); onUp(e); }
  });

  start();
})();
