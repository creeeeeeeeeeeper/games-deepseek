(() => {
  'use strict';

  /* ================= DOM 引用 ================= */
  const W = 400; // 画布逻辑宽
  const H = 700; // 画布逻辑高
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlayEl = document.getElementById('overlay');
  const modalEl = document.getElementById('modal');
  const modalTitleEl = document.getElementById('modalTitle');
  const modalSubEl = document.getElementById('modalSub');
  const againBtn = document.getElementById('againBtn');
  const restartBtn = document.getElementById('restartBtn');
  const msgEl = document.getElementById('msg');
  const BEST_KEY = 'doodle-best';

  /* ================= 物理常量 ================= */
  const GRAVITY = 2400;   // 重力加速度 px/s^2
  const JUMP_V = 980;     // 普通弹跳速度（跳高约 200px）
  const SPRING_V = 1560;  // 弹簧弹射速度
  const MOVE_ACC = 3000;  // 水平加速度
  const MOVE_MAX = 380;   // 水平最大速度
  const AIR_DRAG = 2600;  // 无输入时的水平阻尼
  const PLAYER_W = 42;
  const PLAYER_H = 42;
  const PLAT_W = 72;
  const PLAT_H = 14;

  /* ================= 可变状态 ================= */
  let state = 'ready'; // ready | playing | dying | over
  let cameraY = 0;     // 屏幕顶部对应的世界纵坐标
  let climb = 0;       // 已上升的像素数
  let score = 0;
  let best = 0;
  let newBest = false;
  let deathTimer = 0;
  let shakeT = 0;
  let time = 0;
  let countdownToken = 0;
  let lastBumpAt = 0;
  let startY = 0;
  let lastPlatY = 0;
  let breakStreak = 0;
  let blinkTimer = 3;

  let platforms = [];
  let particles = [];
  let pieces = [];

  const player = {
    x: W / 2, y: 0, vx: 0, vy: 0,
    sx: 1, sy: 1, face: 1, rot: 0, blink: 0,
  };

  const keys = { left: false, right: false };
  const pointers = new Map();

  /* ================= 工具函数 ================= */
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mod = (n, m) => ((n % m) + m) % m;
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpC = (a, b, t) => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ];
  const css = (c) => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ================= 平台生成 ================= */
  function makePlatform(y, hAbove) {
    let type = 'normal';
    if (hAbove > 350) {
      const pBreak = Math.min(0.22, 0.04 + hAbove / 14000);
      const pMove = Math.min(0.34, 0.06 + hAbove / 9000);
      const r = Math.random();
      if (breakStreak >= 2) {
        type = 'normal'; // 连续两个易碎后强制给一个稳固平台
      } else if (r < pBreak) {
        type = 'break';
      } else if (r < pBreak + pMove) {
        type = 'move';
      }
    }
    breakStreak = type === 'break' ? breakStreak + 1 : 0;

    const p = {
      x: rand(8, W - PLAT_W - 8),
      y: y,
      w: PLAT_W,
      h: PLAT_H,
      type: type,
      vx: 0,
      spring: null,
      broken: false,
    };
    if (type === 'move') {
      p.vx = (Math.random() < 0.5 ? -1 : 1) * rand(40, 110);
    }
    if (type !== 'break' && Math.random() < 0.09) {
      p.spring = { t: 0, w: 22, h: 18, cx: p.w / 2 };
    }
    return p;
  }

  function generateUpTo(topY) {
    while (lastPlatY > topY) {
      const hAbove = Math.max(0, startY - lastPlatY);
      const gap = 56 + Math.min(50, hAbove / 60); // 越高越稀疏
      lastPlatY -= gap;
      platforms.push(makePlatform(lastPlatY, hAbove));
    }
  }

  /* ================= 特效 ================= */
  function spawnBurst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI, 0);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(a) * rand(speed * 0.3, speed),
        vy: Math.sin(a) * rand(speed * 0.3, speed),
        life: rand(0.25, 0.55),
        maxLife: 0.55,
        r: rand(2, 4.5),
        grav: 700,
        color: color,
      });
    }
  }

  function breakPlat(p) {
    p.broken = true;
    for (let i = 0; i < 5; i++) {
      pieces.push({
        x: p.x + ((i + 0.5) * p.w) / 5 - 6,
        y: p.y,
        w: p.w / 5 - 4,
        h: p.h,
        vx: rand(-70, 70),
        vy: rand(-60, 140),
        rot: 0,
        vr: rand(-7, 7),
        life: 0.7,
      });
    }
    spawnBurst(p.x + p.w / 2, p.y, 8, '#c98d5f', 180);
  }

  /* ================= 核心逻辑 ================= */
  function inputDirs() {
    let l = keys.left;
    let r = keys.right;
    for (const s of pointers.values()) {
      if (s === 'left') l = true;
      else r = true;
    }
    return { l: l, r: r };
  }

  function land(p, viaSpring) {
    if (viaSpring) {
      player.vy = -SPRING_V;
      p.spring.t = 0.3;
      player.sy = 1.5;
      player.sx = 0.6;
      spawnBurst(player.x, p.y - 10, 12, '#ffb23e', 260);
    } else {
      player.vy = -JUMP_V;
      player.sy = 0.62;
      player.sx = 1.35;
      spawnBurst(player.x, p.y, 6, 'rgba(255,255,255,0.85)', 120);
      if (p.type === 'break') breakPlat(p);
    }
  }

  function stepPlayer(dt, canCollide) {
    // —— 水平 ——
    const dirs = inputDirs();
    if (dirs.l && !dirs.r) {
      player.vx -= MOVE_ACC * dt;
      player.face = -1;
    } else if (dirs.r && !dirs.l) {
      player.vx += MOVE_ACC * dt;
      player.face = 1;
    } else {
      const d = AIR_DRAG * dt;
      if (Math.abs(player.vx) <= d) player.vx = 0;
      else player.vx -= Math.sign(player.vx) * d;
    }
    player.vx = clamp(player.vx, -MOVE_MAX, MOVE_MAX);
    player.x += player.vx * dt;

    // —— 垂直 ——
    const prevFeet = player.y + PLAYER_H / 2;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    const feet = player.y + PLAYER_H / 2;

    // —— 落台判定（仅下落时） ——
    if (canCollide && player.vy > 0) {
      for (const p of platforms) {
        if (p.broken) continue;
        const scx = p.spring ? p.x + p.spring.cx : 0;
        const onSpringX = !!p.spring &&
          player.x + PLAYER_W * 0.3 > scx - p.spring.w / 2 &&
          player.x - PLAYER_W * 0.3 < scx + p.spring.w / 2;
        const topY = onSpringX ? p.y - p.spring.h * 0.8 : p.y;
        if (prevFeet <= topY + 4 && feet >= topY &&
            player.x + PLAYER_W * 0.36 > p.x &&
            player.x - PLAYER_W * 0.36 < p.x + p.w) {
          land(p, onSpringX);
          break;
        }
      }
    }

    // —— 左右绕行（经典设定） ——
    const half = PLAYER_W / 2;
    if (player.x > W + half) player.x = -half;
    else if (player.x < -half) player.x = W + half;
  }

  function setScore(v) {
    if (v === score) return;
    score = v;
    scoreEl.textContent = v;
    const now = performance.now();
    if (now - lastBumpAt > 130) {
      lastBumpAt = now;
      scoreEl.classList.remove('bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('bump');
    }
  }

  function die() {
    if (state !== 'playing') return;
    state = 'dying';
    deathTimer = 0;
    shakeT = 0.55;
    spawnBurst(player.x, cameraY + H - 10, 10, 'rgba(255,93,108,0.9)', 220);
  }

  function gameOver() {
    state = 'over';
    newBest = score > best && score > 0;
    if (newBest) {
      best = score;
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch (e) {
        /* 存储不可用时静默忽略 */
      }
      bestEl.textContent = best;
      msgEl.textContent = '🏆 打破纪录！';
      msgEl.hidden = false;
    }
    modalTitleEl.textContent = '💀 掉下去啦！';
    modalSubEl.innerHTML =
      '本局高度 <b>' + score + '</b> 分 · 最高纪录 <b>' + best + '</b>' +
      (newBest ? ' <span class="new-best">🏆 新纪录！</span>' : '');
    modalEl.classList.add('show');
  }

  function showOverlay(text) {
    overlayEl.textContent = text;
    overlayEl.classList.add('show');
    overlayEl.classList.remove('count');
    void overlayEl.offsetWidth;
    overlayEl.classList.add('count');
  }

  function resetGame() {
    countdownToken++;
    const token = countdownToken;
    modalEl.classList.remove('show');
    msgEl.hidden = true;

    platforms = [];
    particles = [];
    pieces = [];
    breakStreak = 0;

    player.x = W / 2;
    player.y = 620 - PLAYER_H / 2;
    player.vx = 0;
    player.vy = 0;
    player.sx = 1;
    player.sy = 1;
    player.rot = 0;

    startY = player.y;
    climb = 0;
    score = 0;
    scoreEl.textContent = '0';
    cameraY = 0;
    deathTimer = 0;

    platforms.push({
      x: 24, y: 620, w: W - 48, h: 18,
      type: 'ground', vx: 0, spring: null, broken: false,
    });
    lastPlatY = 620;
    generateUpTo(-120);

    state = 'ready';
    showOverlay('准备…');
    setTimeout(() => {
      if (token !== countdownToken) return;
      showOverlay('跳！');
    }, 850);
    setTimeout(() => {
      if (token !== countdownToken) return;
      overlayEl.classList.remove('show');
      state = 'playing';
      player.vy = -JUMP_V;
      player.sy = 1.35;
      player.sx = 0.72;
      spawnBurst(player.x, player.y + PLAYER_H / 2, 8, 'rgba(255,255,255,0.85)', 140);
    }, 1300);
  }

  /* ================= 更新 ================= */
  function update(dt) {
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);

    // 平台移动 & 弹簧计时
    if (state === 'playing' || state === 'dying') {
      for (const p of platforms) {
        if (p.type === 'move' && !p.broken) {
          p.x += p.vx * dt;
          if (p.x < 4) {
            p.x = 4;
            p.vx = Math.abs(p.vx);
          } else if (p.x + p.w > W - 4) {
            p.x = W - 4 - p.w;
            p.vx = -Math.abs(p.vx);
          }
        }
        if (p.spring && p.spring.t > 0) {
          p.spring.t = Math.max(0, p.spring.t - dt);
        }
      }
    }

    if (state === 'playing') {
      stepPlayer(dt, true);

      // 相机只向上跟随
      const target = player.y - H * 0.42;
      if (target < cameraY) cameraY += (target - cameraY) * Math.min(1, dt * 8);

      // 高度即分数
      if (startY - player.y > climb) {
        climb = startY - player.y;
        setScore(Math.max(0, Math.floor(climb / 10)));
      }

      // 生成新平台 & 清理旧平台
      generateUpTo(Math.min(cameraY - 120, player.y - 450));
      platforms = platforms.filter((p) => p.y < cameraY + H + 80);

      // 掉出屏幕底部即失败
      if (player.y - cameraY > H + 50) die();
    } else if (state === 'dying') {
      stepPlayer(dt, false);
      player.rot += 7 * dt;
      // 相机跟下，展示下坠动画
      cameraY += (player.y - H * 0.62 - cameraY) * Math.min(1, dt * 5);
      deathTimer += dt;
      if (deathTimer > 1.15) gameOver();
    }

    // 压扁 / 拉伸恢复（体积近似守恒）
    const tSy = player.vy < 0
      ? 1 + Math.min(0.22, -player.vy / 5000)
      : 1 - Math.min(0.12, player.vy / 8000);
    player.sy += (tSy - player.sy) * Math.min(1, dt * 10);
    player.sx += (1 / tSy - player.sx) * Math.min(1, dt * 10);

    // 眨眼
    blinkTimer -= dt;
    if (blinkTimer < -0.13) blinkTimer = rand(2.2, 4.5);
    player.blink = blinkTimer < 0 ? 1 : 0;

    // 粒子
    for (const q of particles) {
      q.life -= dt;
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    particles = particles.filter((q) => q.life > 0);

    // 平台碎片
    for (const f of pieces) {
      f.life -= dt;
      f.vy += 1800 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
    }
    pieces = pieces.filter((f) => f.life > 0);
  }

  /* ================= 绘制 ================= */
  function drawBackground() {
    const t1 = clamp(climb / 5000, 0, 1);
    const t2 = clamp((climb - 5000) / 7000, 0, 1);
    const top = lerpC(lerpC([35, 42, 69], [24, 59, 74], t1), [59, 29, 74], t2);
    const bot = lerpC(lerpC([20, 24, 39], [15, 32, 39], t1), [26, 15, 39], t2);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(top));
    g.addColorStop(1, css(bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 视差星星
    ctx.save();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 36; i++) {
      const sx = (i * 127.31 + 17) % W;
      const sy = mod(i * 191.73 - cameraY * 0.45, H + 60) - 30;
      ctx.globalAlpha = 0.2 + 0.25 * Math.abs(Math.sin(time * 1.4 + i * 2.13));
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function springHF(s) {
    if (s.t <= 0) return 1;
    const ph = 1 - s.t / 0.3; // 0 → 1 压缩恢复进度
    if (ph < 0.3) return 0.35;
    return 1 + 0.35 * Math.sin(((ph - 0.3) / 0.7) * Math.PI);
  }

  function drawSpring(p, sy) {
    const s = p.spring;
    const cx = p.x + s.cx;
    const hf = springHF(s);
    const sh = s.h * hf;
    const topY = sy - sh;
    const coilTop = Math.min(topY + 5, sy - 4);

    // 底座
    ctx.fillStyle = '#8a5a3a';
    rr(cx - s.w / 2, sy - 3, s.w, 4, 2);
    ctx.fill();

    // 弹簧线圈（锯齿）
    ctx.strokeStyle = '#ffb23e';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const coils = 3;
    for (let i = 0; i <= coils * 2; i++) {
      const yy = lerp(sy - 2, coilTop, i / (coils * 2));
      const xx = cx + (i % 2 === 0 ? -s.w * 0.28 : s.w * 0.28);
      if (i === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();

    // 顶板
    ctx.fillStyle = '#ffb23e';
    rr(cx - s.w / 2, topY, s.w, 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    rr(cx - s.w / 2 + 2, topY + 1, s.w - 4, 2, 1);
    ctx.fill();
  }

  function drawPlatform(p) {
    const sy = p.y - cameraY;
    if (sy < -40 || sy > H + 40) return;
    if (p.broken) return;

    if (p.type === 'ground') {
      ctx.fillStyle = '#3a4258';
      rr(p.x, sy, p.w, p.h, 6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      rr(p.x, sy, p.w, 4, 2);
      ctx.fill();
      return;
    }

    let c1;
    let c2;
    if (p.type === 'move') {
      c1 = '#5cb3ff';
      c2 = '#2467b8';
    } else if (p.type === 'break') {
      c1 = '#c98d5f';
      c2 = '#8a5a3a';
    } else {
      c1 = '#4be0a0';
      c2 = '#1f9d6b';
    }
    const g = ctx.createLinearGradient(0, sy, 0, sy + p.h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    rr(p.x, sy, p.w, p.h, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 顶部高光
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    rr(p.x + 5, sy + 2.5, p.w - 10, 3, 1.5);
    ctx.fill();

    if (p.type === 'move') {
      // 双向箭头提示
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      const cy = sy + p.h / 2 + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x + 8, cy);
      ctx.lineTo(p.x + 14, cy - 4);
      ctx.lineTo(p.x + 14, cy + 4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x + p.w - 8, cy);
      ctx.lineTo(p.x + p.w - 14, cy - 4);
      ctx.lineTo(p.x + p.w - 14, cy + 4);
      ctx.closePath();
      ctx.fill();
    }

    if (p.type === 'break') {
      // 裂纹
      ctx.strokeStyle = 'rgba(60,30,15,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.32, sy + 2);
      ctx.lineTo(p.x + p.w * 0.38, sy + p.h - 2);
      ctx.moveTo(p.x + p.w * 0.62, sy + 2);
      ctx.lineTo(p.x + p.w * 0.56, sy + p.h - 2);
      ctx.stroke();
    }

    if (p.spring) drawSpring(p, sy);
  }

  function drawPlayer() {
    const bob = state === 'ready' ? Math.sin(time * 3) * 3 : 0;
    const px = player.x;
    const py = player.y - cameraY + bob;
    if (py > H + 120 || py < -120) return;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.rot);
    ctx.scale(player.sx, player.sy);

    // 天线
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.quadraticCurveTo(4, -30, 8, -32);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(9, -33, 4, 0, Math.PI * 2);
    ctx.fill();

    // 身体
    const g = ctx.createLinearGradient(0, -24, 0, 24);
    g.addColorStop(0, '#5db4ff');
    g.addColorStop(1, '#7c6bff');
    ctx.fillStyle = g;
    rr(-21, -21, 42, 42, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 肚皮
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    const dead = state === 'dying' || state === 'over';
    if (dead) {
      // X 眼 + 惊叹嘴
      ctx.strokeStyle = '#10203a';
      ctx.lineWidth = 2.5;
      for (const ex of [-8, 8]) {
        ctx.beginPath();
        ctx.moveTo(ex - 4, -10);
        ctx.lineTo(ex + 4, -2);
        ctx.moveTo(ex + 4, -10);
        ctx.lineTo(ex - 4, -2);
        ctx.stroke();
      }
      ctx.fillStyle = '#10203a';
      ctx.beginPath();
      ctx.ellipse(0, 6, 4, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (player.blink) {
      ctx.strokeStyle = '#10203a';
      ctx.lineWidth = 2.5;
      for (const ex of [-8, 8]) {
        ctx.beginPath();
        ctx.moveTo(ex - 4, -6);
        ctx.lineTo(ex + 4, -6);
        ctx.stroke();
      }
    } else {
      const look = clamp(player.vx / 140, -2.5, 2.5);
      const lookY = clamp(player.vy / 500, -2, 2);
      for (const ex of [-8, 8]) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, -6, 5.5, 6.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10203a';
        ctx.beginPath();
        ctx.arc(ex + look, -5 + lookY, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#10203a';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 4, 6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();

    ctx.save();
    if (shakeT > 0) {
      const m = shakeT * 16;
      ctx.translate(rand(-m, m), rand(-m, m));
    }

    for (const p of platforms) drawPlatform(p);

    // 碎裂碎片
    for (const f of pieces) {
      const sy = f.y - cameraY;
      ctx.save();
      ctx.globalAlpha = clamp(f.life / 0.7, 0, 1);
      ctx.translate(f.x, sy);
      ctx.rotate(f.rot);
      ctx.fillStyle = '#a06a44';
      rr(-f.w / 2, -f.h / 2, f.w, f.h, 3);
      ctx.fill();
      ctx.restore();
    }

    // 粒子
    for (const q of particles) {
      ctx.save();
      ctx.globalAlpha = clamp(q.life / q.maxLife, 0, 1);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y - cameraY, q.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    drawPlayer();
    ctx.restore();
  }

  /* ================= 输入 ================= */
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      keys.left = true;
      if (e.code === 'ArrowLeft') e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      keys.right = true;
      if (e.code === 'ArrowRight') e.preventDefault();
    } else if (e.code === 'KeyR') {
      resetGame();
    } else if (e.code === 'Enter' && state === 'over') {
      resetGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  });

  function sideOf(e) {
    const r = canvas.getBoundingClientRect();
    return (e.clientX - r.left) < r.width / 2 ? 'left' : 'right';
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 捕获失败不影响方向判定 */
      }
    }
    pointers.set(e.pointerId, sideOf(e));
  });

  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, sideOf(e));
  });

  function releasePointer(e) {
    pointers.delete(e.pointerId);
  }

  window.addEventListener('pointerup', releasePointer);
  window.addEventListener('pointercancel', releasePointer);

  againBtn.addEventListener('click', () => {
    againBtn.blur();
    resetGame();
  });

  restartBtn.addEventListener('click', () => {
    restartBtn.blur();
    resetGame();
  });

  /* ================= 主循环 ================= */
  let lastT = performance.now();

  function frame(now) {
    const dt = Math.min((now - lastT) / 1000, 0.033);
    lastT = now;
    time += dt;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  /* ================= 启动 ================= */
  try {
    best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0;
  } catch (e) {
    best = 0;
  }
  bestEl.textContent = best;

  resetGame();
  requestAnimationFrame(frame);
})();
