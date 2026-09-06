/* ============================================================
   软糖充气 · 原创
   按住充气变大、松开缩小；边向上钻边挤过越来越窄的缺口
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 640;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const sizeEl = document.getElementById("size");
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("inflate-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best ? best + "m" : "0m";

  let state = "ready";       // ready | count | play | over
  let distance = 0;
  let blob = { x: W / 2, y: H - 150, r: 18 };
  let inflating = false;
  let walls = [];
  let speed = 90;
  let spawnT = 0;
  let lives = 3, inv = 0, overT = 0, countT = 0;
  let lastMs = 0, now = 0;
  let targetX = W / 2;
  let shake = 0;

  function setLives() { livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives)); }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function start() {
    state = "count";
    countT = 0;
    distance = 0;
    blob = { x: W / 2, y: H - 150, r: 18 };
    inflating = false;
    walls = [];
    speed = 90;
    spawnT = 0.6;
    lives = 3; inv = 0; overT = 0; shake = 0;
    scoreEl.textContent = "0m";
    sizeEl.textContent = "0%";
    setLives();
    endModal.classList.remove("show");
  }

  // 生成一段缺口障碍（左右两道墙，中间留 gap）
  function spawnSegment() {
    const gapW = Math.max(58, 118 - distance * 0.04);
    const cx = gapW / 2 + 24 + Math.random() * (W - gapW - 48);
    const h = 150 + Math.random() * 90;
    walls.push({ x0: 0, x1: cx - gapW / 2, y: -h - 40, h });
    walls.push({ x0: cx + gapW / 2, x1: W, y: -h - 40, h });
  }

  function update(dt) {
    now += dt;
    shake = Math.max(0, shake - dt * 3);
    inv = Math.max(0, inv - dt);
    if (state === "count") { countT += dt; if (countT >= 0.9) state = "play"; return; }
    if (state !== "play") { if (state === "over") { overT += dt; if (overT > 0.7) showEnd(); } return; }

    // 难度
    speed = Math.min(220, speed + dt * 8);
    distance += dt * (speed / 40);

    // 体积
    if (inflating) blob.r = Math.min(52, blob.r + 62 * dt);
    else blob.r = Math.max(16, blob.r - 90 * dt);

    // 水平移动（朝目标），夹取
    blob.x += (targetX - blob.x) * Math.min(1, dt * 10);
    blob.x = Math.max(blob.r + 2, Math.min(W - blob.r - 2, blob.x));

    // 世界下滑（相对上升）
    walls.forEach((wl) => { wl.y += speed * dt; });
    walls = walls.filter((wl) => wl.y < H + 20);

    // 生成
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = Math.max(0.5, 1.3 - distance * 0.004); spawnSegment(); }

    // 碰撞（圆 vs 墙矩形）
    const b = blob;
    for (const wl of walls) {
      if (wl.y > H) continue;
      if (circleRect(b.x, b.y, b.r, wl)) {
        hit();
        return;
      }
    }

    scoreEl.textContent = Math.floor(distance) + "m";
    sizeEl.textContent = Math.round(((blob.r - 16) / 36) * 100) + "%";
  }

  function circleRect(x, y, r, wl) {
    const nx = Math.max(wl.x0, Math.min(x, wl.x1));
    const ny = Math.max(wl.y, Math.min(y, wl.y + wl.h));
    return (x - nx) * (x - nx) + (y - ny) * (y - ny) < r * r;
  }

  function hit() {
    if (inv > 0) return;
    lives--;
    setLives();
    shake = 1;
    if (lives <= 0) { state = "over"; overT = 0; return; }
    // 清场重生，短暂无敌
    walls = [];
    blob.x = W / 2; blob.y = H - 150; blob.r = 18;
    spawnT = 0.9;
    inv = 1.2;
  }

  function showEnd() {
    const d = Math.floor(distance);
    const isNew = d > best;
    if (isNew) { best = d; try { localStorage.setItem("inflate-best", String(best)); } catch (_) {} bestEl.textContent = best + "m"; }
    endTitle.textContent = "💥 挤爆了！";
    endMsg.innerHTML = "爬到 <b>" + d + "m</b>" + (isNew ? "<br>🏆 新纪录！" : "<br>最高纪录 " + best + "m");
    endModal.classList.add("show");
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#14243a"); g.addColorStop(1, "#0a1020");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 侧墙
    ctx.fillStyle = "#22324c";
    walls.forEach((wl) => {
      ctx.fillRect(wl.x0, wl.y, wl.x1 - wl.x0, wl.h);
      ctx.fillStyle = "#2c3e5c";
      ctx.fillRect(wl.x0, wl.y, Math.min(14, wl.x1 - wl.x0), wl.h);
      ctx.fillStyle = "#22324c";
    });

    // 软糖
    if (!(inv > 0 && Math.floor(now * 8) % 2 === 0)) {
      const wob = Math.sin(now * 8) * (blob.r * 0.03);
      const col = blob.r > 40 ? "#ff8fb3" : blob.r > 26 ? "#ffb3c9" : "#ffd0df";
      ctx.save();
      ctx.translate(blob.x, blob.y);
      const grad = ctx.createRadialGradient(-blob.r * 0.3, -blob.r * 0.35, 2, 0, 0, blob.r);
      grad.addColorStop(0, "#fff");
      grad.addColorStop(0.25, col);
      grad.addColorStop(1, "#e06a92");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, blob.r + wob, blob.r - wob, 0, 0, 7);
      ctx.fill();
      // 高光 / 眼睛
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath(); ctx.arc(-blob.r * 0.3, -blob.r * 0.35, blob.r * 0.18, 0, 7); ctx.fill();
      ctx.fillStyle = "#3a1c2c";
      ctx.beginPath(); ctx.arc(-blob.r * 0.2, -blob.r * 0.05, blob.r * 0.08, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(blob.r * 0.2, -blob.r * 0.05, blob.r * 0.08, 0, 7); ctx.fill();
      ctx.strokeStyle = "#3a1c2c"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, blob.r * 0.12, blob.r * 0.16, 0.2, Math.PI - 0.2); ctx.stroke();
      ctx.restore();
    }

    // 状态提示
    ctx.textAlign = "center";
    if (state === "count") {
      ctx.fillStyle = "rgba(10,16,32,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 54px sans-serif";
      ctx.fillText("3", W / 2, H / 2);
    } else if (state === "ready") {
      ctx.fillStyle = "rgba(10,16,32,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 26px sans-serif";
      ctx.fillText("🍬 软糖充气", W / 2, H / 2 - 30);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#9adcff";
      ctx.fillText("按住充气 · 松开缩小 · 挤过缺口", W / 2, H / 2 + 6);
      ctx.fillStyle = "#ffe9b3"; ctx.font = "bold 16px sans-serif";
      ctx.fillText("点击开始", W / 2, H / 2 + 42);
    }
  }

  /* ---------- 输入 ---------- */
  function setTarget(e) {
    const r = cv.getBoundingClientRect();
    targetX = ((e.clientX - r.left) / r.width) * W;
  }
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { state = "count"; countT = 0; return; }
    setTarget(e);
    inflating = true;
  });
  cv.addEventListener("pointermove", (e) => { if (state === "play") setTarget(e); });
  window.addEventListener("pointerup", () => { inflating = false; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " " && !e.repeat) { if (state === "ready") { state = "count"; countT = 0; } else inflating = true; }
    if (e.key === "ArrowLeft") targetX = Math.max(20, targetX - 40);
    if (e.key === "ArrowRight") targetX = Math.min(W - 20, targetX + 40);
  });
  document.addEventListener("keyup", (e) => { if (e.key === " ") inflating = false; });
  againBtn.addEventListener("click", start);

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  start();
  requestAnimationFrame(frame);
})();
