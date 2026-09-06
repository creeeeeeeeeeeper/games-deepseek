/* ===== 反应测试 ===== */
(() => {
  'use strict';

  const TOTAL_ROUNDS = 5;
  const BEST_KEY = 'reaction-best';

  const $ = (id) => document.getElementById(id);
  const pad = $('pad');
  const padIcon = $('padIcon');
  const padText = $('padText');
  const padSub = $('padSub');
  const liveTimeEl = $('liveTime');
  const roundsEl = $('rounds');
  const hudRound = $('hudRound');
  const hudAvg = $('hudAvg');
  const hudBest = $('hudBest');
  const modal = $('modal');
  const modalSub = $('modalSub');
  const resAvg = $('resAvg');
  const resRank = $('resRank');
  const resBest = $('resBest');
  const btnRestart = $('btnRestart');
  const btnAgain = $('btnAgain');

  // state: idle | ready | wait | go | early | show | done
  let state = 'idle';
  let round = 0;          // 当前轮次（1 起）
  let results = [];       // 每轮毫秒
  let goTime = 0;         // 变绿时刻
  let roundTimer = null;  // 等待->变绿 定时器
  let flowTimer = null;   // 流程推进定时器
  let rafId = null;       // 实时毫秒计数 rAF
  let best = loadBest();  // 历史最佳（最小单轮 ms）
  let runStartBest = best;

  function loadBest() {
    try {
      const v = parseInt(window.localStorage.getItem(BEST_KEY), 10);
      return Number.isFinite(v) && v > 0 ? v : null;
    } catch (e) {
      return null;
    }
  }

  function saveBest(ms) {
    try {
      window.localStorage.setItem(BEST_KEY, String(ms));
    } catch (e) {
      /* 存储不可用时静默降级 */
    }
  }

  function setState(s) {
    state = s;
    pad.dataset.state = s;
  }

  function setPad(icon, text, sub) {
    padIcon.textContent = icon;
    padText.textContent = text;
    padSub.textContent = sub;
  }

  function clearTimers() {
    if (roundTimer != null) { clearTimeout(roundTimer); roundTimer = null; }
    if (flowTimer != null) { clearTimeout(flowTimer); flowTimer = null; }
    stopLive();
  }

  function updateHud() {
    const shown = state === 'idle' ? 0 : Math.min(Math.max(round, 1), TOTAL_ROUNDS);
    hudRound.textContent = shown + '/' + TOTAL_ROUNDS;
    hudAvg.textContent = results.length
      ? Math.round(results.reduce((a, b) => a + b, 0) / results.length) + ' ms'
      : '--';
    hudBest.textContent = best != null ? best + ' ms' : '--';
  }

  /* ---- 实时毫秒计数（rAF 驱动） ---- */
  function tickLive() {
    if (state !== 'go') { rafId = null; return; }
    liveTimeEl.textContent = Math.max(0, Math.round(performance.now() - goTime)) + ' ms';
    rafId = requestAnimationFrame(tickLive);
  }

  function stopLive() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  /* ---- 波纹特效 ---- */
  function spawnRipple(x, y) {
    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    pad.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
    setTimeout(() => r.remove(), 900); // 兜底清理
  }

  /* ---- 流程 ---- */
  function startGame() {
    clearTimers();
    results = [];
    round = 0;
    runStartBest = best;
    roundsEl.innerHTML = '';
    liveTimeEl.textContent = '';
    modal.classList.remove('show');
    updateHud();
    setState('ready');
    setPad('🎯', '准备…', '集中注意力');
    flowTimer = setTimeout(() => {
      round += 1;
      scheduleRound();
    }, 900);
  }

  function scheduleRound() {
    updateHud();
    liveTimeEl.textContent = '';
    setState('wait');
    setPad('✋', '等待…', '保持冷静，变绿立刻点击');
    const delay = 1000 + Math.random() * 3000; // 1~4 秒随机
    roundTimer = setTimeout(() => {
      setState('go');
      setPad('⚡', '点击！', '');
      goTime = performance.now();
      if (rafId == null) rafId = requestAnimationFrame(tickLive);
    }, delay);
  }

  function addRoundCard(n, ms, isRecord) {
    const el = document.createElement('div');
    el.className = 'round-card' + (isRecord ? ' record' : '');
    const no = document.createElement('span');
    no.className = 'round-no';
    no.textContent = '第' + n + '轮';
    const strong = document.createElement('strong');
    strong.textContent = ms + ' ms';
    el.appendChild(no);
    el.appendChild(strong);
    if (isRecord) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = '🏆 新纪录';
      el.appendChild(tag);
    }
    roundsEl.appendChild(el);
  }

  function rankOf(avg) {
    if (avg < 200) return '闪电 ⚡';
    if (avg < 300) return '极快 🚀';
    if (avg < 400) return '良好 👍';
    if (avg < 500) return '一般 🙂';
    return '偏慢 🐢';
  }

  function finish() {
    setState('done');
    setPad('🏁', '测试完成', '查看结果，或按 R 再来一局');
    const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length);
    const fastest = Math.min.apply(null, results);
    const newRecord = runStartBest == null || best < runStartBest;
    resAvg.textContent = avg + ' ms';
    resRank.textContent = rankOf(avg);
    resBest.textContent = best != null ? best + ' ms' : '--';
    modalSub.textContent = '最快单轮 ' + fastest + ' ms · 共 ' + TOTAL_ROUNDS + ' 轮'
      + (newRecord ? ' · 🏆 刷新历史最佳！' : '');
    modal.classList.add('show');
  }

  /* ---- 核心输入 ---- */
  function handlePress(x, y) {
    spawnRipple(x, y);

    if (state === 'idle' || state === 'done') {
      startGame();
      return;
    }

    if (state === 'wait') {
      // 提前点击：本轮作废，稍后重测该轮
      if (roundTimer != null) { clearTimeout(roundTimer); roundTimer = null; }
      setState('early');
      setPad('😅', '太早了！', '这一轮作废，马上重测');
      flowTimer = setTimeout(scheduleRound, 1300);
      return;
    }

    if (state === 'go') {
      const ms = Math.max(1, Math.round(performance.now() - goTime));
      stopLive();
      liveTimeEl.textContent = '';
      results.push(ms);
      let isRecord = false;
      if (best == null || ms < best) {
        best = ms;
        saveBest(ms);
        isRecord = true;
      }
      addRoundCard(round, ms, isRecord);
      updateHud();
      setState('show');
      setPad(isRecord ? '🏆' : '👏', ms + ' ms',
        results.length >= TOTAL_ROUNDS ? '全部完成！' : '不错，下一轮马上开始');
      flowTimer = setTimeout(() => {
        if (results.length >= TOTAL_ROUNDS) {
          finish();
        } else {
          round += 1;
          scheduleRound();
        }
      }, 1100);
    }
    // ready / early / show 阶段忽略点击，防止跳轮
  }

  /* ---- 事件绑定 ---- */
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = pad.getBoundingClientRect();
    handlePress(e.clientX - rect.left, e.clientY - rect.top);
  });

  pad.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();
      const rect = pad.getBoundingClientRect();
      handlePress(rect.width / 2, rect.height / 2);
    } else if (e.key === 'r' || e.key === 'R') {
      startGame();
    }
  });

  btnRestart.addEventListener('click', startGame);
  btnAgain.addEventListener('click', startGame);

  /* ---- 初始化 ---- */
  setState('idle');
  setPad('🖱️', '点击这里开始', '或按下 空格 键');
  updateHud();
})();
