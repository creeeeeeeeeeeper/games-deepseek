/* ============================================================
   方格连线 · 棋牌对战（人机）
   5×5 点阵，轮流画线，围成方格者得分；得格者继续画
   点阵: point(r,c) 屏幕 (OFFSET+c*GAP, OFFSET+r*GAP)
   hEdges[r][c]: 横边 点(r,c)-(r,c+1)   r∈[0..N-1] c∈[0..N-2]
   vEdges[r][c]: 竖边 点(r,c)-(r+1,c)   r∈[0..N-2] c∈[0..N-1]
   方格左上角 (r,c): 需 h[r][c] h[r+1][c] v[r][c] v[r][c+1]
   ============================================================ */
(function () {
  "use strict";

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const youEl = document.getElementById("you");
  const aiEl = document.getElementById("ai");
  const turnEl = document.getElementById("turn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const N = 5, SIZE = N - 1;
  const GAP = 76, OFFSET = 42, R = 5;

  function X(c) { return OFFSET + c * GAP; }
  function Y(r) { return OFFSET + r * GAP; }

  let H, V, owner, turn, scoreY, scoreA, over, busy;

  function reset() {
    H = Array.from({ length: N }, () => Array(N - 1).fill(false));
    V = Array.from({ length: N - 1 }, () => Array(N).fill(false));
    owner = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    turn = "player"; scoreY = 0; scoreA = 0; over = false; busy = false;
  }

  function render() {
    youEl.textContent = scoreY;
    aiEl.textContent = scoreA;
    turnEl.textContent = turn === "player" ? "你" : "AI";
    turnEl.style.color = turn === "player" ? "var(--accent-2)" : "var(--danger)";
  }

  function draw() {
    ctx.clearRect(0, 0, 380, 380);
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (owner[r][c] !== 0) {
        ctx.fillStyle = owner[r][c] === 1 ? "rgba(111,217,138,0.2)" : "rgba(217,75,58,0.18)";
        ctx.fillRect(X(c) + 4, Y(r) + 4, GAP - 8, GAP - 8);
      }
    }
    // 横边
    ctx.strokeStyle = "#e2c266"; ctx.lineWidth = 4;
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (H[r][c]) {
      ctx.beginPath(); ctx.moveTo(X(c), Y(r)); ctx.lineTo(X(c + 1), Y(r)); ctx.stroke();
    }
    // 竖边
    ctx.strokeStyle = "#6f86ac";
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) if (V[r][c]) {
      ctx.beginPath(); ctx.moveTo(X(c), Y(r)); ctx.lineTo(X(c), Y(r + 1)); ctx.stroke();
    }
    // 点
    ctx.fillStyle = "#f4f6f8";
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.beginPath(); ctx.arc(X(c), Y(r), R, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 画一条横边 H[r][c]，判断围成的方格
  function closeH(r, c, who) {
    let got = 0;
    // 上方方格 (左上角 r-1,c): 顶 H[r-1][c] + 两竖边 V[r-1][c] V[r-1][c+1]，底边 H[r][c] 已画
    if (r > 0 && H[r - 1][c] && V[r - 1][c] && V[r - 1][c + 1]) { const a = r - 1, b = c; if (owner[a][b] === 0) { owner[a][b] = who; got++; } }
    // 下方方格 (左上角 r,c): 顶 H[r][c] 已画, 两竖边 + 底边 H[r+1][c]
    if (r < N - 1 && H[r + 1][c] && V[r][c] && V[r][c + 1]) { const a = r, b = c; if (owner[a][b] === 0) { owner[a][b] = who; got++; } }
    return got;
  }
  // 画一条竖边 V[r][c]
  function closeV(r, c, who) {
    let got = 0;
    // 左方格 (左上角 r,c-1): 右 V[r][c] 已画, 需 V[r][c-1](左) H[r][c-1] H[r+1][c-1]
    if (c > 0 && V[r][c - 1] && H[r][c - 1] && H[r + 1][c - 1]) { const a = r, b = c - 1; if (owner[a][b] === 0) { owner[a][b] = who; got++; } }
    // 右方格 (左上角 r,c): 左 V[r][c] 已画, 需 V[r][c+1](右) H[r][c] H[r+1][c]
    if (c < N - 1 && V[r][c + 1] && H[r][c] && H[r + 1][c]) { const a = r, b = c; if (owner[a][b] === 0) { owner[a][b] = who; got++; } }
    return got;
  }

  function drawEdge(kind, r, c, who) {
    if (kind === "h") { if (H[r][c]) return null; H[r][c] = true; return closeH(r, c, who); }
    else { if (V[r][c]) return null; V[r][c] = true; return closeV(r, c, who); }
  }

  function updateScores() {
    scoreY = 0; scoreA = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (owner[r][c] === 1) scoreY++; else if (owner[r][c] === 2) scoreA++;
    }
    render();
  }

  function isFull() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (!H[r][c]) return false;
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) if (!V[r][c]) return false;
    return true;
  }

  function allMoves() {
    const moves = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (!H[r][c]) moves.push({ kind: "h", r, c });
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) if (!V[r][c]) moves.push({ kind: "v", r, c });
    return moves;
  }

  function playerMove(kind, r, c) {
    if (over || busy || turn !== "player") return;
    const got = drawEdge(kind, r, c, 1);
    if (got === null) { msgEl.textContent = "这条线已经画了。"; return; }
    updateScores();
    draw();
    if (isFull()) { finish(); return; }
    if (got === 0) { turn = "ai"; render(); busy = true; setTimeout(aiMove, 500); }
  }

  function aiMove() {
    if (over) return;
    const moves = allMoves();
    if (!moves.length) { finish(); return; }
    // 优先找能围成方格的
    let chosen = moves[0], found = false;
    for (const m of moves) {
      let got = 0;
      if (m.kind === "h") { H[m.r][m.c] = true; got = closeH(m.r, m.c, 2); H[m.r][m.c] = false; }
      else { V[m.r][m.c] = true; got = closeV(m.r, m.c, 2); V[m.r][m.c] = false; }
      if (got > 0) { chosen = m; found = true; break; }
    }
    if (!found) {
      // 尽量不送给玩家：选一条不会让玩家立即得分的边（简单：任取第一根安全的）
      chosen = moves[0];
    }
    const got = drawEdge(chosen.kind, chosen.r, chosen.c, 2);
    updateScores();
    draw();
    if (isFull()) { busy = false; finish(); return; }
    if (got > 0) { setTimeout(aiMove, 400); return; }  // 连画
    turn = "player"; busy = false; render();
  }

  function finish() {
    over = true; busy = false;
    endTitle.textContent = scoreY > scoreA ? "🎉 你赢了！" : (scoreY < scoreA ? "🤖 AI 赢" : "🤝 平局");
    endMsg.textContent = "你 " + scoreY + " 格 · AI " + scoreA + " 格";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  // 点最近空闲边
  function nearestEdge(mx, my) {
    let bt = null, bd = 1e9;
    for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) if (!H[r][c]) {
      const d = Math.hypot((X(c) + X(c + 1)) / 2 - mx, Y(r) - my);
      if (d < bd) { bd = d; bt = { kind: "h", r, c }; }
    }
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) if (!V[r][c]) {
      const d = Math.hypot(X(c) - mx, (Y(r) + Y(r + 1)) / 2 - my);
      if (d < bd) { bd = d; bt = { kind: "v", r, c }; }
    }
    return bt;
  }

  canvas.addEventListener("click", (e) => {
    if (over || busy) return;
    const rect = canvas.getBoundingClientRect();
    const edge = nearestEdge(e.clientX - rect.left, e.clientY - rect.top);
    if (edge) playerMove(edge.kind, edge.r, edge.c);
  });

  againBtn.addEventListener("click", () => { reset(); start(); });
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); start(); } });

  function start() {
    reset();
    msgEl.textContent = "点击两相邻点之间画线。围成方格再画一次。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    draw();
    render();
  }
  start();
})();
