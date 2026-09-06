/* ============================================================
   极简赛车 · 纵向车道躲避
   3 车道无限刷车流；距离=分数；速度递增；撞车结束
   ============================================================ */
(function () {
  "use strict";

  const W = 360, H = 600;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const wrap = document.querySelector(".board-wrap");
  const scoreEl = document.getElementById("score");
  const speedEl = document.getElementById("speed");
  const bestEl = document.getElementById("best");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const LANES = 3;
  const CAR_W = 54, CAR_H = 92;
  const ROAD_X = 18, ROAD_W = W - 36;
  const LANE_W = ROAD_W / LANES;

  const CAR_COLORS = ["#ff5d6c", "#ffd166", "#b06bff", "#22d3ee", "#ff9f43"];

  let best = 0;
  try { best = parseInt(localStorage.getItem("racer-best") || "0", 10) || 0; } catch (_) {}
  bestEl.textContent = best ? best + "m" : "0m";

  let state = "ready";
  let score = 0;          // 米
  let speed = 300;        // px/s 基准
  let player = { lane: 1, x: 0, y: H - 150 };
  let cars = [];
  let spawnT = 0.8;
  let roadOff = 0;
  let parts = [];
  let shakeT = 0;
  let overT = 0;
  let now = 0;
  let lastMs = 0;
  let keys = { left: false, right: false };
  let steerTo = -1;       // 滑动目标车道

  function laneX(lane) {
    return ROAD_X + LANE_W * lane + LANE_W / 2;
  }
  function bump(el) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function setHud() {
    scoreEl.textContent = Math.floor(score) + "m";
    speedEl.textContent = Math.round((speed - 300) / 14 + 1);
  }

  function reset() {
    state = "ready";
    score = 0;
    speed = 300;
    player.lane = 1;
    player.x = laneX(1);
    player.y = H - 150;
    cars = [];
    parts = [];
    spawnT = 0.9;
    shakeT = 0; overT = 0;
    steerTo = -1;
    endModal.classList.remove("show");
    setHud();
  }

  function spawnCar() {
    // 避免同一车道连续刚生成重叠：随机车道，但检查最上方那辆不会瞬间出现于屏幕内
    let lane = (Math.random() * LANES) | 0;
    const y = -CAR_H - 20 - Math.random() * 120;
    cars.push({
      lane, y,
      v: speed * (0.75 + Math.random() * 0.4),
      color: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
      isPlayer: false,
    });
  }

  function update(dt) {
    now += dt;
    shakeT = Math.max(0, shakeT - dt * 3);
    if (state === "ready") return;
    if (state === "over") { overT += dt; if (overT > 0.6) showEnd(); return; }

    // 难度递增
    speed = Math.min(760, speed + dt * 14);
    score += dt * (speed / 300) * 9;
    setHud();

    // 车道变化
    if (keys.left && player.lane > 0) { player.lane -= 1; keys.left = false; }
    if (keys.right && player.lane < LANES - 1) { player.lane += 1; keys.right = false; }
    if (steerTo >= 0 && steerTo !== player.lane) {
      const step = Math.sign(steerTo - player.lane);
      player.lane += step;
    }
    // 平滑横向移动
    const targetX = laneX(player.lane);
    player.x += (targetX - player.x) * Math.min(1, dt * 12);

    // 道路标线滚动
    roadOff = (roadOff + speed * dt) % 48;

    // 刷车
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = Math.max(0.3, 0.95 - score / 1400);
      spawnCar();
      if (speed > 520 && Math.random() < 0.4) spawnCar();
    }

    // 车流移动（比玩家略慢形成超车感）
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.y += c.v * dt;
      if (c.y > H + CAR_H + 30) cars.splice(i, 1);
    }

    // 碰撞（同一车道且纵向重叠）
    const px = player.x, py = player.y;
    cars.forEach((c) => {
      const cx = laneX(c.lane);
      if (Math.abs(cx - px) < CAR_W * 0.72 && Math.abs(c.y - py) < CAR_H * 0.78) {
        crash(c);
      }
    });
    // 粒子推进
    parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    parts = parts.filter((p) => p.t < 0.7);
  }

  function crash(car) {
    if (state !== "play") return;
    state = "over";
    overT = 0;
    shakeT = 1;
    wrap.classList.remove("bad"); void wrap.offsetWidth;
    wrap.classList.add("bad");    for (let i = 0; i < 24; i++) {
      const a = Math.random() * 6.283, sp = 90 + Math.random() * 260;
      parts.push({ x: player.x, y: player.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, color: Math.random() < 0.5 ? "#ffb23e" : "#fff" });
    }
    if (score > best) {
      best = Math.floor(score);
      bestEl.textContent = best + "m";
      try { localStorage.setItem("racer-best", String(best)); } catch (_) {}
      newRecord = true;
    }
  }

  function showEnd() {
    const isNew = newRecord;
    endTitle.textContent = "💥 撞车了！";
    endMsg.innerHTML = "跑了 <b>" + Math.floor(score) + "m</b>" +
      (isNew && score > 0 ? "<br>🏆 新纪录！" : "<br>最高纪录 " + best + "m");
    endModal.classList.add("show");
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - 0.5) * shakeT * 10, (Math.random() - 0.5) * shakeT * 8);

    // 路外背景
    ctx.fillStyle = "#0d3b2e";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0a2c22";
    for (let y = -48 + (roadOff % 48); y < H; y += 48) {
      ctx.fillRect(0, y, 18, 26);
      ctx.fillRect(W - 18, y, 18, 26);
    }

    // 路面
    ctx.fillStyle = "#20293c";
    ctx.fillRect(ROAD_X - 6, 0, ROAD_W + 12, H);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_X + LANE_W * l;
      ctx.setLineDash([26, 22]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 边缘线
    ctx.strokeStyle = "#f5f7fa";
    ctx.lineWidth = 4;
    ctx.strokeRect(ROAD_X - 6, 0, ROAD_W + 12, H);

    // 其它车
    cars.forEach((c) => drawCar(c.x = laneX(c.lane), c.y, c.color, false));

    // 玩家车
    drawCar(player.x, player.y, "#3aa0ff", true);

    // 粒子
    parts.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / 0.7;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    });
    ctx.globalAlpha = 1;

    if (state === "ready") {
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏎️ 极简赛车", W / 2, 240);
      ctx.font = "17px sans-serif";
      ctx.fillStyle = "#9adcff";
      ctx.fillText("← → 变道 / 按住两侧拖动", W / 2, 276);
      ctx.fillStyle = "#ffe9b3";
      ctx.fillText("点击开始", W / 2, 318);
    }
    ctx.restore();
  }

  function drawCar(x, y, color, isPlayer) {
    ctx.save();
    ctx.translate(x, y);
    // 车身
    ctx.fillStyle = color;
    roundRect(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 10);
    ctx.fill();
    // 车窗
    ctx.fillStyle = "rgba(10,16,28,0.85)";
    roundRect(ctx, -CAR_W / 2 + 6, -CAR_H / 2 + 10, CAR_W - 12, 26, 6);
    ctx.fill();
    // 玩家顶光
    if (isPlayer) {
      ctx.fillStyle = "#9adcff";
      roundRect(ctx, -4, -CAR_H / 2 + 2, 8, 8, 3);
      ctx.fill();
    }
    // 尾灯（下沿）
    ctx.fillStyle = isPlayer ? "#ff5d6c" : "#ff8a97";
    ctx.fillRect(-CAR_W / 2 + 4, CAR_H / 2 - 8, 12, 5);
    ctx.fillRect(CAR_W / 2 - 16, CAR_H / 2 - 8, 12, 5);
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
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
  function tapStart() {
    if (state === "ready") {
      state = "play";
      lastMs = performance.now();
      return;
    }
    if (state === "over") return;
  }
  function steer(direction) {
    if (state === "play") {
      if (direction < 0) keys.left = true;
      else keys.right = true;
    }
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") steer(-1);
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") steer(1);
    if (e.key === " " || e.key === "Enter") tapStart();
    if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); }
  });
  cv.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (state === "ready") { tapStart(); return; }
    if (state !== "play") return;
    const rect = cv.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    if (mx < W / 2 - 40) steer(-1);
    else if (mx > W / 2 + 40) steer(1);
  });
  againBtn.addEventListener("click", reset);

  reset();
  requestAnimationFrame(frame);
})();
