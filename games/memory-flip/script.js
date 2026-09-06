/* ============================================================
   记忆翻牌 · 4x4 图案配对
   3D 翻牌动画；记录步数 / 用时 / 最佳步数(localStorage)
   ============================================================ */
(function () {
  "use strict";

  const EMOJIS = ["🍎", "🍊", "🍋", "🍇", "🍓", "🍑", "🥝", "🍒"];

  const boardEl = document.getElementById("board");
  const movesEl = document.getElementById("moves");
  const pairsEl = document.getElementById("pairs");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");
  const cardBox = document.querySelector(".game-card");

  let bestMoves = null;
  try {
    const v = parseInt(localStorage.getItem("memory-best"), 10);
    if (v > 0) bestMoves = v;
  } catch (_) {}
  bestEl.textContent = bestMoves === null ? "--" : bestMoves;

  const TOTAL = EMOJIS.length; // 8 对
  let deck = [];
  let open = [];        // 当前翻开未配对的卡
  let matchedCount = 0;
  let moves = 0;
  let started = false;
  let elapsed = 0;
  let lock = false;
  let timerId = null;
  let done = false;     // 对局是否已结束（防止结算后继续翻牌）
  let gen = 0;          // 对局代数：重开时 +1，令旧动画回调失效

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function fmt(sec) {
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    deck = shuffle(EMOJIS.concat(EMOJIS));
    deck.forEach((emo, i) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML =
        '<div class="card-inner">' +
        '<div class="face back"><span class="qm">?</span></div>' +
        '<div class="face front">' + emo + "</div>" +
        "</div>";
      card.addEventListener("click", () => onOpen(card, i));
      boardEl.appendChild(card);
    });
  }

  function onOpen(card, i) {
    if (lock || done) return;
    if (card.classList.contains("open") || card.classList.contains("matched")) return;
    if (!started) { started = true; timerId = setInterval(() => { elapsed += 1; timeEl.textContent = fmt(elapsed); }, 1000); }
    card.classList.add("open");
    open.push({ card, i, emoji: deck[i] });
    if (open.length === 2) {
      lock = true;
      moves += 1;
      movesEl.textContent = moves;
      movesEl.classList.remove("bump"); void movesEl.offsetWidth;
      movesEl.classList.add("bump");
      checkPair();
    }
  }

  function checkPair() {
    const g = gen;
    const [a, b] = open;
    if (a.emoji === b.emoji) {
      setTimeout(() => {
        if (gen !== g || done) return;
        a.card.classList.add("matched");
        b.card.classList.add("matched");
        matchedCount += 1;
        pairsEl.textContent = matchedCount + "/" + TOTAL;
        open = [];
        lock = false;
        if (matchedCount === TOTAL) win();
      }, 320);
    } else {
      setTimeout(() => {
        if (gen !== g || done) return;
        a.card.classList.add("wrong");
        b.card.classList.add("wrong");
        setTimeout(() => {
          if (gen !== g || done) return;
          a.card.classList.remove("open", "wrong");
          b.card.classList.remove("open", "wrong");
          open = [];
          lock = false;
        }, 420);
      }, 700);
    }
  }

  function confetti() {
    const colors = ["#3aa0ff", "#34d399", "#ffd166", "#ff5d6c", "#b06bff"];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[(Math.random() * colors.length) | 0];
      p.style.animationDelay = Math.random() * 0.6 + "s";
      cardBox.appendChild(p);
      p.addEventListener("animationend", () => p.remove(), { once: true });
    }
  }

  function win() {
    done = true;
    clearInterval(timerId);
    const isNew = bestMoves === null || moves < bestMoves;
    if (isNew) {
      bestMoves = moves;
      bestEl.textContent = bestMoves;
      try { localStorage.setItem("memory-best", String(bestMoves)); } catch (_) {}
    }
    confetti();
    msgEl.textContent = "🎉 全部配对成功！";
    msgEl.className = "msg win";
    endTitle.textContent = "🎉 全部配对成功！";
    endMsg.innerHTML =
      "共 " + moves + " 步 · 用时 " + fmt(elapsed) +
      (isNew ? "<br>🏆 新的最佳步数！" : "<br>最佳步数 " + bestMoves);
    const g = gen;
    setTimeout(() => { if (g === gen) endModal.classList.add("show"); }, 650);
  }

  function reset() {
    gen += 1;             // 令上一局遗留的动画回调全部失效
    clearInterval(timerId);
    open = [];
    matchedCount = 0;
    moves = 0;
    elapsed = 0;
    started = false;
    lock = false;
    done = false;
    movesEl.textContent = 0;
    pairsEl.textContent = "0/" + TOTAL;
    timeEl.textContent = "0:00";
    msgEl.textContent = "";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    document.querySelectorAll(".confetti-piece").forEach((n) => n.remove());
    buildBoard();
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); }
  });
  againBtn.addEventListener("click", reset);

  reset();
})();
