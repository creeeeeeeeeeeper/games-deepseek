/* ============================================================
   磁吸星辰 · 原创小游戏
   按住开启磁力场，把漂移的星辰吸进下方采集槽；金色+5，黑洞-3
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 520;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const TIME = 30;
  const PORTAL = { x: W / 2, y: H - 54, r: 46 };
  const MAG_R = 150;

  let best = 0;
  try { best = parseInt(localStorage.getItem("magstar-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "ready";      // ready | count | play | over
  let score = 0, combo = 0, comboT = 0, got = 0;
  let timeLeft = TIME;
  let stars = [];
  let parts = [];
  let floats = [];
  let spawnT = 0;
  let magnet = { on: false, x: W / 2, y: H - 120 };
  let overT = 0, countT = 0;
  let lastMs = 0, now = 0;

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function spawn() {
    const roll = Math.random();
    let kind = "star", r = 10, color = "#ffe08a", speed = 34 + Math.random() * 40;
    if (roll < 0.08) { kind = "gold"; r = 7; color = "#ffd166"; speed = 60 + Math.random() * 50; }
    else if (roll < 0.16) { kind = "hole"; r = 12; color = "#2a2f3a"; speed = 26 + Math.random() * 24; }
    stars.push({
      kind, r, color, speed,
      x: W * 0.1 + Math.random() * W * 0.8,
      y: -20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 30,
      vy: speed,
    });
  }

  function update(dt) {
    now += dt;
    if (state === "count") { countT += dt; if (countT >= 0.9) { state = "play"; timeLeft = TIME; lastMs += 0; } return; }
    if (state !== "play") return;

    timeLeft -= dt;
    timeEl.textContent = Math.max(0, Math.ceil(timeLeft));
    timeEl.classList.toggle("danger", timeLeft <= 5);
    if (timeLeft <= 0) { endGame(); return; }

    // 生成
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = 0.55 + Math.random() * 0.4; spawn(); }

    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      // 磁力吸引（按住时，且非黑洞也轻微受扰）
      if (magnet.on) {
        const dx = magnet.x - s.x, dy = magnet.y - s.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < MAG_R) {
          const push = (s.kind === "hole" ? -1 : 1) * (220 * (1 - d / MAG_R));
          s.vx += (dx / d) * push * dt;
          s.vy += (dy / d) * push * dt;
        }
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // 阻尼 + 速度上限
      s.vx *= 0.995; s.vy = Math.min(Math.max(s.vy, -240), 260);

      // 边界反弹
      if (s.x < s.r) { s.x = s.r; s.vx = Math.abs(s.vx); }
      if (s.x > W - s.r) { s.x = W - s.r; s.vx = -Math.abs(s.vx); }
      if (s.y < s.r) { s.y = s.r; s.vy = Math.abs(s.vy); }

      // 采集判定
      if (s.kind !== "hole" && Math.hypot(s.x - PORTAL.x, s.y - PORTAL.y) < PORTAL.r - 4) {
        collect(s, i);
      } else if (s.kind === "hole" && Math.hypot(s.x - PORTAL.x, s.y - PORTAL.y) < PORTAL.r - 4) {
        explodeHole(s, i);
      } else if (s.y > H + 30) {
        stars.splice(i, 1);
      }
    }

    // 粒子 / 飘字
    parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    parts = parts.filter((p) => p.t < 0.5);
    floats.forEach((f) => (f.t += dt));
    floats = floats.filter((f) => f.t < 0.9);
  }

  function collect(s, i) {
    stars.splice(i, 1);
    got++;
    const nowS = now;
    if (nowS - comboT < 1.2) combo++; else combo = 1;
    comboT = nowS;
    const pts = s.kind === "gold" ? 5 : 1;
    score += pts;
    scoreEl.textContent = score;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;
    boom(s.x, s.y, s.color);
    addFloat(PORTAL.x, PORTAL.y - 40, "+" + pts + (combo > 1 ? " ×" + combo : ""), s.kind === "gold" ? "#ffd166" : "#fff3c0");
  }
  function explodeHole(s, i) {
    stars.splice(i, 1);
    score = Math.max(0, score - 3);
    combo = 0;
    comboEl.textContent = 0;
    scoreEl.textContent = score;
    bump(scoreEl);
    boom(s.x, s.y, "#ff5d6c", 22);
    addFloat(PORTAL.x, PORTAL.y - 40, "-3 黑洞", "#ff5d6c");
  }

  function boom(x, y, color, n) {
    n = n || 10;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 50 + Math.random() * 150;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, color });
    }
  }
  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, t: 0 });
  }

  function endGame() {
    state = "over";
    overT = 0;
    const isNew = score > best;
    if (isNew) { best = score; try { localStorage.setItem("magstar-best", String(best)); } catch (_) {} bestEl.textContent = best; }
    endTitle.textContent = isNew ? "🏆 新纪录！" : "⏰ 时间到！";
    endMsg.innerHTML = "得分 <b>" + score + "</b> · 采集 " + got + " 颗 · 最高连击 " + combo +
      "<br>" + (isNew ? "🏆 新纪录！" : "最高分 " + best);
    setTimeout(() => endModal.classList.add("show"), 450);
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#12211a");
    g.addColorStop(1, "#0a0f08");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 采集槽
    ctx.strokeStyle = "rgba(231,193,78,0.7)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(PORTAL.x, PORTAL.y, PORTAL.r, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(231,193,78,0.08)";
    ctx.beginPath();
    ctx.arc(PORTAL.x, PORTAL.y, PORTAL.r - 3, 0, 7);
    ctx.fill();
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(236,224,200,0.6)";
    ctx.fillText("采集槽", PORTAL.x, PORTAL.y + 4);

    // 磁力场（按住时）
    if (magnet.on) {
      const pulse = 1 + 0.06 * Math.sin(now * 6);
      ctx.strokeStyle = "rgba(58,168,173,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(magnet.x, magnet.y, MAG_R * pulse, 0, 7);
      ctx.stroke();
      ctx.fillStyle = "rgba(58,168,173,0.08)";
      ctx.beginPath();
      ctx.arc(magnet.x, magnet.y, MAG_R, 0, 7);
      ctx.fill();
    }

    // 星辰 / 黑洞
    stars.forEach((s) => {
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.kind === "hole") {
        const rg = ctx.createRadialGradient(0, 0, 1, 0, 0, s.r + 4);
        rg.addColorStop(0, "#000");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(0, 0, s.r + 4, 0, 7); ctx.fill();
        ctx.fillStyle = "#14171f";
        ctx.beginPath(); ctx.arc(0, 0, s.r, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(214,69,58,0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, s.r + 2, 0, 7); ctx.stroke();
      } else {
        const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, s.r * 2.4);
        glow.addColorStop(0, s.color);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, s.r * 2.4, 0, 7); ctx.fill();
        ctx.fillStyle = s.kind === "gold" ? "#ffe9a8" : s.color;
        ctx.beginPath(); ctx.arc(0, 0, s.r, 0, 7); ctx.fill();
        // 星芒
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1.4;
        for (let a = 0; a < 4; a++) {
          const ang = a * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ang) * s.r, Math.sin(ang) * s.r);
          ctx.lineTo(Math.cos(ang) * (s.r + 6), Math.sin(ang) * (s.r + 6));
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // 粒子 / 飘字
    parts.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / 0.5;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    floats.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / 0.9;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - f.t * 44);
    });
    ctx.globalAlpha = 1;

    if (state === "ready") {
      ctx.fillStyle = "rgba(10,15,8,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("🧲 磁吸星辰", W / 2, H / 2 - 40);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#9adcff";
      ctx.fillText("按住屏幕吸附星辰，送进下方采集槽", W / 2, H / 2);
      ctx.fillStyle = "#ffe9b3";
      ctx.font = "bold 17px sans-serif";
      ctx.fillText("点击开始", W / 2, H / 2 + 40);
    } else if (state === "count") {
      ctx.fillStyle = "rgba(10,15,8,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8";
      ctx.font = "bold 60px sans-serif";
      ctx.fillText("3", W / 2, H / 2 + 10);
    }
  }

  /* ---------- 指针 ---------- */
  function setMag(e) {
    const r = cv.getBoundingClientRect();
    magnet.x = ((e.clientX - r.left) / r.width) * W;
    magnet.y = ((e.clientY - r.top) / r.height) * H;
  }
  cv.addEventListener("pointerdown", (e) => {
    if (state === "ready") { state = "count"; countT = 0; spawn(); return; }
    e.preventDefault();
    setMag(e);
    magnet.on = true;
  });
  cv.addEventListener("pointermove", (e) => { if (magnet.on) setMag(e); });
  window.addEventListener("pointerup", () => { magnet.on = false; });

  function startCount() {
    state = "count";
    countT = 0;
    score = 0; combo = 0; got = 0; comboT = 0; timeLeft = TIME;
    stars = []; parts = []; floats = [];
    spawnT = 0.4;
    scoreEl.textContent = "0"; comboEl.textContent = "0"; timeEl.textContent = TIME; timeEl.classList.remove("danger");
    endModal.classList.remove("show");
    for (let i = 0; i < 6; i++) spawn();
  }

  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); startCount(); }
  });
  againBtn.addEventListener("click", startCount);

  startCount();
  requestAnimationFrame(frame);
})();
