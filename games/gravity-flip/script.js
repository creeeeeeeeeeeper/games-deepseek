/* ============================================================
   重力翻面 · 原创
   点按翻转重力，贴"有缺口的一侧"过闸门；贴错就撞上
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 640;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const gvEl = document.getElementById("gv");
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const CUBE = 26;
  const TOP = 44, BOT = H - 44;
  const GAP_H = 96;
  let best = 0;
  try { best = parseInt(localStorage.getItem("gravityflip-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best ? best + "m" : "0m";

  let state = "ready";
  let grav = 1;            // 1=下（贴下沿） -1=上
  let cy = BOT;            // 方块中心 y
  let gates = [];
  let distance = 0, speed = 110, spawnT = 1.2, lives = 3, inv = 0, overT = 0, countT = 0;
  let lastMs = 0, now = 0, shake = 0, passed = 0;

  function setLives() { livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives)); }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function cubeY() { return grav === 1 ? BOT : TOP; }

  function spawnGate() {
    const gap = Math.random() < 0.5 ? "top" : "bottom";   // 缺口在上 or 下
    gates.push({ y: -GAP_H - 30, gap: gap, h: GAP_H });
  }

  function flip() {
    if (state !== "play") return;
    grav = -grav;
    gvEl.textContent = grav === 1 ? "↓" : "↑";
    inv = Math.max(inv, 0.35);
  }

  function update(dt) {
    now += dt;
    shake = Math.max(0, shake - dt * 3);
    inv = Math.max(0, inv - dt);
    if (state === "count") { countT += dt; if (countT >= 0.7) state = "play"; return; }
    if (state !== "play") { if (state === "over") { overT += dt; if (overT > 0.7) showEnd(); } return; }

    speed = Math.min(230, speed + dt * 6);
    distance += dt * (speed / 40);
    cy += ((grav === 1 ? BOT : TOP) - cy) * Math.min(1, dt * 12);

    spawnT -= dt;
    if (spawnT <= 0) { spawnT = Math.max(0.6, 1.3 - distance * 0.006); spawnGate(); }
    gates.forEach((g) => { g.y += speed * dt; });
    gates = gates.filter((g) => g.y < H + 20);

    // 穿过判定：闸门带覆盖到方块行时，缺口侧必须匹配重力侧
    for (const g of gates) {
      const bandTop = g.y, bandBot = g.y + g.h;
      if (cy > bandTop && cy < bandBot) {
        const need = g.gap === "top" ? -1 : 1;   // 缺口在上→需要贴顶(grav=-1)
        if (grav !== need && inv <= 0) { hit(); return; }
        if (!g.passed) { g.passed = true; passed++; scoreEl.textContent = Math.floor(distance) + "m"; bump(scoreEl); }
      }
    }

    scoreEl.textContent = Math.floor(distance) + "m";
  }

  function hit() {
    lives--; setLives();
    shake = 1;
    if (lives <= 0) { state = "over"; overT = 0; return; }
    // 清掉逼近的闸门，短暂无敌
    gates = gates.filter((g) => g.y < H - 260 && g.y > -40);
    inv = 1.3;
  }

  function showEnd() {
    const d = Math.floor(distance);
    const isNew = d > best;
    if (isNew) { best = d; try { localStorage.setItem("gravityflip-best", String(best)); } catch (_) {} bestEl.textContent = best + "m"; }
    endTitle.textContent = "💥 撞上了！";
    endMsg.innerHTML = "爬了 <b>" + d + "m</b> · 过 " + passed + " 道门" + (isNew ? "<br>🏆 新纪录！" : "<br>最高纪录 " + best + "m");
    endModal.classList.add("show");
  }

  function drawGate(g) {
    // 缺口 top：实心在下；缺口 bottom：实心在上
    ctx.fillStyle = "#4b3b22";
    if (g.gap === "top") {
      ctx.fillRect(0, g.y + g.h - 34, W, 34);   // 底下实心
      ctx.fillRect(0, g.y + g.h - 34, W, 6);
    } else {
      ctx.fillRect(0, g.y, W, 34);
      ctx.fillRect(0, g.y + 28, W, 6);
    }
    // 缺口箭头提示
    ctx.fillStyle = "rgba(124,224,138,0.7)";
    ctx.font = "16px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(g.gap === "top" ? "↑" : "↓", W / 2, g.y + g.h / 2 + 5);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1c1a2b"); g.addColorStop(1, "#0c0b14");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 8, 0);

    // 上下导轨
    ctx.fillStyle = "#2c3e5c";
    ctx.fillRect(0, TOP - 12, W, 12);
    ctx.fillRect(0, BOT, W, 12);

    // 闸门
    gates.forEach(drawGate);

    // 方块
    if (!(inv > 0 && Math.floor(now * 8) % 2 === 0)) {
      ctx.fillStyle = "#8fe0ff";
      ctx.fillRect(W / 2 - CUBE / 2, cy - CUBE / 2, CUBE, CUBE);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(W / 2 - CUBE / 2, cy - CUBE / 2, CUBE, 6);
      ctx.strokeStyle = "rgba(58,168,173,0.9)"; ctx.lineWidth = 2;
      ctx.strokeRect(W / 2 - CUBE / 2, cy - CUBE / 2, CUBE, CUBE);
    }
    ctx.restore();

    if (state === "ready") {
      ctx.fillStyle = "rgba(10,12,20,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🪐 重力翻面", W / 2, H / 2 - 26);
      ctx.font = "15px sans-serif"; ctx.fillStyle = "#9adcff";
      ctx.fillText("点按翻转重力，贴有缺口的一侧过闸门", W / 2, H / 2 + 8);
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
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { state = "count"; countT = 0; return; }
    flip();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " " && !e.repeat) { if (state === "ready") { state = "count"; countT = 0; } else flip(); }
  });
  againBtn.addEventListener("click", start);

  function start() {
    state = "count"; countT = 0;
    grav = 1; cy = BOT; gates = [];
    distance = 0; speed = 110; spawnT = 1.2; lives = 3; inv = 0; passed = 0; overT = 0; shake = 0;
    scoreEl.textContent = "0m";
    gvEl.textContent = "↓";
    setLives();
    endModal.classList.remove("show");
  }

  start();
  requestAnimationFrame(frame);
})();
