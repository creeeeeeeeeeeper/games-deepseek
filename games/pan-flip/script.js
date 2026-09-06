/* ============================================================
   翻煎饼 · 原创蓄力甩饼
   按住蓄力，松手把煎饼甩上天自转；落地金黄面朝上才得分
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 520;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const livesEl = document.getElementById("lives");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const PAN = { y: H - 64, w: 220, h: 18, r: 14 };
  const R = 46;              // 煎饼半径
  const GRAV = 1400;

  let best = 0;
  try { best = parseInt(localStorage.getItem("panflip-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "ready";       // ready | charge | fly | over
  let power = 0;
  let charging = false;
  let pancake = { x: W / 2, y: PAN.y - R - 6, vy: 0, ang: 0, spin: 0 };
  let score = 0, combo = 0, comboOk = true, lives = 3, attempts = 0, successes = 0;
  let parts = [], floats = [], shake = 0, overT = 0;
  let lastMs = 0, now = 0;

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function setLives() { livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives)); }

  function start() {
    state = "ready";
    power = 0; charging = false;
    score = 0; combo = 0; lives = 3; attempts = 0; successes = 0; comboOk = true;
    pancake = { x: W / 2, y: PAN.y - R - 6, vy: 0, ang: 0, spin: 0 };
    scoreEl.textContent = "0"; comboEl.textContent = "0";
    setLives(); bestEl.textContent = best;
    endModal.classList.remove("show");
    parts = []; floats = []; shake = 0; overT = 0;
  }

  function charge(dt) {
    if (!charging || state !== "ready") return;
    power = Math.min(1, power + dt / 1.1);
  }

  function launch() {
    if (state !== "ready") return;
    state = "fly";
    charging = false;
    pancake.vy = -(420 + power * 430);
    pancake.spin = (2.2 + power * 6.8) * (Math.random() < 0.5 ? 1 : -1);
  }

  function update(dt) {
    now += dt;
    shake = Math.max(0, shake - dt * 3);
    if (state === "over") { overT += dt; if (overT > 0.7) showEnd(); return; }

    if (state === "ready") return;
    if (state === "charge") { charge(dt); return; }

    // fly
    if (state === "fly") {
      pancake.vy += GRAV * dt;
      pancake.y += pancake.vy * dt;
      pancake.ang += pancake.spin * dt;
      // 落地（回到锅面）
      if (pancake.vy > 0 && pancake.y >= PAN.y - R - 6) {
        pancake.y = PAN.y - R - 6;
        land();
      }
    }

    parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    parts = parts.filter((p) => p.t < 0.5);
    floats.forEach((f) => (f.t += dt));
    floats = floats.filter((f) => f.t < 0.9);
  }

  function land() {
    attempts++;
    const half = Math.round(pancake.ang / Math.PI);
    const odd = Math.abs(half % 2) === 1;          // 奇数个半圈 → 金黄面朝上
    const perfect = Math.abs(pancake.ang - half * Math.PI) < 0.16;
    burst(pancake.x, pancake.y);
    if (odd) {
      successes++;
      if (comboOk) combo++; else { combo = 1; comboOk = true; }
      const pts = perfect ? 15 : 10;
      score += pts;
      scoreEl.textContent = score;
      bump(scoreEl);
      if (score > best) bestEl.textContent = score;
      addFloat(pancake.x, pancake.y - R - 14, (perfect ? "完美 +" : "+") + pts + (combo > 1 ? " ×" + combo : ""),
        perfect ? "#ffd166" : "#7ce08a");
      comboEl.textContent = combo;
    } else {
      comboOk = false;
      lives--;
      setLives();
      shake = 1;
      addFloat(pancake.x, pancake.y - R - 14, "糊了…", "#ff5d6c");
      if (lives <= 0) { state = "over"; overT = 0; return; }
    }
    // 重置回锅面
    pancake = { x: W / 2, y: PAN.y - R - 6, vy: 0, ang: 0, spin: 0 };
    power = 0;
    state = "ready";
  }

  function shot(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 40 + Math.random() * 140;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, color });
    }
  }
  function burst(x, y) {
    shot(x, y, "#f2b64a", 8);
    shot(x, y, "#8a5a2b", 4);
  }
  function addFloat(x, y, text, color) { floats.push({ x, y, text, color, t: 0 }); }

  function showEnd() {
    const isNew = score > best;
    if (isNew) { best = score; try { localStorage.setItem("panflip-best", String(best)); } catch (_) {} bestEl.textContent = best; }
    endTitle.textContent = "🍳 收工！";
    endMsg.innerHTML = "得分 <b>" + score + "</b> · 成功 " + successes + "/" + attempts + " 次" +
      (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
    endModal.classList.add("show");
  }

  /* ---------- 绘制 ---------- */
  function drawPan() {
    ctx.fillStyle = "#3a332a";
    ctx.fillRect(W / 2 - PAN.w / 2, PAN.y, PAN.w, PAN.h - 6);
    ctx.fillStyle = "#241f18";
    ctx.fillRect(W / 2 - PAN.w / 2 + 4, PAN.y + PAN.h - 4, PAN.w - 8, 10);
  }
  function drawPancake(angle) {
    ctx.save();
    ctx.translate(pancake.x, pancake.y);
    ctx.rotate(angle);
    // 底（浅色面）
    ctx.fillStyle = "#f7e2b0";
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
    // 金黄面：半圆遮片（随角度转动）
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI); ctx.closePath();
    ctx.clip();
    ctx.fillStyle = "#f2b64a";
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
    // 焦痕
    ctx.strokeStyle = "rgba(138,90,43,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc((i % 2 ? 1 : -1) * R * 0.35, (i % 2 ? -1 : 1) * R * 0.3, R * 0.16, 0, 7);
      ctx.stroke();
    }
    // 外圈
    ctx.strokeStyle = "rgba(138,90,43,0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R - 1.5, 0, 7); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 8, 0);
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2a2118"); g.addColorStop(1, "#120d08");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 暖光
    ctx.fillStyle = "rgba(242,182,74,0.06)";
    ctx.beginPath(); ctx.arc(W / 2, PAN.y - 60, 180, 0, 7); ctx.fill();

    drawPan();
    pancake.y > PAN.y - R - 60 ? drawPancake(pancake.ang) : drawPancake(pancake.ang);

    // 蓄力条
    if (state === "charge") {
      const w = 160;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(W / 2 - w / 2, 26, w, 8);
      ctx.fillStyle = power > 0.8 ? "#ff5d6c" : power > 0.45 ? "#ffd166" : "#7ce08a";
      ctx.fillRect(W / 2 - w / 2, 26, w * power, 8);
      ctx.font = "11px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#ece0c8";
      ctx.fillText("蓄力 " + Math.round(power * 100) + "%（金黄面若朝向锅底≈翻面成功）", W / 2, 48);
    }
    if (state === "ready") {
      ctx.font = "13px sans-serif"; ctx.textAlign = "center";
      ctx.fillStyle = "#9adcff";
      ctx.fillText("按住蓄力，松手甩起", W / 2, H - 110);
    }

    parts.forEach((p) => { ctx.globalAlpha = 1 - p.t / 0.5; ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); });
    ctx.globalAlpha = 1;
    ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
    floats.forEach((f) => { ctx.globalAlpha = 1 - f.t / 0.9; ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - f.t * 40); });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ---------- 输入 ---------- */
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { charging = true; power = 0; state = "charge"; }
    else if (state === "charge") { }
  });
  window.addEventListener("pointerup", () => { if (state === "charge") launch(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " " && !e.repeat && state === "ready") { charging = true; power = 0; state = "charge"; }
  });
  document.addEventListener("keyup", (e) => { if (e.key === " " && state === "charge") launch(); });
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
