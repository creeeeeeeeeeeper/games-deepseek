/* ============================================================
   泡泡射手 · 蜂窝网格消除
   发射泡泡 → 锁定最近空位 → 3 连消 → 悬空掉落
   ============================================================ */
(function () {
  "use strict";

  const W = 420, H = 600;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const wrap = document.querySelector(".board-wrap");
  const scoreEl = document.getElementById("score");
  const levelEl = document.getElementById("level");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  // 网格参数
  const D = 26;               // 泡泡直径
  const R = D / 2;
  const PITCH = D * 0.868;    // 行距
  const COLS = 15;
  const TOP = 44;
  const DANGER_Y = H - 150;
  const PIVOT = { x: W / 2, y: H - 46 };

  const PALETTE = ["#ff5d6c", "#3aa0ff", "#ffd166", "#34d399", "#b06bff", "#ff9f43"];
  const POP_SOUND = null;

  let best = 0;
  try { best = parseInt(localStorage.getItem("bubble-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best;

  // 状态
  let state = "ready";
  let level = 1;
  let score = 0;
  let rows = [];            // rows[r] = {off: r%2, cells:[{col,color}]}
  let cur = null;           // 飞行中 {x,y,vx,vy,color}
  let nextColor = 0;
  let aim = 90;             // 角度（度），90=正上
  let popped = [];          // 正在消失动画的 {x,y,color,t}
  let floats = [];          // 正在掉落的 {x,y,vy,color,rot}
  let fxTexts = [];
  let overT = 0;
  let lockT = 0;            // 消泡冻结计时
  let now = 0;
  let lastMs = 0;

  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }

  // 行 r 的列数
  function colCount(r) { return r % 2 === 0 ? COLS : COLS - 1; }
  function cellCenter(r, c) {
    return {
      x: D / 2 + c * D + (r % 2 === 0 ? 0 : D / 2),
      y: TOP + R + r * PITCH,
    };
  }
  function getCell(r, c) {
    if (r < 0) return null;
    const row = rows[r];
    if (!row) return null;
    if (c < 0 || c >= colCount(r)) return null;
    const cell = row.cells[c];
    return cell ? { row: r, col: c, color: cell } : null;
  }

  // 邻居 6 个方向
  function neighbors(r, c) {
    const odd = r % 2;
    const drs = odd ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
                    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
    const out = [];
    for (const [dr, dc] of drs) {
      const n = getCell(r + dr, c + dc);
      if (n) out.push(n);
    }
    return out;
  }

  function resetBoard() {
    rows = [];
    for (let r = 0; r < 5; r++) {
      const cols = colCount(r);
      const cells = new Array(cols);
      for (let c = 0; c < cols; c++) {
        cells[c] = PALETTE[(Math.random() * levelColors()) | 0];
      }
      rows.push({ cells });
    }
  }

  function levelColors() { return Math.min(6, 2 + level); }

  /* ---------- 放置 & 消除 ---------- */
  function placeBubble(px, py, color) {
    // 找最近的空网格位
    const rr = Math.max(0, Math.min(rows.length + 3, Math.round((py - TOP - R) / PITCH)));
    let best = null, bd = 1e9;
    for (let r = Math.max(0, rr - 2); r <= rr + 2; r++) {
      const n = colCount(r);
      for (let c = 0; c < n; c++) {
        if (getCell(r, c)) continue;
        const cc = cellCenter(r, c);
        const d = Math.hypot(cc.x - px, cc.y - py);
        if (d < bd) { bd = d; best = { r, c, cc }; }
      }
    }
    if (!best) return;
    if (best.r >= rows.length) {
      while (rows.length <= best.r) rows.push({ cells: new Array(colCount(rows.length)) });
    }
    rows[best.r].cells[best.c] = color;

    // 同色连通
    const group = [{ row: best.r, col: best.c }];
    const seen = new Set([best.r + "," + best.c]);
    for (let i = 0; i < group.length; i++) {
      const g = group[i];
      neighbors(g.row, g.col).forEach((n) => {
        const key = n.row + "," + n.col;
        if (!seen.has(key) && n.color === color) { seen.add(key); group.push({ row: n.row, col: n.col }); }
      });
    }
    if (group.length >= 3) {
      // 消除
      group.forEach((g) => {
        rows[g.row].cells[g.col] = null;
        const cc = cellCenter(g.row, g.col);
        popped.push({ x: cc.x, y: cc.y, color, t: 0 });
      });
      score += group.length * 10;
      fxTexts.push({ x: best.cc.x, y: best.cc.y - 14, text: "+" + group.length * 10, color: "#ffd166", t: 0 });
      updateScore();
      // 悬空掉落
      setTimeout(() => dropFloating(), 200);
      lockT = 0.18;
      return;
    }
    // 无消除也检查悬空
    dropFloating();
  }

  function dropFloating() {
    const connected = new Set();
    const queue = [];
    rows[0] && rows[0].cells.forEach((cell, c) => {
      if (cell) { const k = "0," + c; connected.add(k); queue.push([0, c]); }
    });
    while (queue.length) {
      const [r, c] = queue.pop();
      neighbors(r, c).forEach((n) => {
        const k = n.row + "," + n.col;
        if (!connected.has(k)) { connected.add(k); queue.push([n.row, n.col]); }
      });
    }
    let dropped = 0;
    rows.forEach((row, r) => {
      row.cells.forEach((color, c) => {
        if (color && !connected.has(r + "," + c)) {
          const cc = cellCenter(r, c);
          floats.push({ x: cc.x, y: cc.y, vy: 0, color, rot: 0 });
          row.cells[c] = null;
          dropped++;
        }
      });
    });
    if (dropped) {
      score += dropped * 15;
      fxTexts.push({ x: W / 2, y: 180, text: "掉落 +" + dropped * 15, color: "#34d399", t: 0 });
      updateScore();
    }
  }

  function updateScore() {
    scoreEl.textContent = score;
    bump(scoreEl);
    if (score > best) bestEl.textContent = score;
  }

  /* ---------- 主流程 ---------- */
  function startLevel() {
    levelEl.textContent = level;
    resetBoard();
    popped = []; floats = []; fxTexts = [];
    cur = null; lockT = 0; overT = 0;
    nextColor = (Math.random() * levelColors()) | 0;
    state = "play";
  }

  function startGame() {
    score = 0;
    level = 1;
    scoreEl.textContent = 0;
    endModal.classList.remove("show");
    startLevel();
  }

  function fire() {
    if (state !== "play" || cur) return;
    const a = (aim * Math.PI) / 180;
    // 发射"预览色"，再随机下一发预览——保证嘴上看到的就是要发射的
    cur = {
      x: PIVOT.x, y: PIVOT.y,
      vx: Math.cos(a) * 780,
      vy: -Math.sin(a) * 780,
      color: PALETTE[nextColor],
    };
    nextColor = (Math.random() * levelColors()) | 0;
  }

  function checkDanger() {
    for (let r = rows.length - 1; r >= 0; r--) {
      const row = rows[r];
      if (!row) continue;
      for (let c = 0; c < row.cells.length; c++) {
        if (row.cells[c]) {
          const cc = cellCenter(r, c);
          if (cc.y > DANGER_Y) return true;
          return false; // 最靠下的行都没超线即可
        }
      }
    }
    return false;
  }

  function boardEmpty() {
    return rows.every((row) => row.cells.every((c) => !c));
  }

  function gameOver() {
    state = "over";
    overT = 0;
    const isNew = score > best;
    if (isNew) {
      best = score;
      try { localStorage.setItem("bubble-best", String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    setTimeout(() => {
      endTitle.textContent = "🫧 泡泡过线了！";
      endMsg.innerHTML = "得分 <b>" + score + "</b> · 到达第 " + level + " 关" +
        (isNew ? "<br>🏆 新纪录！" : "<br>最高分 " + best);
      endModal.classList.add("show");
    }, 500);
  }

  function update(dt) {
    now += dt;
    lockT = Math.max(0, lockT - dt);
    popped.forEach((p) => (p.t += dt));
    popped = popped.filter((p) => p.t < 0.24);
    floats.forEach((f) => { f.vy += 700 * dt; f.y += f.vy * dt; f.rot += 4 * dt; });
    floats = floats.filter((f) => f.y < H + 60);
    fxTexts.forEach((f) => (f.t += dt));
    fxTexts = fxTexts.filter((f) => f.t < 1);

    if (state !== "play") {
      if (state === "over") overT += dt;
      return;
    }
    if (cur) {
      cur.x += cur.vx * dt;
      cur.y += cur.vy * dt;
      // 墙壁
      if (cur.x - R < 0) { cur.x = R; cur.vx = Math.abs(cur.vx); }
      if (cur.x + R > W) { cur.x = W - R; cur.vx = -Math.abs(cur.vx); }
      // 顶部/碰到泡泡/高度判定
      let hit = cur.y - R <= TOP + 4;
      if (!hit) {
        for (let r = 0; r < rows.length && !hit; r++) {
          const row = rows[r];
          for (let c = 0; c < row.cells.length && !hit; c++) {
            if (!row.cells[c]) continue;
            const cc = cellCenter(r, c);
            if (Math.hypot(cur.x - cc.x, cur.y - cc.y) < D - 3) hit = true;
          }
        }
      }
      if (hit) {
        placeBubble(cur.x, cur.y, cur.color);
        cur = null;
        if (boardEmpty()) {
          level += 1;
          fxTexts.push({ x: W / 2, y: 180, text: "🎉 通关！第 " + level + " 关", color: "#34d399", t: 0 });
          setTimeout(() => { if (state === "play") startLevel(); }, 700);
        } else if (checkDanger()) {
          gameOver();
        }
      }
    }
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();

    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#101c38");
    g.addColorStop(1, "#0a0f1e");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 危险线
    ctx.strokeStyle = "rgba(255,93,108,0.4)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, DANGER_Y);
    ctx.lineTo(W, DANGER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // 已放置泡泡
    rows.forEach((row, r) => {
      row.cells.forEach((color, c) => {
        if (!color) return;
        const cc = cellCenter(r, c);
        drawBubble(cc.x, cc.y, color, 1);
      });
    });

    // 发射瞄准线
    if (state === "play" && !cur) {
      const a = (aim * Math.PI) / 180;
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PIVOT.x, PIVOT.y);
      ctx.lineTo(PIVOT.x + Math.cos(a) * 400, PIVOT.y - Math.sin(a) * 400);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(PIVOT.x + Math.cos(a) * 20, PIVOT.y - Math.sin(a) * 20, 3, 0, 7);
      ctx.fill();
    }

    // 发射器
    ctx.fillStyle = "#2b3850";
    ctx.beginPath();
    ctx.arc(PIVOT.x, PIVOT.y, 24, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "#3aa0ff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 飞行泡泡
    if (cur) drawBubble(cur.x, cur.y, cur.color, 1);

    // 下一发预告
    if (state === "play") {
      drawBubble(PIVOT.x, PIVOT.y - 2, PALETTE[nextColor], 0.92);
    }

    // 消除动画
    popped.forEach((p) => {
      const a = 1 - p.t / 0.24;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R * (1.6 - 0.6 * p.t / 0.24), 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // 掉落
    floats.forEach((f) => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      drawBubble(0, 0, f.color, 0.95);
      ctx.restore();
    });

    // 飘字
    ctx.textAlign = "center";
    fxTexts.forEach((f) => {
      ctx.globalAlpha = 1 - f.t;
      ctx.fillStyle = f.color;
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(f.text, f.x, f.y - f.t * 50);
    });
    ctx.globalAlpha = 1;

    // 就绪提示
    if (state === "ready") {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("点击开始", W / 2, 250);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#9adcff";
      ctx.fillText("瞄准 · 发射 · 三连消除", W / 2, 286);
    }
    ctx.restore();
  }

  function drawBubble(x, y, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, 7);
    ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.arc(x - R * 0.35, y - R * 0.35, R * 0.3, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, R - 0.5, 0, 7);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* ---------- 输入 ---------- */
  function setAim(clientX, clientY) {
    const rect = cv.getBoundingClientRect();
    const mx = ((clientX - rect.left) / rect.width) * W;
    const my = ((clientY - rect.top) / rect.height) * H;
    let deg = (Math.atan2(PIVOT.y - my, mx - PIVOT.x) * 180) / Math.PI;
    if (deg < -90) deg = -90;
    if (deg > 90) deg = 90;
    aim = 90 - deg; // 0..180，90=上
    aim = Math.max(15, Math.min(165, aim));
  }
  cv.addEventListener("pointermove", (e) => { setAim(e.clientX, e.clientY); });
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { state = "play"; return; }
    setAim(e.clientX, e.clientY);
    fire();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); startGame(); }
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (state === "play") fire(); }
    if (e.key === "ArrowLeft") aim = Math.max(15, aim - 3);
    if (e.key === "ArrowRight") aim = Math.min(165, aim + 3);
  });
  againBtn.addEventListener("click", startGame);

  startGame();
  requestAnimationFrame(frame);
})();
