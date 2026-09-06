/* ============================================================
   经典 9x9 数独（Sudoku）
   - 纯原生 JS，无任何外部依赖
   - 回溯法生成完整解，再按难度挖去若干格
   - 保证挖去后仍为唯一解（可选但已实现）
   ============================================================ */
(function () {
  "use strict";

  const SIZE = 9;

  // 难度配置：名称 + 需要挖掉的格子数
  const LEVELS = {
    easy: { name: "简单", remove: 38 },
    medium: { name: "中等", remove: 48 },
    hard: { name: "困难", remove: 56 },
  };

  // 状态
  let solution = [];   // 完整解
  let grid = [];       // 当前显示的棋盘（含玩家填写）
  let given = [];      // 布尔网格：是否为题目给定的固定格
  let selected = null; // { r, c } 当前选中的格子
  let errors = 0;      // 错误次数
  let won = false;     // 是否已完成

  // DOM 元素
  const boardEl = document.getElementById("board");
  const numPadEl = document.getElementById("numPad");
  const errorsEl = document.getElementById("errors");
  const difficultyEl = document.getElementById("difficulty");
  const levelSelect = document.getElementById("level");
  const newGameBtn = document.getElementById("newGame");

  /* ---------- 工具函数 ---------- */

  // Fisher-Yates 洗牌，用于随机化候选数字，让生成的谜题不固定
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // 判断在 (r,c) 放置 num 是否合法（行 / 列 / 宫 均不重复）
  function isValid(board, r, c, num) {
    for (let i = 0; i < SIZE; i++) {
      if (board[r][i] === num) return false; // 行
      if (board[i][c] === num) return false; // 列
    }
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (board[br + i][bc + j] === num) return false; // 3x3 宫
      }
    }
    return true;
  }

  // 回溯法：填满整个 9x9 棋盘（由无解时回溯）
  function fillBoard(board) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === 0) {
          for (const num of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
            if (isValid(board, r, c, num)) {
              board[r][c] = num;
              if (fillBoard(board)) return true;
              board[r][c] = 0; // 回溯
            }
          }
          return false;
        }
      }
    }
    return true; // 已填满
  }

  // 统计解的数量（最多数到 limit，用于判断唯一解）
  function countSolutions(board, limit) {
    const g = board.map((row) => row.slice());
    let count = 0;

    function solve() {
      if (count >= limit) return;
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          if (g[r][c] === 0) {
            for (let num = 1; num <= SIZE; num++) {
              if (isValid(g, r, c, num)) {
                g[r][c] = num;
                solve();
                if (count >= limit) { g[r][c] = 0; return; }
                g[r][c] = 0;
              }
            }
            return; // 此格无解，回溯
          }
        }
      }
      count++; // 找到一个完整解
    }

    solve();
    return count;
  }

  // 生成谜题：先填满完整解，再随机挖格并保证唯一解
  function generate() {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    fillBoard(board);
    const full = board.map((row) => row.slice()); // 完整解
    const puzzle = board.map((row) => row.slice()); // 初始即完整解，随后挖去

    const target = LEVELS[levelSelect.value].remove;
    const positions = shuffle([...Array(SIZE * SIZE).keys()]);
    let removed = 0;

    for (const idx of positions) {
      if (removed >= target) break;
      const r = Math.floor(idx / SIZE);
      const c = idx % SIZE;
      if (puzzle[r][c] === 0) continue; // 已是空格

      const backup = puzzle[r][c];
      puzzle[r][c] = 0;

      // 挖去后仍需唯一解，否则还原
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[r][c] = backup;
      } else {
        removed++;
      }
    }

    return { full, puzzle };
  }

  /* ---------- 渲染 ---------- */

  // 渲染棋盘
  function render() {
    boardEl.innerHTML = "";

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const val = grid[r][c];
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.textContent = val || "";

        // 3x3 宫格分隔：第 3/6 列（左）和第 3/6 行（上）加粗并换色
        const left = c === 0 ? 0 : (c === 3 || c === 6) ? 3 : 1;
        const top = r === 0 ? 0 : (r === 3 || r === 6) ? 3 : 1;
        cell.style.borderLeftWidth = left + "px";
        cell.style.borderTopWidth = top + "px";
        if (left === 3) cell.style.borderLeftColor = "#5a7bb5";
        if (top === 3) cell.style.borderTopColor = "#5a7bb5";

        // 给定格 / 玩家格
        if (val !== 0) {
          cell.classList.add(given[r][c] ? "given" : "user");
        }

        // 玩家填错（值不等同于解）→ 标红
        if (val !== 0 && val !== solution[r][c]) {
          cell.classList.add("wrong");
        }

        // 选中高亮
        if (selected && selected.r === r && selected.c === c) {
          cell.classList.add("selected");
        } else if (selected && val !== 0 && val === grid[selected.r][selected.c]) {
          // 与选中格相同数字的高亮
          cell.classList.add("same");
        }

        cell.addEventListener("click", () => selectCell(r, c));
        boardEl.appendChild(cell);
      }
    }
  }

  // 渲染数字键盘（1-9 + 清除）
  function renderPad() {
    numPadEl.innerHTML = "";

    for (let n = 1; n <= SIZE; n++) {
      const btn = document.createElement("button");
      btn.className = "pad-num";
      btn.textContent = n;
      btn.addEventListener("click", () => enterNumber(n));
      numPadEl.appendChild(btn);
    }

    const clear = document.createElement("button");
    clear.className = "pad-num pad-clear";
    clear.textContent = "清除";
    clear.addEventListener("click", () => clearCell());
    numPadEl.appendChild(clear);
  }

  /* ---------- 交互 ---------- */

  // 选中格子
  function selectCell(r, c) {
    selected = { r, c };
    render();
  }

  // 输入数字
  function enterNumber(num) {
    if (won) return;
    if (!selected) return;
    const { r, c } = selected;
    if (given[r][c]) return; // 给定格不可修改

    grid[r][c] = num;

    if (num !== solution[r][c]) {
      errors++;
      errorsEl.textContent = errors;
      render();
      shakeCell(r, c); // 填错抖动
      return;
    }

    render();
    checkWin();
  }

  // 清除所选格子的数字
  function clearCell() {
    if (won) return;
    if (!selected) return;
    const { r, c } = selected;
    if (given[r][c]) return; // 给定格不可清除
    grid[r][c] = 0;
    render();
  }

  // 给某个填错的格子添加抖动动画
  function shakeCell(r, c) {
    const cell = boardEl.querySelector('.cell[data-r="' + r + '"][data-c="' + c + '"]');
    if (!cell) return;
    cell.classList.add("shake");
    cell.addEventListener("animationend", () => cell.classList.remove("shake"), { once: true });
  }

  // 判断是否已完成
  function checkWin() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] !== solution[r][c]) return; // 还有没填对的地方
      }
    }
    won = true;
    showWin();
  }

  // 胜利提示
  function showWin() {
    let msg = document.getElementById("gameMsg");
    if (!msg) {
      msg = document.createElement("div");
      msg.id = "gameMsg";
      msg.className = "msg win";
      document.querySelector(".game-card").appendChild(msg);
    }
    msg.textContent = "🎉 恭喜！你完成了这次数独，共错了 " + errors + " 次！";
  }

  // 新开一局
  function newGame() {
    const { full, puzzle } = generate();
    solution = full;
    grid = puzzle;
    given = puzzle.map((row) => row.map((v) => v !== 0));

    errors = 0;
    errorsEl.textContent = errors;
    won = false;
    selected = null;

    difficultyEl.textContent = LEVELS[levelSelect.value].name;

    render();
  }

  /* ---------- 事件绑定 ---------- */

  // 键盘输入：1-9 填数，Backspace / Delete 清除
  document.addEventListener("keydown", (e) => {
    // 焦点在下拉框时不拦截，避免误选
    if (e.target && e.target.tagName === "SELECT") return;

    if (e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      enterNumber(Number(e.key));
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      clearCell();
    }
  });

  // 切换难度 → 立即出新题
  levelSelect.addEventListener("change", newGame);

  // 新题按钮
  newGameBtn.addEventListener("click", newGame);

  // 初始化
  renderPad();
  newGame();
})();
