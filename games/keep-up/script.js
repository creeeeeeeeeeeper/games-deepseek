/* ============================================================
   别让它落地 · 原创
   点按向上顶球；球落地或撞尖刺扣命；撑得越久分越高
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 520;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const GROUND = H - 34;
  const R = 18;
  const GRAV = 900, BOOST = 430;
  let best = 0;
  try { best = parseInt(localStorage.getItem("keepup-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best ? best + "s" : "0s";

  let state = "ready";
  let ball = { x: W / 2, y: GROUND - R, vy: 0 };
  let spikes = [];            // 一排尖刺（从顶下压），y 为下沿
  let lives = 3, inv = 0, time = 0, overT = 0, countT = 0;
  let spawnT = 2.2;
  let lastMs = 0, now = 0, shake = 0;

  function setLives() { livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives)); }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function tock() { ball.vy = -BOOST; }

  function spawnSpikes() {
    spikes.push({ y: -30 });
  }

  function update(dt) {
    now += dt;
    shake = Math.max(0, shake - dt * 3);
    inv = Math.max(0, inv - dt);
    if (state === "count") { countT += dt; if (countT >= 0.6) state = "play"; return; }
    if (state !== "play") { if (state === "over") { overT += dt; if (overT > 0.7) showEnd(); } return; }

    time += dt;
    // 尖刺下压，越来越快
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = Math.max(0.6, 2.2 - time * 0.02); spawnSpikes(); }
    spikes.forEach((s) => { s.y += (60 + time * 2.5) * dt; });
    spikes = spikes.filter((s) => s.y < H && rockClear(s));

    // 球
    ball.vy += GRAV * dt;
    ball.y += ball.vy * dt;
    if (ball.y + R >= GROUND) { ball.y = GROUND - R; ball.vy = Math.abs(ball.vy) * 0.72; }

    // 撞尖刺
    for (const s of spikes) {
      if (s.y > 0 && ball.y - R < s.y && ball.y + R > s.y - 26 && inv <= 0) {
        hit();
        return;
      }
    }
    scoreEl.textContent = Math.floor(time) + "s";
  }
  function rockClear(s) { return true; }

  function hit() {
    lives--; setLives();
    shake = 1;
    ball.y = Math.min(ball.y, H - 90);
    ball.vy = -300;
    if (lives <= 0) { state = "over"; overT = 0; return; }
    inv = 1.2;
    // 清掉逼近的尖刺
    spikes = spikes.filter((s) => s.y < H - 220);
  }

  function showEnd() {
    const t = Math.floor(time);
    const isNew = t > best;
    if (isNew) { best = t; try { localStorage.setItem("keepup-best", String(best)); } catch (_) {} bestEl.textContent = best + "s"; }
    endTitle.textContent = "🏀 落下了…";
    endMsg.innerHTML = "撑了 <b>" + t + "s</b>" + (isNew ? "<br>🏆 新纪录！" : "<br>最高纪录 " + best + "s");
    endModal.classList.add("show");
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1b2433"); g.addColorStop(1, "#0c1018");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 8, 0);

    // 地面
    ctx.fillStyle = "#2c3e5c";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = "rgba(236,224,200,0.4)";
    ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();

    // 尖刺排
    spikes.forEach((s) => {
      ctx.fillStyle = "#6b5a3e";
      for (let x = 6; x < W; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, s.y);
        ctx.lineTo(x + 13, s.y - 26);
        ctx.lineTo(x + 26, s.y);
        ctx.closePath();
        ctx.fill();
      }
    });

    // 球（小白球，闪烁=无敌）
    if (!(inv > 0 && Math.floor(now * 8) % 2 === 0)) {
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(ball.x, ball.y, R, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(58,168,173,0.7)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, R - 1, 0, 7); ctx.stroke();
      ctx.fillStyle = "#1b2433";
      ctx.beginPath(); ctx.arc(ball.x - 6, ball.y - 4, 2.4, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ball.x + 6, ball.y - 4, 2.4, 0, 7); ctx.fill();
    }
    ctx.restore();

    if (state === "ready") {
      ctx.fillStyle = "rgba(10,16,32,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🏀 别让它落地", W / 2, H / 2 - 26);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#9adcff";
      ctx.fillText("点按顶球，躲开下压的尖刺", W / 2, H / 2 + 8);
      ctx.fillStyle = "#ffe9b3"; ctx.font = "bold 16px sans-serif";
      ctx.fillText("点击开始", W / 2, H / 2 + 40);
    } else if (state === "count") {
      ctx.fillStyle = "rgba(10,16,32,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 48px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("3", W / 2, H / 2);
    }
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { state = "count"; countT = 0; return; }
    tock();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " " && !e.repeat) { if (state === "ready") { state = "count"; countT = 0; } else tock(); }
  });
  againBtn.addEventListener("click", start);

  function start() {
    state = "count"; countT = 0;
    ball = { x: W / 2, y: GROUND - R, vy: 0 };
    spikes = [];
    lives = 3; inv = 0; time = 0; spawnT = 2.2; overT = 0; shake = 0;
    scoreEl.textContent = "0s";
    setLives();
    endModal.classList.remove("show");
  }

  start();
  requestAnimationFrame(frame);
})();
