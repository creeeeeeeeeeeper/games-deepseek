/* ============================================================
   珠玑猜色（Mastermind）游戏逻辑
   - 纯原生 JavaScript，无任何外部库 / CDN
   - 系统从 6 种颜色中生成 4 位秘密组合（颜色可重复）
   - 玩家逐行猜测，反馈黑钉(颜色位置都对)/白钉(颜色对位置错)
   - 共 10 次机会，猜中获胜，用完失败并揭示答案
   ============================================================ */
(function () {
  "use strict";

  // 常量配置
  var COLS = 4; // 猜测的位置数
  var COLORS = 6; // 颜色种类数
  var MAX_TRIES = 10; // 最大猜测次数

  // 颜色定义：索引 0-5 对应中文名与色值（用于展示和写入样式）
  var COLOR_HEX = ["#ff5d6c", "#ff9f43", "#ffd93d", "#2ecc71", "#3aa0ff", "#9b6bff"];

  // 游戏状态
  var secret; // 秘密组合：[4] 颜色索引
  var guesses; // 已提交的猜测：[{ colors:[4], black, white }]
  var current; // 当前行的 4 个槽位（null = 未填）
  var activeColor; // 当前选中的颜色索引（null = 未选择，可作橡皮擦）
  var over; // 是否已结束（胜或败）
  var won; // 是否获胜

  // DOM 元素引用
  var boardEl = document.getElementById("board");
  var paletteEl = document.getElementById("palette");
  var attemptEl = document.getElementById("attempt");
  var remainingEl = document.getElementById("remaining");
  var messageEl = document.getElementById("message");
  var submitBtn = document.getElementById("submit");
  var clearBtn = document.getElementById("clear");
  var restartBtn = document.getElementById("restart");
  var modalEl = document.getElementById("modal");
  var modalTitleEl = document.getElementById("modalTitle");
  var modalSubEl = document.getElementById("modalSub");
  var modalAnswerEl = document.getElementById("modalAnswer");
  var modalBtn = document.getElementById("modalBtn");

  /* ---------- 工具函数 ---------- */

  // 随机生成秘密组合（6 色可选、4 个位置、颜色可重复）
  function generateSecret() {
    var s = [];
    for (var i = 0; i < COLS; i++) {
      s.push(Math.floor(Math.random() * COLORS));
    }
    return s;
  }

  // 评估一次猜测：返回黑/白钉数量
  function evaluate(guess, target) {
    var used = []; // target 中已被黑钉占用的位置
    var black = 0;

    // 先统计黑钉（颜色与位置都正确）
    for (var i = 0; i < COLS; i++) {
      if (guess[i] === target[i]) {
        black++;
        used[i] = true;
      } else {
        used[i] = false;
      }
    }

    // 收集剩余（未被黑钉占用）的双方颜色，用于统计白钉
    var sLeft = [];
    var gLeft = [];
    for (var j = 0; j < COLS; j++) {
      if (!used[j]) {
        sLeft.push(target[j]);
        gLeft.push(guess[j]);
      }
    }

    // 按颜色逐色取最小值，得到"颜色对但位置不对"的数量
    var sCount = new Array(COLORS).fill(0);
    var gCount = new Array(COLORS).fill(0);
    for (var k = 0; k < sLeft.length; k++) sCount[sLeft[k]]++;
    for (var m = 0; m < gLeft.length; m++) gCount[gLeft[m]]++;
    var white = 0;
    for (var c = 0; c < COLORS; c++) {
      white += Math.min(sCount[c], gCount[c]);
    }

    return { black: black, white: white };
  }

  // 判断当前行是否已填满
  function canSubmit() {
    for (var i = 0; i < COLS; i++) {
      if (current[i] === null || current[i] === undefined) return false;
    }
    return true;
  }

  // 设置状态消息
  function setMsg(text, cls) {
    messageEl.textContent = text;
    messageEl.className = "msg" + (cls ? " " + cls : "");
  }

  /* ---------- 渲染 ---------- */

  // 渲染整个棋盘（10 行）
  function renderBoard() {
    boardEl.innerHTML = "";
    var activeRow = guesses.length; // 当前应填的行索引

    for (var r = 0; r < MAX_TRIES; r++) {
      var rowEl = document.createElement("div");
      rowEl.className = "mm-row";

      var isSubmitted = r < guesses.length; // 已提交的行
      var isCurrent = r === activeRow && !over; // 当前可输入的行

      if (isCurrent) rowEl.classList.add("current");
      if (isSubmitted) rowEl.classList.add("done");

      // 4 个猜测槽位
      for (var i = 0; i < COLS; i++) {
        var cell = document.createElement("div");
        cell.className = "guess-cell";
        // 已提交行显示固定颜色；当前行显示玩家已选颜色
        var val = isSubmitted ? guesses[r].colors[i] : (isCurrent ? current[i] : null);
        if (val !== null && val !== undefined) {
          cell.classList.add("filled");
          cell.style.background = COLOR_HEX[val];
        }
        // 仅当前行可点击
        if (isCurrent) {
          cell.dataset.pos = i;
          cell.addEventListener("click", onCellClick);
        }
        rowEl.appendChild(cell);
      }

      // 反馈钉（仅已提交的行）
      var pegsEl = document.createElement("div");
      pegsEl.className = "pegs";
      if (isSubmitted) {
        var g = guesses[r];
        var pegs = [];
        for (var b = 0; b < g.black; b++) pegs.push("black");
        for (var w = 0; w < g.white; w++) pegs.push("white");
        while (pegs.length < COLS) pegs.push("empty");
        for (var p = 0; p < pegs.length; p++) {
          var peg = document.createElement("span");
          peg.className = "peg " + pegs[p];
          pegsEl.appendChild(peg);
        }
      }
      rowEl.appendChild(pegsEl);

      boardEl.appendChild(rowEl);
    }
  }

  // 渲染调色盘
  function renderPalette() {
    paletteEl.innerHTML = "";
    for (var i = 0; i < COLORS; i++) {
      var sw = document.createElement("button");
      sw.type = "button";
      sw.className = "palette-swatch" + (activeColor === i ? " active" : "");
      sw.style.background = COLOR_HEX[i];
      sw.setAttribute("aria-label", "颜色 " + (i + 1));
      sw.addEventListener("click", makePaletteClick(i));
      paletteEl.appendChild(sw);
    }
  }

  // 更新状态栏与按钮
  function renderHud() {
    var used = guesses.length;
    attemptEl.textContent = used + "/" + MAX_TRIES;
    remainingEl.textContent = MAX_TRIES - used;
    submitBtn.disabled = over || !canSubmit();
    clearBtn.disabled = over;
  }

  // 汇总渲染
  function render() {
    renderBoard();
    renderPalette();
    renderHud();
  }

  /* ---------- 交互 ---------- */

  // 调色盘点击：选中 / 取消选中某颜色
  function makePaletteClick(idx) {
    return function () {
      if (over) return;
      // 再次点击同一个颜色则取消选择（进入"橡皮擦"状态）
      activeColor = activeColor === idx ? null : idx;
      render();
    };
  }

  // 槽位点击：填充颜色 / 擦除
  function onCellClick(e) {
    if (over) return;
    var pos = Number(e.currentTarget.dataset.pos);
    // 已选中颜色：填充；若该格已是同一颜色则擦除
    if (activeColor !== null) {
      current[pos] = current[pos] === activeColor ? null : activeColor;
    } else {
      // 未选中颜色：点击已填格擦除
      current[pos] = null;
    }
    render();
  }

  // 提交当前行
  function submit() {
    if (over || !canSubmit()) return;
    var pegs = evaluate(current, secret);
    guesses.push({ colors: current.slice(), black: pegs.black, white: pegs.white });

    // 获胜：4 个黑钉
    if (pegs.black === COLS) {
      over = true;
      won = true;
      endGame(true);
      return;
    }

    // 填满 10 次仍未猜中 → 失败
    if (guesses.length >= MAX_TRIES) {
      over = true;
      endGame(false);
      return;
    }

    current = new Array(COLS).fill(null);
    render();
  }

  // 清空当前行
  function clearRow() {
    if (over) return;
    current = new Array(COLS).fill(null);
    render();
  }

  // 结束游戏：弹出胜利/失败弹窗，并揭示答案
  function endGame(win) {
    render(); // 先绘制最终棋盘（含最后一行的结果/黑钉）

    if (win) {
      modalTitleEl.textContent = "🎉 猜中啦！";
      modalSubEl.textContent = "恭喜你用 " + guesses.length + " 次猜出秘密组合！";
      setMsg("🎉 恭喜获胜！", "win");
    } else {
      modalTitleEl.textContent = "😵 机会用完了";
      modalSubEl.textContent = "很遗憾没有猜中，正确答案是：";
      setMsg("😵 游戏结束，正确答案已揭示。", "lose");
    }

    // 在弹窗内展示答案色块
    modalAnswerEl.innerHTML = "";
    for (var i = 0; i < COLS; i++) {
      var sw = document.createElement("span");
      sw.className = "answer-swatch";
      sw.style.background = COLOR_HEX[secret[i]];
      modalAnswerEl.appendChild(sw);
    }

    modalEl.classList.add("show");
  }

  // 重新开始
  function restart() {
    secret = generateSecret();
    guesses = [];
    current = new Array(COLS).fill(null);
    activeColor = null;
    over = false;
    won = false;
    modalEl.classList.remove("show");
    setMsg("选择颜色，涂满 4 格后提交。", "");
    render();
  }

  /* ---------- 键盘支持 ---------- */
  function onKeydown(e) {
    if (over) return;

    // 1-6 选择颜色
    if (e.key >= "1" && e.key <= "6") {
      e.preventDefault();
      activeColor = Number(e.key) - 1;
      render();
      return;
    }

    // Enter 提交
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
      return;
    }

    // Backspace：擦除当前行最后一个已填格
    if (e.key === "Backspace") {
      e.preventDefault();
      var idx = -1;
      for (var i = COLS - 1; i >= 0; i--) {
        if (current[i] !== null) { idx = i; break; }
      }
      if (idx >= 0) { current[idx] = null; render(); }
      return;
    }

    // Delete：清空整行
    if (e.key === "Delete" || e.key === "Escape") {
      e.preventDefault();
      clearRow();
    }
  }

  // 键盘开关提示（仅在焦点不在输入区时生效）
  document.addEventListener("keydown", onKeydown);

  /* ---------- 事件绑定 ---------- */
  submitBtn.addEventListener("click", submit);
  clearBtn.addEventListener("click", clearRow);
  restartBtn.addEventListener("click", restart);
  modalBtn.addEventListener("click", restart);

  // 初始化游戏
  restart();
})();
