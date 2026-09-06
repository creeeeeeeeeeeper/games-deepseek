/* ============================================================
   连连看 (Link-Link) 游戏逻辑
   —— 纯原生 JavaScript / DOM，禁止外部库；IIFE 包裹避免污染全局。
   核心：图块配对 + “不超过 2 个拐点” 的寻路消除。
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 常量与配置 ---------- */

  // emoji 图案库（每个图案在一个棋盘内只出现一次，成对出现）
  const EMOJIS = [
    "😀", "😎", "🤖", "👻", "🐱", "🐶", "🦊", "🐼", "🦁", "🐸",
    "🐵", "🦄", "🐯", "🐰", "🍎", "🍌", "🍉", "🍓", "🍒", "🍑",
    "🍍", "🍇", "🍔", "🍕", "🍜", "🍰", "🍦", "🌮", "☕", "🍺",
    "⚽", "🏀", "🎮", "🎲", "🎯", "🎳", "✈️", "🚀", "🚗", "🚲",
    "🌸", "🌵", "🌙", "⭐", "🌈", "🎁", "🎈", "🎵", "🎉", "🥇",
    "💎", "🔑", "🌍", "🔥", "⚡", "❄️", "🧩", "🎀", "🍄", "🍀"
  ];

  // 不同难度的棋盘（内层格子）尺寸：保证总数为偶数（每图案成对）
  const LEVELS = {
    easy:   { cols: 8,  rows: 5,  lives: 3 },  // 40 格 = 20 对
    medium: { cols: 10, rows: 6,  lives: 3 },  // 60 格 = 30 对
    hard:   { cols: 10, rows: 8,  lives: 3 }   // 80 格 = 40 对
  };

  // 需要至少多少个不同图案（等于对数）；不足则循环补齐
  // （图案会重复用于不同对，但因为同图案只出现两次，仍可唯一配对）

  /* ---------- DOM 引用 ---------- */
  const boardEl = document.getElementById("board");
  const pairsEl = document.getElementById("pairs");
  const timeEl = document.getElementById("time");
  const scoreEl = document.getElementById("score");
  const errorsEl = document.getElementById("errors");
  const msgEl = document.getElementById("msg");
  const difficultyEl = document.getElementById("difficulty");
  const restartBtn = document.getElementById("restart");
  const hintBtn = document.getElementById("hintBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const modalEl = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalSub = document.getElementById("modalSub");
  const modalRestart = document.getElementById("modalRestart");
  const modalClose = document.getElementById("modalClose");

  /* ---------- 状态变量 ---------- */
  let P = { cols: 10, rows: 6, lives: 3 };  // 当前难度
  let grid = [];        // 加边后的 (rows+2) x (cols+2) 数组：0=空，>0=图案索引
  let R = 0, C = 0;     // grid 的实际维度（含外圈）
  let selected = null;  // 当前选中的格子 {r,c}
  let cursor = null;    // 键盘光标位置 {r,c}（内层坐标 1..rows, 1..cols）
  let remaining = 0;    // 剩余图案对数
  let score = 0;
  let errors = 0;
  let elapsed = 0;
  let timerId = null;
  let playing = false;
  let failCount = 0;    // 洗牌次数记录（用于展示）
  let shownPath = null;   // 最近一次成功连线的路径元素，用于绘制高亮线

  /* ---------- 加边网格的存取 ---------- */
  // 内层坐标 (r, c)：1 <= r <= rows, 1 <= c <= cols
  function setIdx(r, c, v) { grid[r][c] = v; }

  /* ============================================================
     寻路核心：判断两个图案是否能以 <=2 个拐点 的折线相连
     ============================================================ */
  // 同一条水平线上（第 r 行，列 c1->c2 之间）是否全为空（端点不算）
  function horizontalClear(r, c1, c2) {
    const lo = Math.min(c1, c2) + 1;
    const hi = Math.max(c1, c2) - 1;
    for (let c = lo; c <= hi; c++) if (grid[r][c] !== 0) return false;
    return true;
  }
  // 同一条垂直线（第 c 列，行 r1->r2 之间）是否全为空
  function verticalClear(c, r1, r2) {
    const lo = Math.min(r1, r2) + 1;
    const hi = Math.max(r1, r2) - 1;
    for (let r = lo; r <= hi; r++) if (grid[r][c] !== 0) return false;
    return true;
  }

  // 计算连线路径点（返回路径点数组，或 null）
  // 用于「是否可连」判断 + 绘制高亮折线
  function findPath(a, b) {
    if (a.r === b.r && a.c === b.c) return null;

    // 1) 直线（0 拐点）
    if (a.r === b.r && horizontalClear(a.r, a.c, b.c)) {
      return [{ r: a.r, c: a.c }, { r: b.r, c: b.c }];
    }
    if (a.c === b.c && verticalClear(a.c, a.r, b.r)) {
      return [{ r: a.r, c: a.c }, { r: b.r, c: b.c }];
    }

    // 2) 一个拐点：转角在 (a.r, b.c) 或 (b.r, a.c)
    const corners1 = [
      { r: a.r, c: b.c },
      { r: b.r, c: a.c }
    ];
    for (const p of corners1) {
      if (grid[p.r][p.c] === 0 &&
          horizontalClear(p.r, a.c, p.c) &&
          verticalClear(p.c, a.r, p.r)) {
        return [{ r: a.r, c: a.c }, p, { r: b.r, c: b.c }];
      }
    }

    // 3) 两个拐点：先竖向后横向再竖向（遍历中间行），或先横向再竖向再横向（遍历中间列）
    // 3a) 中间取行 r，路径：A -> (r,a.c) -> (r,b.c) -> B
    for (let r = 0; r < R; r++) {
      if (grid[r][a.c] !== 0 || grid[r][b.c] !== 0) continue;
      if (verticalClear(a.c, a.r, r) &&
          horizontalClear(r, a.c, b.c) &&
          verticalClear(b.c, b.r, r)) {
        return [{ r: a.r, c: a.c }, { r: r, c: a.c }, { r: r, c: b.c }, { r: b.r, c: b.c }];
      }
    }
    // 3b) 中间取列 c，路径：A -> (a.r,c) -> (b.r,c) -> B
    for (let c = 0; c < C; c++) {
      if (grid[a.r][c] !== 0 || grid[b.r][c] !== 0) continue;
      if (horizontalClear(a.r, a.c, c) &&
          verticalClear(c, a.r, b.r) &&
          horizontalClear(b.r, b.c, c)) {
        return [{ r: a.r, c: a.c }, { r: a.r, c: c }, { r: b.r, c: c }, { r: b.r, c: b.c }];
      }
    }

    return null;
  }

  // 便捷判断：a 与 b 是否可连
  function canConnect(a, b) { return findPath(a, b) !== null; }

  /* ---------- 工具：随机打乱并重排图案到指定位置集合 ---------- */
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ---------- 棋盘生成 ---------- */
  function generateBoard() {
    const rows = P.rows, cols = P.cols;
    R = rows + 2;
    C = cols + 2;
    // 外圈全部置空
    grid = Array.from({ length: R }, () => Array(C).fill(0));

    const total = rows * cols;          // 总格数（偶数）
    const pairs = total / 2;            // 对数 = 每种图案出现一次
    // 取足够多的不同图案：对数 <= EMOJIS 长度？直接取对数种，不足则复用
    const chosen = [];
    for (let i = 0; i < pairs; i++) chosen.push(EMOJIS[i % EMOJIS.length]);

    // 每种图案成对
    const tiles = [];
    chosen.forEach((emo, k) => { tiles.push(k, k); }); // 图案索引用 index
    shuffleArray(tiles);

    // 填入内层
    let t = 0;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        grid[r][c] = tiles[t] + 1; // +1 使值 >=1，0 代表空
        t++;
      }
    }
    // 存储选择到的图案，便于取 emoji 显示
    boardEl.dataset.patterns = JSON.stringify(chosen);
  }

  /* ---------- 是否还有任何可消除的对 ---------- */
  function hasAnyMove() {
    const cells = [];
    for (let r = 1; r <= P.rows; r++)
      for (let c = 1; c <= P.cols; c++)
        if (grid[r][c] !== 0) cells.push({ r, c, v: grid[r][c] });
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        if (cells[i].v === cells[j].v &&
            canConnect({ r: cells[i].r, c: cells[i].c }, { r: cells[j].r, c: cells[j].c })) {
          return { a: cells[i], b: cells[j] };
        }
      }
    }
    return null;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    boardEl.style.setProperty("--cols", P.cols);
    boardEl.innerHTML = "";
    // 生成所有内层格子
    for (let r = 1; r <= P.rows; r++) {
      for (let c = 1; c <= P.cols; c++) {
        const cell = document.createElement("div");
        cell.className = "ll-tile";
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (grid[r][c] !== 0) {
          cell.textContent = emojiOf(grid[r][c]);
          cell.dataset.shape = grid[r][c];
        } else {
          cell.classList.add("empty");
          cell.style.visibility = "hidden";
          cell.style.pointerEvents = "none";
        }
        boardEl.appendChild(cell);
      }
    }
    updateHud();
  }

  function emojiOf(v) {
    const chosen = JSON.parse(boardEl.dataset.patterns || "[]");
    return chosen[v - 1];
  }

  function updateHud() {
    pairsEl.textContent = remaining;
    timeEl.textContent = elapsed + "s";
    scoreEl.textContent = score;
    errorsEl.textContent = errors + "/" + P.lives;
  }

  function setMsg(text, kind) {
    msgEl.textContent = text;
    msgEl.className = "msg" + (kind ? " " + kind : "");
  }

  /* ---------- 选择与消除 ---------- */
  function tileEl(r, c) {
    return boardEl.querySelector('[data-r="' + r + '"][data-c="' + c + '"]');
  }

  function clearSelected() {
    if (selected) {
      const el = tileEl(selected.r, selected.c);
      if (el) el.classList.remove("selected");
      selected = null;
    }
  }

  function onTileClick(r, c) {
    if (!playing) return;
    if (grid[r][c] === 0) return; // 空格子不可选

    // 点同一个格子：取消选择
    if (selected && selected.r === r && selected.c === c) {
      clearSelected();
      return;
    }

    if (!selected) {
      selected = { r, c };
      tileEl(r, c).classList.add("selected");
      return;
    }

    const a = selected;
    const b = { r, c };
    clearSelected();

    if (grid[a.r][a.c] !== grid[b.r][b.c]) {
      // 图案不同：记录错误
      registerError("图案不同，无法配对");
      return;
    }

    // 图案相同，尝试连
    const path = findPath(a, b);
    if (!path) {
      registerError("有障碍阻挡，无法连接");
      return;
    }

    // 连接成功：先播放消除动画
    removePair(a, b, path);
  }

  function registerError(text) {
    errors++;
    updateHud();
    if (errors >= P.lives) {
      setMsg("错误已满，游戏失败！", "err");
      endGame(false);
    } else {
      setMsg("✖ " + text + "（还可错 " + (P.lives - errors) + " 次）", "warn");
    }
  }

  function removePair(a, b, path) {
    // 高亮连线
    drawPath(path);
    const ea = tileEl(a.r, a.c);
    const eb = tileEl(b.r, b.c);
    ea.classList.add("removing");
    eb.classList.add("removing");
    // 清除棋盘数据
    setIdx(a.r, a.c, 0);
    setIdx(b.r, b.c, 0);
    remaining--;
    score += 10;
    updateHud();
    setMsg("🎯 消除成功！", "ok");

    // 动画结束后移除 DOM 节点
    setTimeout(() => {
      ea.remove();
      eb.remove();
      hidePath();
    }, 280);

    if (remaining <= 0) {
      setMsg("🎉 全部消除，胜利！", "ok");
      endGame(true);
      return;
    }

    // 消除后检查是否死局（无可连对）
    if (!hasAnyMove()) {
      setMsg("⚠️ 没有可连的对了，自动洗牌…", "warn");
      setTimeout(shuffleBoard, 350);
    }
  }

  /* ---------- 连线折线绘制（基于棋盘几何） ---------- */
  function drawPath(path) {
    hidePath();
    // 取一个内层格子元素估算格子尺寸与间距
    const first = tileEl(1, 1);
    if (!first) return;
    const cellSz = first.getBoundingClientRect().width;
    const pl = parseFloat(getComputedStyle(boardEl).paddingLeft);
    const gap = parseFloat(getComputedStyle(boardEl).columnGap) || 0;

    // 坐标映射：内层 (r,c) 的中心相对棋盘左上角
    function center(r, c) {
      const x = pl + (c - 1) * (cellSz + gap) + cellSz / 2;
      const y = pl + (r - 1) * (cellSz + gap) + cellSz / 2;
      return { x, y };
    }

    const pts = path.map((p) => center(p.r, p.c));
    const wrap = document.createElement("div");
    wrap.style.position = "absolute";
    wrap.style.left = "0";
    wrap.style.top = "0";
    wrap.style.width = "0";
    wrap.style.height = "0";
    wrap.style.pointerEvents = "none";
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const line = document.createElement("div");
      line.className = "ll-path-line";
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      line.style.width = Math.max(len, 4) + "px";
      line.style.height = "4px";
      line.style.left = a.x + "px";
      line.style.top = a.y - 2 + "px";
      line.style.transform = "rotate(" + Math.atan2(dy, dx) + "rad)";
      wrap.appendChild(line);
    }
    boardEl.style.position = "relative";
    boardEl.appendChild(wrap);
    shownPath = wrap;
  }

  function hidePath() {
    if (shownPath && typeof shownPath.remove === "function") { shownPath.remove(); }
    shownPath = null;
  }

  /* ---------- 随机洗牌 ---------- */
  function shuffleBoard() {
    // 收集当前所有非空格子及其图案
    const cells = [];
    for (let r = 1; r <= P.rows; r++)
      for (let c = 1; c <= P.cols; c++)
        if (grid[r][c] !== 0) cells.push({ r, c, v: grid[r][c] });

    const values = cells.map((x) => x.v);
    // 重新洗牌打乱图案（不改变图案组成，保证仍是成对）
    // 循环：保证洗牌后至少有一个可连对，最多尝试若干次
    let attempts = 0;
    let ok = false;
    while (attempts < 40) {
      shuffleArray(values);
      // 临时填入看是否有解
      cells.forEach((cell, i) => { grid[cell.r][cell.c] = values[i]; });
      if (hasAnyMove()) { ok = true; break; }
      attempts++;
    }
    if (!ok) {
      // 极端情况：还原并再洗一次（概率极低）
      cells.forEach((cell, i) => { grid[cell.r][cell.c] = values[i]; });
      shuffleArray(values);
      cells.forEach((cell, i) => { grid[cell.r][cell.c] = values[i]; });
    }
    failCount++;
    selected = null;
    render();
    setMsg("🔀 已重新洗牌（第 " + failCount + " 次）", "warn");
  }

  /* ---------- 提示：找一对可连的并高亮 ---------- */
  function showHint() {
    clearSelected();
    hidePath();
    boardEl.querySelectorAll(".ll-tile.hinted").forEach((el) => el.classList.remove("hinted"));
    const mv = hasAnyMove();
    if (!mv) { setMsg("当前没有可连的对，试试洗牌", "warn"); return; }
    const a = tileEl(mv.a.r, mv.a.c);
    const b = tileEl(mv.b.r, mv.b.c);
    if (a) a.classList.add("hinted");
    if (b) b.classList.add("hinted");
    setMsg("💡 试试这一对", "ok");
    setTimeout(() => {
      if (a) a.classList.remove("hinted");
      if (b) b.classList.remove("hinted");
    }, 1500);
  }

  /* ---------- 键盘光标控制 ---------- */
  function moveCursor(dr, dc) {
    if (!playing) return;
    let nr = cursor.r + dr, nc = cursor.c + dc;
    nr = Math.max(1, Math.min(P.rows, nr));
    nc = Math.max(1, Math.min(P.cols, nc));
    boardEl.querySelectorAll(".ll-tile.cursor").forEach((el) => el.classList.remove("cursor"));
    cursor = { r: nr, c: nc };
    const el = tileEl(nr, nc);
    if (el) el.classList.add("cursor");
  }

  function activateCursor() {
    if (!playing) return;
    // 空格子跳本身不可选，但仍在格子动画中应用选择逻辑（onTileClick 会忽略空格）
    onTileClick(cursor.r, cursor.c);
  }

  /* ---------- 计时 ---------- */
  function startTimer() {
    stopTimer();
    elapsed = 0;
    updateHud();
    timerId = setInterval(() => {
      elapsed++;
      timeEl.textContent = elapsed + "s";
    }, 1000);
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  /* ---------- 结算弹窗 ---------- */
  function endGame(win) {
    stopTimer();
    playing = false;
    if (win) {
      modalTitle.textContent = "🎉 胜利！";
      modalTitle.style.color = "var(--accent-2)";
      modalSub.textContent = "用时 " + elapsed + " 秒，得分 " + score + "，剩余对数 0。";
    } else {
      modalTitle.textContent = "😢 失败！";
      modalTitle.style.color = "var(--danger)";
      modalSub.textContent = "错误已达上限，得分 " + score + "，剩余对数 " + remaining + "。再来一局试试！";
    }
    modalEl.classList.add("show");
  }

  function hideModal() {
    modalEl.classList.remove("show");
  }

  /* ---------- 开局 / 重置 ---------- */
  function reset(diff) {
    if (diff) P = LEVELS[diff];
    generateBoard();
    // 保证初始局面至少有一个可连对
    let guard = 0;
    while (!hasAnyMove() && guard < 200) { generateBoard(); guard++; }

    remaining = (P.rows * P.cols) / 2;
    score = 0;
    errors = 0;
    failCount = 0;
    selected = null;
    cursor = { r: 1, c: 1 };
    playing = true;
    hideModal();
    hidePath();
    setMsg("", "");
    render();
    startTimer();
  }

  /* ---------- 事件绑定 ---------- */
  // 棋盘点击（事件委托）
  boardEl.addEventListener("click", (e) => {
    const t = e.target.closest(".ll-tile");
    if (!t || !t.dataset.r) return;
    const r = +t.dataset.r, c = +t.dataset.c;
    if (t.classList.contains("empty")) return;
    // 更新键盘光标到点击处
    cursor = { r, c };
    boardEl.querySelectorAll(".ll-tile.cursor").forEach((el) => el.classList.remove("cursor"));
    onTileClick(r, c);
  });

  // 键盘
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") { e.preventDefault(); moveCursor(-1, 0); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveCursor(1, 0); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); moveCursor(0, -1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); moveCursor(0, 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateCursor(); }
  });

  // 控件
  restartBtn.addEventListener("click", () => reset());
  difficultyEl.addEventListener("change", () => reset(difficultyEl.value));
  hintBtn.addEventListener("click", showHint);
  shuffleBtn.addEventListener("click", () => { if (playing) shuffleBoard(); });
  modalRestart.addEventListener("click", () => reset());
  modalClose.addEventListener("click", () => { hideModal(); });

  // 触屏：点击即选中（click 事件已覆盖），关闭默认滚动干扰
  boardEl.style.touchAction = "manipulation";

  /* ---------- 启动 ---------- */
  reset(difficultyEl.value);
})();
