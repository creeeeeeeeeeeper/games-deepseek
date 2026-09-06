/* ============================================================
   扫雷 游戏逻辑（纯原生 JavaScript，IIFE 包裹，无外部库）
   功能：
   - 9x9 网格，默认 10 颗雷；支持 初级/中级/高级 难度
   - 左键翻开，右键插旗/取消旗；插旗模式下左键也插旗（适配触屏）
   - 首次点击必定安全（地雷重新安置到首点及周围之外）
   - 翻开所有非雷格子获胜；踩雷失败
   - 剩余雷数、计时、重新开始、胜利/失败提示
   ============================================================ */
(function () {
  "use strict";

  // ---------- 难度配置 ----------
  const LEVELS = {
    easy:   { name: "初级", rows: 9,  cols: 9,  mines: 10 },
    medium: { name: "中级", rows: 16, cols: 16, mines: 40 },
    hard:   { name: "高级", rows: 16, cols: 30, mines: 99 },
  };

  // ---------- DOM 引用 ----------
  const boardWrap = document.querySelector(".board-wrap");
  const boardEl = document.getElementById("board");
  const minesEl = document.getElementById("mines");
  const timerEl = document.getElementById("timer");
  const msgEl = document.getElementById("msg");
  const restartBtn = document.getElementById("restart");
  const flagModeBtn = document.getElementById("flagMode");
  const diffBtns = document.querySelectorAll(".diff");

  // ---------- 游戏状态 ----------
  let level = "easy";
  let rows, cols, mineCount;
  let grid = [];          // grid[r][c] -> { mine, revealed, flagged, adj }
  let cellEls = [];       // 对应的 DOM 元素
  let state = "idle";     // idle / playing / won / lost
  let flagMode = false;   // 插旗模式（触屏用）
  let flagged = 0;        // 已插旗数量
  let revealedCount = 0;  // 已翻开数量
  let firstClickDone = false;
  let timerId = null;
  let seconds = 0;

  // ---------- 工具：周围 8 个格子坐标 ----------
  function neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
      }
    }
    return out;
  }

  // ---------- 重开一局 ----------
  function startGame(difficulty) {
    if (difficulty) level = difficulty;
    const cfg = LEVELS[level];
    rows = cfg.rows;
    cols = cfg.cols;
    mineCount = cfg.mines;

    // 初始化网格数据
    grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        mine: false, revealed: false, flagged: false, adj: 0,
      }))
    );

    // 状态重置
    state = "idle";
    flagged = 0;
    revealedCount = 0;
    firstClickDone = false;
    seconds = 0;
    stopTimer();
    timerEl.textContent = "0";
    setMsg("");

    // 高亮当前难度按钮
    diffBtns.forEach((b) => b.classList.toggle("active", b.dataset.level === level));

    buildBoard();
    updateHud();
  }

  // ---------- 构建棋盘 DOM ----------
  function buildBoard() {
    const size = computeCellSize();
    boardEl.style.setProperty("--cell", size + "px");
    boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, var(--cell))`;
    boardEl.innerHTML = "";
    cellEls = [];

    for (let r = 0; r < rows; r++) {
      cellEls[r] = [];
      for (let c = 0; c < cols; c++) {
        const el = document.createElement("div");
        el.className = "cell";
        el.dataset.r = r;
        el.dataset.c = c;
        // 左键：翻开 或（插旗模式）插旗
        el.addEventListener("click", (e) => onLeftClick(r, c, e));
        // 右键：插旗/取消旗
        el.addEventListener("contextmenu", (e) => onRightClick(r, c, e));
        boardEl.appendChild(el);
        cellEls[r][c] = el;
      }
    }
    render();
  }

  // ---------- 计算格子大小（响应式），让其尽量填满棋盘宽度 ----------
  function computeCellSize() {
    // 各难度的基础格子大小
    const base = easy_base(level);
    // 容器可用宽度（左右留白 + 内边距）
    const wrapWidth = boardWrap ? boardWrap.clientWidth : 560;
    const avail = Math.min(560, wrapWidth) - 12 - 4 * (cols - 1) - 8;
    const size = Math.floor(Math.max(20, Math.min(base, avail / cols)));
    return size;
  }
  function easy_base(lv) {
    if (lv === "easy") return 46;
    if (lv === "medium") return 34;
    return 28;
  }

  // ---------- 放置地雷（避开首次点击及其周围） ----------
  function placeMines(safeR, safeC) {
    const forbidden = new Set();
    forbidden.add(safeR + "," + safeC);
    neighbors(safeR, safeC).forEach(([r, c]) => forbidden.add(r + "," + c));

    let placed = 0;
    let attempts = 0;
    const totalCells = rows * cols;
    // 若安全区域过大导致剩余格不足时，仍保证能放满
    const maxAttempts = totalCells * 10;
    while (placed < mineCount && attempts < maxAttempts) {
      attempts++;
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      const key = r + "," + c;
      if (forbidden.has(key)) continue;
      if (grid[r][c].mine) continue;
      grid[r][c].mine = true;
      placed++;
    }
    // 计算每个格子的相邻地雷数
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) continue;
        let cnt = 0;
        neighbors(r, c).forEach(([nr, nc]) => {
          if (grid[nr][nc].mine) cnt++;
        });
        grid[r][c].adj = cnt;
      }
    }
  }

  // ---------- 翻开格子 ----------
  function reveal(r, c) {
    const cell = grid[r][c];
    if (cell.revealed || cell.flagged) return;

    // 游戏尚未开始：先放雷，保证首点安全
    if (!firstClickDone || state === "idle") {
      firstClickDone = true;
      placeMines(r, c);
      state = "playing";
      startTimer();
    }

    cell.revealed = true;
    revealedCount++;

    if (cell.mine) {
      // 踩雷 -> 失败
      revealAllMines();
      cellEls[r][c].classList.add("mine-hit");
      state = "lost";
      stopTimer();
      setMsg("💥 踩到地雷了！点击「重新开始」再试一次", "lose");
      updateHud();
      return;
    }

    // 数字为 0 -> 连锁展开（深度优先洪水填充）
    if (cell.adj === 0) {
      const stack = [[r, c]];
      while (stack.length) {
        const [cr, cc] = stack.pop();
        neighbors(cr, cc).forEach(([nr, nc]) => {
          const nb = grid[nr][nc];
          if (!nb.revealed && !nb.flagged && !nb.mine) {
            nb.revealed = true;
            revealedCount++;
            if (nb.adj === 0) stack.push([nr, nc]);
          }
        });
      }
    }

    render();
    checkWin();
    updateHud();
  }

  // ---------- 插旗 / 取消旗 ----------
  function toggleFlag(r, c) {
    const cell = grid[r][c];
    if (cell.revealed) return;
    if (cell.flagged) {
      cell.flagged = false;
      flagged--;
    } else {
      cell.flagged = true;
      flagged++;
    }
    render();
    updateHud();
  }

  // ---------- 胜利判定 ----------
  function checkWin() {
    const totalSafe = rows * cols - mineCount;
    if (revealedCount >= totalSafe) {
      state = "won";
      stopTimer();
      // 自动为剩余地雷插旗（视觉收尾）
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          if (grid[r][c].mine && !grid[r][c].flagged) {
            grid[r][c].flagged = true;
            flagged++;
          }
      revealAllMines();
      render();
      updateHud();
      setMsg("🎉 恭喜通关！你排掉了所有地雷", "win");
    }
  }

  // ---------- 失败时把所有雷显示出来 ----------
  function revealAllMines() {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (grid[r][c].mine && !grid[r][c].revealed) {
          grid[r][c].revealed = true;
        }
    render();
  }

  // ---------- 渲染 ----------
  function render() {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const el = cellEls[r][c];
        el.className = "cell";
        el.dataset.n = "";

        if (cell.revealed) {
          el.classList.add("revealed");
          if (cell.mine) {
            el.classList.add("mine-detected");
            el.textContent = "💣";
          } else {
            el.dataset.n = cell.adj;
            el.textContent = cell.adj > 0 ? String(cell.adj) : "";
          }
        } else if (cell.flagged) {
          el.classList.add("flagged");
          el.textContent = "🚩";
        } else {
          el.textContent = "";
        }
      }
    }
  }

  // ---------- HUD 刷新 ----------
  function updateHud() {
    const remaining = Math.max(0, mineCount - flagged);
    minesEl.textContent = remaining;
    timerEl.textContent = seconds;
  }

  // ---------- 计时 ----------
  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      seconds++;
      timerEl.textContent = seconds;
    }, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // ---------- 消息提示 ----------
  function setMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.className = "msg" + (cls ? " " + cls : "");
  }

  // ---------- 事件处理 ----------
  function onLeftClick(r, c, e) {
    if (state === "won" || state === "lost") return;
    if (flagMode) { toggleFlag(r, c); return; }
    reveal(r, c);
  }
  function onRightClick(r, c, e) {
    e.preventDefault();
    if (state === "won" || state === "lost") return;
    toggleFlag(r, c);
  }

  // 阻止棋盘默认右键菜单
  boardEl.addEventListener("contextmenu", (e) => e.preventDefault());

  // 重新开始（保持当前难度）
  restartBtn.addEventListener("click", () => startGame(level));

  // 插旗模式开关（触屏友好）
  flagModeBtn.addEventListener("click", () => {
    flagMode = !flagMode;
    flagModeBtn.classList.toggle("active", flagMode);
    setMsg(flagMode ? "📍 插旗模式已开启：点击格子将标记/取消旗帜" : "插旗模式已关闭");
  });

  // 难度按钮
  diffBtns.forEach((b) =>
    b.addEventListener("click", () => startGame(b.dataset.level))
  );

  // 键盘：R 重开，F 切换插旗模式
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "r") startGame(level);
    else if (k === "f") flagModeBtn.click();
  });

  // 窗口缩放时重算格子大小
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const size = computeCellSize();
      boardEl.style.setProperty("--cell", size + "px");
    }, 150);
  });

  // 启动
  startGame("easy");
})();
