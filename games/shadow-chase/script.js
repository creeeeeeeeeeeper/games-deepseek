/* ============================================================
   追光人 · 原创
   手电光跟随指针；光罩到萤火虫即点亮（萤火虫会逃跑）
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 520;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const comboEl = document.getElementById("combo");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const N = 4, LIGHT_R = 62, FIRE_R = 10, TIME = 45;
  let best = 0;
  try { best = parseInt(localStorage.getItem("shadow-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "ready";
  let score = 0, combo = 0, comboT = 0, timeLeft = TIME, overT = 0, countT = 0;
  let light = { x: W / 2, y: H / 2 };
  let fires = [];
  let parts = [], floats = [];
  let lastMs = 0, now = 0;

  function spawnFire(x, y) {
    return { x: x ?? (20 + Math.random() * (W - 40)), y: y ?? (20 + Math.random() * (H - 40)),
      vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: Math.random() * 6 };
  }

  function update(dt) {
    now += dt;
    if (state === "count") { countT += dt; if (countT >= 0.7) state = "play"; return; }
    if (state !== "play") { if (state === "over") { overT += dt; if (overT > 0.7) showEnd(); } return; }

    timeLeft -= dt;
    timeEl.textContent = Math.max(0, Math.ceil(timeLeft));
    if (timeLeft <= 0) { endGame(); return; }

    for (let i = 0; i < fires.length; i++) {
      const f = fires[i];
      // 周期性随机转向
      f.t += dt;
      if (Math.random() < 0.01) { f.vx += (Math.random() - 0.5) * 80; f.vy += (Math.random() - 0.5) * 80; }
      // 逃离光
      const dx = f.x - light.x, dy = f.y - light.y, d = Math.hypot(dx, dy) || 1;
      if (d < LIGHT_R + 30) { f.vx += (dx / d) * 220 * dt; f.vy += (dy / d) * 220 * dt; }
      // 限速
      const sp = Math.hypot(f.vx, f.vy), max = 200;
      if (sp > max) { f.vx *= max / sp; f.vy *= max / sp; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < FIRE_R) { f.x = FIRE_R; f.vx = Math.abs(f.vx); }
      if (f.x > W - FIRE_R) { f.x = W - FIRE_R; f.vx = -Math.abs(f.vx); }
      if (f.y < FIRE_R) { f.y = FIRE_R; f.vy = Math.abs(f.vy); }
      if (f.y > H - FIRE_R) { f.y = H - FIRE_R; f.vy = -Math.abs(f.vy); }
      // 点亮判定
      if (d < LIGHT_R) {
        score++; combo = now - comboT < 1.0 ? combo + 1 : 1; comboT = now;
        scoreEl.textContent = score; bump(scoreEl);
        if (score > best) bestEl.textContent = score;
        fires.splice(i, 1);
        fires.push(spawnFire());
        addFloat(f.x, f.y, "+1", "#ffd166");
        break;
      }
    }

    parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    parts = parts.filter((p) => p.t < 0.5);
    floats.forEach((f) => (f.t += dt));
    floats = floats.filter((f) => f.t < 0.9);
    comboEl.textContent = combo;
  }

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function addFloat(x, y, text, color) { floats.push({ x, y, text, color, t: 0 }); }

  function endGame() {
    state = "over"; overT = 0;
    const isNew = score > best;
    if (isNew) { best = score; try { localStorage.setItem("shadow-best", String(best)); } catch (_) {} bestEl.textContent = best; }
    endTitle.textContent = "🔦 时间到！";
    endMsg.innerHTML = "点亮 <b>" + score + "</b> 只" + (isNew ? "<br>🏆 新纪录！" : "<br>最高纪录 " + best);
    setTimeout(() => endModal.classList.add("show"), 450);
  }
  function showEnd() {}   // endGame 已展示

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a1b2a"); g.addColorStop(1, "#0b0c14");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 萤火虫
    fires.forEach((f) => {
      const glow = ctx.createRadialGradient(f.x, f.y, 1, f.x, f.y, 18);
      glow.addColorStop(0, "#ffe9a8"); glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(f.x, f.y, 18, 0, 7); ctx.fill();
      ctx.fillStyle = "#ffe9a8"; ctx.beginPath(); ctx.arc(f.x, f.y, FIRE_R, 0, 7); ctx.fill();
    });

    // 手电光
    ctx.strokeStyle = "rgba(231,193,78,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(light.x, light.y, LIGHT_R, 0, 7); ctx.stroke();
    ctx.fillStyle = "rgba(255,217,109,0.06)";
    ctx.beginPath(); ctx.arc(light.x, light.y, LIGHT_R, 0, 7); ctx.fill();
    // 手电
    ctx.fillStyle = "#ece0c8";
    ctx.beginPath(); ctx.arc(light.x, light.y, 6, 0, 7); ctx.fill();

    parts.forEach((p) => { ctx.globalAlpha = 1 - p.t / 0.5; ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
    ctx.globalAlpha = 1;
    ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
    floats.forEach((f) => { ctx.globalAlpha = 1 - f.t / 0.9; ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - f.t * 40); });
    ctx.globalAlpha = 1;

    if (state === "ready") {
      ctx.fillStyle = "rgba(10,12,20,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🔦 追光人", W / 2, H / 2 - 26);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#9adcff";
      ctx.fillText("移动光罩住萤火虫，点亮它们", W / 2, H / 2 + 8);
      ctx.fillStyle = "#ffe9b3"; ctx.font = "bold 16px sans-serif";
      ctx.fillText("点击开始", W / 2, H / 2 + 40);
    }
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function setLight(e) {
    const r = cv.getBoundingClientRect();
    light.x = ((e.clientX - r.left) / r.width) * W;
    light.y = ((e.clientY - r.top) / r.height) * H;
  }
  cv.addEventListener("pointermove", (e) => { if (state === "play") setLight(e); });
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { state = "count"; countT = 0; return; }
    setLight(e);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
  });
  againBtn.addEventListener("click", start);

  function start() {
    state = "count"; countT = 0;
    score = 0; combo = 0; comboT = 0; timeLeft = TIME; overT = 0;
    scoreEl.textContent = "0"; comboEl.textContent = "0"; timeEl.textContent = TIME;
    fires = []; parts = []; floats = [];
    for (let i = 0; i < N; i++) fires.push(spawnFire());
    endModal.classList.remove("show");
  }

  start();
  requestAnimationFrame(frame);
})();
