/* ============================================================
   跳棋（简化国际跳棋）
   单人=对战 AI / 双人=同屏轮流
   兵斜进一格、跳吃；升王双向；清光对方或无子可动者胜
   ============================================================ */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  const msgEl = document.getElementById("msg");
  const turnEl = document.getElementById("turn");
  const countAEl = document.getElementById("countA");
  const countBEl = document.getElementById("countB");
  const lblA = document.getElementById("lblA");
  const lblB = document.getElementById("lblB");
  const restartBtn = document.getElementById("restart");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");
  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));

  // 子类型：1 红兵 2 黄兵 3 红王 4 黄王；1/2=黑? 我们设定 A(红) 在下，B(黄) 在上
  const A = 1, B = 2;          // player color group base
  let mode = "ai";
  let board = [];
  let cur = A;                 // A 红 先手（下方）
  let running = true;
  let sel = null;              // 选中的 {r,c}
  let moves = [];              // 可行落点
  let aiTimer = null;
  let counts = { [A]: 12, [B]: 12 };

  function groupOf(v) { return v >= 3 ? (v === 3 ? A : B) : v; }
  function dirOf(v) { return groupOf(v) === A ? -1 : 1; } // A 在 r 大处 → 向上(-1)
  function isKing(v) { return v === 3 || v === 4; }
  function kingOf(v) { return groupOf(v) === A ? 3 : 4; }

  function inside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

  /* 候选步：{r,c,cap:{r,c}} */
  function legalMovesOf(r, c) {
    const v = board[r][c];
    if (!v || groupOf(v) !== cur) return [];
    const out = [];
    const dirs = isKing(v) ? [-1, 1] : [dirOf(v)];
    dirs.forEach((dr) => {
      [-1, 1].forEach((dc) => {
        const nr = r + dr, nc = c + dc;
        if (!inside(nr, nc)) return;
        if (!board[nr][nc]) {
          out.push({ r: nr, c: nc, cap: null });
        } else if (groupOf(board[nr][nc]) !== groupOf(v)) {
          const jr = nr + dr, jc = nc + dc;
          if (inside(jr, jc) && !board[jr][jc]) {
            out.push({ r: jr, c: jc, cap: { r: nr, c: nc } });
          }
        }
      });
    });
    return out;
  }

  function hasCaptureMovesFor(v) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && groupOf(board[r][c]) === v) {
        if (legalMovesOf(r, c).some((m) => m.cap)) return true;
      }
    }
    return false;
  }

  function countPieces(v) {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (groupOf(board[r][c]) === v) n++;
    return n;
  }

  /* ---------- 构建 ---------- */
  function initBoard() {
    board = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) {
        let v = 0;
        if ((r + c) % 2 === 1) {
          if (r >= 5) v = A;         // 红在底部两行+第6行? r=5,6,7
          else if (r <= 2) v = B;    // 黄在顶部 0..2
        }
        row.push(v);
      }
      board.push(row);
    }
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement("div");
        sq.className = "sq " + ((r + c) % 2 === 0 ? "light" : "dark");
        sq.dataset.r = r;
        sq.dataset.c = c;
        if (sel && sel.r === r && sel.c === c) sq.classList.add("sel");
        moves.forEach((m) => { if (m.r === r && m.c === c) sq.classList.add("hint"); });
        const v = board[r][c];
        if (v) {
          const p = document.createElement("div");
          p.className = "piece " + (groupOf(v) === A ? "a" : "b") + (isKing(v) ? " king" : "");
          p.addEventListener("click", (e) => { e.stopPropagation(); if (running) clickPiece(r, c); });
          sq.appendChild(p);
        }
        sq.addEventListener("click", () => { if (running) clickSquare(r, c); });
        boardEl.appendChild(sq);
      }
    }
    counts[A] = countPieces(A);
    counts[B] = countPieces(B);
    countAEl.textContent = counts[A];
    countBEl.textContent = counts[B];
    updateTurnLabel();
  }

  function updateTurnLabel() {
    const nm = cur === A ? (mode === "ai" ? "你" : "玩家 1") : (mode === "ai" ? "AI" : "玩家 2");
    turnEl.textContent = nm + (cur === A ? "（红）" : "（黄）");
    turnEl.className = cur === A ? "a" : "b";
  }

  function showMsg(t, cls) {
    msgEl.textContent = t;
    msgEl.className = "msg" + (cls ? " " + cls : "");
  }

  /* ---------- 交互 ---------- */
  function clickPiece(r, c) {
    if (groupOf(board[r][c]) !== cur) return;
    // 若有吃子机会则只能吃子选择；允许选择任一己方可吃的子或普通子
    const mustCap = hasCaptureMovesFor(cur);
    const opts = legalMovesOf(r, c).filter((m) => (mustCap ? m.cap : true));
    if (!opts.length) return;
    sel = { r, c };
    moves = opts;
    render();
  }

  function clickSquare(r, c) {
    if (!sel) return;
    const mv = moves.find((m) => m.r === r && m.c === c);
    if (mv) {
      doMove(sel.r, sel.c, mv, () => afterTurn());
      sel = null;
      moves = [];
    } else {
      sel = null;
      moves = [];
      render();
    }
  }

  function doMove(fr, fc, mv, done) {
    const v = board[fr][fc];
    board[fr][fc] = 0;
    if (mv.cap) {
      // 吃掉对方（先动画后移除）
      const capEl = pieceEl(mv.cap.r, mv.cap.c);
      if (capEl) {
        capEl.classList.add("captured");
        setTimeout(() => { capEl.remove(); }, 340);
      }
      board[mv.cap.r][mv.cap.c] = 0;
    }
    let nv = v;
    // 升王
    if (groupOf(v) === A && mv.r === 0 && !isKing(v)) nv = kingOf(v);
    if (groupOf(v) === B && mv.r === 7 && !isKing(v)) nv = kingOf(v);
    board[mv.r][mv.c] = nv;
    render();
    setTimeout(done, 180);
  }

  function pieceEl(r, c) {
    const sq = boardEl.querySelector('.sq[data-r="' + r + '"][data-c="' + c + '"]');
    return sq ? sq.querySelector(".piece") : null;
  }

  function afterTurn() {
    // 胜负
    const aLeft = countPieces(A), bLeft = countPieces(B);
    const aMoves = movesExist(A), bMoves = movesExist(B);
    if (aLeft === 0 || !aMoves) { endGame(B); return; }
    if (bLeft === 0 || !bMoves) { endGame(A); return; }
    cur = cur === A ? B : A;
    updateTurnLabel();
    render();
    if (mode === "ai" && cur === B) {
      aiTimer = setTimeout(() => aiTurn(), 550);
    }
  }

  function movesExist(v) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && groupOf(board[r][c]) === v) {
        if (legalMovesOf(r, c).length) return true;
      }
    }
    return false;
  }

  /* ---------- AI（黄方） ---------- */
  function aiTurn() {
    if (!running || cur !== B) return;
    const myPieces = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (board[r][c] && groupOf(board[r][c]) === B) myPieces.push([r, c]);
    }
    const mustCap = hasCaptureMovesFor(B);
    const cand = myPieces
      .map(([r, c]) => ({ r, c, ms: legalMovesOf(r, c).filter((m) => (mustCap ? m.cap : true)) }))
      .filter((x) => x.ms.length);
    if (!cand.length) { afterTurn(); return; }
    // 优先吃子，其次升王，再随机
    const prefer = mustCap ? cand.filter((x) => x.ms.some((m) => m.cap)) : cand;
    const pool = prefer.length ? prefer : cand;
    const pick = pool[(Math.random() * pool.length) | 0];
    let mv = pick.ms[0];
    if (!mustCap) {
      const king = pick.ms.find((m) => (groupOf(board[pick.r][pick.c]) === B ? m.r === 7 : false));
      if (king) mv = king;
    }
    sel = { r: pick.r, c: pick.c };
    moves = pick.ms;
    doMove(pick.r, pick.c, mv, () => { sel = null; moves = []; afterTurn(); });
  }

  /* ---------- 对局控制 ---------- */
  function newGame() {
    clearTimeout(aiTimer);
    initBoard();
    cur = A;
    running = true;
    sel = null;
    moves = [];
    endModal.classList.remove("show");
    showMsg(mode === "ai" ? "你执红（下方），先手" : "玩家 1（红）先手", "");
    render();
  }

  function setMode(m) {
    mode = m;
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    lblA.textContent = m === "ai" ? "你" : "玩家 1";
    lblB.textContent = m === "ai" ? "AI" : "玩家 2";
    newGame();
  }

  function sideName(v) {
    if (mode === "ai") return v === A ? "你" : "AI";
    return v === A ? "玩家 1" : "玩家 2";
  }

  function endGame(v) {
    running = false;
    showMsg("🎉 " + sideName(v) + " 获胜！", "win");
    turnEl.textContent = sideName(v) + " 胜";
    turnEl.className = v === A ? "a" : "b";
    endTitle.textContent = "🎉 " + sideName(v) + " 获胜！";
    endMsg.textContent = "清光对方棋子或无子可动！";
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  restartBtn.addEventListener("click", newGame);
  againBtn.addEventListener("click", newGame);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newGame(); }
  });

  setMode("ai");
})();
