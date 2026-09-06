/* ============================================================
   汉诺塔（Tower of Hanoi）
   - 纯原生 JavaScript + Canvas，无任何外部依赖
   - 三根柱子，把若干圆盘从最左侧移到最右侧即获胜
   - 操作：点源柱选中其最上层圆盘 -> 点目标柱移动
   - 右键 / 再次点击同柱 取消选择
   中文注释，便于理解与维护
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 配置 ---------- */
  const PEG_COUNT = 3;              // 柱子数量
  const DISK_HEIGHT = 22;           // 每个圆盘的高度（逻辑像素）
  const MIN_DISK_W = 40;            // 最小圆盘宽度
  const MAX_DISK_W = 120;           // 最大圆盘宽度
  const BASE_H = 12;                // 底部横梁高度
  const PEG_W = 8;                  // 柱子宽度
  const PAD_TOP = 26;               // 顶部留白

  // 圆盘颜色（从小到大），倒序使用让最大的颜色最醒目
  const DISK_COLORS = [
    "#3aa0ff", "#4fb3ff", "#34d399", "#ffd93d",
    "#ffb23e", "#ff7a4d", "#ff5d6c", "#9b6bff",
  ];

  /* ---------- 状态 ---------- */
  let level = 4;                    // 当前圆盘数量（3/4/5）
  let pegs = [];                    // 三根柱子上的圆盘栈（数字表示尺寸，越大越靠底）
  let selected = -1;                // 当前选中的源柱索引，-1 表示未选中
  let moves = 0;                    // 已走步数
  let minMoves = 0;                 // 理论最少步数 = 2^level - 1
  let won = false;                  // 是否已获胜

  /* ---------- DOM ---------- */
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const movesEl = document.getElementById("moves");
  const minMovesEl = document.getElementById("minMoves");
  const levelSel = document.getElementById("level");
  const restartBtn = document.getElementById("restart");
  const msgEl = document.getElementById("msg");

  /* ---------- 工具：初始化一局 ---------- */
  function initGame() {
    pegs = [];
    for (let i = 0; i < PEG_COUNT; i++) pegs.push([]);
    // 把 1..level 全部放到第一根柱子上（尺寸越大代表越大圆盘）
    for (let d = level; d >= 1; d--) pegs[0].push(d);
    selected = -1;
    moves = 0;
    won = false;
    minMoves = Math.pow(2, level) - 1;
    updateHud();
    setMsg("");
    draw();
  }

  /* ---------- 画布尺寸自适应（含高清屏适配） ---------- */
  function resizeCanvas() {
    const containerW = canvas.parentElement.clientWidth;
    // 设计宽高比固定为 640:420，跟随容器宽度缩放，保证清晰
    const w = Math.max(320, Math.min(640, containerW));
    const dpr = window.devicePixelRatio || 1;
    const h = Math.round(w * (420 / 640));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    // 用 ctx.setTransform 让后续绘制都按逻辑尺寸来
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  /* ---------- 把逻辑坐标换算成柱子索引 ---------- */
  function pegFromX(x) {
    const w = canvas.clientWidth;
    const left = w * 0.12;
    const spacing = (w - 2 * left) / PEG_COUNT;
    // 离哪根柱子中心最近就是哪根
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < PEG_COUNT; i++) {
      const cx = left + spacing * (i + 0.5);
      const d = Math.abs(x - cx);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  /* ---------- 尝试移动：src -> dst ---------- */
  function tryMove(src, dst) {
    if (src === dst) return;
    const srcPeg = pegs[src];
    const dstPeg = pegs[dst];
    if (srcPeg.length === 0) return;                    // 源柱为空
    const top = srcPeg[srcPeg.length - 1];              // 源柱最上层圆盘
    const dstTop = dstPeg[dstPeg.length - 1];           // 目标柱最上层圆盘（可能 undefined）
    // 只能放在更大的圆盘上方或空柱上
    if (dstTop !== undefined && top > dstTop) return;
    srcPeg.pop();
    dstPeg.push(top);
    moves++;
    updateHud();
    if (checkWin()) {
      won = true;
      setMsg("🎉 恭喜获胜！用了 " + moves + " 步（最少 " + minMoves + " 步）。", "good");
    } else {
      setMsg("");
    }
  }

  /* ---------- 胜利判定：所有圆盘都在最右侧柱子 ---------- */
  function checkWin() {
    const last = pegs[PEG_COUNT - 1];
    if (last.length !== level) return false;
    // 所有盘都在最右柱，且最底部是最大盘（=level）。
    // 合法的移动永远保持大盘在下，因此只要最底是最大盘即已整齐收齐。
    return last[0] === level;
  }

  /* ---------- 更新状态栏 ---------- */
  function updateHud() {
    movesEl.textContent = moves;
    minMovesEl.textContent = minMoves;
  }

  /* ---------- 设置提示消息 ---------- */
  function setMsg(text, kind) {
    msgEl.textContent = text;
    msgEl.className = "msg" + (kind ? " " + kind : "");
  }

  /* ---------- 绘制整幅画面 ---------- */
  function draw() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const left = w * 0.12;
    const spacing = (w - 2 * left) / PEG_COUNT;
    const pegX = [], pegTop = PAD_TOP;
    for (let i = 0; i < PEG_COUNT; i++) pegX.push(left + spacing * (i + 0.5));

    const baseY = h - 30;                    // 柱子底部
    const diskW = (n) => MIN_DISK_W + (n - 1) * (MAX_DISK_W - MIN_DISK_W) / (level - 1);

    // ---- 底部横梁 ----
    ctx.fillStyle = "#2b3850";
    ctx.fillRect(left - 18, baseY, (w - 2 * left) + 36, BASE_H);

    // ---- 三根柱子（依次绘制，选中柱高亮） ----
    for (let i = 0; i < PEG_COUNT; i++) {
      const highlighted = (i === selected);
      ctx.strokeStyle = highlighted ? "#3aa0ff" : "#60708c";
      ctx.lineWidth = PEG_W;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pegX[i], pegTop);
      ctx.lineTo(pegX[i], baseY);
      ctx.stroke();
    }

    // ---- 每根柱子上的圆盘 ----
    for (let i = 0; i < PEG_COUNT; i++) {
      const stack = pegs[i];
      const n = stack.length;
      for (let j = 0; j < n; j++) {
        const d = stack[j];                    // 圆盘尺寸（越大越宽）
        const dw = diskW(d);
        // stack[0] 在柱底，stack[n-1] 在柱顶；y 越接近 baseY 越靠底
        const dy = baseY - (j + 1) * DISK_HEIGHT;
        drawDisk(pegX[i], dy, dw, d);
      }
    }

    // ---- 选中指示箭头（在源柱顶部上方） ----
    if (selected >= 0 && pegs[selected].length > 0) {
      const topY = baseY - pegs[selected].length * DISK_HEIGHT;
      drawArrow(pegX[selected], topY - PAD_TOP + 4);
    }
  }

  /* ---------- 绘制单个圆盘（带高光渐变，视觉更立体） ---------- */
  function drawDisk(cx, topY, width, diskNum) {
    const color = DISK_COLORS[(diskNum - 1) % DISK_COLORS.length];
    const x = cx - width / 2;
    const h = DISK_HEIGHT - 3;                 // 留一点间隙，避免贴太紧
    const r = 6;

    // 圆角矩形 + 渐变，模拟立体感
    const grad = ctx.createLinearGradient(0, topY, 0, topY + h);
    grad.addColorStop(0, lighten(color, 0.25));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    roundRect(x, topY, width, h, r);
    ctx.fill();

    // 高光描边
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* ---------- 圆角矩形路径 ---------- */
  function roundRect(x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------- 绘制柔和的高亮圆头箭头 ---------- */
  function drawArrow(cx, y) {
    ctx.fillStyle = "#3aa0ff";
    ctx.beginPath();
    ctx.moveTo(cx, y + 14);
    ctx.lineTo(cx - 8, y);
    ctx.lineTo(cx + 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, y + 16, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ---------- 工具：颜色变亮 ---------- */
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt));
    const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt));
    const b = Math.min(255, (n & 255) + Math.round(255 * amt));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  /* ---------- 事件处理：点击 / 触屏选择与移动 ---------- */
  function handlePointer(evt) {
    if (won) return;                       // 胜利后锁定，点重新开始
    const rect = canvas.getBoundingClientRect();
    let clientX = evt.clientX;
    if (evt.touches && evt.touches.length) clientX = evt.touches[0].clientX;
    const x = clientX - rect.left;
    const peg = pegFromX(x);

    if (selected === -1) {
      // 第一步：选中一根有盘的柱子
      if (pegs[peg].length === 0) { setMsg("这根柱子是空的，选一根有圆盘的柱子。", "bad"); return; }
      selected = peg;
      setMsg("");
    } else if (selected === peg) {
      // 再次点击同一根 -> 取消选择
      selected = -1;
      setMsg("已取消选择。");
    } else {
      // 第二步：向目标柱移动
      const src = selected;
      const srcPeg = pegs[src];
      const top = srcPeg[srcPeg.length - 1];
      const dstPeg = pegs[peg];
      const dstTop = dstPeg[dstPeg.length - 1];
      if (dstTop !== undefined && top > dstTop) {
        setMsg("不能把大的圆盘放在小的上面。", "bad");
        // 移动失败，保持选中态，方便换目标柱
        return;
      }
      tryMove(src, peg);
      selected = -1;                        // 移动成功后清除选中
    }
    draw();
  }

  // 左键 / 触屏
  canvas.addEventListener("pointerdown", handlePointer);

  // 右键：取消选择（并阻止右键菜单）
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (selected !== -1) { selected = -1; setMsg("已取消选择。"); draw(); }
  });

  /* ---------- 控制按钮 ---------- */
  restartBtn.addEventListener("click", () => {
    initGame();
    draw();
  });

  // 切换圆盘数量：重新开局
  levelSel.addEventListener("change", () => {
    level = parseInt(levelSel.value, 10) || 4;
    initGame();
    draw();
  });

  /* ---------- 键盘快捷键（可选，方便桌面玩家） ---------- */
  window.addEventListener("keydown", (e) => {
    // 数字键 1/2/3 直接选择对应柱子
    const numKey = { "1": 0, "2": 1, "3": 2 }[e.key];
    if (numKey !== undefined) {
      const peg = numKey;
      if (selected === -1) {
        if (pegs[peg].length === 0) { setMsg("这根柱子是空的，选一根有圆盘的柱子。", "bad"); return; }
        selected = peg; setMsg("");
      } else if (selected === peg) {
        selected = -1; setMsg("已取消选择。");
      } else {
        const src = selected;
        const top = pegs[src][pegs[src].length - 1];
        const dstTop = pegs[peg][pegs[peg].length - 1];
        if (dstTop !== undefined && top > dstTop) { setMsg("不能把大的圆盘放在小的上面。", "bad"); draw(); return; }
        tryMove(src, peg);
        selected = -1;
      }
      draw();
    }
    // ESC 取消选择
    if (e.key === "Escape" && selected !== -1) {
      selected = -1; setMsg("已取消选择。"); draw();
    }
  });

  /* ---------- 启动 ---------- */
  window.addEventListener("resize", resizeCanvas);
  initGame();
  resizeCanvas();
})();
