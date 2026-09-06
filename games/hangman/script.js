/* ============================================================
   猜单词 · 拯救小人
   类别词库 + 屏幕/物理键盘；6 次失误上限；连胜统计
   ============================================================ */
(function () {
  "use strict";

  const MAX_WRONG = 6;

  const WORDS = [
    { c: "水果", w: "apple" }, { c: "水果", w: "mango" }, { c: "水果", w: "grape" },
    { c: "动物", w: "tiger" }, { c: "动物", w: "panda" }, { c: "动物", w: "zebra" },
    { c: "动物", w: "camel" }, { c: "动物", w: "koala" },
    { c: "食物", w: "pizza" }, { c: "食物", w: "bread" }, { c: "食物", w: "toast" },
    { c: "运动", w: "tennis" }, { c: "运动", w: "soccer" }, { c: "运动", w: "hockey" },
    { c: "星球", w: "earth" }, { c: "星球", w: "mars" }, { c: "星球", w: "venus" },
    { c: "科技", w: "robot" }, { c: "科技", w: "cloud" }, { c: "科技", w: "pixel" },
    { c: "职业", w: "pilot" }, { c: "职业", w: "chef" }, { c: "职业", w: "nurse" },
    { c: "自然", w: "ocean" }, { c: "自然", w: "river" }, { c: "自然", w: "storm" },
  ];

  const wordEl = document.getElementById("word");
  const categoryEl = document.getElementById("category");
  const leftEl = document.getElementById("left");
  const streakEl = document.getElementById("streak");
  const keysEl = document.getElementById("keys");
  const guessMsg = document.getElementById("guessMsg");
  const gallows = document.getElementById("gallows");
  const newBtn = document.getElementById("newBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  // 绘制顺序：rope head body armL armR legL legR（绞刑架始终显示）
  const PART_ORDER = ["head", "body", "armL", "armR", "legL", "legR"];
  const bodyParts = document.querySelectorAll("#gallows .part");
  const figures = PART_ORDER.map((id) => document.getElementById(id));

  let streak = 0;
  try { streak = parseInt(localStorage.getItem("hangman-streak") || "0", 10) || 0; } catch (_) {}
  streakEl.textContent = streak;

  let word = "";
  let display = [];      // '_' 或字母 或 空格/连字符显示
  let wrong = 0;
  let guessed = new Set();
  let done = false;
  let usedKeys = new Set();

  function pickWord() {
    const item = WORDS[(Math.random() * WORDS.length) | 0];
    word = item.w;
    categoryEl.textContent = item.c;
    display = [];
    word.split("").forEach((ch) => display.push(ch === " " ? " " : "_"));
    renderWord();
  }

  function renderWord() {
    wordEl.innerHTML = "";
    display.forEach((ch, i) => {
      const slot = document.createElement("div");
      slot.className = "letter-slot" + (word[i] === " " ? " hyphen" : "");
      if (ch !== "_") {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = ch === " " ? "·" : ch;
        slot.appendChild(s);
      }
      wordEl.appendChild(slot);
    });
  }

  function renderKeys() {
    keysEl.innerHTML = "";
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((l) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = l;
      b.dataset.l = l;
      b.classList.add("used", "hidden"); // 初始隐藏 used 只占位；用 class 管理
      if (usedKeys.has(l)) {
        b.classList.add(guessed.has(l) ? "good" : "bad");
      } else {
        b.classList.remove("used", "hidden");
      }
      b.addEventListener("click", () => guess(l));
      keysEl.appendChild(b);
    });
  }

  function guess(ch) {
    if (done || usedKeys.has(ch)) return;
    usedKeys.add(ch);
    let hit = false;
    for (let i = 0; i < word.length; i++) {
      if (word[i] === ch) { display[i] = ch; hit = true; }
    }
    if (hit) {
      guessed.add(ch);
      guessMsg.textContent = "✔ " + ch + " 猜对了！";
    } else {
      wrong += 1;
      leftEl.textContent = MAX_WRONG - wrong;
      if (MAX_WRONG - wrong <= 2) leftEl.classList.add("low");
      updateGallows();
      guessMsg.textContent = "✘ " + ch + " 不对哦";
    }
    renderWord();
    renderKeys();
    const allRevealed = !display.includes("_");
    if (allRevealed) win();
    else if (wrong >= MAX_WRONG) lose();
  }

  function updateGallows() {
    figures.forEach((el, i) => el.classList.add(i < wrong ? "show" : ""));
    if (wrong >= MAX_WRONG) figures.forEach((el) => el.classList.add("done"));
  }

  function resetParts() {
    figures.forEach((el) => el.classList.remove("show", "done"));
    wrong = 0;
    leftEl.textContent = MAX_WRONG;
    leftEl.classList.remove("low");
    leftEl.classList.remove("bump");
  }

  function win() {
    done = true;
    streak += 1;
    try { localStorage.setItem("hangman-streak", String(streak)); } catch (_) {}
    streakEl.textContent = streak;
    streakEl.classList.remove("bump"); void streakEl.offsetWidth;
    streakEl.classList.add("bump");
    guessMsg.textContent = "🎉 太棒了！单词是 " + word;
    endTitle.textContent = "🎉 你拯救了小人！";
    endMsg.textContent = "答案是 " + word.toUpperCase() + " · 连胜 " + streak + " 局";
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function lose() {
    done = true;
    streak = 0;
    try { localStorage.setItem("hangman-streak", "0"); } catch (_) {}
    streakEl.textContent = 0;
    guessMsg.textContent = "答案是 " + word;
    endTitle.textContent = "😵 小人被吊起来了…";
    endMsg.textContent = "正确答案是 " + word.toUpperCase() + "，再试一次！";
    setTimeout(() => endModal.classList.add("show"), 700);
  }

  function newGame() {
    done = false;
    guessed.clear();
    usedKeys.clear();
    resetParts();
    guessMsg.textContent = "";
    endModal.classList.remove("show");
    pickWord();
    renderKeys();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Delete") { e.preventDefault(); newGame(); return; }
    const ch = e.key.toUpperCase();
    if (/^[A-Z]$/.test(ch)) guess(ch);
  });
  newBtn.addEventListener("click", newGame);
  againBtn.addEventListener("click", newGame);

  newGame();
})();
