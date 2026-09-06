/* ============================================================
   Wordle 猜词 · 6×5 英文单词
   输入 5 字母提交；绿/黄/灰着色（正确 / 含但错位 / 不含，处理重复字母）
   键盘：点按或物理输入统一小写；键色只升不降（correct>present>absent）
   ============================================================ */
(function () {
  "use strict";

  const RAW_WORDS = [
    "apple", "grape", "peach", "lemon", "mango", "berry", "melon", "olive",
    "tiger", "zebra", "koala", "panda", "camel", "horse", "mouse", "snake",
    "bread", "toast", "pizza", "pasta", "sugar", "cream", "taste", "sweet",
    "light", "night", "cloud", "storm", "earth", "water", "river", "ocean",
    "robot", "pixel", "radio", "video", "power", "build", "frame",
    "dream", "happy", "sunny", "quiet", "lucky", "brave", "clean", "fresh",
    "small", "great", "green", "black", "white", "brown",
  ];
  // 只保留恰好 5 个字母的词（去掉 6 字母的 yellow 等），并去重
  const WORDS = Array.from(new Set(RAW_WORDS.filter((w) => w.length === 5)));

  const T = 6, L = 5;
  const RANK = { absent: 1, present: 2, correct: 3 };
  const KEY_ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ];

  const boardEl = document.getElementById("board");
  const msgEl = document.getElementById("msg");
  const keysEl = document.getElementById("keys");
  const gamesEl = document.getElementById("games");
  const winrateEl = document.getElementById("winrate");
  const streakEl = document.getElementById("streak");
  const newBtn = document.getElementById("newBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let stats = { games: 0, wins: 0, streak: 0 };
  try {
    const s = JSON.parse(localStorage.getItem("wordle-stats") || "null");
    if (s) stats = s;
  } catch (_) {}
  syncStats();

  let answer = "";
  let guess = [];          // 当前行字母（小写）
  let row = 0;
  let done = false;
  let keyMap = {};         // letter -> 'absent' | 'present' | 'correct'
  let flashTimer = null;

  function syncStats() {
    gamesEl.textContent = stats.games;
    winrateEl.textContent = stats.games ? Math.round((stats.wins / stats.games) * 100) + "%" : "--";
    streakEl.textContent = stats.streak;
    try { localStorage.setItem("wordle-stats", JSON.stringify(stats)); } catch (_) {}
  }

  /* ---------- 键盘（三行，Enter/退格分列两侧） ---------- */
  function buildKeys() {
    keysEl.innerHTML = "";
    KEY_ROWS.forEach((rowKeys, ri) => {
      const line = document.createElement("div");
      line.className = "krow";
      if (ri === 1) { // 左侧补 ⌫（视觉对齐）
        line.appendChild(keyBtn("⌫", "wide left"));
      }
      rowKeys.forEach((ch) => line.appendChild(keyBtn(ch)));
      if (ri === 2) {
        line.appendChild(keyBtn("↵", "wide"));
      }
      keysEl.appendChild(line);
    });
  }
  function keyBtn(ch, extra) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "k" + (extra ? " " + extra : "");
    b.textContent = ch.toUpperCase();
    b.dataset.k = ch;
    b.addEventListener("click", () => press(ch));
    return b;
  }

  function applyKeyColors() {
    keysEl.querySelectorAll(".k").forEach((b) => {
      const ch = b.dataset.k;
      if (!ch || ch.length !== 1) return;
      const st = keyMap[ch];
      b.classList.remove("correct", "present", "absent");
      if (st) b.classList.add(st);
    });
  }

  /* ---------- 棋盘 ---------- */
  function renderBoard() {
    boardEl.innerHTML = "";
    for (let r = 0; r < T; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "row";
      rowEl.dataset.row = r;
      for (let c = 0; c < L; c++) {
        const t = document.createElement("div");
        t.className = "tile";
        rowEl.appendChild(t);
      }
      boardEl.appendChild(rowEl);
    }
  }

  function refreshRow(animate) {
    const rowEl = boardEl.querySelector('.row[data-row="' + row + '"]');
    [...rowEl.children].forEach((t, i) => {
      t.textContent = guess[i] || "";
      if (animate && guess[i]) {
        t.classList.remove("pop");
        void t.offsetWidth;
        t.classList.add("pop");
      }
    });
  }

  /* ---------- 输入 ---------- */
  function press(ch) {
    if (done) return;
    if (ch === "↵") { submit(); return; }
    if (ch === "⌫") {
      if (guess.length) { guess.pop(); refreshRow(false); }
      return;
    }
    ch = ch.toLowerCase();
    if (!/[a-z]/.test(ch) || guess.length >= L) return;
    guess.push(ch);
    refreshRow(true);
  }

  function submit() {
    if (guess.length !== L) { flashMsg("还差 " + (L - guess.length) + " 个字母"); return; }
    // 任意 5 个英文字母都允许判定（不做词库限制），保证输入即可玩
    evaluate(guess.join(""));
  }

  /* ---------- 判定与着色 ---------- */
  function evaluate(word) {
    const res = new Array(L).fill("absent");
    const ans = answer.split("");
    // 第一轮：位置正确
    for (let i = 0; i < L; i++) {
      if (word[i] === ans[i]) { res[i] = "correct"; ans[i] = null; }
    }
    // 第二轮：包含但错位（用剩余未消耗的字母）
    for (let i = 0; i < L; i++) {
      if (res[i] === "correct") continue;
      const at = ans.indexOf(word[i]);
      if (at >= 0) { res[i] = "present"; ans[at] = null; }
    }

    const rowEl = boardEl.querySelector('.row[data-row="' + row + '"]');
    [...rowEl.children].forEach((t, i) => {
      t.textContent = word[i];
      const el = t;
      setTimeout(() => {
        el.classList.add("reveal");
        setTimeout(() => {
          el.classList.add(res[i]);
        }, 240); // 翻到一半再着色，视觉更接近官方
      }, i * 150);
    });

    // 键盘键色：只升不降
    word.split("").forEach((ch, i) => {
      const prev = keyMap[ch];
      if (!prev || RANK[res[i]] > RANK[prev]) keyMap[ch] = res[i];
    });
    applyKeyColors();

    const wasCorrect = word === answer;
    guess = [];
    row += 1;

    setTimeout(() => {
      if (wasCorrect) { win(row); return; }
      if (row >= T) { lose(); return; }
      refreshRow(false);
    }, L * 150 + 640);
  }

  function flashMsg(t) {
    msgEl.textContent = t;
    msgEl.className = "msg";
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { if (!done) msgEl.textContent = ""; }, 1500);
  }

  function win(attempt) {
    done = true;
    stats.games += 1;
    stats.wins += 1;
    stats.streak += 1;
    syncStats();
    msgEl.textContent = "🎉 猜对了！用了 " + attempt + " 次";
    msgEl.className = "msg win";
    endTitle.textContent = "🎉 猜对了！";
    endMsg.textContent = "单词是 " + answer.toUpperCase() + " · 第 " + attempt + " 次猜中 · 连胜 " + stats.streak;
    setTimeout(() => endModal.classList.add("show"), 1000);
  }

  function lose() {
    done = true;
    stats.games += 1;
    stats.streak = 0;
    syncStats();
    msgEl.textContent = "😵 答案是 " + answer.toUpperCase();
    msgEl.className = "msg";
    endTitle.textContent = "😵 六次机会用完了…";
    endMsg.textContent = "正确答案是 " + answer.toUpperCase() + "，再来一局！";
    setTimeout(() => endModal.classList.add("show"), 800);
  }

  function newGame() {
    if (WORDS.length === 0) return;
    answer = WORDS[(Math.random() * WORDS.length) | 0];
    guess = [];
    row = 0;
    done = false;
    keyMap = {};
    clearTimeout(flashTimer);
    msgEl.textContent = "";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    renderBoard();
    buildKeys();
    refreshRow(false);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Delete") { e.preventDefault(); newGame(); return; }
    if (e.key === "Enter") press("↵");
    else if (e.key === "Backspace") press("⌫");
    else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
  });
  newBtn.addEventListener("click", newGame);
  againBtn.addEventListener("click", newGame);

  newGame();
})();
