/* ============================================================
   喂宠物 · 休闲娱乐（单人养成）
   保持饱食 & 心情；喂食 / 玩耍；撑得越久越好
   ============================================================ */
(function () {
  "use strict";

  const petEl = document.getElementById("pet");
  const moodEl = document.getElementById("mood");
  const fullEl = document.getElementById("full");
  const daysEl = document.getElementById("days");
  const feedBtn = document.getElementById("feedBtn");
  const playBtn = document.getElementById("playBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let mood = 100, full = 100, day = 0, over = false;
  let raf = 0, last = 0, tickAcc = 0;

  function reset() {
    mood = 100; full = 100; day = 0; over = false; tickAcc = 0;
  }

  function render() {
    moodEl.textContent = Math.max(0, Math.round(mood));
    fullEl.textContent = Math.max(0, Math.round(full));
    daysEl.textContent = day;
    updatemoodface();
  }
  function updatemoodface() {
    petEl.className = "pet";
    if (over) petEl.classList.add("sad");
    else if (mood > 75) petEl.classList.add("happy");
    else if (mood < 35) petEl.classList.add("angry");
  }

  function update(dt) {
    if (over) return;
    tickAcc += dt;
    full -= dt * 1.6;
    // 太饿会掉心情
    if (full < 25) mood -= dt * 4;
    else mood -= dt * 0.4;
    // 每 8 秒算一天
    if (tickAcc >= 8) { tickAcc -= 8; day++; }
    if (full <= 0 || mood <= 0) { die(); return; }
    render();
  }

  function feed() {
    if (over) return;
    full += 26;
    chomp();
    if (mood > 92) mood -= 8;      // 喂太饱会发脾气
    else if (full < 100) mood = Math.min(100, mood + 6);
    msgEl.textContent = "🥕 吃饱饱~";
    render();
  }
  function play() {
    if (over) return;
    mood = Math.min(100, mood + 18);
    full -= 14;
    if (full < 12) mood -= 10;    // 玩太累且饿会生气
    msgEl.textContent = "🎾 玩得好开心！";
    render();
  }
  function chomp() {
    petEl.classList.add("eat");
    setTimeout(() => petEl.classList.remove("eat"), 300);
  }

  function die() {
    over = true;
    endTitle.textContent = "✖️ 宠物离你而去";
    endMsg.textContent = "坚持了 " + day + " 天。它饿了/心情差，走啦。";
    msgEl.className = "msg lose";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function loop(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    reset();
    msgEl.textContent = "让宠物保持吃饱、心情好。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
    if (raf) cancelAnimationFrame(raf);
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  feedBtn.addEventListener("click", feed);
  playBtn.addEventListener("click", play);
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
    if (e.key === " " || e.code === "Space") { e.preventDefault(); feed(); }
  });

  start();
})();
