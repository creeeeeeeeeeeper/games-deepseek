/* ============================================================
   猜数字 · 游戏逻辑
   纯原生 JavaScript，使用 IIFE 包裹，不依赖任何外部库。
   玩法：电脑在 1~100 中随机取一个整数，玩家输入猜测，
        系统提示「大了 / 小了」并动态收窄范围，猜中获胜。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  var MIN = 1;          // 最小数字
  var MAX = 100;        // 最大数字
  var MAX_ATTEMPTS = 10; // 允许的最大猜测次数（超出则判负）

  /* ---------- 游戏状态 ---------- */
  var answer;   // 正确答案
  var attempts; // 已猜次数
  var low;      // 当前可行范围下界
  var high;     // 当前可行范围上界
  var gameOver; // 是否已结束

  /* ---------- 获取 DOM 元素 ---------- */
  var input = document.getElementById('guessInput');
  var guessBtn = document.getElementById('guessBtn');
  var feedback = document.getElementById('feedback');
  var targetRange = document.getElementById('targetRange');
  var attemptsEl = document.getElementById('attempts');
  var remainingEl = document.getElementById('remaining');
  var lowMark = document.getElementById('lowMark');
  var highMark = document.getElementById('highMark');
  var rangeFill = document.getElementById('rangeFill');
  var historyList = document.getElementById('historyList');
  var resultMsg = document.getElementById('resultMsg');
  var restart = document.getElementById('restart');

  /* ---------- 工具函数 ---------- */
  // 取 [min, max] 之间的随机整数
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 设置反馈信息并绑定对应的样式类
  function setFeedback(text, cls) {
    feedback.textContent = text;
    feedback.className = cls || 'feedback';
  }

  /* ---------- 界面刷新 ---------- */
  // 刷新尝试次数与剩余次数
  function updateHud() {
    attemptsEl.textContent = String(attempts);
    remainingEl.textContent = String(MAX_ATTEMPTS - attempts);
  }

  // 刷新底部范围刻度条（用区间宽高表现当前可行范围）
  function updateRange() {
    lowMark.textContent = String(low);
    highMark.textContent = String(high);
    targetRange.textContent = low + '-' + high;
    // 计算当前范围在整个标尺上的位置与宽度
    var start = ((low - MIN) / (MAX - MIN)) * 100;
    var width = ((high - low + 1) / (MAX - MIN)) * 100;
    rangeFill.style.left = start + '%';
    rangeFill.style.width = width + '%';
  }

  /* ---------- 新增一次历史记录芯片 ---------- */
  function addHistory(num, dir) {
    // 若已有「还没有猜测记录」的空占位，先清掉
    var empty = historyList.querySelector('.history-empty');
    if (empty) empty.remove();

    var chip = document.createElement('span');
    chip.className = 'history-chip dir-' + dir;

    var numSpan = document.createElement('span');
    numSpan.className = 'num';
    numSpan.textContent = String(num);
    chip.appendChild(numSpan);

    var dirText = document.createElement('span');
    if (dir === 'low') dirText.textContent = '太小';
    else if (dir === 'high') dirText.textContent = '太大';
    else dirText.textContent = '命中';
    chip.appendChild(dirText);

    historyList.appendChild(chip);
  }

  /* ---------- 结束游戏 ---------- */
  function endGame(win) {
    gameOver = true;
    input.disabled = true;
    guessBtn.disabled = true;

    if (win) {
      setFeedback('🎉 恭喜！答案就是 ' + answer + '，你用了 ' + attempts + ' 次猜中。', 'feedback win');
      resultMsg.textContent = '🎉 你赢了！';
      resultMsg.className = 'msg win';
    } else {
      setFeedback('😥 很遗憾，' + MAX_ATTEMPTS + ' 次机会用完了，答案是 ' + answer + '。', 'feedback warn');
      resultMsg.textContent = '😥 你输了，正确答案是 ' + answer;
      resultMsg.className = 'msg lose';
    }
  }

  /* ---------- 处理一次猜测 ---------- */
  function handleGuess() {
    if (gameOver) return;

    var raw = (input.value || '').trim();

    // 输入为空
    if (raw === '') {
      setFeedback('请先输入一个数字再提交。', 'feedback warn');
      input.focus();
      return;
    }

    var n = Number(raw);

    // 校验：整数且在范围内
    if (!Number.isInteger(n) || n < MIN || n > MAX) {
      setFeedback('请输入 ' + MIN + ' ~ ' + MAX + ' 之间的整数。', 'feedback warn');
      input.select();
      input.focus();
      return;
    }

    attempts += 1;
    var dir;

    if (n < answer) {
      dir = 'low';
      // 猜小了，下界提升到 n+1
      low = Math.max(low, n + 1);
      // 非常接近时给出额外提示
      if (answer - n <= 2) {
        setFeedback(n + ' 太小了，但已经很接近啦 🔥 再往上猜！', 'feedback hot');
      } else {
        setFeedback(n + ' 太小了，再往上猜。', 'feedback cold');
      }
    } else if (n > answer) {
      dir = 'high';
      // 猜大了，上界降低到 n-1
      high = Math.min(high, n - 1);
      if (n - answer <= 2) {
        setFeedback(n + ' 太大了，但已经很接近啦 🔥 再往下猜！', 'feedback hot');
      } else {
        setFeedback(n + ' 太大了，再往下猜。', 'feedback warm');
      }
    } else {
      dir = 'hit';
      setFeedback('🎉 答对了！就是 ' + answer + '。', 'feedback win');
    }

    addHistory(n, dir);
    updateHud();
    updateRange();
    input.value = '';
    input.focus();

    // 命中即获胜
    if (dir === 'hit') {
      endGame(true);
      return;
    }

    // 超次判负
    if (attempts >= MAX_ATTEMPTS) {
      endGame(false);
    }
  }

  /* ---------- 开始新一局 ---------- */
  function newGame() {
    answer = randomInt(MIN, MAX);
    attempts = 0;
    low = MIN;
    high = MAX;
    gameOver = false;

    input.disabled = false;
    guessBtn.disabled = false;
    input.value = '';

    setFeedback('输入数字并回车，我会告诉你「大了/小了」。', 'feedback');
    resultMsg.textContent = '';
    resultMsg.className = 'msg';

    // 清空历史
    historyList.innerHTML = '<div class="history-empty">还没有猜测记录</div>';

    updateHud();
    updateRange();
    input.focus();
  }

  /* ---------- 事件绑定 ---------- */
  guessBtn.addEventListener('click', handleGuess);

  // 支持键盘回车提交
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGuess();
    }
  });

  restart.addEventListener('click', newGame);

  // 启动即开始一局
  newGame();
})();
