/* ============================================================
   数学速算 · 限时口算挑战
   纯原生 JS；答对递增难度；60 秒倒计时；连击与最高分记录
   ============================================================ */
(function () {
  "use strict";

  const TIME = 60;

  const scoreEl = document.getElementById("score");
  const comboEl = document.getElementById("combo");
  const rateEl = document.getElementById("rate");
  const bestEl = document.getElementById("best");
  const timebar = document.getElementById("timebar");
  const timeText = document.getElementById("timeText");
  const questionEl = document.getElementById("question");
  const answerEl = document.getElementById("answer");
  const submitBtn = document.getElementById("submitBtn");
  const feedbackEl = document.getElementById("feedback");
  const keypad = document.getElementById("keypad");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("math-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let state = "idle";   // idle | count | play | over
  let timeLeft = TIME;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let correct = 0;
  let total = 0;
  let current = null;   // { text, ans }
  let timerHandle = null;

  /* ---------- 随机数与题目生成 ---------- */
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  // 6 档难度：按累计答对题数解锁
  function genQuestion(tier) {
    let text, ans;
    switch (tier) {
      case 0: { const a = ri(1, 9), b = ri(1, 9); text = a + " + " + b + " = ?"; ans = a + b; break; }
      case 1: { const b = ri(1, 9), a = ri(b, b + 12); text = a + " − " + b + " = ?"; ans = a - b; break; }
      case 2: { const a = ri(2, 9), b = ri(2, 9); text = a + " × " + b + " = ?"; ans = a * b; break; }
      case 3: { const a = ri(12, 45), b = ri(12, 45); text = a + " + " + b + " = ?"; ans = a + b; break; }
      case 4: { const b = ri(5, 30), a = ri(b + 10, b + 40); text = a + " − " + b + " = ?"; ans = a - b; break; }
      default: { const a = ri(2, 9), b = ri(2, 9), c = ri(1, 9); text = a + " × " + b + " + " + c + " = ?"; ans = a * b + c; break; }
    }
    return { text, ans };
  }
  function tierOf() {
    if (correct >= 30) return 5;
    if (correct >= 22) return 4;
    if (correct >= 16) return 3;
    if (correct >= 10) return 2;
    if (correct >= 5) return 1;
    return 0;
  }

  /* ---------- HUD ---------- */
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function showFeedback(text, ok) {
    feedbackEl.textContent = text;
    feedbackEl.className = "feedback " + (ok ? "ok" : "no") + " pop";
  }

  function nextQuestion() {
    current = genQuestion(tierOf());
    questionEl.textContent = current.text;
    questionEl.classList.remove("in");
    void questionEl.offsetWidth;
    questionEl.classList.add("in");
    answerEl.value = "";
    answerEl.classList.remove("right", "wrong");
    showFeedback("");
    answerEl.focus();
  }

  /* ---------- 计时 ---------- */
  function tick() {
    timeLeft -= 1;
    timebar.style.width = (timeLeft / TIME) * 100 + "%";
    timeText.textContent = timeLeft;
    timebar.classList.toggle("danger", timeLeft <= 10);
    timeText.classList.toggle("danger", timeLeft <= 10);
    if (timeLeft <= 0) endGame();
  }

  /* ---------- 提交判定 ---------- */
  function submit() {
    if (state !== "play" || !current) return;
    const val = parseInt(answerEl.value, 10);
    if (answerEl.value.trim() === "" || isNaN(val)) return;

    total += 1;
    answerEl.classList.remove("right", "wrong");
    if (val === current.ans) {
      correct += 1;
      combo += 1;
      if (combo > maxCombo) maxCombo = combo;
      let gain = 10;
      if (combo > 0 && combo % 5 === 0) {
        gain += 5;
        showFeedback("🎉 连击 " + combo + "！额外 +5", true);
      } else {
        showFeedback("✔ 正确 +" + gain + (combo > 1 ? "（连击 ×" + combo + "）" : ""), true);
      }
      score += gain;
      answerEl.classList.add("right");
    } else {
      combo = 0;
      score = Math.max(0, score - 5);
      showFeedback("✘ 答错了，正确答案是 " + current.ans + "（-5）", false);
      answerEl.classList.add("wrong");
    }
    bump(scoreEl);
    comboEl.textContent = combo;
    rateEl.textContent = total ? Math.round((correct / total) * 100) + "%" : "--";
    scoreEl.textContent = score;
    nextQuestion();
  }

  /* ---------- 流程控制 ---------- */
  function start() {
    clearInterval(timerHandle);
    state = "play";
    timeLeft = TIME;
    score = 0; combo = 0; maxCombo = 0; correct = 0; total = 0;
    scoreEl.textContent = 0;
    comboEl.textContent = 0;
    rateEl.textContent = "--";
    timebar.style.width = "100%";
    timeText.textContent = TIME;
    timebar.classList.remove("danger");
    timeText.classList.remove("danger");
    answerEl.disabled = false;
    submitBtn.disabled = false;
    answerEl.focus();
    endModal.classList.remove("show");
    nextQuestion();
    timerHandle = setInterval(tick, 1000);
  }

  function startWithCountdown() {
    clearInterval(timerHandle);
    state = "count";
    answerEl.disabled = true;
    submitBtn.disabled = true;
    timeLeft = TIME;
    timebar.style.width = "100%";
    timeText.textContent = TIME;
    endModal.classList.remove("show");
    const seq = ["3", "2", "1", "开始！"];
    let i = 0;
    questionEl.textContent = seq[0];
    timerHandle = setInterval(() => {
      i += 1;
      if (i < seq.length) {
        questionEl.textContent = seq[i];
      } else {
        clearInterval(timerHandle);
        start();
      }
    }, 650);
  }

  function endGame() {
    state = "over";
    clearInterval(timerHandle);
    answerEl.disabled = true;
    submitBtn.disabled = true;
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("math-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = isNew ? "🏆 新纪录！" : "⏰ 时间到！";
    endMsg.innerHTML =
      "得分 <b>" + score + "</b> · 答题 " + total + " 题 · 正确 " + correct + " 题<br>" +
      "正确率 " + (total ? Math.round((correct / total) * 100) : 0) + "% · 最高连击 " + maxCombo +
      " · 最高分 " + best;
    endModal.classList.add("show");
  }

  /* ---------- 事件 ---------- */
  submitBtn.addEventListener("click", submit);

  keypad.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-k]");
    if (!btn) return;
    const k = btn.dataset.k;
    if (k === "back") { answerEl.value = answerEl.value.slice(0, -1); answerEl.focus(); }
    else if (k === "enter") submit();
    else {
      if (answerEl.value.length < 4) answerEl.value += k;
      answerEl.focus();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); startWithCountdown(); return; }
    if (state !== "play") return;
    if (e.key === "Enter") { e.preventDefault(); submit(); }
    else if (e.key === "Backspace") { /* 输入框自带 */ }
  });

  againBtn.addEventListener("click", startWithCountdown);

  /* ---------- 启动 ---------- */
  startWithCountdown();
})();
