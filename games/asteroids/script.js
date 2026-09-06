'use strict';

(() => {
  // ===================== DOM =====================
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const livesEl = document.getElementById('lives');
  const waveEl = document.getElementById('wave');
  const msgEl = document.getElementById('msg');
  const modalEl = document.getElementById('modal');
  const modalTitleEl = document.getElementById('modal-title');
  const modalSubEl = document.getElementById('modal-sub');
  const btnAgain = document.getElementById('btn-again');
  const btnRestart = document.getElementById('btn-restart');

  const BEST_KEY = 'asteroids-best';

  // ===================== 配置 =====================
  const ROT_SPEED = 3.9;        // 旋转速度（弧度/秒）
  const THRUST = 310;           // 推进加速度（px/s²）
  const MAX_SPEED = 470;        // 飞船最大速度
  const DRAG = 0.32;            // 太空微阻尼（每秒）
  const BRAKE = 2.6;            // S 键减速强度
  const BULLET_SPEED = 520;
  const BULLET_LIFE = 1.05;     // 子弹寿命（秒）
  const FIRE_CD = 0.2;          // 射速间隔（秒）
  const RESPAWN_DELAY = 1.4;    // 重生等待
  const INV_TIME = 2.4;         // 重生无敌时间
  const SHIP_R = 13;            // 飞船碰撞半径
  const BASE_COUNT = 3;         // 第 1 波行星数
  const BASE_SPEED = 46;        // 第 1 波基础速度
  const SPEED_PER_WAVE = 7;     // 每波速度增量
  const SIZE_INFO = { 3: { r: 40, score: 20 }, 2: { r: 23, score: 50 }, 1: { r: 12, score: 100 } };
  const SIZE_SPD = { 3: 1.0, 2: 1.55, 1: 2.15 };
  const EXPLODE_COLORS = ['#ffb23e', '#ff5d6c', '#e8eef7', '#9aa7b8'];
  const THRUST_COLORS = ['#ffb23e', '#ffd27a', '#ff8a4a'];

  // ===================== 状态 =====================
  let phase = 'ready';          // ready | play | over
  let score = 0;
  let lives = 3;
  let wave = 1;
  let best = 0;
  let startBest = 0;
  let ship = null;
  let asteroids = [];
  let bullets = [];
  let particles = [];
  let shake = 0;
  let readyTimer = 0;
  let respawnTimer = 0;
  let waveGapTimer = 0;
  let waveGapActive = false;
  let thrustAcc = 0;
  let msgTimeout = null;

  try {
    best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (e) {
    best = 0;
  }
  startBest = best;

  // 星空背景（静态生成，绘制时闪烁）
  const stars = [];
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.4 + Math.random() * 1.3,
      ph: Math.random() * Math.PI * 2,
      sp: 0.5 + Math.random() * 2.2
    });
  }

  // ===================== 工具 =====================
  const rand = (a, b) => a + Math.random() * (b - a);

  function wrap(obj, margin) {
    if (obj.x < -margin) obj.x = W + margin;
    else if (obj.x > W + margin) obj.x = -margin;
    if (obj.y < -margin) obj.y = H + margin;
    else if (obj.y > H + margin) obj.y = -margin;
  }

  function popEl(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  function updateHUD() {
    scoreEl.textContent = score;
    bestEl.textContent = best;
    livesEl.textContent = lives;
    waveEl.textContent = wave;
    livesEl.classList.toggle('low', lives <= 1);
  }

  function flashMsg(text, dur) {
    clearTimeout(msgTimeout);
    msgEl.textContent = text;
    msgEl.classList.add('show');
    msgTimeout = setTimeout(() => msgEl.classList.remove('show'), dur);
  }

  function hideMsg() {
    clearTimeout(msgTimeout);
    msgEl.classList.remove('show');
  }

  function saveBest() {
    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch (e) {
      /* 存储不可用时静默忽略 */
    }
  }

  // ===================== 实体 =====================
  function makeShip() {
    return {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      a: -Math.PI / 2,
      inv: INV_TIME,
      fireCd: 0,
      thrusting: false
    };
  }

  function makeAsteroid(x, y, size) {
    const base = BASE_SPEED + (wave - 1) * SPEED_PER_WAVE;
    const r = SIZE_INFO[size].r * rand(0.85, 1.15);
    const ang = rand(0, Math.PI * 2);
    const spd = base * SIZE_SPD[size] * rand(0.8, 1.2);
    const n = 8 + Math.floor(Math.random() * 4);
    const verts = [];
    for (let i = 0; i < n; i++) verts.push(r * rand(0.7, 1.12));
    return {
      x,
      y,
      size,
      r,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      rot: rand(0, Math.PI * 2),
      spin: rand(-1.6, 1.6),
      verts
    };
  }

  function beginWave() {
    const count = BASE_COUNT + (wave - 1);
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let tries = 0;
      do {
        x = rand(0, W);
        y = rand(0, H);
        tries++;
      } while (ship && Math.hypot(x - ship.x, y - ship.y) < 180 && tries < 60);
      asteroids.push(makeAsteroid(x, y, 3));
    }
    updateHUD();
    if (wave > 1) flashMsg('第 ' + wave + ' 波', 1000);
  }

  function safeToRespawn() {
    for (const a of asteroids) {
      if (Math.hypot(a.x - W / 2, a.y - H / 2) < a.r + 120) return false;
    }
    return true;
  }

  // ===================== 粒子 =====================
  function explode(x, y, n, isShip) {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const spd = rand(40, 260);
      const lf = rand(0.4, 1.0);
      particles.push({
        type: Math.random() < 0.5 ? 'line' : 'dot',
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: lf,
        maxLife: lf,
        size: rand(1.5, 3.5),
        angle: rand(0, Math.PI * 2),
        spin: rand(-10, 10),
        color: isShip
          ? (Math.random() < 0.5 ? '#ff5d6c' : '#e8eef7')
          : EXPLODE_COLORS[Math.floor(Math.random() * EXPLODE_COLORS.length)]
      });
    }
  }

  function spawnThrust(dt) {
    if (!ship) return;
    thrustAcc += dt * 80;
    while (thrustAcc >= 1) {
      thrustAcc -= 1;
      const back = ship.a + Math.PI;
      const spread = rand(-0.35, 0.35);
      const spd = rand(90, 170);
      const lf = rand(0.15, 0.35);
      particles.push({
        type: 'dot',
        x: ship.x + Math.cos(back) * (SHIP_R - 2),
        y: ship.y + Math.sin(back) * (SHIP_R - 2),
        vx: ship.vx * 0.4 + Math.cos(back + spread) * spd,
        vy: ship.vy * 0.4 + Math.sin(back + spread) * spd,
        life: lf,
        maxLife: lf,
        size: rand(1.2, 2.4),
        angle: 0,
        spin: 0,
        color: THRUST_COLORS[Math.floor(Math.random() * THRUST_COLORS.length)]
      });
    }
  }

  // ===================== 战斗逻辑 =====================
  function fireBullet() {
    const nx = Math.cos(ship.a);
    const ny = Math.sin(ship.a);
    bullets.push({
      x: ship.x + nx * (SHIP_R + 5),
      y: ship.y + ny * (SHIP_R + 5),
      vx: ship.vx * 0.5 + nx * BULLET_SPEED,
      vy: ship.vy * 0.5 + ny * BULLET_SPEED,
      life: BULLET_LIFE
    });
    // 枪口闪光
    for (let i = 0; i < 3; i++) {
      const ang = ship.a + rand(-0.4, 0.4);
      particles.push({
        type: 'dot',
        x: ship.x + nx * SHIP_R,
        y: ship.y + ny * SHIP_R,
        vx: Math.cos(ang) * rand(30, 90),
        vy: Math.sin(ang) * rand(30, 90),
        life: 0.12,
        maxLife: 0.12,
        size: 1.6,
        angle: 0,
        spin: 0,
        color: '#eaf6ff'
      });
    }
  }

  function addScore(n) {
    score += n;
    scoreEl.textContent = score;
    popEl(scoreEl);
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      popEl(bestEl);
      saveBest();
    }
  }

  function destroyAsteroid(idx) {
    const a = asteroids[idx];
    addScore(SIZE_INFO[a.size].score);
    explode(a.x, a.y, 8 + a.size * 5, false);
    shake = Math.min(shake + 3 + a.size * 3.5, 24);
    asteroids.splice(idx, 1);
    if (a.size > 1) {
      for (let k = 0; k < 2; k++) {
        const ox = rand(-8, 8);
        const oy = rand(-8, 8);
        asteroids.push(makeAsteroid(a.x + ox, a.y + oy, a.size - 1));
      }
    }
  }

  function shipHit() {
    explode(ship.x, ship.y, 30, true);
    shake = Math.min(shake + 20, 30);
    ship = null;
    lives--;
    updateHUD();
    if (lives <= 0) {
      gameOver();
    } else {
      respawnTimer = RESPAWN_DELAY;
    }
  }

  function gameOver() {
    phase = 'over';
    saveBest();
    const isRecord = score > startBest && score > 0;
    modalTitleEl.textContent = '💀 游戏结束';
    modalSubEl.textContent =
      '最终得分 ' + score + ' · 抵达第 ' + wave + ' 波 · 最高分 ' + best +
      (isRecord ? ' · 🎉 新纪录！' : '');
    modalEl.classList.add('show');
  }

  function startGame() {
    phase = 'ready';
    score = 0;
    lives = 3;
    wave = 1;
    startBest = best;
    ship = makeShip();
    ship.inv = 1.2;
    asteroids = [];
    bullets = [];
    particles = [];
    shake = 0;
    waveGapActive = false;
    respawnTimer = 0;
    thrustAcc = 0;
    readyTimer = 1.6;
    modalEl.classList.remove('show');
    flashMsg('准备…', 1500);
    updateHUD();
  }

  // ===================== 更新 =====================
  function updateShip(dt) {
    if (!ship) return;
    if (keys.left) ship.a -= ROT_SPEED * dt;
    if (keys.right) ship.a += ROT_SPEED * dt;

    ship.thrusting = keys.thrust;
    if (keys.thrust) {
      ship.vx += Math.cos(ship.a) * THRUST * dt;
      ship.vy += Math.sin(ship.a) * THRUST * dt;
      spawnThrust(dt);
    }
    if (keys.brake) {
      const k = Math.exp(-BRAKE * dt);
      ship.vx *= k;
      ship.vy *= k;
    }

    // 微阻尼 + 限速
    const damp = Math.exp(-DRAG * dt);
    ship.vx *= damp;
    ship.vy *= damp;
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > MAX_SPEED) {
      ship.vx *= MAX_SPEED / sp;
      ship.vy *= MAX_SPEED / sp;
    }

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship, SHIP_R);

    if (ship.inv > 0) ship.inv -= dt;
    ship.fireCd -= dt;
    if (keys.fire && ship.fireCd <= 0) {
      fireBullet();
      ship.fireCd = FIRE_CD;
    }
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      wrap(b, 4);
      if (b.life <= 0) bullets.splice(i, 1);
    }
  }

  function updateAsteroids(dt) {
    for (const a of asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.spin * dt;
      wrap(a, a.r);
    }
  }

  function updateParticles(dt) {
    const damp = Math.exp(-0.6 * dt);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= damp;
      p.vy *= damp;
      p.angle += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function decayShake(dt) {
    shake *= Math.exp(-6 * dt);
    if (shake < 0.05) shake = 0;
  }

  function handleCollisions() {
    // 子弹 vs 行星
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (let j = asteroids.length - 1; j >= 0; j--) {
        const a = asteroids[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const rr = a.r * 0.88;
        if (dx * dx + dy * dy < rr * rr) {
          bullets.splice(i, 1);
          destroyAsteroid(j);
          break;
        }
      }
    }
    // 飞船 vs 行星
    if (ship && ship.inv <= 0) {
      for (let j = 0; j < asteroids.length; j++) {
        const a = asteroids[j];
        const dx = ship.x - a.x;
        const dy = ship.y - a.y;
        const rr = a.r * 0.82 + SHIP_R * 0.65;
        if (dx * dx + dy * dy < rr * rr) {
          shipHit();
          break;
        }
      }
    }
  }

  function update(dt) {
    decayShake(dt);
    updateParticles(dt);

    if (phase === 'ready') {
      readyTimer -= dt;
      if (readyTimer <= 0) {
        phase = 'play';
        hideMsg();
        beginWave();
      }
      return;
    }

    if (phase === 'play') {
      updateShip(dt);
      updateBullets(dt);
      updateAsteroids(dt);
      handleCollisions();

      if (phase === 'play' && !ship) {
        respawnTimer -= dt;
        if (respawnTimer <= 0 && safeToRespawn()) {
          ship = makeShip();
        }
      }

      if (phase === 'play' && asteroids.length === 0) {
        if (!waveGapActive) {
          waveGapActive = true;
          waveGapTimer = 1.5;
          flashMsg('✨ 第 ' + wave + ' 波清空', 1100);
        } else {
          waveGapTimer -= dt;
          if (waveGapTimer <= 0) {
            waveGapActive = false;
            wave++;
            beginWave();
          }
        }
      }
      return;
    }

    // over：背景继续漂移
    updateBullets(dt);
    updateAsteroids(dt);
  }

  // ===================== 绘制 =====================
  function drawStars(t) {
    ctx.fillStyle = '#cfe0ff';
    for (const s of stars) {
      ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawAsteroids() {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#93a2ba';
    ctx.fillStyle = 'rgba(147, 162, 186, 0.05)';
    for (const a of asteroids) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);
      ctx.beginPath();
      const n = a.verts.length;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const px = Math.cos(ang) * a.verts[i];
        const py = Math.sin(ang) * a.verts[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const b of bullets) {
      ctx.fillStyle = 'rgba(58, 160, 255, 0.28)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#eaf6ff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const k = Math.max(p.life / p.maxLife, 0);
      ctx.globalAlpha = k;
      if (p.type === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1.6;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        const L = p.size * 2.4;
        ctx.beginPath();
        ctx.moveTo(-L, 0);
        ctx.lineTo(L, 0);
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawShip(t) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.a);

    // 无敌闪烁
    if (ship.inv > 0) {
      ctx.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(t * 12));
      ctx.strokeStyle = '#3aa0ff';
    } else {
      ctx.strokeStyle = '#e8eef7';
    }

    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    // 复古矢量线条船体
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.stroke();

    // 推进尾焰（随机抖动）
    if (ship.thrusting) {
      const fl = rand(10, 20);
      ctx.strokeStyle = '#ffb23e';
      ctx.globalAlpha = 0.6 + 0.4 * Math.random();
      ctx.beginPath();
      ctx.moveTo(-9, 5);
      ctx.lineTo(-9 - fl, 0);
      ctx.lineTo(-9, -5);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw(t) {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (shake > 0.2) {
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
    }

    drawStars(t);
    drawAsteroids();
    drawBullets();
    drawParticles();
    if (ship) drawShip(t);

    ctx.restore();
  }

  // ===================== 输入 =====================
  const keys = { left: false, right: false, thrust: false, fire: false, brake: false };

  const KEYMAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'thrust',
    KeyW: 'thrust',
    Space: 'fire',
    ArrowDown: 'brake',
    KeyS: 'brake'
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') {
      if (!e.repeat) startGame();
      e.preventDefault();
      return;
    }
    const k = KEYMAP[e.code];
    if (k) {
      keys[k] = true;
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) {
      keys[k] = false;
      e.preventDefault();
    }
  });

  // 窗口失焦时松开所有按键，防止卡键
  window.addEventListener('blur', () => {
    keys.left = keys.right = keys.thrust = keys.fire = keys.brake = false;
    document.querySelectorAll('.tbtn.active').forEach((b) => b.classList.remove('active'));
  });

  // 触屏 / 屏上按钮（pointer 事件同时覆盖触摸与鼠标）
  function bindHold(id, key) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = (e) => {
      e.preventDefault();
      keys[key] = true;
      btn.classList.add('active');
    };
    const off = (e) => {
      e.preventDefault();
      keys[key] = false;
      btn.classList.remove('active');
    };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  bindHold('btn-left', 'left');
  bindHold('btn-right', 'right');
  bindHold('btn-thrust', 'thrust');
  bindHold('btn-fire', 'fire');
  bindHold('btn-brake', 'brake');

  btnAgain.addEventListener('click', () => {
    btnAgain.blur();
    startGame();
  });

  btnRestart.addEventListener('click', () => {
    btnRestart.blur();
    startGame();
  });

  // ===================== 主循环 =====================
  startGame();

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;  // 帧时间差驱动 + 跳帧保护
    if (dt < 0) dt = 0;
    update(dt);
    draw(now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
