/* ============================================================
   太空射击 · 纵向卷轴射击（canvas）
   配套 games/space-shooter/index.html 与 style.css
   8 波敌机、连击加成、强化道具（双发 / 护盾）、护盾体系
   ============================================================ */
(function () {
  "use strict";

  const W = 420, H = 700;
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");

  const hudScore = document.getElementById("hud-score");
  const hudShield = document.getElementById("hud-shield");
  const hudWave = document.getElementById("hud-wave");
  const hudBest = document.getElementById("hud-best");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalMsg = document.getElementById("modal-msg");
  const modalSub = document.getElementById("modal-sub");
  const btnRestart = document.getElementById("btn-restart");

  let best = 0;
  try { best = parseInt(localStorage.getItem("shooter-best") || "0", 10) || 0; } catch (_) {}
  hudBest.textContent = best;

  // ---------- 状态 ----------
  const S = {
    state: "count",      // count | banner | play | over | win
    score: 0,
    combo: 0,
    comboAt: 0,
    wave: 1,
    shield: 3,
    player: { x: W / 2, y: H - 80, r: 14, iT: 0, fireCd: 0, powerT: 0 },
    bullets: [],
    ebullets: [],
    enemies: [],
    powerups: [],
    parts: [],
    floats: [],
    stars: [],
    keys: {},
    firing: false,
    spawnT: 0,
    alive: 0,
    bannerT: 0,
    bannerText: "",
    shake: 0,
    overT: 0,
    now: 0,
    raf: 0,
    cdStart: 0,
  };

  // 星空
  for (let i = 0; i < 90; i++) {
    S.stars.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.8 + 0.4, v: 40 + Math.random() * 120, tw: Math.random() * 6.28 });
  }

  // ---------- HUD ----------
  function updateHud() {
    hudScore.textContent = S.score;
    hudShield.textContent = "❤".repeat(Math.max(0, S.shield)) + "🖤".repeat(Math.max(0, 3 - S.shield));
    hudWave.textContent = Math.min(S.wave, 8) + "/8";
  }

  // ---------- 输入 ----------
  function key(name, down) { S.keys[name] = down; }

  function resetGame() {
    S.score = 0; S.wave = 1; S.shield = 3; S.combo = 0;
    S.player.x = W / 2; S.player.y = H - 80; S.player.iT = 0; S.player.fireCd = 0; S.player.powerT = 0;
    S.bullets.length = 0; S.ebullets.length = 0; S.enemies.length = 0;
    S.powerups.length = 0; S.parts.length = 0; S.floats.length = 0;
    S.alive = 0; S.spawnT = 0; S.shake = 0;
    modal.classList.remove("show");
    updateHud();
  }

  function spawnWave(n) {
    const count = Math.min(14, 4 + n);
    S.alive = count;
    S.spawnT = 0;
    // 预生成敌机描述
    const list = [];
    for (let i = 0; i < count; i++) {
      const type = (n >= 2 && Math.random() < 0.35) ? "sine" : "drone";
      list.push({ type, delay: 0.25 + i * (1.05 - n * 0.06), x: 0, y: 0, hp: type === "sine" ? 2 : 1, fired: 0 });
    }
    S.enemies = list;
    S.spawnDelay = Math.max(0.3, 1.0 - n * 0.08);
    S.waveTimer = 0;
    S.queued = list;
    S.spawned = 0;
  }

  // ---------- 实体 ----------
  function firePlayer() {
    const cd = S.player.powerT > 0 ? 0.11 : 0.22;
    if (S.player.fireCd > 0) return;
    S.player.fireCd = cd;
    const y = S.player.y - 18;
    if (S.player.powerT > 0) {
      S.bullets.push({ x: S.player.x - 8, y, v: -640, dmg: 1 }, { x: S.player.x + 8, y, v: -640, dmg: 1 });
    } else {
      S.bullets.push({ x: S.player.x, y, v: -640, dmg: 1 });
    }
  }

  function killEnemy(e, idx) {
    // 连击判定
    const now = performance.now() / 1000;
    if (now - S.comboAt < 1.6) S.combo += 1; else S.combo = 1;
    S.comboAt = now;
    const mult = Math.min(5, S.combo);
    const pts = (e.type === "sine" ? 25 : 10) * mult;
    S.score += pts;
    addFloat(e.x, e.y, "+" + pts);
    if (mult >= 2) addFloat(e.x, e.y - 22, "×" + mult + " 连击");
    explosion(e.x, e.y, e.type === "sine" ? "#ff9f43" : "#3aa0ff", 16);
    S.alive -= 1;
    S.enemies[idx] = null;   // 所有被击毁的敌机都移除
    // 掉落
    if (Math.random() < 0.09) {
      S.powerups.push({ x: e.x, y: e.y, v: 120, kind: Math.random() < 0.55 ? "D" : "H", t: 0 });
    }
  }

  function hitPlayer() {
    if (S.player.iT > 0) return;
    S.shield -= 1;
    S.player.iT = 1.6;
    S.shake = 0.9;
    explosion(S.player.x, S.player.y, "#ff5d6c", 22);
    updateHud();
    if (S.shield <= 0) {
      S.state = "over";
      S.overT = 0;
      explosion(S.player.x, S.player.y, "#fff", 34);
    }
  }

  function explosion(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, sp = 60 + Math.random() * 190;
      S.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4, t: 0, color,
      });
    }
  }
  function addFloat(x, y, text) {
    S.floats.push({ x, y, text, t: 0, life: 0.9, color: "#ffd166" });
  }

  // ---------- 更新 ----------
  function update(dt) {
    const now = performance.now() / 1000;
    S.player.fireCd = Math.max(0, S.player.fireCd - dt);
    S.player.iT = Math.max(0, S.player.iT - dt);
    S.player.powerT = Math.max(0, S.player.powerT - dt);
    S.shake = Math.max(0, S.shake - dt * 1.6);

    // 星星
    S.stars.forEach((st) => {
      st.y += st.v * dt;
      if (st.y > H) { st.y = -4; st.x = Math.random() * W; }
    });

    // 玩家移动
    const k = S.keys;
    const spd = 360 * dt;
    if (k.left || k.a) S.player.x -= spd;
    if (k.right || k.d) S.player.x += spd;
    S.player.x = Math.max(22, Math.min(W - 22, S.player.x));
    if (S.firing) firePlayer();

    // 玩家子弹
    S.bullets.forEach((b) => (b.y += b.v * dt));
    S.bullets = S.bullets.filter((b) => b.y > -20);

    // 敌弹
    S.ebullets.forEach((b) => (b.y += b.v * dt));
    S.ebullets = S.ebullets.filter((b) => b.y < H + 20);

    // 敌机生成（按 queued 延迟出屏）
    if (S.queued && S.state === "play") {
      S.waveTimer += dt;
      const ready = S.queued.filter((e) => e.delay <= S.waveTimer && !e.spawned);
      ready.forEach((e) => {
        e.spawned = true;
        e.y = -30;
        e.x = 60 + Math.random() * (W - 120);
        if (e.type === "sine") e.baseX = e.x;
      });
    }

    // 敌机移动 & 射击
    const enSpeed = 95 + S.wave * 16;
    S.enemies.forEach((e, idx) => {
      if (!e) return;
      if (e.spawned) {
        e.y += enSpeed * dt;
        if (e.type === "sine") {
          e.t = (e.t || 0) + dt;
          e.x = e.baseX + Math.sin(e.t * 2.4) * 70;
        }
        // 射击
        if (S.wave >= 3) {
          e.fireT = (e.fireT || Math.random() * 1.5) - dt;
          if (e.fireT <= 0) {
            e.fireT = 1.4 + Math.random() * 1.2;
            S.ebullets.push({ x: e.x, y: e.y + 12, v: 170 + S.wave * 8 });
          }
        }
        // 撞击玩家
        if (dist(e.x, e.y, S.player.x, S.player.y) < 26 && S.player.iT <= 0) {
          killEnemy(e, idx);
          hitPlayer();
        }
        if (e.y > H + 40) { S.alive -= 1; S.enemies[idx] = null; }
      }
    });
    S.enemies = S.enemies.filter(Boolean);

    // 玩家子弹命中
    S.bullets.forEach((b, bi) => {
      S.enemies.forEach((e, ei) => {
        if (!e || !e.spawned) return;
        if (Math.abs(b.x - e.x) < 20 && Math.abs(b.y - e.y) < 22) {
          b.dead = true;
          e.hp -= b.dmg;
          if (e.hp <= 0) killEnemy(e, ei);
          else { explosion(b.x, b.y, "#9adcff", 5); }
        }
      });
    });
    S.bullets = S.bullets.filter((b) => !b.dead);

    // 敌弹命中玩家
    S.ebullets.forEach((b) => {
      if (Math.abs(b.x - S.player.x) < 16 && Math.abs(b.y - S.player.y) < 18) {
        b.dead = true;
        hitPlayer();
      }
    });
    S.ebullets = S.ebullets.filter((b) => !b.dead);

    // 道具
    S.powerups.forEach((p, i) => {
      p.y += p.v * dt;
      p.t += dt;
      if (dist(p.x, p.y, S.player.x, S.player.y) < 24) {
        S.powerups.splice(i, 1);
        if (p.kind === "D") { S.player.powerT = 8; addFloat(S.player.x, S.player.y - 30, "⚡ 双发！"); }
        else { S.shield = Math.min(3, S.shield + 1); addFloat(S.player.x, S.player.y - 30, "❤ +1 护盾"); updateHud(); }
        return;
      }
      if (p.y > H + 20) S.powerups.splice(i, 1);
    });

    // 粒子 / 飘字
    S.parts.forEach((p) => { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; });
    S.parts = S.parts.filter((p) => p.t < p.life);
    S.floats.forEach((f) => (f.t += dt));
    S.floats = S.floats.filter((f) => f.t < f.life);

    // 波次推进
    if (S.state === "play" && S.alive <= 0 && (!S.queued || S.queued.every((e) => e.spawned))) {
      if (S.wave >= 8) {
        S.state = "win";
        showEnd(true);
      } else {
        S.wave += 1;
        S.state = "banner";
        S.bannerText = "第 " + S.wave + " 波";
        S.bannerT = 1.4;
      }
    }
    if (S.state === "banner") {
      S.bannerT -= dt;
      if (S.bannerT <= 0) {
        S.state = "play";
        spawnWave(S.wave);
      }
    }
    if (S.state === "over") {
      S.overT += dt;
      if (S.overT > 0.9) showEnd(false);
    }
    updateHud();
  }

  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  // ---------- 绘制 ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (S.shake > 0) ctx.translate((Math.random() - 0.5) * S.shake * 10, (Math.random() - 0.5) * S.shake * 10);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#05070f");
    bg.addColorStop(1, "#101a33");
    ctx.fillStyle = bg;
    ctx.fillRect(-12, -12, W + 24, H + 24);

    // 星星
    S.stars.forEach((st) => {
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(st.tw + S.now));
      ctx.fillStyle = "#cfe6ff";
      ctx.fillRect(st.x, st.y, st.s, st.s);
    });
    ctx.globalAlpha = 1;

    // 道具
    S.powerups.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.t * 3);
      ctx.font = "22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(p.kind === "D" ? "⚡" : "✚", 0, 8);
      ctx.restore();
    });

    // 敌弹
    ctx.fillStyle = "#ff8c6b";
    S.ebullets.forEach((b) => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,140,107,0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 11, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#ff8c6b";
    });

    // 敌机
    S.enemies.forEach((e) => {
      if (!e || !e.spawned) return;
      if (e.type === "sine") {
        ctx.fillStyle = "#ff9f43";
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + 16);
        ctx.lineTo(e.x - 16, e.y - 8);
        ctx.lineTo(e.x - 6, e.y - 4);
        ctx.lineTo(e.x, e.y - 14);
        ctx.lineTo(e.x + 6, e.y - 4);
        ctx.lineTo(e.x + 16, e.y - 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#c96f1a";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = "#6f9dff";
        ctx.fillRect(e.x - 14, e.y - 10, 28, 20);
        ctx.fillStyle = "#3e6fd8";
        ctx.fillRect(e.x - 6, e.y - 4, 12, 8);
        ctx.fillStyle = "#ff5d6c";
        ctx.beginPath();
        ctx.arc(e.x - 6, e.y, 2.6, 0, 7);
        ctx.arc(e.x + 6, e.y, 2.6, 0, 7);
        ctx.fill();
      }
    });

    // 玩家子弹
    ctx.fillStyle = "#9adcff";
    S.bullets.forEach((b) => {
      ctx.fillRect(b.x - 2, b.y - 12, 4, 16);
      ctx.fillStyle = "#dff4ff";
      ctx.fillRect(b.x - 1, b.y - 14, 2, 20);
      ctx.fillStyle = "#9adcff";
    });

    // 玩家（无敌闪烁）
    if (S.state !== "over") {
      const blink = S.player.iT > 0 && Math.floor(S.now * 12) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(S.player.x, S.player.y);
        ctx.fillStyle = "#35d0ff";
        ctx.beginPath();
        ctx.moveTo(0, -24);
        ctx.lineTo(-20, 14);
        ctx.lineTo(-8, 8);
        ctx.lineTo(-3, 16);
        ctx.lineTo(0, 12);
        ctx.lineTo(3, 16);
        ctx.lineTo(8, 8);
        ctx.lineTo(20, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#9ae8ff";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // 尾焰
        const fl = 6 + Math.random() * 8;
        ctx.fillStyle = Math.random() < 0.5 ? "#ffb23e" : "#ff7a3d";
        ctx.beginPath();
        ctx.moveTo(-5, 16);
        ctx.lineTo(0, 16 + fl);
        ctx.lineTo(5, 16);
        ctx.closePath();
        ctx.fill();
        if (S.player.powerT > 0) {
          ctx.strokeStyle = "#ffd166";
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, 26, 0, 7);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }
    }

    // 粒子
    S.parts.forEach((p) => {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // 飘字
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    S.floats.forEach((f) => {
      ctx.globalAlpha = 1 - f.t / f.life;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - f.t * 40);
    });
    ctx.globalAlpha = 1;

    // 横幅 / 状态文字
    ctx.textAlign = "center";
    if (S.state === "count") {
      ctx.font = "bold 42px sans-serif";
      ctx.fillStyle = "#fff";
      const n = Math.max(0, Math.ceil(3 - (S.now - S.cdStart)));
      ctx.fillText(n > 0 ? n : "出发！", W / 2, H / 2 - 30);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#9adcff";
      ctx.fillText("← → / A D 移动 · 空格或按住射击", W / 2, H / 2 + 20);
    }
    if (S.state === "banner") {
      ctx.font = "bold 36px sans-serif";
      ctx.fillStyle = "#ffd166";
      ctx.fillText(S.bannerText, W / 2, H / 2 - 30);
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText("敌机来袭！", W / 2, H / 2 + 6);
    }
    ctx.restore();
  }

  // ---------- 结束 ----------
  function showEnd(win) {
    const isNew = S.score > best;
    if (isNew) {
      best = S.score;
      try { localStorage.setItem("shooter-best", String(best)); } catch (_) {}
      hudBest.textContent = best;
    }
    if (win) modalTitle.textContent = "🏆 通关成功！";
    else modalTitle.textContent = "💥 战机被击毁";
    modalMsg.innerHTML = "得分 <b>" + S.score + "</b> · 到达第 <b>" + S.wave + "</b> 波";
    modalSub.innerHTML = (isNew ? "🏆 新纪录！" : "最高分 " + best) + " · 清完 8 波即可通关";
    modal.classList.add("show");
  }

  // ---------- 主循环 ----------
  let lastMs = 0;
  function frame(ts) {
    const dt = lastMs ? Math.min((ts - lastMs) / 1000, 0.05) : 0;
    lastMs = ts;
    S.now = ts / 1000;
    if (S.state === "count") {
      if (S.now - S.cdStart > 3.2) {
        S.state = "banner";
        S.bannerText = "第 1 波";
        S.bannerT = 1.2;
      }
    }
    update(dt);
    draw();
    S.raf = requestAnimationFrame(frame);
  }

  // ---------- 事件 ----------
  document.addEventListener("keydown", (e) => {
    const map = { ArrowLeft: "left", ArrowRight: "right", a: "a", d: "d", A: "a", D: "d" };
    if (map[e.key]) { key(map[e.key], true); e.preventDefault(); }
    if (e.key === " ") { S.firing = true; e.preventDefault(); }
    if (e.key === "r" || e.key === "R") { e.preventDefault(); begin(); }
  });
  document.addEventListener("keyup", (e) => {
    const map = { ArrowLeft: "left", ArrowRight: "right", a: "a", d: "d", A: "a", D: "d" };
    if (map[e.key]) key(map[e.key], false);
    if (e.key === " ") S.firing = false;
  });

  // 鼠标 / 触屏：按住=开火，拖动=移动
  cv.addEventListener("pointerdown", (e) => {
    cv.setPointerCapture(e.pointerId);
    S.firing = true;
    moveTo(e);
  });
  cv.addEventListener("pointermove", (e) => { if (e.buttons || e.pressure) moveTo(e); });
  window.addEventListener("pointerup", () => { S.firing = false; });

  function moveTo(e) {
    const rect = cv.getBoundingClientRect();
    S.player.x = ((e.clientX - rect.left) / rect.width) * W;
  }

  btnRestart.addEventListener("click", begin);

  // ---------- 启动 ----------
  function begin() {
    resetGame();
    S.state = "count";
    S.cdStart = performance.now() / 1000;
    lastMs = 0;
    spawnWave(1);
    updateHud();
  }

  begin();
  S.raf = requestAnimationFrame(frame);
})();
