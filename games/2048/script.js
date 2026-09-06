/* ============================================================
   2048 · 平滑滑动版
   - 静态槽位 + 绝对定位数字块；移动时数字块以 left/top 过渡
   - 新块从 0 弹入、合并块在落位后放大回弹
   ============================================================ */
(function () {
  "use strict";

  const SIZE = 4;
  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");

  let grid;            // 数值网格 4x4（0=空）
  let tileBy = {};     // key "r,c" -> 数字块 DOM（对应每格存在的块）
  let score = 0;
  let over = false;
  let won = false;
  let animating = false;

  let best = +(localStorage.getItem("game2048-best") || 0);
  bestEl.textContent = best;

  /* ---------- 几何 ---------- */
  function dims() {
    const cs = getComputedStyle(boardEl);
    const f = (n) => parseFloat(cs.getPropertyValue(n)) || 88;
    const t = f("--t"), g = f("--g"), pd = f("--pd");
    return { t, g, pd, step: t + g };
  }
  function posOf(c) { const d = dims(); return d.pd + c * d.step; }

  function place(tileEl, r, c) {
    tileEl.style.left = posOf(c) + "px";
    tileEl.style.top = posOf(r) + "px";
  }
  function setVal(tileEl, v) {
    tileEl.dataset.v = String(v);
    tileEl.textContent = v;
    tileEl.classList.toggle("big", v >= 1024);
  }

  /* ---------- 生成 ---------- */
  function newTile(r, c, v) {
    const el = document.createElement("div");
    el.className = "tile";
    setVal(el, v);
    place(el, r, c);
    boardEl.appendChild(el);
    return el;
  }

  function buildSlots() {
    boardEl.innerHTML = "";
    for (let i = 0; i < SIZE * SIZE; i++) {
      const s = document.createElement("div");
      s.className = "slot";
      boardEl.appendChild(s);
    }
  }

  function renderAll(animateNew) {
    // 重建数字块层：按当前 grid 逐格放置
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const v = grid[r][c];
        const key = r + "," + c;
        const el = tileBy[key];
        if (v) {
          if (!el) {
            // 新出现的数字块
            const created = newTile(r, c, v);
            tileBy[key] = created;
            if (animateNew) {
              created.classList.add("new");
              setTimeout(() => created.classList.remove("new"), 220);
            }
          } else {
            place(el, r, c);
          }
        }
      }
    }
    // 移除消失的（合并后被清掉的格子）
    for (const key in tileBy) {
      const [r, c] = key.split(",").map(Number);
      if (!grid[r][c] && tileBy[key]) {
        tileBy[key].remove();
        delete tileBy[key];
      }
    }
  }

  function clearTiles() { tileBy = {}; }

  /* ---------- 状态 ---------- */
  function reset() {
    over = false; won = false; score = 0;
    clearTiles();
    buildSlots();
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    scoreEl.textContent = 0;
    spawn(); spawn();
    renderAll(true);
    hideMsg();
  }

  function spawn() {
    const empty = [];
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empty.push([r, c]);
    if (!empty.length) return;
    const [r, c] = empty[(Math.random() * empty.length) | 0];
    grid[r][c] = Math.random() < 0.9 ? 2 : 4;
  }

  /* ---------- 方向：把棋盘变换成"向左"行处理 ---------- */
  // work[i][j] = { origR, origC }（i 行是移动线上的第 0..3 格）
  function workIdx(dir) {
    const w = [];
    for (let i = 0; i < SIZE; i++) {
      const row = [];
      for (let j = 0; j < SIZE; j++) {
        let r, c;
        if (dir === "left") { r = i; c = j; }
        else if (dir === "right") { r = i; c = SIZE - 1 - j; }   // 每行逆向(右为线首)
        else if (dir === "up") { r = j; c = i; }                 // 每列自上而下为线首
        else { r = SIZE - 1 - j; c = i; }                        // down：每列自下而上为线首
        row.push({ r, c });
      }
      w.push(row);
    }
    return w;
  }

  function doSlide(dir) {
    if (over || won || animating) return;
    const w = workIdx(dir);
    // 计算每行压缩结果：{value, fromKey, fromEls}
    const results = [];
    let changed = false;

    for (let i = 0; i < SIZE; i++) {
      const cells = w[i].map((p) => ({ ...p, v: grid[p.r][p.c] }));
      const kept = cells.filter((x) => x.v);
      const out = [];
      let j = 0;
      while (j < kept.length) {
        if (j + 1 < kept.length && kept[j].v === kept[j + 1].v) {
          out.push({ v: kept[j].v * 2, from: [kept[j], kept[j + 1]] });
          j += 2;
        } else {
          out.push({ v: kept[j].v, from: [kept[j]] });
          j += 1;
        }
      }
      // 放置目标坐标 = w[i][k]
      out.forEach((item, k) => {
        const target = w[i][k];
        if (grid[target.r][target.c] !== item.v) changed = true;
        item.to = target;
      });
      results.push(out);
    }

    if (!changed) return;

    // 先按"from 原位置"移除对应块的引用标记，由新 target 建引用
    const newGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

    results.forEach((line) => {
      line.forEach((item) => {
        const t = item.to;
        newGrid[t.r][t.c] = item.v;
        if (item.v === 2048) won = true;

        const primaryEl = tileBy[item.from[0].r + "," + item.from[0].c];
        const secondaryEl = item.from.length > 1
          ? tileBy[item.from[1].r + "," + item.from[1].c]
          : null;

        if (!primaryEl) return;
        // 1) 平滑滑向目标
        place(primaryEl, t.r, t.c);
        // 2) 合并时：次要块也滑到同一位置，稍后隐藏
        if (secondaryEl) {
          place(secondaryEl, t.r, t.c);
          setTimeout(() => { secondaryEl.remove(); }, 160);
        }
        // 3) 更新数值（合并的话要等滑动结束再变+弹一下）
        if (item.from.length > 1) {
          const oldV = primaryEl.dataset.v;
          setTimeout(() => {
            if (oldV !== String(item.v)) setVal(primaryEl, item.v);
            score += item.v;
            scoreEl.textContent = score;
            primaryEl.classList.add("merged");
            setTimeout(() => primaryEl.classList.remove("merged"), 240);
          }, 130);
        } else {
          setVal(primaryEl, item.v);
        }
      });
    });

    // 重建 grid 与 tileBy（显式迁移：每个结果项的 from[0] 元素搬到目标格）
    grid = newGrid;
    const rebuilt = {};
    results.forEach((line) => {
      line.forEach((item) => {
        const t = item.to;
        const el = tileBy[item.from[0].r + "," + item.from[0].c];
        if (el && el.isConnected) rebuilt[t.r + "," + t.c] = el;
      });
    });
    tileBy = rebuilt;

    if (score > best) {
      best = score;
      bestEl.textContent = best;
      try { localStorage.setItem("game2048-best", String(best)); } catch (_) {}
    }

    animating = true;
    setTimeout(() => {
      animating = false;
      spawn();
      renderAll(true);
      afterMove();
    }, 165);
  }

  /* ---------- 判定 ---------- */
  function afterMove() {
    if (won) { showMsg("🎉 你成功了！", "win"); return; }
    if (!canMove()) { over = true; showMsg("😵 游戏结束，没有可移动方块", "lose"); }
  }
  function canMove() {
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        if (!grid[r][c]) return true;
        if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
        if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
      }
    return false;
  }

  function showMsg(text, cls) {
    let msg = document.querySelector(".msg");
    if (!msg) {
      msg = document.createElement("div");
      msg.className = "msg";
      const hud = document.querySelector(".hud");
      hud.parentNode.insertBefore(msg, hud.nextSibling);
    }
    msg.textContent = text;
    msg.className = "msg " + cls;
  }
  function hideMsg() {
    const msg = document.querySelector(".msg");
    // 仅隐藏游戏内自建提示（.msg 不带 endModal 类的）
    if (msg && !msg.closest?.("#endModal")) {
      msg.textContent = "";
      msg.className = "msg";
    }
  }

  function handleKey(e) {
    const keyMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
    const dir = keyMap[e.key];
    if (dir) { e.preventDefault(); doSlide(dir); }
  }

  document.addEventListener("keydown", handleKey);

  let startX, startY;
  boardEl.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, { passive: true });
  boardEl.addEventListener("touchend", (e) => {
    if (!startX) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) doSlide(dx > 0 ? "right" : "left");
    else doSlide(dy > 0 ? "down" : "up");
    startX = startY = null;
  }, { passive: true });

  window.addEventListener("resize", () => {
    for (const key in tileBy) {
      const [r, c] = key.split(",").map(Number);
      if (tileBy[key]) place(tileBy[key], r, c);
    }
  });

  document.getElementById("newGame").addEventListener("click", reset);

  reset();
})();
