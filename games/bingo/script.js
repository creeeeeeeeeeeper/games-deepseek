/* ============================================================
   宾果 · 棋牌对战（人机 数字卡）
   各有一张 5×5 卡，轮流报数并自动圈掉；先连成一条线者胜
   ============================================================ */
(function () {
  "use strict";

  const myCardEl = document.getElementById("myCard");
  const myLinesEl = document.getElementById("myLines");
  const aiLinesEl = document.getElementById("aiLines");
  const calledEl = document.getElementById("called");
  const drawBtn = document.getElementById("drawBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const SIZE = 5;
  let myNums = [], myMark = [], aiNums = [], aiMark = [];
  let turn = "player", over = false, busy = false, used = new Set();

  function makeCard() {
    // 行主序填充：i = r*SIZE+c；使同一"列"(固定 c)落入同一个 15 区间
    const nums = new Array(SIZE * SIZE);
    for (let c = 0; c < SIZE; c++) {
      const lo = c * 15 + 1, hi = c * 15 + 15;
      const colSet = new Set();
      while (colSet.size < SIZE) colSet.add(lo + ((Math.random() * 15) | 0));
      const colNums = [...colSet].sort((a, b) => a - b);
      for (let r = 0; r < SIZE; r++) nums[/* idx(r,c) */ r * SIZE + c] = colNums[r];
    }
    nums[12] = "★";
    const marks = nums.map((n) => n === "★");
    return { nums, marks };
  }

  function newGame() {
    const a = makeCard(), b = makeCard();
    myNums = a.nums; myMark = a.marks;
    aiNums = b.nums; aiMark = b.marks;
    used = new Set(); turn = "player"; over = false; busy = false;
  }

  const idx = (r, c) => r * SIZE + c;

  function checkLines(nums, marks) {
    let lines = 0;
    for (let r = 0; r < SIZE; r++) { let ok = true; for (let c = 0; c < SIZE; c++) if (!marks[idx(r, c)]) ok = false; if (ok) lines++; }
    for (let c = 0; c < SIZE; c++) { let ok = true; for (let r = 0; r < SIZE; r++) if (!marks[idx(r, c)]) ok = false; if (ok) lines++; }
    let d1 = true, d2 = true;
    for (let i = 0; i < SIZE; i++) { if (!marks[idx(i, i)]) d1 = false; if (!marks[idx(i, SIZE - 1 - i)]) d2 = false; }
    if (d1) lines++; if (d2) lines++;
    return lines;
  }

  function render() {
    myCardEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const i = idx(r, c);
        const cell = document.createElement("div");
        cell.className = "cell" + (myNums[i] === "★" ? " free" : "") + (myMark[i] ? " marked" : "");
        cell.textContent = myNums[i];
        myCardEl.appendChild(cell);
      }
    }
    drawBtn.disabled = over || busy || turn !== "player";
  }

  function renderCounts() {
    myLinesEl.textContent = checkLines(myNums, myMark);
    aiLinesEl.textContent = checkLines(aiNums, aiMark);
  }

  function drawNum() {
    let n;
    do { n = 1 + ((Math.random() * 75) | 0); } while (used.has(n));
    used.add(n);
    return n;
  }

  // 自动圈掉
  function autoMark(nums, marks, n) {
    const i = nums.indexOf(n);
    if (i >= 0) marks[i] = true;
  }

  function onDrawBtn() {
    if (over || busy || turn !== "player") return;
    busy = true;
    const n = drawNum();
    calledEl.textContent = n;
    autoMark(myNums, myMark, n);
    renderCounts();
    if (checkLines(myNums, myMark) > 0) { finish("player"); return; }
    msgEl.textContent = "你叫到 " + n + "，AI 叫下一个。";
    render();
    turn = "ai";
    setTimeout(aiTurn, 600);
  }

  function aiTurn() {
    if (over) return;
    busy = true;
    const n = drawNum();
    calledEl.textContent = n;
    autoMark(aiNums, aiMark, n);
    renderCounts();
    if (checkLines(aiNums, aiMark) > 0) { finish("ai"); return; }
    msgEl.textContent = "AI 叫到 " + n + "，轮到你了。";
    turn = "player";
    busy = false;
    render();
  }

  function finish(winner) {
    over = true;
    const myL = checkLines(myNums, myMark), aiL = checkLines(aiNums, aiMark);
    endTitle.textContent = winner === "player" ? "🎉 BINGO！你赢了" : "🤖 AI 先连成线";
    endMsg.textContent = "你 " + myL + " 条线 · AI " + aiL + " 条线";
    msgEl.className = "msg " + (winner === "player" ? "win" : "lose");
    render();
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    newGame();
    calledEl.textContent = "—";
    msgEl.textContent = "轮到你时点「报数」，报出的数字会自动圈到两张卡上。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    renderCounts();
    render();
  }

  drawBtn.addEventListener("click", onDrawBtn);
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });

  start();
})();
