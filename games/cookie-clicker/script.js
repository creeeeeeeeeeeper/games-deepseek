/* ============================================================
   点饼干 · 休闲娱乐（单人点击放置）
   点击大饼干赚饼干；升级点击收益 & 自动产量；攒到 10000
   ============================================================ */
(function () {
  "use strict";

  const cookieEl = document.getElementById("cookie");
  const cookiesEl = document.getElementById("cookies");
  const rateEl = document.getElementById("rate");
  const shopEl = document.getElementById("shop");
  const msgEl = document.getElementById("msg");
  const endModal = document.getElementById("endModal");
  const endTitle = document.getElementById("endTitle");
  const endMsg = document.getElementById("endMsg");
  const againBtn = document.getElementById("againBtn");

  const GOAL = 10000;
  let cookies = 0, perClick = 1, over = false;
  let upgrades = [];

  const DEFS = [
    { key: "click", name: "点击更值钱 +1", desc: "每点一下多 +1", base: 20, growth: 1.35, type: "click" },
    { key: "click3", name: "点击更值钱 +3", desc: "每点一下多 +3", base: 90, growth: 1.4, type: "click", amount: 3 },
    { key: "auto", name: "自动饼干 ×1", desc: "每秒自动 +1", base: 60, growth: 1.5, type: "auto", amount: 1 },
    { key: "auto5", name: "自动饼干 ×5", desc: "每秒自动 +5", base: 300, growth: 1.5, type: "auto", amount: 5 },
    { key: "auto20", name: "自动饼干 ×20", desc: "每秒自动 +20", base: 1200, growth: 1.6, type: "auto", amount: 20 },
  ];

  function reset() {
    cookies = 0; perClick = 1; over = false;
    upgrades = DEFS.map((d) => ({ ...d, count: 0, cost: d.base }));
  }

  function rate() {
    return upgrades.filter((u) => u.type === "auto").reduce((s, u) => s + u.count * u.amount, 0);
  }

  function render() {
    cookiesEl.textContent = Math.floor(cookies);
    rateEl.textContent = rate();
    shopEl.innerHTML = "";
    upgrades.forEach((u) => {
      const el = document.createElement("div");
      el.className = "upg" + (cookies < u.cost ? " cant" : "");
      el.innerHTML = '<div class="nm">' + u.name + ' (' + u.count + ')</div><div class="ds">' + u.desc + '</div><div class="pr">🍪 ' + Math.floor(u.cost) + '</div>';
      el.addEventListener("click", () => buy(u));
      shopEl.appendChild(el);
    });
  }

  function buy(u) {
    if (over || cookies < u.cost) return;
    cookies -= u.cost;
    u.count++;
    if (u.type === "click") perClick += u.amount || 1;
    u.cost = Math.ceil(u.cost * u.growth);
    render();
  }

  function clickCookie() {
    if (over) return;
    cookies += perClick;
    render();
    if (cookies >= GOAL) finish();
  }

  function finish() {
    over = true;
    endTitle.textContent = "🎉 一万块达成！";
    endMsg.textContent = "你攒到 " + Math.floor(cookies) + " 块饼干。";
    msgEl.className = "msg win";
    setTimeout(() => endModal.classList.add("show"), 400);
  }

  function tick() {
    if (over) return;
    cookies += rate() * 0.25;   // 每秒自动增量拆到 4 Hz
    render();
    if (cookies >= GOAL) finish();
  }

  function start() {
    reset();
    msgEl.textContent = "点大饼干赚钱。";
    msgEl.className = "msg";
    endModal.classList.remove("show");
    render();
  }

  cookieEl.addEventListener("click", clickCookie);
  againBtn.addEventListener("click", start);
  document.addEventListener("keydown", (e) => { if (e.key === "r" || e.key === "R") { e.preventDefault(); start(); } });
  setInterval(tick, 250);
  start();
})();
