/* ============================================================
   塔防 · 固定 S 型路径
   金币造塔 ⚡单体 / 💥溅射；消灭怪物得金币；坚持 10 波获胜
   ============================================================ */
(function () {
  "use strict";

  const W = 640, H = 520;
  const CELL = 40;
  const COLS = 16, ROWS = 13;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  const goldEl = document.getElementById("gold");
  const livesEl = document.getElementById("lives");
  const waveEl = document.getElementById("wave");
  const nextBtn = document.getElementById("nextBtn");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");
  const towerBtns = Array.from(document.querySelectorAll(".tower-btn"));

  // 塔类型定义
  const TYPES = {
    gun:    { cost: 50, range: 105, dmg: 14, rate: 0.55, color: "#3aa0ff" },
    splash: { cost: 100, range: 90, dmg: 9, rate: 1.05, aoe: 60, color: "#ff9f43" },
  };

  let gold = 160;
  let lives = 10;
  let wave = 0;            // 已完成波次
  let state = "idle";      // idle | count | fight | win | over
  let selected = "gun";
  let towers = [];         // {c,r,type,cd,x,y}
  let enemies = [];
  let shots = [];
  let parts = [];
  let floats = [];
  let spawnQueue = [];
  let spawnT = 0;
  let countdown = 0;
  let hoverCell = null;
  let overT = 0;
  let best = 0;
  let now = 0;
  let lastMs = 0;
  let killCount = 0;

  try { best = parseInt(localStorage.getItem("td-best") || "0", 10) || 0; } catch (_) {}

  /* ---------- 路径构建（S 型蛇形） ---------- */
  const path = [];
  {
    const legs = [
      ["R", 1, 0, 15], ["D", 15, 1, 3], ["L", 3, 15, 0], ["D", 0, 3, 5],
      ["R", 5, 0, 15], ["D", 15, 5, 7], ["L", 7, 15, 0], ["D", 0, 7, 9],
      ["R", 9, 0, 15],
    ];
    const push = (c, r) => {
      const last = path[path.length - 1];
      if (!last || last.c !== c || last.r !== r) path.push({ c, r });
    };
    legs.forEach(([dir, row, a, b]) => {
      const step = a <= b ? 1 : -1;
      if (dir === "R" || dir === "L") {
        for (let c = a; c !== b + step; c += step) push(c, row);
      } else {
        for (let r = a; r !== b + step; r += step) push(row, r);
      }
    });
  }
  const pathSet = new Set(path.map((p) => p.c + "," + p.r));
  const START = path[0];
  const GOAL = path[path.length - 1];

  function cc(c, r) { return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }; }

  /* ---------- 对局 ---------- */
  function setHud() {
    goldEl.textContent = gold;
    livesEl.textContent = "❤".repeat(Math.max(0, lives)) + "🖤".repeat(Math.max(0, 10 - lives));
    waveEl.textContent = Math.min(wave, 10) + "/10";
  }
  function reset() {
    gold = 160; lives = 10; wave = 0; state = "idle";
    towers = []; enemies = []; shots = []; parts = []; floats = []; spawnQueue = [];
    killCount = 0;
    overT = 0;
    endModal.classList.remove("show");
    nextBtn.disabled = false;
    setHud();
  }

  function spawnWave(n) {
    const count = Math.min(30, 6 + n * 3);   // 敌人更多
    spawnQueue = [];
    for (let i = 0; i < count; i++) {
      const type = i % 10 === 9 ? "tank" : i % 4 === 3 ? "fast" : "norm";
      const hpBase = type === "tank" ? 150 : type === "fast" ? 45 : 70;
      spawnQueue.push({ type, hp: Math.round(hpBase * (1 + n * 0.55)) });
    }
    spawnT = 0;
    state = "fight";
  }

  /* ---------- 更新 ---------- */
  function update(dt) {
    now += dt;
    if (state === "count") {
      countdown -= dt;
      if (countdown <= 0) { wave += 1; spawnWave(wave); }
      return;
    }
    if (state === "over") { overT += dt; if (overT > 0.8) showEnd(false); return; }
    if (state !== "fight") return;

    // 出怪
    if (spawnQueue.length) {
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnT = Math.max(0.28, 0.5 - wave * 0.025);   // 更快
        const def = spawnQueue.shift();
        const p0 = cc(START.c, START.r);
        enemies.push({
          seg: 0, x: p0.x, y: p0.y, facing: 0,
          hp: def.hp, maxhp: def.hp, type: def.type,
          speed: def.type === "fast" ? 160 : def.type === "tank" ? 60 : 96,
          gold: def.type === "tank" ? 25 : def.type === "fast" ? 12 : 8,
          slow: 0, color: def.type === "tank" ? "#b06bff" : def.type === "fast" ? "#ffd166" : "#ff5d6c",
        });
      }
    }

    // 移动敌人（沿路径转向，并记录朝向）
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const mult = e.slow > 0 ? 0.55 : 1;
      e.slow = Math.max(0, e.slow - dt);
      let dist = e.speed * mult * dt;
      while (dist > 0 && e.seg < path.length - 1) {
        const a = cc(path[e.seg].c, path[e.seg].r);
        const b = cc(path[e.seg + 1].c, path[e.seg + 1].r);
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const can = Math.min(dist, segLen);
        e.x += ((b.x - a.x) / segLen) * can;
        e.y += ((b.y - a.y) / segLen) * can;
        e.facing = Math.atan2(b.y - a.y, b.x - a.x);
        dist -= can;
        if (can >= segLen - 0.001) e.seg += 1;
      }
      if (e.seg >= path.length - 1) {
        // 抵达城堡
        enemies.splice(i, 1);
        lives -= 1;
        setHud();
        if (lives <= 0) { state = "over"; overT = 0; }
      }
    }

    // 塔射击
    towers.forEach((t) => {
      t.cd -= dt;
      if (t.cd > 0) return;
      const tc = cc(t.c, t.r);
      let target = null, bd = TYPES[t.type].range;
      enemies.forEach((e) => {
        const d = Math.hypot(e.x - tc.x, e.y - tc.y);
        if (d < bd) { bd = d; target = e; }
      });
      if (!target) return;
      t.cd = TYPES[t.type].rate;
      t.angle = Math.atan2(target.y - tc.y, target.x - tc.x);
      shots.push({ x: tc.x, y: tc.y, target, type: t.type, dmg: TYPES[t.type].dmg, aoe: TYPES[t.type].aoe || 0, t: 0 });
      muzzle(tc.x, tc.y, t.angle, TYPES[t.type].color);
    });

    // 弹道
    shots.forEach((s) => {
      s.t += dt;
      if (!s.target || s.target.hp <= 0) { s.dead = true; return; }
      const speed = 560;
      const dx = s.target.x - s.x, dy = s.target.y - s.y;
      const d = Math.hypot(dx, dy);
      const step = Math.min(speed * dt, d);
      s.x += (dx / d) * step;
      s.y += (dy / d) * step;
      if (d < 14) {
        // 命中
        hitEnemy(s.target, s.dmg);
        if (s.aoe) {
          enemies.forEach((e2) => { if (e2 !== s.target && Math.hypot(e2.x - s.target.x, e2.y - s.target.y) < s.aoe) hitEnemy(e2, s.dmg * 0.6); });
          boom(s.target.x, s.target.y, TYPES.splash.color);
        } else {
          boom(s.x, s.y, "#9adcff");
        }
        s.dead = true;
      }
    });
    shots = shots.filter((s) => !s.dead);

    function hitEnemy(e, dmg) {
      if (e.hp <= 0) return;
      e.hp -= dmg;
      e.slow = Math.max(e.slow, 0.05);
      if (e.hp <= 0) {
        gold += e.gold;
        killCount += 1;
        floats.push({ x: e.x, y: e.y, text: "+" + e.gold, color: "#ffd166", t: 0 });
        boom(e.x, e.y, e.color);
        setHud();
        enemies = enemies.filter((x) => x !== e);
      }
    }

    // 波次结束
    if (!enemies.length && !spawnQueue.length && state === "fight") {
      if (wave >= 10) {
        state = "win";
        showEnd(true);
      } else {
        state = "count";
        countdown = 2.2;
        gold += 40 + wave * 8;   // 波次奖励
        setHud();
        floats.push({ x: W / 2, y: 90, text: "波次奖励 +" + (40 + wave * 8), color: "#34d399", t: 0 });
      }
    }

    // 特效推进
    parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    parts = parts.filter((p) => p.t < 0.5);
    floats.forEach((f) => (f.t += dt));
    floats = floats.filter((f) => f.t < 0.9);
  }

  function muzzle(x, y, ang, color) {
    for (let i = 0; i < 4; i++) {
      const a = ang + (Math.random() - 0.5) * 0.8;
      parts.push({ x: x + Math.cos(ang) * 12, y: y + Math.sin(ang) * 12, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, t: 0, color });
    }
  }
  function boom(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * 6.283, sp = 60 + Math.random() * 140;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, color });
    }
  }

  function showEnd(win) {
    const isNew = win && (best === 0 || wave >= best);
    if (win && wave > best) {
      best = wave;
      try { localStorage.setItem("td-best", String(best)); } catch (_) {}
    }
    endTitle.textContent = win ? "🏆 防守成功！" : "💥 城堡被攻破了";
    endMsg.innerHTML = "坚持到第 <b>" + Math.min(wave, 10) + "</b> 波 · 消灭 " + killCount + " 只" +
      (win && isNew ? "<br>🏆 已通关！" : "<br>最高波次 " + best);
    endModal.classList.add("show");
  }

  /* ---------- 建造 ---------- */
  function build(c, r) {
    if (pathSet.has(c + "," + r)) return;
    if (r === START.r && c === START.c) return;
    if (c === GOAL.c && r === GOAL.r) return;
    const found = towers.find((t) => t.c === c && t.r === r);
    if (found) {
      // 拆除返还一半
      gold += Math.round(TYPES[found.type].cost / 2);
      towers = towers.filter((t) => t !== found);
      floats.push({ x: cc(c, r).x, y: cc(c, r).y - 10, text: "拆除 +" + Math.round(TYPES[found.type].cost / 2), color: "#9adcff", t: 0 });
      setHud();
      return;
    }
    const def = TYPES[selected];
    if (gold < def.cost) {
      floats.push({ x: cc(c, r).x, y: cc(c, r).y - 10, text: "金币不足！", color: "#ff5d6c", t: 0 });
      return;
    }
    gold -= def.cost;
    towers.push({ c, r, type: selected, cd: 0, angle: 0, x: cc(c, r).x, y: cc(c, r).y });
    setHud();
  }

  /* ---------- 绘制 ---------- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // 草地
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#254b2c" : "#2a5230";
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
        if (pathSet.has(c + "," + r)) {
          ctx.fillStyle = "#8a6a4a";
          ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
          ctx.fillStyle = "rgba(0,0,0,0.15)";
          ctx.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
        }
      }
    }
    // 起点 & 终点城堡
    const s = cc(START.c, START.r), g = cc(GOAL.c, GOAL.r);
    ctx.font = "26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👾", s.x, s.y);
    ctx.font = "34px sans-serif";
    ctx.fillText("🏰", g.x, g.y);

    // 塔
    towers.forEach((t) => {
      const def = TYPES[t.type];
      const tc = cc(t.c, t.r);
      // 射程（悬停）
      if (hoverCell && hoverCell.c === t.c && hoverCell.r === t.r) {
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(tc.x, tc.y, def.range, 0, 7);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // 底座
      ctx.fillStyle = "#233248";
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, 15, 0, 7);
      ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, 11, 0, 7);
      ctx.fill();
      // 炮管
      ctx.save();
      ctx.translate(tc.x, tc.y);
      ctx.rotate(t.angle);
      ctx.fillStyle = "#e8ecf5";
      ctx.fillRect(2, -3, 16, 6);
      ctx.restore();
      ctx.font = "13px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(t.type === "gun" ? "⚡" : "💥", tc.x, tc.y + 1);
    });

    // 敌人（带行进方向的小箭头，转弯一眼可见）
    enemies.forEach((e) => {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.facing || 0);
      // 机身：朝前的泪滴形
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(13, 0);
      ctx.quadraticCurveTo(-2, -11, -8, -6);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-8, 6);
      ctx.quadraticCurveTo(-2, 11, 13, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 血条
      const bw = 22;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(e.x - bw / 2, e.y - 20, bw, 4);
      ctx.fillStyle = e.hp / e.maxhp > 0.5 ? "#67e6a0" : e.hp / e.maxhp > 0.25 ? "#ffd166" : "#ff5d6c";
      ctx.fillRect(e.x - bw / 2, e.y - 20, bw * Math.max(0, e.hp / e.maxhp), 4);
    });

    // 弹道
    shots.forEach((s) => {
      ctx.fillStyle = s.aoe ? "#ffd166" : "#9adcff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.aoe ? 4 : 3, 0, 7);
      ctx.fill();
    });

    // 特效
    parts.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / 0.5;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // 飘字
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    floats.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / 0.9;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - f.t * 44);
    });
    ctx.globalAlpha = 1;

    // 倒计时 / 开场
    ctx.textAlign = "center";
    if (state === "idle") {
      ctx.fillStyle = "rgba(10,15,26,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 30px sans-serif";
      ctx.fillText("🏰 塔 防", W / 2, H / 2 - 60);
      ctx.font = "17px sans-serif";
      ctx.fillStyle = "#9adcff";
      ctx.fillText("建造 ⚡ / 💥 炮塔，守住 10 波进攻", W / 2, H / 2 - 20);
      ctx.fillStyle = "#ffe9b3";
      ctx.font = "bold 19px sans-serif";
      ctx.fillText("点击“立即开波”开始！", W / 2, H / 2 + 26);
    } else if (state === "count") {
      ctx.fillStyle = "rgba(10,15,26,0.45)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 26px sans-serif";
      ctx.fillText("第 " + (wave + 1) + " 波来袭！" + Math.ceil(countdown) + "s", W / 2, H / 2);
    }
  }

  /* ---------- 输入 ---------- */
  cv.addEventListener("click", (e) => {
    const rect = cv.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * W / CELL);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * H / CELL);
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) build(c, r);
  });
  cv.addEventListener("mousemove", (e) => {
    const rect = cv.getBoundingClientRect();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * W / CELL);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * H / CELL);
    hoverCell = (c >= 0 && c < COLS && r >= 0 && r < ROWS) ? { c, r } : null;
  });
  towerBtns.forEach((b) => b.addEventListener("click", () => {
    selected = b.dataset.t;
    towerBtns.forEach((x) => x.classList.toggle("active", x === b));
  }));
  nextBtn.addEventListener("click", () => {
    if (state === "idle" || state === "count") {
      if (state === "idle") { state = "count"; countdown = 0.1; }
      else countdown = Math.min(countdown, 0.1);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") { e.preventDefault(); reset(); }
  });
  againBtn.addEventListener("click", reset);

  /* ---------- 主循环 ---------- */
  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  reset();
  requestAnimationFrame(frame);
})();
