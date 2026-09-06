/* ============================================================
   时机捕手 · 原创
   游标左右扫，绿区随机移动；趁游标在绿区内按下定格，越准越高分
   ============================================================ */
(function () {
  "use strict";

  const W = 480, H = 260;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const roundEl = document.getElementById("round");
  const hitEl = document.getElementById("hit");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const N = 10;
  const BAR_X = 40, BAR_W = W - 80, BAR_Y = H / 2;
  const MARK_R = 12, ZONE_W = 90;
  let best = 0;
  try { best = parseInt(localStorage.getItem("timing-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "ready";
  let round = 1, score = 0, hit = 0;
  let zone = { x: 0, dir: 1, speed: 40 };
  let markerT = 0, markerAmp = (BAR_W - ZONE_W) / 2;
  let locked = false, lockPts = 0, flashT = 0;
  let lastMs = 0, now = 0;

  function resetZone() {
    // 绿区随机落在可移动范围内，并给出随机方向
    zone.x = BAR_X + Math.random() * (BAR_W - ZONE_W);
    zone.dir = Math.random() < 0.5 ? 1 : -1;
    zone.speed = 60 + round * 12;
  }

  function markerX() { return 40 + (Math.sin(markerT) * 0.5 + 0.5) * (BAR_W) + MARK_R * 0; }
  function zoneX() { return Math.max(BAR_X, Math.min(BAR_X + BAR_W - ZONE_W, zone.x)); }

  function lock() {
    const mx = markerX(), zx = zoneX();
    const dist = Math.abs(mx - (zx + ZONE_W / 2));
    lockPts = Math.max(0, Math.round(100 - dist / ((BAR_W / 2) / 100)));
    hit = lockPts;
    score += lockPts;
    flashT = 0.5;
    locked = true;
    hitEl.textContent = hit;
    scoreEl.textContent = score;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;
  }

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  function next() {
    if (round >= N) { endGame(); return; }
    round++;
    roundEl.textContent = round + "/" + N;
    hitEl.textContent = 0;
    locked = false;
    resetZone();
  }

  function update(dt) {
    now += dt;
    flashT = Math.max(0, flashT - dt);
    if (state !== "play") return;
    markerT += dt * (2.2 + round * 0.15);
    zone.x += zone.dir * zone.speed * dt;
    if (zone.x <= BAR_X) { zone.x = BAR_X; zone.dir = 1; }
    if (zone.x >= BAR_X + BAR_W - ZONE_W) { zone.x = BAR_X + BAR_W - ZONE_W; zone.dir = -1; }
    if (locked && flashT <= 0) next();
  }

  function endGame() {
    state = "over";
    const isNew = score > best;
    if (isNew) { best = score; try { localStorage.setItem("timing-best", String(best)); } catch (_) {} bestEl.textContent = best; }
    endTitle.textContent = "🎯 十回合打完！";
    endMsg.innerHTML = "总分 <b>" + score + "</b>（满分 1000）" +
      (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    state = "count";
    round = 1; score = 0; hit = 0;
    roundEl.textContent = "1/10";
    hitEl.textContent = 0; scoreEl.textContent = 0;
    locked = false; flashT = 0;
    endModal.classList.remove("show");
    resetZone();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1b2433"); g.addColorStop(1, "#0c1018");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 轨道
    ctx.strokeStyle = "rgba(236,224,200,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(BAR_X, BAR_Y); ctx.lineTo(BAR_X + BAR_W, BAR_Y); ctx.stroke();

    // 绿区
    const zx = zoneX();
    ctx.fillStyle = "rgba(124,224,138,0.16)";
    ctx.fillRect(zx, BAR_Y - 16, ZONE_W, 32);
    ctx.strokeStyle = "rgba(124,224,138,0.8)";
    ctx.strokeRect(zx, BAR_Y - 16, ZONE_W, 32);

    // 游标
    const mx = markerX();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(mx, BAR_Y, MARK_R, 0, 7); ctx.fill();
    ctx.fillStyle = "#1b2433";
    ctx.beginPath(); ctx.arc(mx, BAR_Y, 5, 0, 7); ctx.fill();

    // 定格结果
    if (locked && flashT > 0) {
      ctx.fillStyle = lockPts >= 85 ? "#7ce08a" : lockPts >= 50 ? "#ffd166" : "#ff8a97";
      ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("+" + lockPts + (lockPts >= 95 ? " 完美！" : ""), zx + ZONE_W / 2, BAR_Y - 34);
    }

    // 状态
    ctx.textAlign = "center";
    if (state === "count") {
      ctx.fillStyle = "rgba(10,16,32,0.7)"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ece0c8"; ctx.font = "bold 42px sans-serif";
      ctx.fillText("第 " + round + " 回合 · 准备", W / 2, H / 2);
      ctx.font = "14px sans-serif"; ctx.fillStyle = "#9adcff";
      ctx.fillText("游标进绿区时按下！", W / 2, H / 2 + 28);
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
    if (state === "count") { state = "play"; return; }
    if (state === "play" && !locked) lock();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (e.key === " " && state === "play" && !locked) lock();
  });
  againBtn.addEventListener("click", start);

  start();
  requestAnimationFrame(frame);
})();
