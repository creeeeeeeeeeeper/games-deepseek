/* ============================================================
   找不同 · 双图找茬
   程序化生成 A/B 两幅相近花园场景，B 有 5 处不同，点击标注
   ============================================================ */
(function () {
  "use strict";

  const CW = 420, CH = 330;
  const canvasA = document.getElementById("canvasA");
  const canvasB = document.getElementById("canvasB");
  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");
  const foundEl = document.getElementById("found");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const msgEl = document.getElementById("msg");
  const newBtn = document.getElementById("newBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const NEED = 5;
  const FLOWER_COLORS = ["#ff5d6c", "#ff9f43", "#b06bff", "#3aa0ff", "#ffd166", "#22d3ee"];

  let bestSec = null;
  try {
    const v = parseFloat(localStorage.getItem("diff-best"));
    if (v > 0) bestSec = v;
  } catch (_) {}
  bestEl.textContent = bestSec === null ? "--" : fmt(bestSec);

  let layout = null;   // 稳定坐标：flowers/butterflies/apples/clouds
  let diffs = [];      // {type,i,found,cx,cy,r}
  let stateA = null, stateB = null;
  let foundCount = 0;
  let over = false;
  let startAt = 0;
  let timerId = null;

  function fmt(sec) {
    sec = Math.floor(sec);
    return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");
  }
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------- 布局与差异 ---------- */
  function makeLayout() {
    const flowers = [];
    for (let i = 0; i < 8; i++) flowers.push({ x: 40 + i * 47 + rand(-8, 8), y: CH - 26 + rand(-6, 6) });
    const butterflies = [];
    for (let i = 0; i < 3; i++) butterflies.push({ x: rand(46, CW - 46), y: rand(52, 168) });
    const apples = [];
    for (let i = 0; i < 6; i++) {
      const a = rand(0, 6.28), rr = rand(8, 58);
      apples.push({ x: 258 + Math.cos(a) * rr, y: 122 + Math.sin(a) * rr * 0.7 });
    }
    const clouds = [{ x: 64, y: 46 }, { x: 196, y: 30 }, { x: 330, y: 56 }];
    return { flowers, butterflies, apples, clouds };
  }

  function baseState() {
    return {
      flowerIdx: layout.flowers.map(() => (Math.random() * FLOWER_COLORS.length) | 0),
      butterflyOn: layout.butterflies.map(() => Math.random() < 0.6),
      appleOn: layout.apples.map(() => Math.random() < 0.8),
      cloudShift: layout.clouds.map(() => 0),
    };
  }
  function cloneState(s) {
    return {
      flowerIdx: s.flowerIdx.slice(),
      butterflyOn: s.butterflyOn.slice(),
      appleOn: s.appleOn.slice(),
      cloudShift: s.cloudShift.slice(),
    };
  }
  function applyDiff(st, d) {
    if (d.type === "flower") st.flowerIdx[d.i] = (st.flowerIdx[d.i] + 1 + ((Math.random() * 3) | 0)) % FLOWER_COLORS.length;
    else if (d.type === "butterfly") st.butterflyOn[d.i] = !st.butterflyOn[d.i];
    else if (d.type === "apple") st.appleOn[d.i] = !st.appleOn[d.i];
    else if (d.type === "cloud") st.cloudShift[d.i] = 26;
  }
  function regionOf(type, i) {
    if (type === "flower") { const f = layout.flowers[i]; return { cx: f.x, cy: f.y, r: 17 }; }
    if (type === "butterfly") { const b = layout.butterflies[i]; return { cx: b.x, cy: b.y, r: 17 }; }
    if (type === "apple") { const a = layout.apples[i]; return { cx: a.x, cy: a.y, r: 15 }; }
    const c = layout.clouds[i];
    return { cx: c.x + 13, cy: c.y + 8, r: 60 };
  }
  function chooseDiffs() {
    const list = [];
    // 两朵花改色
    const picked = new Set();
    while (picked.size < 2) picked.add((Math.random() * layout.flowers.length) | 0);
    picked.forEach((i) => list.push({ type: "flower", i, found: false }));
    // 一只蝴蝶增减
    list.push({ type: "butterfly", i: (Math.random() * layout.butterflies.length) | 0, found: false });
    // 一个苹果增减
    list.push({ type: "apple", i: (Math.random() * layout.apples.length) | 0, found: false });
    // 一朵云位移
    list.push({ type: "cloud", i: (Math.random() * layout.clouds.length) | 0, found: false });
    list.forEach((d) => Object.assign(d, regionOf(d.type, d.i)));
    return list;
  }

  /* ---------- 绘制 ---------- */
  function drawScene(ctx, st, showRings) {
    // 天空
    const g = ctx.createLinearGradient(0, 0, 0, CH);
    g.addColorStop(0, "#8fd3ff");
    g.addColorStop(1, "#eaf8ff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    // 云
    ctx.fillStyle = "#ffffff";
    layout.clouds.forEach((c, i) => {
      const x = c.x + st.cloudShift[i];
      ctx.beginPath();
      ctx.arc(x, c.y, 19, 0, 7);
      ctx.arc(x + 19, c.y + 5, 14, 0, 7);
      ctx.arc(x - 19, c.y + 5, 14, 0, 7);
      ctx.fill();
    });

    // 太阳
    ctx.fillStyle = "#ffd93d";
    ctx.beginPath();
    ctx.arc(376, 54, 18, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,209,61,0.75)";
    ctx.lineWidth = 3;
    for (let a = 0; a < 8; a++) {
      const ang = (a * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(376 + Math.cos(ang) * 24, 54 + Math.sin(ang) * 24);
      ctx.lineTo(376 + Math.cos(ang) * 33, 54 + Math.sin(ang) * 33);
      ctx.stroke();
    }

    // 远山与树
    ctx.fillStyle = "#a5d6a7";
    ctx.beginPath();
    ctx.moveTo(0, 235);
    ctx.quadraticCurveTo(100, 140, 200, 232);
    ctx.quadraticCurveTo(300, 130, CW, 240);
    ctx.lineTo(CW, 330); ctx.lineTo(0, 330);
    ctx.closePath(); ctx.fill();

    // 树
    ctx.fillStyle = "#8d5a3a";
    ctx.fillRect(246, 128, 24, 92);
    ctx.fillStyle = "#5fae68";
    ctx.beginPath(); ctx.arc(258, 112, 74, 0, 7); ctx.fill();
    ctx.fillStyle = "#7cc983";
    ctx.beginPath(); ctx.arc(232, 86, 30, 0, 7); ctx.fill();
    ctx.fillStyle = "#ff5a55";
    layout.apples.forEach((a, i) => {
      if (!st.appleOn[i]) return;
      ctx.beginPath(); ctx.arc(a.x, a.y, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = "#8d5a3a";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y - 7); ctx.lineTo(a.x + 4, a.y - 12); ctx.stroke();
    });

    // 草地
    ctx.fillStyle = "#8bc34a";
    ctx.fillRect(0, CH - 24, CW, 24);

    // 花
    layout.flowers.forEach((f, i) => {
      const col = FLOWER_COLORS[st.flowerIdx[i]];
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x, f.y + 14); ctx.stroke();
      ctx.fillStyle = col;
      for (let k = 0; k < 5; k++) {
        const a = (k * 6.283) / 5;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * 5, f.y + Math.sin(a) * 5 - 2, 4.4, 0, 7); ctx.fill();
      }
      ctx.fillStyle = "#ffe082";
      ctx.beginPath(); ctx.arc(f.x, f.y - 2, 3.3, 0, 7); ctx.fill();
    });

    // 蝴蝶（固定朝向，随 i 轻微飘动由静态绘制）
    layout.butterflies.forEach((b, i) => {
      if (!st.butterflyOn[i]) return;
      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🦋", b.x, b.y);
    });

    // 找到 → 绿圈
    if (showRings) {
      ctx.strokeStyle = "#2fd77e";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      diffs.forEach((d) => {
        if (d.found) {
          ctx.beginPath(); ctx.arc(d.cx, d.cy, d.r, 0, 7); ctx.stroke();
        }
      });
      ctx.setLineDash([]);
    }
  }

  /* ---------- 对局 ---------- */
  function newRound() {
    clearInterval(timerId);
    layout = makeLayout();
    diffs = chooseDiffs();
    foundCount = 0;
    over = false;
    foundEl.textContent = "0/" + NEED;
    msgEl.textContent = "";
    msgEl.className = "msg";
    endModal.classList.remove("show");

    stateA = baseState();
    stateB = cloneState(stateA);
    diffs.forEach((d) => applyDiff(stateB, d));

    drawScene(ctxA, stateA, false);
    drawScene(ctxB, stateB, true);
    startAt = Date.now();
    timerId = setInterval(() => { timeEl.textContent = fmt((Date.now() - startAt) / 1000); }, 250);
  }

  function repaint() {
    drawScene(ctxB, stateB, true);
  }

  function onCanvasClick(e) {
    if (over) return;
    const rect = canvasB.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CW;
    const y = ((e.clientY - rect.top) / rect.height) * CH;
    let hit = false;
    diffs.forEach((d) => {
      if (d.found) return;
      if (Math.hypot(x - d.cx, y - d.cy) <= d.r) {
        d.found = true;
        foundCount += 1;
        hit = true;
        foundEl.textContent = foundCount + "/" + NEED;
        foundEl.classList.remove("bump"); void foundEl.offsetWidth;
        foundEl.classList.add("bump");
        repaint();
      }
    });
    if (hit && foundCount === NEED) win();
    else if (!hit) {
      canvasB.classList.remove("bad"); void canvasB.offsetWidth;
      canvasB.classList.add("bad");
      setTimeout(() => canvasB.classList.remove("bad"), 320);
    }
  }

  function win() {
    over = true;
    clearInterval(timerId);
    const secs = (Date.now() - startAt) / 1000;
    const isBest = bestSec === null || secs < bestSec;
    if (isBest) {
      bestSec = secs;
      try { localStorage.setItem("diff-best", String(bestSec)); } catch (_) {}
      bestEl.textContent = fmt(bestSec);
    }
    msgEl.textContent = "🎉 全部找到！用时 " + fmt(secs);
    msgEl.className = "msg win";
    endTitle.textContent = "🎉 全找到了！";
    endMsg.innerHTML = "用时 <b>" + fmt(secs) + "</b>" +
      (isBest ? "<br>🏆 新的最快纪录！" : "<br>最快纪录 " + fmt(bestSec));
    setTimeout(() => endModal.classList.add("show"), 450);
  }

  /* ---------- 事件 ---------- */
  canvasB.addEventListener("click", onCanvasClick);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); newRound(); }
  });
  newBtn.addEventListener("click", newRound);
  againBtn.addEventListener("click", newRound);

  newRound();
})();
