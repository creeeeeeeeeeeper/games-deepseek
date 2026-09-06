(() => {
  'use strict';

  /* ================= DOM 引用 ================= */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const speedEl = document.getElementById('speed');
  const toast = document.getElementById('toast');
  const modal = document.getElementById('modal');
  const modalSub = document.getElementById('modalSub');
  const resultScore = document.getElementById('resultScore');
  const recordBadge = document.getElementById('recordBadge');
  const againBtn = document.getElementById('againBtn');
  const jumpBtn = document.getElementById('jumpBtn');
  const duckBtn = document.getElementById('duckBtn');
  const restartBtn = document.getElementById('restartBtn');

  /* ================= 常量 ================= */
  const W = 800, H = 300;
  const GROUND_Y = 258;          // 地面线
  const GRAVITY = 2600;          // 重力 px/s²
  const JUMP_V = -900;           // 起跳速度
  const JUMP_CUT = -620;         // 提前松手的最小上升速度（小跳）
  const FAST_FALL = 2.1;         // 空中按下蹲的加速倍率
  const BASE_SPEED = 320;        // 初始速度 px/s
  const MAX_SPEED = 880;         // 最大速度 px/s
  const BEST_KEY = 'dino-best';
  const READY_TIME = 1.35;       // 开场准备动画时长
  const STAND_H = 52;            // 站立视觉高度
  const DUCK_H = 30;             // 下蹲视觉高度
  const FONT = 'system-ui, "Microsoft YaHei", sans-serif';

  // 昼 / 夜配色（随昼夜插值）
  const COL = {
    skyDay: [246, 249, 251],   skyNight: [12, 17, 36],
    groundDay: [233, 239, 243], groundNight: [17, 23, 45],
    lineDay: [88, 102, 116],   lineNight: [140, 160, 195],
    dinoDay: [78, 92, 108],    dinoNight: [232, 238, 246],
    cactusDay: [56, 150, 96],  cactusNight: [72, 200, 128],
    birdDay: [90, 104, 120],   birdNight: [210, 222, 240],
    dustDay: [176, 190, 200],  dustNight: [70, 84, 120],
    cloudDay: [214, 226, 234], cloudNight: [46, 58, 92],
  };

  /* ================= 工具 ================= */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const smooth = (a, b, t) => {
    const x = clamp((t - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  };
  const mix = (c1, c2, t) => [
    lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t),
  ];
  const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  /* ================= 游戏状态 ================= */
  let state = 'ready';            // ready | playing | dead
  let score = 0;
  let best = 0;
  let speed = BASE_SPEED;
  let readyT = 0, deathT = 0, flashT = 0, shakeT = 0;
  let lastMilestone = 0;
  let newRecord = false;
  let nightAmt = 0;               // 0 白天 → 1 夜晚
  let distSinceSpawn = 0, nextGap = 420, lastWasBird = false;
  let dustTimer = 0;
  let hudScore = -1, hudSpeedTxt = '';

  const dino = {
    x: 60,
    bottom: GROUND_Y,
    vy: 0,
    onGround: true,
    ducking: false,
    fastFall: false,
    runPhase: 0,
    blinkT: 0,
    nextBlink: rand(1.5, 3.5),
    sx: 1, sy: 1,                 // 挤压 / 拉伸系数
    jumpHeld: false,
    holdTimer: 0,                 // 点按跳的自动“松手”计时
    jumpBuffer: -1,               // 落地前预输入跳跃
  };

  let obstacles = [];
  let particles = [];
  let floaties = [];
  let marks = [];                 // 地面纹理
  let clouds = [];
  let stars = [];

  const duckSources = new Set();  // 'key' | 'touch' | 'btn'

  /* ================= 场景初始化 ================= */
  function newMark(x) {
    return { x, y: GROUND_Y + rand(5, 32), w: rand(3, 16), h: rand(1.5, 3) };
  }

  function initScenery() {
    marks = [];
    for (let i = 0; i < 46; i++) marks.push(newMark(rand(0, W)));
    clouds = [];
    for (let i = 0; i < 3; i++) {
      clouds.push({ x: rand(0, W), y: rand(30, 110), s: rand(0.7, 1.3) });
    }
    stars = [];
    for (let i = 0; i < 42; i++) {
      stars.push({ x: rand(0, W), y: rand(8, 140), r: rand(0.7, 1.7), p: rand(0, Math.PI * 2) });
    }
  }

  function loadBest() {
    try {
      best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    } catch (e) { best = 0; }
    bestEl.textContent = String(best);
  }

  function reset() {
    state = 'ready';
    score = 0;
    speed = BASE_SPEED;
    readyT = 0; deathT = 0; flashT = 0; shakeT = 0;
    lastMilestone = 0;
    newRecord = false;
    nightAmt = 0;
    distSinceSpawn = 0; nextGap = 420; lastWasBird = false;
    dustTimer = 0;
    obstacles = []; particles = []; floaties = [];
    dino.bottom = GROUND_Y; dino.vy = 0; dino.onGround = true;
    dino.ducking = false; dino.fastFall = false;
    dino.sx = 1; dino.sy = 1; dino.runPhase = 0;
    dino.jumpBuffer = -1; dino.jumpHeld = false; dino.holdTimer = 0;
    duckSources.clear();
    modal.classList.remove('show');
    initScenery();
    updateHud();
  }

  /* ================= 输入：跳跃 / 下蹲 ================= */
  function doJump() {
    dino.vy = JUMP_V;
    dino.onGround = false;
    dino.ducking = false;
    dino.jumpHeld = true;
    dino.holdTimer = 0.25;        // 点按也算“按住”一小段 → 完整起跳
    dino.sx = 0.82; dino.sy = 1.22; // 起跳拉伸
    spawnDust(6);
  }

  function tryJump() {
    if (state !== 'playing') return;
    if (dino.onGround) {
      doJump();
    } else {
      dino.jumpBuffer = 0.12;     // 缓冲：即将落地时按下也能接跳
    }
  }

  function updateDuck() {
    const want = duckSources.size > 0 && state === 'playing';
    if (want) {
      if (dino.onGround) dino.ducking = true;
      else dino.fastFall = true;
    } else {
      dino.ducking = false;
      dino.fastFall = false;
    }
  }

  /* ================= 障碍物 ================= */
  function spawnObstacles(dt) {
    distSinceSpawn += speed * dt;
    if (distSinceSpawn < nextGap) return;
    distSinceSpawn = 0;

    // 随分数（≈速度）逐步解锁更多障碍
    const pool = [{ k: 'cactusS', w: 10 }];
    if (score >= 60) pool.push({ k: 'cactusL', w: 8 });
    if (score >= 130) pool.push({ k: 'cactusG', w: 7 });
    if (score >= 260) {
      pool.push({ k: 'birdLow', w: lastWasBird ? 0 : 4 });
      pool.push({ k: 'birdHigh', w: lastWasBird ? 0 : 4 });
    }

    let total = 0;
    for (const p of pool) total += p.w;
    let r = Math.random() * total;
    let pick = pool[0].k;
    for (const p of pool) {
      r -= p.w;
      if (r <= 0) { pick = p.k; break; }
    }
    lastWasBird = pick === 'birdLow' || pick === 'birdHigh';
    nextGap = rand(300, 620) + speed * 0.35 + (lastWasBird ? 90 : 0);

    if (pick === 'cactusS') {
      obstacles.push({ k: 'cactus', x: W + 30, w: rand(14, 18), h: rand(26, 34) });
    } else if (pick === 'cactusL') {
      obstacles.push({ k: 'cactus', x: W + 30, w: rand(20, 26), h: rand(42, 54) });
    } else if (pick === 'cactusG') {
      const n = 2 + (Math.random() < 0.4 ? 1 : 0);
      const parts = [];
      let cx = 0;
      for (let i = 0; i < n; i++) {
        const w = rand(13, 20), h = rand(24, 46);
        parts.push({ dx: cx, w, h });
        cx += w + rand(2, 6);
      }
      obstacles.push({ k: 'group', x: W + 30, w: cx, parts });
    } else {
      const high = pick === 'birdHigh';
      obstacles.push({
        k: 'bird', x: W + 40, w: 40, h: 24,
        y: high ? 195 : 234,       // 高位需下蹲躲 / 低位需跳跃躲
        bob: rand(0, Math.PI * 2),
      });
    }
  }

  function moveObstacles(dt) {
    const dx = speed * dt;
    for (const o of obstacles) {
      o.x -= dx + (o.k === 'bird' ? speed * 0.18 * dt : 0);
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -60);
  }

  function dinoBox() {
    if (dino.ducking) {
      return { x: dino.x + 8, y: dino.bottom - DUCK_H + 4, w: 40, h: DUCK_H - 6 };
    }
    return { x: dino.x + 16, y: dino.bottom - STAND_H + 4, w: 26, h: STAND_H - 6 };
  }

  function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function checkCollision() {
    const db = dinoBox();
    for (const o of obstacles) {
      if (o.k === 'cactus') {
        if (hit(db, { x: o.x + 2, y: GROUND_Y - o.h + 2, w: o.w - 4, h: o.h - 2 })) return die();
      } else if (o.k === 'group') {
        for (const p of o.parts) {
          if (hit(db, { x: o.x + p.dx + 2, y: GROUND_Y - p.h + 2, w: p.w - 4, h: p.h - 2 })) return die();
        }
      } else { // bird
        if (hit(db, { x: o.x + 8, y: o.y + 4, w: o.w - 18, h: 16 })) return die();
      }
    }
  }

  function die() {
    state = 'dead';
    deathT = 0;
    flashT = 0.85;                // 死亡闪白
    shakeT = 0.4;                 // 屏幕震动
    dino.ducking = false;
    dino.fastFall = false;
    if (dino.onGround) {
      dino.vy = -320;             // 死亡小弹跳
      dino.onGround = false;
    }
    spawnDust(12);
    const s = Math.floor(score);
    if (s > best) {
      best = s;
      newRecord = true;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* 忽略存储异常 */ }
      bestEl.textContent = String(best);
    }
  }

  function showResult() {
    resultScore.textContent = String(Math.floor(score));
    modalSub.textContent = `最高分 ${best} · 速度 ×${(speed / BASE_SPEED).toFixed(1)}`;
    recordBadge.classList.toggle('show', newRecord);
    modal.classList.add('show');
  }

  /* ================= 里程碑 ================= */
  function onMilestone(v) {
    toast.textContent = `✦ ${v} 分！`;
    toast.classList.remove('show');
    void toast.offsetWidth;       // 重触发动画
    toast.classList.add('show');
    scoreEl.classList.remove('pulse');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pulse');
    floaties.push({ x: dino.x + 44, y: 150, vy: -46, life: 1.1, max: 1.1, text: `✦ ${v}` });
  }

  /* ================= 粒子 ================= */
  function spawnDust(n) {
    for (let i = 0; i < n; i++) {
      const life = rand(0.35, 0.7);
      particles.push({
        x: dino.x + rand(2, 14),
        y: GROUND_Y - rand(0, 4),
        vx: rand(-90, -20) - speed * 0.12,
        vy: rand(-70, -15),
        r: rand(1.5, 3.5),
        life, max: life,
      });
    }
    if (particles.length > 140) particles.splice(0, particles.length - 140);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.vy += 300 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > GROUND_Y + 30) p.y = GROUND_Y + 30;
      p.life -= dt;
      if (state === 'playing') p.x -= speed * dt * 0.4;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function updateFloaties(dt) {
    for (const f of floaties) {
      f.y += f.vy * dt;
      f.life -= dt;
    }
    floaties = floaties.filter((f) => f.life > 0);
  }

  /* ================= 场景滚动 ================= */
  function scrollGround(px) {
    for (const m of marks) {
      m.x -= px;
      if (m.x + m.w < -10) Object.assign(m, newMark(W + rand(0, 60)));
    }
  }

  function updateClouds(dt, spd) {
    for (const c of clouds) {
      c.x -= (spd * 0.12 + 6) * dt;
      if (c.x < -100) { c.x = W + rand(20, 120); c.y = rand(30, 110); c.s = rand(0.7, 1.3); }
    }
  }

  function blinkUpdate(dt) {
    if (dino.blinkT > 0) {
      dino.blinkT -= dt;
    } else {
      dino.nextBlink -= dt;
      if (dino.nextBlink <= 0) {
        dino.blinkT = 0.14;
        dino.nextBlink = rand(1.6, 4);
      }
    }
  }

  /* ================= 主更新 ================= */
  function update(dt, now) {
    if (state === 'ready') {
      readyT += dt;
      scrollGround(BASE_SPEED * 0.35 * dt);
      updateClouds(dt, BASE_SPEED * 0.2);
      blinkUpdate(dt);
      if (readyT >= READY_TIME) {
        state = 'playing';
        updateDuck();             // 若已按住下蹲则立即生效
      }
    } else if (state === 'playing') {
      speed = Math.min(MAX_SPEED, BASE_SPEED + score * 1.05);
      score += (speed * dt) / 30;

      const m = Math.floor(score / 100);
      if (m > lastMilestone) {
        lastMilestone = m;
        onMilestone(m * 100);
      }

      // 昼夜循环：每 800 分一轮，含平滑过渡
      const cyc = (score % 800) / 800;
      nightAmt = smooth(0.38, 0.5, cyc) * (1 - smooth(0.88, 1, cyc));

      // 恐龙物理
      if (!dino.onGround) {
        dino.vy += GRAVITY * (dino.fastFall ? FAST_FALL : 1) * dt;
        if (dino.holdTimer > 0) {
          dino.holdTimer -= dt;
          if (dino.holdTimer <= 0) dino.jumpHeld = false;
        }
        // 提前松手 → 短跳
        if (!dino.jumpHeld && dino.vy < JUMP_CUT) dino.vy = JUMP_CUT;
        dino.bottom += dino.vy * dt;
        if (dino.bottom >= GROUND_Y) {
          dino.bottom = GROUND_Y;
          dino.vy = 0;
          dino.onGround = true;
          dino.fastFall = false;
          dino.sx = 1.18; dino.sy = 0.8; // 落地压扁
          spawnDust(9);
          if (dino.jumpBuffer > 0) {
            dino.jumpBuffer = -1;
            doJump();
          } else {
            updateDuck();
          }
        }
      } else {
        dino.runPhase += dt * (6 + speed / 90);
        dustTimer -= dt;
        if (dustTimer <= 0) {
          dustTimer = 0.09;
          spawnDust(1);           // 跑步扬尘
        }
      }
      if (dino.jumpBuffer > 0) dino.jumpBuffer -= dt;

      // 挤压/拉伸回弹
      dino.sx += (1 - dino.sx) * Math.min(1, dt * 12);
      dino.sy += (1 - dino.sy) * Math.min(1, dt * 12);

      blinkUpdate(dt);
      scrollGround(speed * dt);
      updateClouds(dt, speed);
      spawnObstacles(dt);
      moveObstacles(dt);
      checkCollision();
    } else { // dead
      deathT += dt;
      flashT = Math.max(0, flashT - dt * 2);
      shakeT = Math.max(0, shakeT - dt);
      if (dino.bottom < GROUND_Y || dino.vy !== 0) {
        dino.vy += GRAVITY * dt;
        dino.bottom += dino.vy * dt;
        if (dino.bottom >= GROUND_Y) {
          dino.bottom = GROUND_Y;
          dino.vy = 0;
          dino.onGround = true;
        }
      }
      if (deathT > 0.75 && !modal.classList.contains('show')) showResult();
    }

    updateParticles(dt);
    updateFloaties(dt);
    updateHud();
  }

  function updateHud() {
    const s = Math.floor(score);
    if (s !== hudScore) {
      hudScore = s;
      scoreEl.textContent = String(s);
    }
    const sp = '×' + (speed / BASE_SPEED).toFixed(1);
    if (sp !== hudSpeedTxt) {
      hudSpeedTxt = sp;
      speedEl.textContent = sp;
    }
  }

  /* ================= 绘制 ================= */
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function tri(x1, y1, x2, y2, x3, y3) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }

  function drawCelestial(now) {
    if (nightAmt > 0.02) {
      for (const s of stars) {
        const a = nightAmt * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 2 + s.p)));
        ctx.fillStyle = `rgba(235,240,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const cx = W - 110, cy = 58;
    const sa = 1 - nightAmt;
    if (sa > 0.02) { // 太阳
      ctx.fillStyle = `rgba(255,208,100,${(0.25 * sa).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,208,100,${(0.85 * sa).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    }
    if (nightAmt > 0.02) { // 月亮（月牙）
      ctx.fillStyle = `rgba(226,232,246,${(0.95 * nightAmt).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rgb(mix(COL.skyDay, COL.skyNight, nightAmt));
      ctx.beginPath(); ctx.arc(cx - 9, cy - 5, 17, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawClouds() {
    const c = mix(COL.cloudDay, COL.cloudNight, nightAmt);
    ctx.fillStyle = rgb(c);
    for (const cl of clouds) {
      const s = cl.s;
      ctx.beginPath();
      ctx.arc(cl.x, cl.y, 12 * s, 0, Math.PI * 2);
      ctx.arc(cl.x + 14 * s, cl.y - 6 * s, 10 * s, 0, Math.PI * 2);
      ctx.arc(cl.x + 28 * s, cl.y, 11 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMarks() {
    ctx.fillStyle = rgb(mix(COL.lineDay, COL.lineNight, nightAmt));
    ctx.globalAlpha = 0.5;
    for (const m of marks) ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.globalAlpha = 1;
  }

  function drawCactus(x, w, h, col) {
    ctx.fillStyle = col;
    const gy = GROUND_Y + 2;
    rr(x, gy - h, w, h + 2, w / 2); ctx.fill();          // 主干
    const ay = gy - h * 0.62;                            // 左臂
    rr(x - 7, ay, 6, h * 0.32, 3); ctx.fill();
    rr(x - 7, ay + h * 0.26, 9, 5, 2.5); ctx.fill();
    const by = gy - h * 0.75;                            // 右臂
    rr(x + w + 1, by, 6, h * 0.3, 3); ctx.fill();
    rr(x + w - 2, by + h * 0.24, 9, 5, 2.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';            // 高光
    rr(x + 2, gy - h + 3, 3, Math.max(2, h - 8), 1.5); ctx.fill();
  }

  function drawBird(o, now, col) {
    const bobY = Math.sin(now * 3 + o.bob) * 3;
    const x = o.x, y = o.y + bobY;
    ctx.fillStyle = col;
    // 身体
    ctx.beginPath();
    ctx.ellipse(x + o.w / 2, y + 14, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // 头 + 喙（朝左）
    ctx.beginPath();
    ctx.ellipse(x + 8, y + 10, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    tri(x + 4, y + 8, x - 9, y + 11, x + 4, y + 14);
    // 尾巴
    tri(x + o.w - 14, y + 12, x + o.w + 2, y + 7, x + o.w + 2, y + 16);
    // 扇动的翅膀
    const wing = Math.sin(now * 11 + o.bob) * 16;
    tri(x + 12, y + 12, x + 26, y + 12 - wing, x + 30, y + 14);
    // 眼睛
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x + 8, y + 9, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  function drawObstacles(now) {
    const cac = rgb(mix(COL.cactusDay, COL.cactusNight, nightAmt));
    const bird = rgb(mix(COL.birdDay, COL.birdNight, nightAmt));
    for (const o of obstacles) {
      if (o.k === 'cactus') drawCactus(o.x, o.w, o.h, cac);
      else if (o.k === 'group') for (const p of o.parts) drawCactus(o.x + p.dx, p.w, p.h, cac);
      else drawBird(o, now, bird);
    }
  }

  function drawEye(ex, ey, r) {
    if (state === 'dead') { // X 眼
      ctx.strokeStyle = '#ff5d6c';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r);
      ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ex, ey, r, 0, Math.PI * 2); ctx.fill();
    if (dino.blinkT > 0) { // 眨眼
      ctx.strokeStyle = rgb(mix(COL.dinoDay, COL.dinoNight, nightAmt));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex - r + 1, ey); ctx.lineTo(ex + r - 1, ey); ctx.stroke();
    } else {
      ctx.fillStyle = '#1c2733';
      ctx.beginPath(); ctx.arc(ex + 1, ey, r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawLeg(hipX, hipY, footY, phase, grounded) {
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    if (grounded) {
      const dx = Math.sin(phase) * 7;
      const lift = Math.max(0, -Math.cos(phase)) * 5;
      ctx.lineTo(hipX + dx, footY - lift);
    } else {
      ctx.lineTo(hipX + 5, footY - 9); // 空中收腿
    }
    ctx.stroke();
  }

  function drawDino() {
    const col = rgb(mix(COL.dinoDay, COL.dinoNight, nightAmt));
    const duck = dino.ducking && dino.onGround;
    const cx = dino.x + (duck ? 26 : 24);
    const b = dino.bottom;

    ctx.save();
    // 以脚底为轴心做挤压 / 拉伸
    ctx.translate(cx, b);
    ctx.scale(dino.sx, dino.sy);
    ctx.translate(-cx, -b);

    ctx.fillStyle = col;
    ctx.strokeStyle = col;

    if (duck) {
      tri(dino.x + 6, b - 20, dino.x - 14, b - 28, dino.x + 8, b - 10); // 尾巴
      rr(dino.x + 2, b - 26, 44, 20, 9); ctx.fill();                    // 身体
      rr(dino.x + 34, b - 30, 20, 15, 5); ctx.fill();                   // 头
      rr(dino.x + 42, b - 18, 8, 4, 2); ctx.fill();                     // 小手
      drawLeg(dino.x + 16, b - 10, b, dino.runPhase, true);
      drawLeg(dino.x + 32, b - 10, b, dino.runPhase + Math.PI, true);
      drawEye(dino.x + 47, b - 24, 3);
    } else {
      tri(dino.x + 16, b - 36, dino.x - 6, b - 46, dino.x + 18, b - 24); // 尾巴
      rr(dino.x + 12, b - 42, 25, 24, 9); ctx.fill();                    // 身体
      rr(dino.x + 26, b - 54, 21, 17, 5); ctx.fill();                    // 头
      rr(dino.x + 26, b - 44, 14, 5, 2); ctx.fill();                     // 下巴
      rr(dino.x + 30, b - 32, 9, 5, 2.5); ctx.fill();                    // 小手
      drawLeg(dino.x + 20, b - 22, b, dino.runPhase, dino.onGround);
      drawLeg(dino.x + 31, b - 22, b, dino.runPhase + Math.PI, dino.onGround);
      drawEye(dino.x + 41, b - 48, 3.4);
    }
    ctx.restore();
  }

  function drawParticles() {
    const c = mix(COL.dustDay, COL.dustNight, nightAmt);
    ctx.fillStyle = rgb(c);
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * 0.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaties() {
    ctx.textAlign = 'center';
    ctx.font = `800 22px ${FONT}`;
    for (const f of floaties) {
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.fillStyle = '#34d399';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawReady() {
    ctx.save();
    ctx.textAlign = 'center';
    if (readyT < 0.7) {
      const dots = '.'.repeat(1 + (Math.floor(readyT * 4) % 3));
      ctx.font = `700 30px ${FONT}`;
      ctx.fillStyle = 'rgba(30,40,60,0.75)';
      ctx.fillText(`准备${dots}`, W / 2, 120);
    } else {
      const p = clamp((readyT - 0.7) / 0.35, 0, 1);
      const s = 0.6 + 0.4 * (1 - Math.pow(1 - p, 3)); // 缓动弹出
      ctx.translate(W / 2, 120);
      ctx.scale(s, s);
      ctx.font = `800 44px ${FONT}`;
      ctx.fillStyle = '#2f9e5f';
      ctx.fillText('出发！', 0, 15);
    }
    ctx.restore();
  }

  function draw(now) {
    ctx.save();
    if (shakeT > 0) { // 死亡震屏
      const s = shakeT * 14;
      ctx.translate(rand(-s, s), rand(-s, s));
    }
    // 天空
    ctx.fillStyle = rgb(mix(COL.skyDay, COL.skyNight, nightAmt));
    ctx.fillRect(-20, -20, W + 40, H + 40);
    drawCelestial(now);
    drawClouds();
    // 地面
    ctx.fillStyle = rgb(mix(COL.groundDay, COL.groundNight, nightAmt));
    ctx.fillRect(-20, GROUND_Y, W + 40, H - GROUND_Y + 20);
    drawMarks();
    ctx.fillStyle = rgb(mix(COL.lineDay, COL.lineNight, nightAmt));
    ctx.fillRect(-20, GROUND_Y, W + 40, 3);
    // 实体
    drawObstacles(now);
    drawParticles();
    drawDino();
    drawFloaties();
    ctx.restore();
    // 死亡闪白
    if (flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashT.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'ready') drawReady();
  }

  /* ================= 主循环 ================= */
  let last = performance.now() / 1000;
  function frame(t) {
    const now = t / 1000;
    let dt = now - last;
    last = now;
    if (dt > 0.05) dt = 0.05;  // 帧时间差驱动 + 切后台保护
    if (dt < 0) dt = 0;
    update(dt, now);
    draw(now);
    requestAnimationFrame(frame);
  }

  /* ================= 事件绑定 ================= */
  window.addEventListener('keydown', (e) => {
    const jumpKeys = ['Space', 'ArrowUp', 'KeyW'];
    const duckKeys = ['ArrowDown', 'KeyS'];
    if (jumpKeys.includes(e.code) || duckKeys.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (jumpKeys.includes(e.code)) {
      dino.jumpHeld = true;
      tryJump();
    } else if (duckKeys.includes(e.code)) {
      duckSources.add('key');
      updateDuck();
    } else if (e.code === 'KeyR') {
      reset();
    } else if (e.code === 'Enter' && state === 'dead') {
      reset();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
      dino.jumpHeld = false; // 提前松手 → 短跳
    } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
      duckSources.delete('key');
      updateDuck();
    }
  });

  window.addEventListener('blur', () => {
    dino.jumpHeld = false;
    duckSources.clear();
    updateDuck();
  });

  // 画布：点按跳跃、下滑下蹲
  let ptr = null;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (ptr) return;
    ptr = { id: e.pointerId, y0: e.clientY, x0: e.clientX, swiped: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!ptr || e.pointerId !== ptr.id || ptr.swiped) return;
    const dy = e.clientY - ptr.y0;
    if (dy > 24 && dy > Math.abs(e.clientX - ptr.x0)) {
      ptr.swiped = true;
      duckSources.add('touch');
      updateDuck();
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    e.preventDefault();
    if (ptr.swiped) {
      duckSources.delete('touch');
      updateDuck();
    } else {
      tryJump();
    }
    ptr = null;
  });
  canvas.addEventListener('pointercancel', (e) => {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (ptr.swiped) {
      duckSources.delete('touch');
      updateDuck();
    }
    ptr = null;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // 屏上按钮
  jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); tryJump(); });
  jumpBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  duckBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    duckSources.add('btn');
    updateDuck();
  });
  const duckOff = () => { duckSources.delete('btn'); updateDuck(); };
  duckBtn.addEventListener('pointerup', duckOff);
  duckBtn.addEventListener('pointercancel', duckOff);
  duckBtn.addEventListener('pointerleave', duckOff);
  duckBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  restartBtn.addEventListener('click', () => reset());
  againBtn.addEventListener('click', () => reset());

  /* ================= 启动 ================= */
  loadBest();
  reset();
  requestAnimationFrame(frame);
})();
