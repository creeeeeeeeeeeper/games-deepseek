/* ============================================================
   播棋（Kalah）· 棋牌对战（人机）
   14 格：0-5 玩家洞、6 玩家仓库、7-12 AI 洞、13 AI 仓库
   ============================================================ */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  const myStoreEl = document.getElementById("myStore");
  const aiStoreEl = document.getElementById("aiStore");
  const turnEl = document.getElementById("turn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let board, turn, over = false, busy = false;

  function newBoard() {
    board = [];
    for (let i = 0; i < 14; i++) board.push(i === 6 || i === 13 ? 0 : 4);
    // 简化起手：每洞 4 子
    turn = "player";
  }

  // 播种：p 是播种起始洞（玩家：0-5，AI：7-12）
  function sow(p, who) {
    const seeds = board[p];
    board[p] = 0;
    let i = p;
    let extra = false, captured = 0;
    for (let step = 0; step < seeds; step++) {
      i = (i + 1) % 14;
      // 跳过对方仓库
      if (who === "player" && i === 13) i = (i + 1) % 14;
      if (who === "ai" && i === 6) i = (i + 1) % 14;
      board[i]++;
    }
    // 最后一粒落自己仓库 → 再走一次
    if (who === "player" && i === 6) extra = true;
    if (who === "ai" && i === 13) extra = true;
    // 最后一粒落自己一侧空穴且对面有子 → 收子
    if (who === "player" && i >= 0 && i <= 5 && board[i] === 1) {
      const opp = 12 - i;
      if (board[opp] > 0) {
        captured = board[opp] + 1;
        board[6] += captured; board[i] = 0; board[opp] = 0;
      }
    }
    if (who === "ai" && i >= 7 && i <= 12 && board[i] === 1) {
      const opp = 12 - i;
      if (board[opp] > 0) {
        captured = board[opp] + 1;
        board[13] += captured; board[i] = 0; board[opp] = 0;
      }
    }
    return extra;
  }

  function myEmpty() { for (let i = 0; i < 6; i++) if (board[i] > 0) return false; return true; }
  function aiEmpty() { for (let i = 7; i < 13; i++) if (board[i] > 0) return false; return true; }

  function render() {
    boardEl.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "rows";

    // AI 洞 row（7-12，视觉从左到右反转）
    const aiRow = document.createElement("div");
    aiRow.className = "hole-row";
    for (let i = 12; i >= 7; i--) {
      const h = makeHole(i, false);
      aiRow.appendChild(h);
    }
    // 带仓库的中间行：AI 仓库在左，玩家仓库在右
    const midRow = document.createElement("div");
    midRow.className = "hole-row";
    const aiStore = document.createElement("div");
    aiStore.className = "store ai"; aiStore.textContent = board[13];
    const pits = document.createElement("div");
    pits.style.display = "flex"; pits.style.gap = "10px"; pits.style.flex = "1"; pits.style.justifyContent = "center";
    for (let i = 0; i < 6; i++) pits.appendChild(makeHole(i, turn === "player" && !over && !busy && board[i] > 0));
    const myStore = document.createElement("div");
    myStore.className = "store mine"; myStore.textContent = board[6];
    midRow.appendChild(aiStore); midRow.appendChild(pits); midRow.appendChild(myStore);

    wrap.appendChild(aiRow);
    wrap.appendChild(midRow);
    boardEl.appendChild(wrap);
    // 仓库在展示行里，这里更新计数
    myStoreEl.textContent = board[6];
    aiStoreEl.textContent = board[13];
    turnEl.textContent = turn === "player" ? "你" : "AI";
    turnEl.style.color = turn === "player" ? "var(--accent-2)" : "var(--danger)";
  }

  function makeHole(idx, canplay) {
    const h = document.createElement("div");
    h.className = "hole" + (canplay ? " canplay" : " disabled");
    h.textContent = board[idx];
    h.dataset.idx = idx;
    h.addEventListener("click", () => onTake(idx));
    return h;
  }

  function onTake(idx) {
    if (over || busy || turn !== "player") return;
    if (idx < 0 || idx > 5 || board[idx] === 0) return;
    busy = true;
    const extra = sow(idx, "player");
    if (checkEnd()) { over = true; render(); return; }
    if (!extra) { turn = "ai"; }
    busy = false;
    render();
    if (turn === "ai") setTimeout(aiMove, 550);
  }

  function aiMove() {
    if (over) return;
    let bestIdx = -1, bestScore = -Infinity;
    for (let i = 7; i < 13; i++) {
      if (board[i] === 0) continue;
      const copy = board.slice();
      const co = newBoardCopy(copy);
      const extra = sowOn(co, i, "ai");
      // 简单启发式：AI 仓库多则好，能再走一次加分
      let sc = co[13] - co[6];
      if (extra) sc += 4;
      if (sc > bestScore) { bestScore = sc; bestIdx = i; }
    }
    if (bestIdx === -1) { // 无子可走
      checkEnd(); over = true; render(); return;
    }
    busy = true;
    const extra = sow(bestIdx, "ai");
    if (checkEnd()) { over = true; busy = false; render(); return; }
    if (!extra) turn = "player";
    busy = false;
    render();
    msgEl.textContent = "AI 走了 " + (bestIdx - 6) + " 号洞。";
  }

  function newBoardCopy(arr) { const b = arr.slice(); return b; }
  function sowOn(board, p, who) {
    const seeds = board[p]; board[p] = 0; let i = p, extra = false;
    for (let step = 0; step < seeds; step++) {
      i = (i + 1) % 14;
      if (who === "player" && i === 13) i = (i + 1) % 14;
      if (who === "ai" && i === 6) i = (i + 1) % 14;
      board[i]++;
    }
    if (who === "player" && i === 6) extra = true;
    if (who === "ai" && i === 13) extra = true;
    if (who === "player" && i <= 5 && board[i] === 1) { const opp = 12 - i; if (board[opp] > 0) { board[6] += board[opp] + 1; board[i] = 0; board[opp] = 0; } }
    if (who === "ai" && i >= 7 && i <= 12 && board[i] === 1) { const opp = 12 - i; if (board[opp] > 0) { board[13] += board[opp] + 1; board[i] = 0; board[opp] = 0; } }
    return extra;
  }

  function checkEnd() {
    // 一侧清空则结束，另一侧全收入仓库
    let ended = false;
    if (myEmpty()) { for (let i = 7; i < 13; i++) { board[13] += board[i]; board[i] = 0; } ended = true; }
    else if (aiEmpty()) { for (let i = 0; i < 6; i++) { board[6] += board[i]; board[i] = 0; } ended = true; }
    if (!ended) return false;

    const mine = board[6], a = board[13];
    over = true;
    endTitle.textContent = mine > a ? "🎉 你赢了！" : (mine < a ? "🤖 AI 赢了" : "🤝 平局");
    endMsg.textContent = "你 " + mine + " · AI " + a;
    return true;
  }

  function start() {
    newBoard();
    over = false; busy = false;
    msgEl.textContent = "点击你一侧的洞来播种。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });

  start();
})();
