/* ============================================================
   石头剪刀布 · 三局两胜
   单人=对战 AI；双人=同屏轮流（左出完自动切右）
   ============================================================ */
(function () {
  "use strict";

  const G = ["🪨", "✂️", "📄"];
  const NAMES = { rock: "石头", scissors: "剪刀", paper: "布" };
  const WIN = { 0: 2, 1: 0, 2: 1 };   // g 胜 w: 石头(0)胜剪刀(2)? 见规则：0石头 1剪刀 2布

  const modeBtns = Array.from(document.querySelectorAll(".mode-btn"));
  const gestureA = document.getElementById("gestureA");
  const gestureB = document.getElementById("gestureB");
  const nameA = document.getElementById("nameA");
  const nameB = document.getElementById("nameB");
  const sideALabel = document.getElementById("sideALabel");
  const sideBLabel = document.getElementById("sideBLabel");
  const scoreA = document.getElementById("scoreA");
  const scoreB = document.getElementById("scoreB");
  const msgEl = document.getElementById("msg");
  const choices = Array.from(document.querySelectorAll(".choice"));

  let mode = "ai";
  let score = [0, 0];          // [sideA, sideB]
  let turn = "A";              // 当前出招方
  let locked = false;          // 双方已出
  let aiDelay = null;

  function resetMatch() {
    score = [0, 0];
    scoreA.textContent = 0;
    scoreB.textContent = 0;
    gestureA.textContent = "❔";
    gestureB.textContent = "❔";
    gestureA.className = "gesture";
    gestureB.className = "gesture";
    setMode(mode, true);
  }

  function setMode(m, keepScore) {
    mode = m;
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (!keepScore) { score = [0, 0]; scoreA.textContent = 0; scoreB.textContent = 0; }
    if (m === "ai") {
      nameA.textContent = "你";
      nameB.textContent = "AI";
      sideALabel.textContent = "你";
      sideBLabel.textContent = "AI";
    } else {
      nameA.textContent = "玩家 1";
      nameB.textContent = "玩家 2";
      sideALabel.textContent = "玩家 1";
      sideBLabel.textContent = "玩家 2";
    }
    gestureA.textContent = "❔";
    gestureB.textContent = "❔";
    gestureA.className = "gesture";
    gestureB.className = "gesture";
    clearTimeout(aiDelay);
    turn = "A";
    locked = false;
    highlightTurn();
    showMsg(m === "ai" ? "选择你的手势，三局两胜！" : "玩家 1 先出招 👉", "");
  }

  function highlightTurn() {
    gestureA.classList.toggle("hint-turn", turn === "A");
    gestureB.classList.toggle("hint-turn", turn === "B");
  }

  function showMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.className = "msg " + (cls || "");
    msgEl.classList.add("pop");
  }

  // 石头0 > 剪刀1？规则：0石头胜1剪刀；1剪刀胜2布；2布胜0石头
  function judge(a, b) {
    if (a === b) return 0;            // 平
    if ((a === 0 && b === 1) || (a === 1 && b === 2) || (a === 2 && b === 0)) return 1; // a 赢
    return 2;                          // b 赢
  }

  function pick(g, side) {
    if (locked) return;
    const gi = g;
    if (side === "A") {
      gestureA.textContent = G[gi];
      gestureA.dataset.g = String(gi);
      if (mode === "ai") {
        // AI 出招（略随机，但 1/4 概率“看穿”玩家让难度适中）
        let ai = (Math.random() * 3) | 0;
        if (Math.random() < 0.3) ai = (gi + 2) % 3; // 胜玩家的选择
        gestureB.textContent = G[ai];
        gestureB.dataset.g = String(ai);
        locked = true;
        resolve(gi, ai);
      } else {
        turn = "B";
        highlightTurn();
        showMsg("玩家 2 出招 👉", "");
      }
    } else {
      gestureB.textContent = G[gi];
      gestureB.dataset.g = String(gi);
      locked = true;
      const a = parseInt(gestureA.dataset.g, 10);
      resolve(a, gi);
    }
  }

  function resolve(a, b) {
    const j = judge(a, b);
    gestureA.className = "gesture" + (j === 1 ? " win" : j === 2 ? " lose" : "");
    gestureB.className = "gesture" + (j === 2 ? " win" : j === 1 ? " lose" : "");
    const labelA = mode === "ai" ? "你" : "玩家 1";
    const labelB = mode === "ai" ? "AI" : "玩家 2";
    let text;
    if (j === 0) {
      text = "🤝 平局！" + G[a] + " 对 " + G[b];
      showMsg(text, "");
    } else if (j === 1) {
      score[0] += 1;
      text = "🎉 " + labelA + " 胜！" + G[a] + " 赢 " + G[b] + "（" + NAMES[(a === 0 ? "rock" : a === 1 ? "scissors" : "paper")] + " 胜 " + NAMES[(b === 0 ? "rock" : b === 1 ? "scissors" : "paper")] + "）";
      showMsg(text, "win");
    } else {
      score[1] += 1;
      text = "💪 " + labelB + " 胜！" + G[b] + " 赢 " + G[a];
      showMsg(text, "lose");
    }
    scoreA.textContent = score[0];
    scoreB.textContent = score[1];

    // 三局两胜判定
    setTimeout(() => {
      if (score[0] >= 2 || score[1] >= 2) {
        const winner = score[0] >= 2 ? labelA : labelB;
        const whoWon = score[0] >= 2 ? "A" : "B";
        showMsg("🏆 " + winner + " 以 " + Math.max(score[0], score[1]) + " : " + Math.min(score[0], score[1]) + " 赢得比赛！按 R 再来", "win");
        locked = true; // 冻结，等重开
        gestureA.className = "gesture" + (whoWon === "A" ? " win" : " lose");
        gestureB.className = "gesture" + (whoWon === "B" ? " win" : " lose");
      } else {
        // 下一回合
        gestureA.textContent = "❔";
        gestureB.textContent = "❔";
        gestureA.className = "gesture";
        gestureB.className = "gesture";
        turn = "A";
        locked = false;
        highlightTurn();
        if (mode === "ai") showMsg("比分 " + score[0] + " : " + score[1] + "，再来一局！", "");
        else showMsg("比分 " + score[0] + " : " + score[1] + "，玩家 1 先出 👉", "");
      }
    }, 900);
  }

  /* ---------- 出招入口 ---------- */
  function onChoice(g) {
    if (locked) return;
    if (turn === "A") pick(g, "A");
    else if (mode === "pvp") pick(g, "B");
  }

  choices.forEach((c) => c.addEventListener("click", () => onChoice(parseInt(c.dataset.g, 10))));

  modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode, false)));

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); resetMatch(); return; }
    const map = { "1": 0, "2": 1, "3": 2, a: 0, s: 1, d: 2, A: 0, S: 1, D: 2 };
    if (e.key in map) onChoice(map[e.key]);
  });

  setMode("ai", true);
})();
