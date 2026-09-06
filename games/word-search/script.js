/* ============================================================
   找单词 游戏逻辑（纯原生 JavaScript，IIFE 包裹，无外部库）
   玩法：在字母矩阵中找出右侧列表里的单词。
   横、竖、斜、正反方向均可；按住鼠标/手指从首字母拖到末字母连成一条线。
   找到全部单词即获胜。

   - 难度：简单(8x8 5词) / 中等(9x9 7词) / 困难(10x10 9词)
   - 主题：随机（动物/水果/颜色/天气），单词随机摆放
   - 特性：灵活直线拖拽选中、找到高亮、错误红闪、得分、胜利弹窗、
           重新开始、新谜题、键盘 R/N、响应式画布
   ============================================================ */
(function () {
  "use strict";

  // ---------- 常量与配置 ----------
  const DIFFICULTIES = {
    easy:   { size: 8,  count: 5 },
    medium: { size: 9,  count: 7 },
    hard:   { size: 10, count: 9 },
  };

  // 单词主题库（全部大写）
  const TOPICS = [
    { name: "动物", words: ["CAT", "DOG", "BIRD", "FISH", "LION", "TIGER", "BEAR", "WOLF", "FROG", "DEER", "GOAT", "PIG", "SNAKE", "WHALE"] },
    { name: "水果", words: ["APPLE", "MANGO", "GRAPE", "LEMON", "PEACH", "KIWI", "BERRY", "MELON", "PEAR", "PLUM", "PRUNE"] },
    { name: "颜色", words: ["RED", "BLUE", "GREEN", "BLACK", "WHITE", "YELLOW", "PINK", "BROWN", "PURPLE", "ORANGE"] },
    { name: "天气", words: ["RAIN", "SNOW", "WIND", "CLOUD", "STORM", "SUNNY", "FOG", "HAIL", "THUNDER", "FROST"] },
  ];

  // 8 个方向：右、右下、下、左下、左、左上、上、右上
  // （方向向量以「行增量, 列增量」表示，屏幕坐标行向下为正）
  const DIRECTIONS = [
    [0, 1], [1, 1], [1, 0], [1, -1],
    [0, -1], [-1, -1], [-1, 0], [-1, 1],
  ];

  const SCORE_PER_WORD = 10; // 每找到一个单词的得分

  const FOUND_COLOR = "rgba(52, 211, 153, 0.42)"; // 已找到：绿
  const SEL_COLOR   = "rgba(58, 160, 255, 0.42)"; // 当前拖拽：蓝
  const WRONG_COLOR = "rgba(255, 93, 108, 0.45)"; // 选错：红
  const HOVER_COLOR = "rgba(255, 255, 255, 0.10)"; // 悬停：淡白

  // ---------- DOM 引用 ----------
  const boardWrap = document.querySelector(".board-wrap");
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const levelSelect = document.getElementById("level");
  const topicEl = document.getElementById("topic");
  const foundEl = document.getElementById("found");
  const scoreEl = document.getElementById("score");
  const msgEl = document.getElementById("msg");
  const wordListEl = document.getElementById("wordList");
  const restartBtn = document.getElementById("restart");
  const newPuzzleBtn = document.getElementById("newPuzzle");
  const winModal = document.getElementById("winModal");
  const modalSub = document.getElementById("modalSub");
  const playAgainBtn = document.getElementById("playAgain");

  // ---------- 游戏状态 ----------
  let level = levelSelect.value || "easy";
  let size = 8;            // 矩阵边长
  let grid = [];           // grid[r][c] -> 大写字母
  let placements = [];     // [{ word, path:[{r,c},...] }]（path 为单词正向摆放路径）
  let foundWords = new Set(); // 已找到的单词（大写）
  let score = 0;

  // 拖拽选中
  let dragging = false;
  let selOrigin = null;    // 起始格 {r,c}
  let currentSel = [];     // 当前选中的路径 [{r,c},...]
  let hoverCell = null;    // 悬停格（未拖拽时）

  // 选错时的红色闪烁
  let wrongCells = [];
  let wrongTimer = null;

  // 画布尺寸
  let cellPx = 40;         // 每个格子的像素（屏幕 CSS 像素）
  let cssSize = 320;       // 画布边长（CSS 像素）

  // ---------- 工具 ----------
  function rand(n) { return Math.floor(Math.random() * n); }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function pick(arr) { return arr[rand(arr.length)]; }
  function reverseWord(w) { return w.split("").reverse().join(""); }

  // ---------- 谜题生成 ----------
  // 判断某个单词能否以方向 (dr,dc) 从 (r0,c0) 摆放
  function wordFits(grid, word, r0, c0, dr, dc, size) {
    for (let k = 0; k < word.length; k++) {
      const r = r0 + dr * k, c = c0 + dc * k;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      const g = grid[r][c];
      if (g !== "" && g !== word[k]) return false; // 已占且不同字母 => 冲突
    }
    return true;
  }

  // 找出某个单词在方向 (dr,dc) 上的所有可放位置，随机取一个并占位
  function placeWord(grid, word, size) {
    const dirs = shuffle(DIRECTIONS.slice());
    for (const [dr, dc] of dirs) {
      const fits = [];
      for (let r0 = 0; r0 < size; r0++) {
        for (let c0 = 0; c0 < size; c0++) {
          if (wordFits(grid, word, r0, c0, dr, dc, size)) fits.push([r0, c0]);
        }
      }
      if (fits.length) {
        const [r0, c0] = fits[rand(fits.length)];
        const path = [];
        for (let k = 0; k < word.length; k++) {
          const r = r0 + dr * k, c = c0 + dc * k;
          grid[r][c] = word[k];
          path.push({ r, c });
        }
        return path;
      }
    }
    return null; // 该单词放不下
  }

  function randomLetter() {
    return String.fromCharCode(65 + rand(26)); // A-Z
  }

  // 生成一个完整谜题（带重试）
  function generatePuzzle(diff) {
    const cfg = DIFFICULTIES[diff];
    const targetSize = cfg.size;
    const count = Math.min(cfg.count, 8); // 避免单词过多放不下

    // 打乱主题顺序，逐个尝试
    const topicOrder = shuffle(TOPICS.slice());
    for (const topic of topicOrder) {
      // 只保留长度不超过矩阵边长的单词
      const pool = topic.words.filter((w) => w.length <= targetSize);
      if (pool.length < count) continue;
      const wanted = shuffle(pool.slice()).slice(0, count);

      // 对整个谜题做若干次整体重试（换摆放尝试）
      for (let attempt = 0; attempt < 40; attempt++) {
        const g = Array.from({ length: targetSize }, () => Array(targetSize).fill(""));
        const placed = [];
        let ok = true;

        for (const w of wanted) {
          const path = placeWord(g, w, targetSize);
          if (!path) { ok = false; break; }
          placed.push({ word: w, path });
        }

        if (ok) {
          // 空位用随机字母填充
          for (let r = 0; r < targetSize; r++)
            for (let c = 0; c < targetSize; c++)
              if (g[r][c] === "") g[r][c] = randomLetter();
          return { size: targetSize, grid: g, placements: placed, topicName: topic.name };
        }
      }
    }

    // 兜底：极简可用的谜题（几乎不会走到这里）
    return fallbackPuzzle();
  }

  // 兜底：一个必定能生成的简单谜题（动物主题）
  function fallbackPuzzle() {
    const size = 8;
    const words = ["CAT", "DOG", "BIRD"];
    const g = Array.from({ length: size }, () => Array(size).fill(""));
    const placed = [];
    const fixed = [
      { word: "CAT", path: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 0, c: 2 }] },
      { word: "DOG", path: [{ r: 2, c: 0 }, { r: 2, c: 1 }, { r: 2, c: 2 }] },
      { word: "BIRD", path: [{ r: 4, c: 0 }, { r: 4, c: 1 }, { r: 4, c: 2 }, { r: 4, c: 3 }] },
    ];
    for (const f of fixed) {
      f.path.forEach(({ r, c }, i) => { g[r][c] = f.word[i]; });
      placed.push(f);
    }
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (g[r][c] === "") g[r][c] = randomLetter();
    return { size, grid: g, placements: placed, topicName: "动物" };
  }

  // ---------- 新游戏 ----------
  function newGame() {
    const cfg = DIFFICULTIES[level];
    const puzzle = generatePuzzle(level);
    size = puzzle.size;
    grid = puzzle.grid;
    placements = puzzle.placements;
    foundWords.clear();
    score = 0;
    currentSel = [];
    wrongCells = [];
    hoverCell = null;
    stopWrongFlash();

    topicEl.textContent = puzzle.topicName;
    foundEl.textContent = "0/" + placements.length;
    scoreEl.textContent = "0";
    setMsg("");
    winModal.classList.remove("show");

    buildWordList();
    resize();
    render();
  }

  // ---------- 单词列表 ----------
  function buildWordList() {
    wordListEl.innerHTML = "";
    placements.forEach((p) => {
      const el = document.createElement("span");
      el.className = "word";
      el.textContent = p.word;
      el.dataset.word = p.word;
      wordListEl.appendChild(el);
    });
  }

  // ---------- 画布尺寸（响应式 + 高清屏） ----------
  function resize() {
    const wrapWidth = boardWrap ? boardWrap.clientWidth : 560;
    const avail = Math.min(560, wrapWidth);         // 画布最大 560px
    const s = Math.max(240, Math.floor(avail));     // 至少 240px
    cssSize = s;
    cellPx = cssSize / size;

    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssSize + "px";
    canvas.style.height = cssSize + "px";
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  // ---------- 渲染 ----------
  function render() {
    if (!grid.length) return;
    ctx.clearRect(0, 0, cssSize, cssSize);

    // 1. 格子底色 + 背景
    ctx.fillStyle = "#16202f";
    ctx.fillRect(0, 0, cssSize, cssSize);

    // 2. 高亮背景（已找到 / 当前选中 / 选错 / 悬停）
    placements.forEach((p) => {
      if (foundWords.has(p.word)) highlightPath(p.path, FOUND_COLOR);
    });
    if (dragging && currentSel.length) highlightPath(currentSel, SEL_COLOR);
    if (wrongCells.length) highlightPath(wrongCells, WRONG_COLOR);
    else if (hoverCell && !dragging) {
      ctx.fillStyle = HOVER_COLOR;
      fillCell(hoverCell.r, hoverCell.c);
    }

    // 3. 格子边框
    ctx.strokeStyle = "#2b3850";
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellPx, 0);
      ctx.lineTo(i * cellPx, cssSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cellPx);
      ctx.lineTo(cssSize, i * cellPx);
      ctx.stroke();
    }

    // 4. 字母
    ctx.fillStyle = "#f2f5fa";
    ctx.font = "700 " + Math.round(cellPx * 0.54) + "px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = (c + 0.5) * cellPx;
        const y = (r + 0.5) * cellPx + 1;
        ctx.fillText(grid[r][c], x, y);
      }
    }

    // 5. 当前拖拽的连线（醒目描边）
    if (dragging && currentSel.length > 1) {
      ctx.strokeStyle = "rgba(58, 160, 255, 0.95)";
      ctx.lineWidth = Math.max(2, cellPx * 0.12);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const a = centerOf(currentSel[0]);
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < currentSel.length; i++) {
        const p = centerOf(currentSel[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  // 画一个格子高亮块
  function fillCell(r, c) {
    ctx.fillRect(c * cellPx, r * cellPx, cellPx, cellPx);
  }
  function highlightPath(path, color) {
    ctx.fillStyle = color;
    path.forEach(({ r, c }) => fillCell(r, c));
  }
  function centerOf({ r, c }) {
    return { x: (c + 0.5) * cellPx, y: (r + 0.5) * cellPx };
  }

  // ---------- 事件坐标 -> 格子 ----------
  function cellFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const c = Math.floor(x / cellPx);
    const r = Math.floor(y / cellPx);
    if (r < 0 || r >= size || c < 0 || c >= size) return null;
    return { r, c };
  }

  // ---------- 判定当前指针相对起点的 8 方向 ----------
  function snapDirection(dr, dc) {
    let ang = Math.atan2(dr, dc) * 180 / Math.PI; // -180..180，0=右，90=下
    if (ang < 0) ang += 360;
    const idx = Math.round(ang / 45) % 8;
    return DIRECTIONS[idx]; // 规范化方向
  }

  // 根据起点与目标格，扩展出直到目标格的直线选中路径
  function extendSelection(target) {
    if (!selOrigin) return;
    const dr = target.r - selOrigin.r;
    const dc = target.c - selOrigin.c;
    if (dr === 0 && dc === 0) { currentSel = [selOrigin]; return; }

    const dir = snapDirection(dr, dc);
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    currentSel = [];
    for (let k = 0; k <= steps; k++) {
      const r = selOrigin.r + dir[0] * k;
      const c = selOrigin.c + dir[1] * k;
      if (r < 0 || r >= size || c < 0 || c >= size) break;
      currentSel.push({ r, c });
    }
  }

  // ---------- 提交选中，匹配谜底 ----------
  function commitSelection() {
    if (currentSel.length < 2) return; // 至少两个字母才算
    const selStr = currentSel.map(({ r, c }) => grid[r][c]).join("");

    let matched = null;
    for (const p of placements) {
      if (foundWords.has(p.word)) continue;
      if (selStr === p.word || selStr === reverseWord(p.word)) { matched = p; break; }
    }

    if (matched) {
      foundWords.add(matched.word);
      score += SCORE_PER_WORD;
      updateHud();
      highlightWordPill(matched.word);
      setMsg("✓ 找到 " + matched.word + "！+" + SCORE_PER_WORD, "win");
      if (foundWords.size === placements.length) {
        setTimeout(showWin, 250);
      }
    } else {
      // 选错：红色闪烁
      wrongCells = currentSel.slice();
      render();
      setMsg("✗ 这不是目标单词，再试试", "lose");
      stopWrongFlash();
      wrongTimer = setTimeout(() => { wrongCells = []; render(); }, 380);
    }

    currentSel = [];
    dragging = false;
    render();
  }

  function highlightWordPill(word) {
    const el = wordListEl.querySelector('[data-word="' + word + '"]');
    if (el) el.classList.add("found");
  }

  function stopWrongFlash() {
    if (wrongTimer) { clearTimeout(wrongTimer); wrongTimer = null; }
  }

  // ---------- HUD / 消息 ----------
  function updateHud() {
    foundEl.textContent = foundWords.size + "/" + placements.length;
    scoreEl.textContent = String(score);
  }
  function setMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.className = "msg" + (cls ? " " + cls : "");
  }

  // ---------- 胜利 ----------
  function showWin() {
    modalSub.textContent = "找到全部 " + placements.length + " 个单词，总分 " + score + "！";
    winModal.classList.add("show");
  }

  // ---------- 事件 -------------
  // 指针按下：记录起点并开始拖拽
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const cell = cellFromEvent(e);
    if (!cell) return;
    dragging = true;
    selOrigin = cell;
    currentSel = [cell];
    stopWrongFlash();
    wrongCells = [];
    render();
  });

  // 指针移动：扩展选中 / 显示悬停
  canvas.addEventListener("pointermove", (e) => {
    const cell = cellFromEvent(e);
    if (dragging) {
      if (cell) extendSelection(cell);
      render();
    } else {
      hoverCell = cell;
      render();
    }
  });

  // 指针抬起：提交选中
  canvas.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    const cell = cellFromEvent(e);
    if (cell) extendSelection(cell);
    commitSelection();
  });

  // 指针离开画布：清除悬停
  canvas.addEventListener("pointerleave", () => {
    hoverCell = null;
    if (!dragging) render();
  });

  // 重新开始（同难度新谜题，清空得分）
  restartBtn.addEventListener("click", () => { score = 0; newGame(); });
  // 新谜题（同难度，换主题/单词）
  newPuzzleBtn.addEventListener("click", () => newGame());

  // 难度切换
  levelSelect.addEventListener("change", () => {
    level = levelSelect.value;
    newGame();
  });

  // 胜利后再来一局
  playAgainBtn.addEventListener("click", () => newGame());

  // 点击弹窗空白处也可关闭（继续查看棋盘）
  winModal.addEventListener("click", (e) => {
    if (e.target === winModal) winModal.classList.remove("show");
  });

  // 键盘：R 重新开始，N 新谜题
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "r") restartBtn.click();
    else if (k === "n") newPuzzleBtn.click();
  });

  // 窗口缩放时重算画布
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  // ---------- 启动 ----------
  newGame();
})();
