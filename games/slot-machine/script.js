/* ============================================================
   老虎机 · 拉杆三连
   1 金币/次；三条相同图案中奖；倍率表；历史最高金币
   ============================================================ */
(function () {
  "use strict";

  const SYMBOLS = ["🍒", "🍋", "🍇", "⭐", "💎", "7️⃣", "🎰"];
  // 三条相同 → 奖励倍数
  const PAY = { "🍒": 5, "🍋": 10, "🍇": 15, "⭐": 25, "💎": 50, "7️⃣": 100, "🎰": 200 };

  const reels = [document.getElementById("reel0"), document.getElementById("reel1"), document.getElementById("reel2")];
  const coinsEl = document.getElementById("coins");
  const winEl = document.getElementById("win");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const leverBtn = document.getElementById("lever");
  const resetBtn = document.getElementById("resetCoins");
  const card = document.querySelector(".game-card");

  let coins = 50;
  let bestCoins = 0;
  try { bestCoins = parseInt(localStorage.getItem("slot-best") || "0", 10) || 0; } catch (_) {}
  try {
    const c = parseInt(localStorage.getItem("slot-coins") || "50", 10);
    if (c > 0) coins = c;
  } catch (_) {}
  coinsEl.textContent = coins;
  bestEl.textContent = bestCoins;

  let spinning = false;

  function showMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.className = "msg " + (cls || "") + " pop";
  }

  function saveCoins() {
    try { localStorage.setItem("slot-coins", String(coins)); } catch (_) {}
    if (coins > bestCoins) {
      bestCoins = coins;
      bestEl.textContent = bestCoins;
      try { localStorage.setItem("slot-best", String(bestCoins)); } catch (_) {}
    }
  }

  function confetti() {
    const colors = ["#ffd166", "#ff5d6c", "#34d399", "#3aa0ff", "#b06bff"];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[(Math.random() * colors.length) | 0];
      p.style.animationDelay = Math.random() * 0.5 + "s";
      card.appendChild(p);
      p.addEventListener("animationend", () => p.remove(), { once: true });
    }
  }

  function spin() {
    if (spinning) return;
    if (coins < 1) {
      showMsg("金币不足，点「重置金币」再来！", "no");
      return;
    }
    coins -= 1;
    coinsEl.textContent = coins;
    saveCoins();
    spinning = true;
    leverBtn.disabled = true;
    msgEl.textContent = "";
    msgEl.className = "msg";

    // 随机结果
    const result = [0, 1, 2].map(() => (Math.random() * SYMBOLS.length) | 0);

    result.forEach((r, i) => {
      const el = reels[i];
      el.classList.remove("land", "win-sym");
      el.classList.add("spinning");
      // 滚动阶段：快速换符号
      const ticker = setInterval(() => {
        el.textContent = SYMBOLS[(Math.random() * SYMBOLS.length) | 0];
      }, 70);
      const stopAt = 700 + i * 260 + Math.random() * 200;
      setTimeout(() => {
        clearInterval(ticker);
        el.classList.remove("spinning");
        el.textContent = SYMBOLS[r];
        void el.offsetWidth;
        el.classList.add("land");
        if (i === 2) settle(result);
      }, stopAt);
    });
  }

  function settle(result) {
    spinning = false;
    leverBtn.disabled = false;
    const [a, b, c] = result;
    const sym = SYMBOLS[a];
    let winAmt = 0;
    let msg = "";
    let cls = "";
    if (a === b && b === c) {
      winAmt = PAY[sym];
      coins += winAmt;
      coinsEl.textContent = coins;
      reels.forEach((el) => el.classList.add("win-sym"));
      if (sym === "🎰") {
        cls = "jackpot";
        msg = "🎉 头奖！🎰 ×200，赢得 " + winAmt + " 金币！！";
        confetti();
      } else {
        cls = "win";
        msg = "🎉 三个 " + sym + "！赢得 " + winAmt + " 金币";
        if (PAY[sym] >= 50) confetti();
      }
    } else {
      msg = "再试一次，运气会来的～";
      cls = "";
    }
    winEl.textContent = winAmt;
    showMsg(msg, cls);
    saveCoins();
  }

  leverBtn.addEventListener("click", spin);
  resetBtn.addEventListener("click", () => {
    coins = 50;
    coinsEl.textContent = 50;
    winEl.textContent = 0;
    saveCoins();
    showMsg("金币已重置为 50", "");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); spin(); }
  });
})();
