/* ============================================================
   数织 · 经典益智（单人）
   根据行列数字提示涂黑格子，拼出像素画
   ============================================================ */
(function () {
  "use strict";

  const nonoEl = document.getElementById("nono");
  const filledEl = document.getElementById("filled");
  const correctEl = document.getElementById("correct");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const SIZE = 8;
  let target = [], cells = [], over = false;

  // 预置几幅像素画（8×8 = 简单图形）
  const PATTERNS = [
    /* 爱心 */
    [0,1,1,0,0,1,1,0, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 0,1,1,1,1,1,1,0, 0,0,1,1,1,1,0,0, 0,0,0,1,1,0,0,0, 0,0,0,0,0,0,0,0],
    /* 笑脸 */
    [0,0,0,0,0,0,0,0, 0,0,1,0,0,1,0,0, 0,0,1,0,0,1,0,0, 0,0,0,0,0,0,0,0, 0,1,0,0,0,0,1,0, 1,0,1,1,1,1,0,1, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0],
    /* 叉号 */
    [1,0,0,0,0,0,0,1, 0,1,0,0,0,0,1,0, 0,0,1,0,0,1,0,0, 0,0,0,1,1,0,0,0, 0,0,0,1,1,0,0,0, 0,0,1,0,0,1,0,0, 0,1,0,0,0,0,1,0, 1,0,0,0,0,0,0,1],
    /* 方块塔 */
    [0,0,0,0,1,0,0,0, 0,0,0,1,1,1,0,0, 0,0,0,1,1,1,0,0, 0,1,1,1,1,1,1,0, 0,1,1,1,1,1,1,0, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 0,0,0,0,0,0,0,0],
    /* 小舟 */
    [0,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 1,1,0,0,0,0,1,1, 1,1,1,1,1,1,1,1, 1,1,1,1,1,1,1,1, 0,1,1,1,1,1,1,0, 0,0,1,1,1,1,0,0, 0,0,0,0,0,0,0,0],
  ];

  function cluesFor(pattern) {
    const rowClues = [], colClues = [];
    for (let r = 0; r < SIZE; r++) {
      const seq = [];
      let run = 0;
      for (let c = 0; c < SIZE; c++) {
        if (pattern[r * SIZE + c]) run++;
        else if (run) { seq.push(run); run = 0; }
      }
      if (run) seq.push(run);
      rowClues.push(seq.length ? seq : [0]);
    }
    for (let c = 0; c < SIZE; c++) {
      const seq = [];
      let run = 0;
      for (let r = 0; r < SIZE; r++) {
        if (pattern[r * SIZE + c]) run++;
        else if (run) { seq.push(run); run = 0; }
      }
      if (run) seq.push(run);
      colClues.push(seq.length ? seq : [0]);
    }
    return { rowClues, colClues };
  }

  function makeGame() {
    target = PATTERNS[(Math.random() * PATTERNS.length) | 0].slice();
    cells = Array(SIZE * SIZE).fill(0);
  }

  function render() {
    nonoEl.innerHTML = "";
    nonoEl.style.gridTemplateColumns = "64px repeat(" + SIZE + ", 30px)";
    nonoEl.style.gridTemplateRows = "64px repeat(" + SIZE + ", 30px)";
    const { rowClues, colClues } = cluesFor(target);
    // 左上角空白
    const corner = document.createElement("div"); nonoEl.appendChild(corner);
    // 顶部列提示
    for (let c = 0; c < SIZE; c++) {
      const clue = document.createElement("div");
      clue.className = "clue";
      clue.textContent = colClues[c].join("\n");
      nonoEl.appendChild(clue);
    }
    // 行
    for (let r = 0; r < SIZE; r++) {
      const clue = document.createElement("div");
      clue.className = "clue";
      clue.textContent = rowClues[r].join(" ");
      nonoEl.appendChild(clue);
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "ncell " + (cells[r * SIZE + c] === 1 ? "filled" : cells[r * SIZE + c] === 2 ? "x-mark" : "");
        cell.addEventListener("click", () => tap(r, c));
        cell.addEventListener("contextmenu", (e) => { e.preventDefault(); tap(r, c, true); });
        nonoEl.appendChild(cell);
      }
    }
    // 计数
    let f = 0, ok = 0;
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (cells[i] === 1) f++;
      if (cells[i] === 1 && target[i]) ok++;
    }
    filledEl.textContent = f;
    correctEl.textContent = ok;
    if (!over && cells.every((v, i) => (v === 1) === (target[i] === 1))) finish();
  }

  function tap(r, c, markX) {
    if (over) return;
    const i = r * SIZE + c;
    if (markX) { cells[i] = cells[i] === 2 ? 0 : 2; }
    else { cells[i] = cells[i] === 1 ? 0 : 1; }
    render();
  }

  function finish() {
    over = true;
    endTitle.textContent = "🎉 完成！";
    endMsg.textContent = "像素画拼好了！";
    msgEl.className = "msg win";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function start() {
    makeGame();
    over = false;
    msgEl.textContent = "根据数字提示涂黑格子。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  start();
})();
