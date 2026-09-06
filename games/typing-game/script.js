/* ============================================================
   打字游戏 · 字母下落敲击挑战
   键盘对应字母命中；字母落底扣命；速度随得分提升
   ============================================================ */
(function () {
  "use strict";

  const sky = document.getElementById("sky");
  const fxEl = document.getElementById("fx");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const speedEl = document.getElementById("speed");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  let best = 0;
  try { best = parseInt(localStorage.getItem("typing-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  const GROUND = 44;   // 底线距底部像素
  let letters = [];    // {el, ch, x, y, speed}
  let state = "count"; // count | play | over
  let score = 0;
  let lives = 3;
  let spawnT = 1.2;
  let overT = 0;
  let now = 0;
  let lastMs = 0;

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function setLives() {
    livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 3 - lives));
  }

  function area() { return { w: sky.clientWidth, h: sky.clientHeight }; }

  function spawn() {
    const { w } = area();
    const ch = String.fromCharCode(65 + ((Math.random() * 26) | 0));
    const el = document.createElement("div");
    el.className = "letter";
    el.textContent = ch;
    el.style.left = Math.max(10, Math.min(w - 34, Math.random() * w)) + "px";
    sky.appendChild(el);
    letters.push({ el, ch, x: parseFloat(el.style.left), y: -40, speed: 60 + Math.random() * 40 });
  }

  function fx(x, y, text, cls) {
    const f = document.createElement("span");
    f.className = "fx " + (cls || "");
    f.textContent = text;
    f.style.left = Math.max(4, x - 14) + "px";
    f.style.top = Math.max(10, y - 14) + "px";
    fxEl.appendChild(f);
    setTimeout(() => f.remove(), 520);
  }

  function hitLetter(letterObj) {
    const idx = letters.indexOf(letterObj);
    if (idx === -1) return;
    letters.splice(idx, 1);
    letterObj.el.classList.add("hit");
    setTimeout(() => letterObj.el.remove(), 320);
    score += 1;
    scoreEl.textContent = score;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;
    fx(letterObj.x, letterObj.y, letterObj.ch, "");
  }

  function loseLife() {
    lives -= 1;
    setLives();
    sky.classList.remove("bad"); void sky.offsetWidth;
    sky.classList.add("bad");
    if (lives <= 0) {
      state = "over";
      overT = 0;
    }
  }

  function speedLevel() { return Math.min(9, 1 + Math.floor(score / 12)); }

  function update(dt) {
    now += dt;
    if (state === "count") return;
    if (state === "over") { overT += dt; if (overT > 0.7) showEnd(); return; }

    const { h } = area();
    const base = 55 + speedLevel() * 26;
    spawnT -= dt;
    const gap = Math.max(0.4, 1.35 - score * 0.008);
    if (spawnT <= 0) { spawnT = gap * (0.7 + Math.random() * 0.6); spawn(); }

    letters.forEach((l) => {
      l.speed += (base - 50) * dt * 0.4;   // 渐进加速
      l.y += l.speed * dt;
      l.el.style.top = l.y + "px";
      l.el.classList.toggle("near", l.y > h - GROUND - 40);
    });
    // 落底
    letters = letters.filter((l) => {
      if (l.y > h - GROUND + 4) {
        l.el.remove();
        loseLife();
        return false;
      }
      return true;
    });
    speedEl.textContent = speedLevel();
  }

  /* ---------- 键盘 ---------- */
  function onKey(ch) {
    if (state !== "play") return;
    ch = ch.toUpperCase();
    // 优先消灭最接近底线的一个同字母
    let bestL = null, maxY = -1;
    letters.forEach((l) => {
      if (l.ch === ch && l.y > maxY) { maxY = l.y; bestL = l; }
    });
    if (bestL) hitLetter(bestL);
  }

  /* ---------- 流程 ---------- */
  function countShow(t) {
    overlay.innerHTML = t + (t === "开始！" ? "" : "<small>按字母键消灭下落字母</small>");
    overlay.classList.remove("pop"); void overlay.offsetWidth;
    overlay.classList.add("pop");
  }
  function startCount() {
    state = "count";
    score = 0; lives = 3; spawnT = 1.0;
    letters.forEach((l) => l.el.remove());
    letters = [];
    document.querySelectorAll(".fx").forEach((n) => n.remove());
    scoreEl.textContent = 0;
    speedEl.textContent = 1;
    setLives();
    endModal.classList.remove("show");
    const seq = ["3", "2", "1", "开始！"];
    let i = 0;
    countShow(seq[0]);
    const t = setInterval(() => {
      i += 1;
      if (i < seq.length) countShow(seq[i]);
      else {
        clearInterval(t);
        overlay.style.display = "none";
        state = "play";
        spawn();
        lastMs = performance.now();
        requestAnimationFrame(loop);
      }
    }, 700);
  }

  function showEnd() {
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("typing-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    endTitle.textContent = "💥 字母入侵了！";
    endMsg.innerHTML = "得分 <b>" + score + "</b> · 速度档 Lv." + speedLevel() +
      "<br>" + (isNew ? "🏆 新纪录！" : "最高分 " + best);
    overlay.style.display = "";
    overlay.textContent = "";
    endModal.classList.add("show");
  }

  function loop(ts) {
    if (state !== "play") return;
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    requestAnimationFrame(loop);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Delete") { e.preventDefault(); startCount(); return; }
    if (/^[a-zA-Z]$/.test(e.key)) onKey(e.key);
  });
  againBtn.addEventListener("click", startCount);

  /* 防止输入法/系统快捷键干扰：忽略修饰键 */
  document.addEventListener("keypress", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
  });

  setLives();
  startCount();
})();
