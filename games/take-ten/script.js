/* ============================================================
   抢10 · 桌游（对 AI）
   1-9 轮流取，先凑成子集和=10 者赢；AI 会抢你需要的数
   ============================================================ */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  const turnEl = document.getElementById("turn");
  const youSetEl = document.getElementById("youSet");
  const aiSetEl = document.getElementById("aiSet");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let youSet = [], aiSet = [], used = {}, turn = "you", over = false;

  function subsetSum10(arr) {
    let possible = { 0: true };
    for (const n of arr) {
      const next = {};
      for (const k in possible) {
        const v = parseInt(k, 10) + n;
        if (v === 10) return true;
        if (v < 10) next[v] = true;
      }
      for (const k in next) possible[k] = true;
    }
    return !!possible["10"];
  }

  function sync() {
    Array.from(boardEl.children).forEach((b) => {
      const v = parseInt(b.dataset.v, 10);
      b.classList.toggle("used", !!used[v]);
      b.classList.toggle("mine", youSet.includes(v));
      b.classList.toggle("aiv", aiSet.includes(v));
    });
    youSetEl.textContent = youSet.length ? youSet.join(", ") : "—";
    aiSetEl.textContent = aiSet.length ? aiSet.join(", ") : "—";
    turnEl.textContent = turn === "you" ? "你" : "AI";
    turnEl.style.color = turn === "you" ? "#7ce08a" : "#ff8a97";
  }

  function checkWin(who) {
    const set = who === "you" ? youSet : aiSet;
    if (subsetSum10(set)) {
      over = true;
      const win = who === "you";
      msgEl.textContent = win ? "🎉 你凑出 10 了！（" + set.filter(x => true).join(",") + "）" : "🤖 AI 凑出 10（" + set.join(",") + "）";
      msgEl.className = "msg win";
      endTitle.textContent = win ? "🔟 你赢了！" : "🤖 AI 赢了…";
      endMsg.textContent = "你的数：" + (youSet.join(",") || "无") + "　AI 的数：" + (aiSet.join(",") || "无");
      setTimeout(() => endModal.classList.add("show"), 500);
      return true;
    }
    return false;
  }

  function take(v, who) {
    if (over || used[v]) return false;
    used[v] = true;
    if (who === "you") youSet.push(v); else aiSet.push(v);
    sync();
    return !checkWin(who);
  }

  function playerPick(v) {
    if (turn !== "you") return;
    if (!take(v, "you")) return;
    if (allUsed()) { draw(); return; }
    turn = "ai";
    sync();
    setTimeout(aiPick, 700);
  }

  function aiPick() {
    if (over || turn !== "ai" || allUsed()) { if (allUsed()) draw(); return; }
    // 1) 自己赢  2) 抢你需要的数  3) 随机
    const unused = [];
    for (let i = 1; i <= 9; i++) if (!used[i]) unused.push(i);
    let pick = null;
    for (const n of unused) { if (subsetSum10(aiSet.concat([n]))) { pick = n; break; } }
    if (pick === null) {
      for (const n of unused) { if (subsetSum10(youSet.concat([n]))) { pick = n; break; } }
    }
    if (pick === null) pick = unused[(Math.random() * unused.length) | 0];
    if (!take(pick, "ai")) return;
    if (allUsed()) { draw(); return; }
    turn = "you";
    sync();
    msgEl.textContent = "AI 拿走了 " + pick + "。轮到你。";
    msgEl.className = "msg";
  }

  function allUsed() { return Object.keys(used).length === 9 && [1,2,3,4,5,6,7,8,9].every((n) => used[n]); }

  function draw() {
    if (over) return;
    over = true;
    msgEl.textContent = "🤝 桌面取完，双方都没凑出 10，平局。";
    msgEl.className = "msg";
    endTitle.textContent = "🤝 平局";
    endMsg.textContent = "你的数：" + (youSet.join(",") || "无") + "　AI 的数：" + (aiSet.join(",") || "无");
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function build() {
    boardEl.innerHTML = "";
    for (let i = 1; i <= 9; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.v = i;
      b.textContent = i;
      b.addEventListener("click", () => playerPick(i));
      boardEl.appendChild(b);
    }
  }

  function start() {
    youSet = []; aiSet = []; used = {}; turn = "you"; over = false;
    msgEl.textContent = "你先手，挑一个数。"; msgEl.className = "msg";
    endModal.classList.remove("show");
    build();
    sync();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
    if (/^[1-9]$/.test(e.key)) playerPick(parseInt(e.key, 10));
  });
  againBtn.addEventListener("click", start);

  start();
})();
