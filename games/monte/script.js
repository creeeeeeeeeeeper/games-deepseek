/* ============================================================
   三张牌（Three-Card Monte）· 经典桌游（单人）
   先看清皇后 → 翻扣 → 洗牌滑动 → 猜皇后在哪张下面
   ============================================================ */
(function () {
  "use strict";

  const matEl = document.getElementById("mat");
  const roundsEl = document.getElementById("rounds");
  const hitsEl = document.getElementById("hits");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const CARD_W = 92, GAP = 16, OFFSET = 16, STEP = CARD_W + GAP;
  const QUEEN = 0;               // 身份 0 为皇后
  const SUITS = ["👑", "♠", "♥"];// 身份 0..2 的牌面（面朝上时）

  // slots[slot] = 该位置上的卡牌身份(0..2)；dom[id] = 该身份的 DOM 元素
  let slots = [0, 1, 2];
  const dom = {};

  let rounds = 0, hits = 0, over = false, busy = false;
  let phase = "peek";            // peek | shuffle | pick | resolved
  let speed = 800;               // 每步间隔 ms（越玩越快）
  let rafTimer = null;

  function layout() {
    slots.forEach((id, s) => {
      const el = dom[id];
      el.style.left = (OFFSET + s * STEP) + "px";
    });
  }

  function resetRounds() { rounds = 0; hits = 0; speed = 800; }

  /* ---------- 构建三张卡牌 ---------- */
  function buildDom() {
    matEl.innerHTML = "";
    for (let id = 0; id < 3; id++) {
      const el = document.createElement("div");
      el.className = "card3";
      el.dataset.id = id;
      el.innerHTML = '<div class="cbox"><span class="face"></span></div>';
      el.addEventListener("click", () => pick(id));
      matEl.appendChild(el);
      dom[id] = el;
    }
  }

  function setFace(id, faceUp) {
    const el = dom[id];
    const face = el.querySelector(".face");
    face.textContent = faceUp ? SUITS[id] : "";
    el.classList.toggle("up", faceUp);
    el.classList.toggle("down", !faceUp);
  }
  function setAllFaces(faceUp) { for (let id = 0; id < 3; id++) setFace(id, faceUp); }

  function render() {
    layout();
    roundsEl.textContent = rounds;
    hitsEl.textContent = hits;
  }

  /* ---------- 洗牌：每步把皇后与相邻牌交换，滑动可见 ---------- */
  function shuffleStep() {
    if (phase !== "shuffle") return;
    const qSlot = slots.indexOf(QUEEN);
    const others = [0, 1, 2].filter((s) => s !== qSlot);
    const target = others[(Math.random() * others.length) | 0];
    const otherId = slots[target];
    slots[qSlot] = otherId;
    slots[target] = QUEEN;
    layout();
  }

  function startShuffle() {
    if (over || busy) return;
    busy = true;
    phase = "shuffle";
    setAllFaces(false);           // 翻扣
    msgEl.textContent = "盯住皇后的背…";
    msgEl.className = "msg";
    render();

    const steps = Math.max(4, Math.min(12, Math.round(speed / 90)));
    let i = 0;
    function next() {
      if (over) return;
      shuffleStep();
      i++;
      if (i < steps) { rafTimer = setTimeout(next, Math.max(90, speed / steps)); }
      else {
        phase = "pick";
        busy = false;
        msgEl.textContent = "停！皇后藏在哪张下面？点选一张。";
        render();
      }
    }
    next();
  }

  /* ---------- 猜牌 ---------- */
  function pick(id) {
    if (over || busy || phase !== "pick") return;
    busy = true;
    phase = "resolved";
    rounds++;

    // 揭示：皇后那张翻开，猜的那张高亮
    for (let i = 0; i < 3; i++) {
      const qFace = i === QUEEN;
      setFace(i, true);
      if (qFace) dom[i].classList.add("queen");
    }
    const correct = id === QUEEN;
    dom[id].classList.add("picked");

    if (correct) {
      hits++;
      msgEl.textContent = "✅ 猜中了！皇后就在你点的那张下面。";
      msgEl.className = "msg win";
    } else {
      msgEl.textContent = "❌ 没盯住，皇后跳到别处了。";
      msgEl.className = "msg lose";
    }
    roundsEl.textContent = rounds;
    hitsEl.textContent = hits;

    if (hits >= 6) { setTimeout(() => finish(true), 420); return; }
    if (rounds >= 10) { setTimeout(() => finish(false), 420); return; }

    // 稍等后回到可再洗牌状态
    setTimeout(() => {
      // 清掉高亮，进入"可再洗牌"
      for (let i = 0; i < 3; i++) dom[i].classList.remove("queen", "picked");
      phase = "peek";
      setAllFaces(true);          // 重新面朝上，让玩家看清皇后再洗
      busy = false;
      speed = Math.max(240, speed * 0.9);
      msgEl.textContent = "看清皇后在哪，再点「洗牌」。";
      msgEl.className = "msg";
      render();
    }, 1100);
  }

  function finish(win) {
    over = true;
    endTitle.textContent = win ? "🎉 你盯得真准！" : "⏸️ 局数到了";
    endMsg.textContent = "命中 " + hits + "/" + rounds;
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  /* ---------- 开局 ---------- */
  function newRound() {
    // 随机摆放：皇后可能出现在任一位置
    const ids = [0, 1, 2];
    for (let i = ids.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; }
    slots = ids.slice();
    phase = "peek";
    busy = false;
    setAllFaces(true);
    render();
  }

  function start() {
    resetRounds();
    buildDom();
    over = false;
    // 初始：面朝上让玩家看清皇后
    slots = [0, 1, 2];
    phase = "peek";
    setAllFaces(true);
    msgEl.textContent = "先看清皇后（👑）在哪，然后点「洗牌」。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  shuffleBtn.addEventListener("click", startShuffle);
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); return; }
  });

  start();
})();
