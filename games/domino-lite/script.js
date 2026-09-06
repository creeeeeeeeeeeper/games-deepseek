/* ============================================================
   骨牌接龙 · 桌游（单人）
   手牌能对上桌面任一端就接；抽/弃牌，清空手牌获胜
   ============================================================ */
(function () {
  "use strict";

  const boardEl = document.getElementById("board");
  const handBox = document.getElementById("handBox");
  const wrap = document.getElementById("wrap");
  const handCount = document.getElementById("hand");
  const deckCount = document.getElementById("deck");
  const placedCount = document.getElementById("placed");
  const drawBtn = document.getElementById("drawBtn");
  const dropBtn = document.getElementById("dropBtn");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let deck = [], hand = [], board = [], over = false;

  function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  function buildDeck() {
    const d = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) d.push([a, b]);
    deck = shuffle(d);
  }
  function leftEnd() { return board[0][0]; }
  function rightEnd() { return board[board.length - 1][1]; }

  function domEl(t, cls) {
    const e = document.createElement("div");
    e.className = "dom" + (cls ? " " + cls : "");
    const p = document.createElement("span"); p.className = "pit";
    const c = document.createElement("span"); c.textContent = t[0];
    const mid = document.createElement("span"); mid.textContent = ":";
    const p2 = document.createElement("span"); p2.className = "pit";
    const c2 = document.createElement("span"); c2.textContent = t[1];
    e.append(p, c, mid, c2);
    return e;
  }

  function render() {
    wrap.innerHTML = "";
    board.forEach((t, i) => wrap.appendChild(domEl(t)));
    handBox.innerHTML = "";
    hand.forEach((t, i) => {
      const e = domEl(t);
      const can = canPlace(t);
      if (can) e.classList.add("canplace");
      e.addEventListener("click", () => place(i));
      handBox.appendChild(e);
    });
    boardEl.textContent = board.length ? leftEnd() + " … " + rightEnd() : "—";
    handCount.textContent = hand.length;
    deckCount.textContent = deck.length;
    placedCount.textContent = board.length;
    refreshButtons();
  }

  function canPlace(t) {
    return t[0] === leftEnd() || t[1] === rightEnd() || t[0] === rightEnd() || t[1] === leftEnd();
  }

  function place(hi) {
    if (over) return;
    const t = hand[hi];
    const le = leftEnd(), re = rightEnd();
    let placed = false;
    if (t[0] === le) { board.unshift([t[1], t[0]]); placed = true; }
    else if (t[1] === le) { board.unshift([t[0], t[1]]); placed = true; }
    else if (t[0] === re) { board.push([t[0], t[1]]); placed = true; }
    else if (t[1] === re) { board.push([t[1], t[0]]); placed = true; }
    if (!placed) return;
    hand.splice(hi, 1);
    if (deck.length) hand.push(deck.pop());
    msgEl.textContent = "接上了！";
    if (checkEndState(true)) return;
    render();
  }

  function checkEndState(allowWin) {
    if (allowWin && hand.length === 0) { finish(true); return true; }
    if (dockEmpty() && !canAny()) { finish(false); return true; }
    return false;
  }

  function place(hi) {
    if (over) return;
    const t = hand[hi];
    const le = leftEnd(), re = rightEnd();
    let placed = false;
    if (t[0] === le) { board.unshift([t[1], t[0]]); placed = true; }
    else if (t[1] === le) { board.unshift([t[0], t[1]]); placed = true; }
    else if (t[0] === re) { board.push([t[0], t[1]]); placed = true; }
    else if (t[1] === re) { board.push([t[1], t[0]]); placed = true; }
    if (!placed) return;
    hand.splice(hi, 1);
    if (deck.length) hand.push(deck.pop());
    msgEl.textContent = "接上了！";
    if (checkEndState(true)) return;
    render();
  }

  function drawOne() {
    if (over || !deck.length) return;
    hand.push(deck.pop());
    render();
    checkEndState(false);
  }
  function dropOne() {
    if (over) return;
    if (hand.length === 0) return;
    // 弃一张 & 抽一张（若无牌堆则只能弃）
    hand.pop();
    if (deck.length) hand.push(deck.pop());
    render();
    checkEndState(false);
  }

  function canAny() { return hand.some(canPlace); }
  function dockEmpty() { return deck.length === 0; }
  function refreshButtons() {
    drawBtn.disabled = over || !deck.length;
    dropBtn.disabled = over || !hand.length;
  }

  function finish(win) {
    over = true;
    const placed = board.length;
    msgEl.textContent = win ? "🎉 你把整条龙接完了！（" + placed + " 张）" : "💀 牌堆抽完，手牌接不上，失败（接了 " + placed + " 张）。";
    msgEl.className = "msg " + (win ? "win" : "lose");
    endTitle.textContent = win ? "🎉 接完啦！" : "💀 接不上…";
    endMsg.textContent = "共接 " + placed + " 张骨牌";
    setTimeout(() => endModal.classList.add("show"), 500);
  }

  function start() {
    buildDeck();
    board = [deck.pop()];
    hand = [];
    for (let i = 0; i < 4; i++) hand.push(deck.pop());
    over = false;
    msgEl.textContent = "点击手牌中亮绿边的牌即可接上两端。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  drawBtn.addEventListener("click", drawOne);
  dropBtn.addEventListener("click", dropOne);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); }
  });
  againBtn.addEventListener("click", start);

  start();
})();
