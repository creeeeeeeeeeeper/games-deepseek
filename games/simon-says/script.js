/* ============================================================
   西蒙记忆 · 复现灯光序列
   四色音块 + WebAudio 音调；关卡递进；最高关卡记录
   ============================================================ */
(function () {
  "use strict";

  const pads = Array.from(document.querySelectorAll(".pad"));
  const centerCount = document.querySelector(".center span");
  const simonEl = document.getElementById("simon");
  const levelEl = document.getElementById("level");
  const bestEl = document.getElementById("best");
  const stateEl = document.getElementById("state");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const NOTES = [261.6, 329.6, 392, 523.25]; // C4 E4 G4 C5

  let best = 0;
  try { best = parseInt(localStorage.getItem("simon-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  let seq = [];          // 需要复现的序列
  let step = 0;          // 玩家已正确按到第几步
  let playing = false;   // 正在播放序列中
  let accepting = false; // 等待玩家输入
  let level = 1;
  let audio = null;

  function beep(freq, dur) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.22, audio.currentTime + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + dur + 0.05);
    } catch (_) {}
  }

  function setState(t, pulse) {
    stateEl.textContent = t;
    if (pulse) { stateEl.classList.remove("pulse"); void stateEl.offsetWidth; stateEl.classList.add("pulse"); }
  }
  function setCount(t, cls) {
    centerCount.textContent = t;
    centerCount.className = cls || "";
  }

  function light(i, ms, dim) {
    return new Promise((res) => {
      pads[i].classList.add("lit");
      beep(NOTES[i], 0.25);
      setTimeout(() => {
        pads[i].classList.remove("lit");
        setTimeout(res, dim || 90);
      }, ms);
    });
  }

  async function playSeq() {
    playing = true;
    accepting = false;
    pads.forEach((p) => (p.disabled = true));
    setState("观察…", true);
    setCount("👀");
    for (const s of seq) {
      await light(s, Math.max(300, 520 - level * 14), Math.max(70, 160 - level * 6));
    }
    playing = false;
    pads.forEach((p) => (p.disabled = false));
    accepting = true;
    setState("你的回合");
    setCount(String(seq.length));
  }

  function nextRound() {
    seq.push((Math.random() * 4) | 0);
    level = seq.length;
    levelEl.textContent = seq.length;
    msgEl.textContent = "";
    msgEl.className = "msg";
    setTimeout(playSeq, 500);
  }

  function startGame() {
    seq = [];
    step = 0;
    levelEl.textContent = 1;
    bestEl.textContent = best;
    endModal.classList.remove("show");
    nextRound();
  }

  function fail() {
    accepting = false;
    simonEl.classList.remove("bad"); void simonEl.offsetWidth;
    simonEl.classList.add("bad");
    setCount("✘", "err");
    beep(110, 0.5);
    const got = seq.length - 1;
    const isNew = got > best;
    if (isNew) {
      best = got;
      try { localStorage.setItem("simon-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = "🎵 记错了！";
    endMsg.innerHTML = "到达第 <b>" + seq.length + "</b> 关 · 正确复现 <b>" + got + "</b> 步" +
      (isNew ? "<br>🏆 新纪录！" : "<br>最高纪录 " + best + " 关");
    setTimeout(() => endModal.classList.add("show"), 600);
  }

  function onPad(i) {
    if (!accepting) return;
    pads[i].classList.add("active");
    setTimeout(() => pads[i].classList.remove("active"), 120);
    beep(NOTES[i], 0.2);
    if (seq[step] === i) {
      step += 1;
      setCount(String(seq.length - step) || "✓", step === seq.length ? "ok" : "");
      if (step === seq.length) {
        accepting = false;
        pads.forEach((p) => (p.disabled = true));
        setCount("✓", "ok");
        setState("过关！", true);
        setTimeout(nextRound, 900);
      }
    } else {
      fail();
    }
  }

  pads.forEach((p, i) => p.addEventListener("click", () => onPad(i)));

  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); startGame(); }
    const n = ["1", "2", "3", "4"].indexOf(e.key);
    if (n >= 0) onPad(n);
  });
  againBtn.addEventListener("click", startGame);

  startGame();
})();
