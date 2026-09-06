/* ============================================================
   农夫过河 · 游戏逻辑
   经典过河谜题：
   - 农夫要把 狼、羊、菜 全部运到对岸。
   - 船一次只能载 农夫 + 最多 1 件物品；农夫必须在船上才能开船。
   - 农夫离开后，若 狼+羊 同岸，或 羊+菜 同岸，任务失败。
   - 所有棋子（含农夫）都到达对岸即获胜。
   纯原生 JavaScript，无任何外部依赖。
   ============================================================ */
(function () {
  "use strict";

  // ---- 棋子定义：键名 / 中文名 / 图标 / 主题色 ----
  const ITEMS = [
    { key: "wolf",    name: "狼",   icon: "🐺", color: "#8a93a6" },
    { key: "goat",    name: "羊",   icon: "🐐", color: "#34d399" },
    { key: "cabbage", name: "菜",   icon: "🥬", color: "#3aa0ff" },
    { key: "farmer",  name: "农夫", icon: "🚣", color: "#ffb23e" },
  ];

  const CAPACITY = 1;   // 船除农夫外最多装载的物品数
  const LEFT  = "left";  // 起点岸
  const RIGHT = "right"; // 对岸
  const BOAT  = "boat";  // 船上

  // ---- 游戏状态 ----
  // locations: 每个棋子当前所在位置（left / right / boat）
  // side:      船当前停靠的岸（left / right）
  // moves:     开船次数
  // over:      是否已结束（胜利/失败）
  let state;
  let resetTimer = null;

  // ---- DOM 引用 ----
  const els = {
    leftItems:  document.getElementById("leftItems"),
    rightItems: document.getElementById("rightItems"),
    boatItems:  document.getElementById("boatItems"),
    boat:       document.getElementById("boat"),
    sail:       document.getElementById("sail"),
    moves:      document.getElementById("moves"),
    boatStatus: document.getElementById("boatStatus"),
    msg:        document.getElementById("msg"),
    modal:      document.getElementById("modal"),
    modalTitle: document.getElementById("modalTitle"),
    modalText:  document.getElementById("modalText"),
    modalRestart: document.getElementById("modalRestart"),
    restart:    document.getElementById("restart"),
  };

  // ---- 初始化 / 重新开始 ----
  function init() {
    state = {
      locations: { wolf: LEFT, goat: LEFT, cabbage: LEFT, farmer: LEFT },
      side: LEFT,
      moves: 0,
      over: false,
    };
    els.modal.classList.remove("show");
    clearMsg();
    render();
  }

  // ---- 辅助判断 ----
  function onBoat(key) { return state.locations[key] === BOAT; }

  // 农夫是否「在场」于某岸：人在岸上，或人乘着小船停靠在该岸
  function farmerAt(bank) {
    return state.locations.farmer === bank || (onBoat("farmer") && state.side === bank);
  }

  // 某岸上的棋子（不含船上的）
  function itemsAt(bank) {
    return ITEMS.filter((it) => state.locations[it.key] === bank);
  }

  // 船上除农夫外的物品数
  function cargoCount() {
    return ITEMS.filter((it) => it.key !== "farmer" && onBoat(it.key)).length;
  }

  // ---- 交互：点击棋子（装载 / 卸载） ----
  function clickItem(key) {
    if (state.over) return;
    const loc = state.locations[key];

    if (loc === BOAT) {
      // 在船上 -> 卸到船当前所在岸
      state.locations[key] = state.side;
      render();
      return;
    }

    if (loc === state.side) {
      // 在船所在岸 -> 尝试装船
      if (key === "farmer") {
        state.locations[key] = BOAT;
      } else {
        if (cargoCount() >= CAPACITY) {
          flashMsg("🚫 船一次只能载一件物品，请先卸下别的。");
          return;
        }
        state.locations[key] = BOAT;
      }
      render();
      return;
    }

    // 在对岸：无法装载
    flashMsg("🚫 船不在这边，无法装载这个棋子。");
  }

  // ---- 开船 ----
  function sail() {
    if (state.over) return;
    if (!onBoat("farmer")) {
      flashMsg("🚫 农夫必须在船上才能开船。");
      return;
    }

    // 船靠岸在另一侧；船上物品随之移动（位置仍为 boat）
    state.side = state.side === LEFT ? RIGHT : LEFT;
    state.moves += 1;
    els.moves.textContent = state.moves;

    render();
    checkAfterSail();
  }

  // ---- 航行后判定（失败 / 胜利） ----
  function checkAfterSail() {
    // 1) 失败判定：农夫不在的岸上，狼+羊 或 羊+菜 同时存在
    for (const b of [LEFT, RIGHT]) {
      if (farmerAt(b)) continue; // 农夫在场则安全
      const present = itemsAt(b).map((it) => it.key);
      const hasWolf = present.includes("wolf");
      const hasGoat = present.includes("goat");
      const hasCabbage = present.includes("cabbage");
      if ((hasWolf && hasGoat) || (hasGoat && hasCabbage)) {
        fail();
        return;
      }
    }

    // 2) 胜利判定：所有棋子都已到达对岸（在右岸，或随船停在右岸）
    const allDelivered = ITEMS.every((it) => state.locations[it.key] === RIGHT ||
      (onBoat(it.key) && state.side === RIGHT));
    if (allDelivered && farmerAt(RIGHT)) {
      win();
    }
  }

  // ---- 失败 / 胜利 ----
  function fail() {
    state.over = true;
    showModal("💥 失败了", "农夫一离开，狼和羊（或羊和菜）就凑在了一岸。点击再来一局吧。", "lose");
  }

  function win() {
    state.over = true;
    clearMsg();
    showModal("🎉 成功过河！", "你用 " + state.moves + " 步把 狼、羊、菜 全部送到了对岸。", "win");
  }

  // ---- 渲染 ----
  function render() {
    renderItems(els.leftItems, LEFT);
    renderItems(els.rightItems, RIGHT);
    renderItems(els.boatItems, BOAT);

    // 船方位视觉 + 开船按钮文案 / 状态
    els.boat.classList.toggle("boat-left",  state.side === LEFT);
    els.boat.classList.toggle("boat-right", state.side === RIGHT);
    els.sail.textContent = state.side === LEFT ? "⛵ 开往对岸" : "⛵ 返回起点";
    els.boatStatus.textContent = onBoat("farmer") ? "农夫在船上，可以开船" : "农夫未上船";
    els.sail.disabled = !onBoat("farmer") || state.over;
  }

  function renderItems(container, bank) {
    container.innerHTML = "";
    const items = itemsAt(bank);
    items.forEach((it) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "item-chip";
      btn.dataset.key = it.key;
      btn.style.setProperty("--item-color", it.color);
      btn.innerHTML = '<span class="emoji">' + it.icon + '</span><span class="name">' + it.name + '</span>';

      // 船上的棋子始终可点击（卸载）；对岸棋子（船不在那边）不可交互，变暗
      if (bank !== BOAT && bank !== state.side) {
        btn.classList.add("dim");
      } else if (!state.over) {
        btn.addEventListener("click", () => clickItem(it.key));
      }

      container.appendChild(btn);
    });
  }

  // ---- 消息 / 弹窗 ----
  function flashMsg(text) {
    els.msg.textContent = text;
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { els.msg.textContent = ""; }, 2400);
  }
  function clearMsg() {
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    els.msg.textContent = "";
  }
  function showModal(title, text, cls) {
    els.modalTitle.textContent = title;
    els.modalText.textContent = text;
    els.modalTitle.className = "modal-title " + cls;
    els.modal.classList.add("show");
  }

  // ---- 键盘控制 ----
  const KEYMAP = { "1": "wolf", "2": "goat", "3": "cabbage", "4": "farmer", "f": "farmer" };
  document.addEventListener("keydown", (e) => {
    if (state.over) return;
    const k = e.key.toLowerCase();
    if (KEYMAP[k]) { e.preventDefault(); clickItem(KEYMAP[k]); }
    else if (k === "enter" || k === " " || k === "s") { e.preventDefault(); sail(); }
  });

  // ---- 事件绑定 ----
  els.sail.addEventListener("click", sail);
  // 点击船身（非棋子）也可开船
  els.boat.addEventListener("click", (e) => {
    if (e.target === els.boat || e.target.classList.contains("boat-label")) sail();
  });
  els.restart.addEventListener("click", init);
  els.modalRestart.addEventListener("click", init);
  // 点击弹窗遮罩空白处也可关闭重开
  els.modal.addEventListener("click", (e) => { if (e.target === els.modal) init(); });

  // ---- 启动 ----
  init();
})();
