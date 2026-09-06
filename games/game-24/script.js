/* ============================================================
   24 点（24 Game）
   - 发 4 张牌（数值 1-13），用 + - × ÷ 与括号凑出 24，每张恰用一次
   - 纯原生 JS，无任何外部依赖
   - 含：重新开始、胜利/失败判定、实时预览、提示求解器
   (c) 小游戏大全
   ============================================================ */
(function () {
  "use strict";

  /* ---------- 常量 ---------- */
  var TARGET = 24;                 // 目标数
  var SUITS = ["♠", "♥", "♣", "♦"]; // 花色
  // 解析用的算子 -> 展示符号
  var OP_SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" };
  var OPS = ["+", "-", "*", "/"];  // 求解器、回退用的原始算子

  /* ---------- 精确分数运算（避免浮点误差） ---------- */
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a || 1;
  }
  // 构造最简分数 {n, d}，分母恒为正
  function frac(n, d) {
    if (d === 0) return null;
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  function fadd(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
  function fsub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
  function fmul(a, b) { return frac(a.n * b.n, a.d * b.d); }
  function fdiv(a, b) { return b.n === 0 ? null : frac(a.n * b.d, a.d * b.n); }
  function isFracInt(a) { return a.d === 1; }
  // 把分数转成直观文本：整数 / 分数(小数)
  function fracToText(a) {
    if (isFracInt(a)) return String(a.n);
    return a.n + "/" + a.d + " ≈ " + (a.n / a.d).toFixed(3);
  }

  /* ---------- DOM ---------- */
  var cardsEl = document.getElementById("cards");
  var exprEl = document.getElementById("expr");
  var previewEl = document.getElementById("preview");
  var msgEl = document.getElementById("msg");
  var roundEl = document.getElementById("round");
  var solvedEl = document.getElementById("solved");
  var leftEl = document.getElementById("left");
  var winModal = document.getElementById("winModal");
  var winText = document.getElementById("winText");

  /* ---------- 状态 ---------- */
  var cards = [];      // 当前 4 张牌的数值
  var cardView = [];   // 每张牌 {value, suit}
  var deckCount = {};  // 完整牌组的数值计数（用于校验"每张恰用一次"）
  var remaining = {};  // 当前还可放入算式的数值计数（用于按钮置灰）
  var tokens = [];     // 已输入的 token 列表
  var round = 1;       // 关卡
  var solved = 0;      // 成功次数
  var hasSolution = false; // 本关是否有解
  var solvedExpr = "";     // 本关已知解（展示形式）

  /* ---------- 提示求解器 ---------- */
  // 从若干数值中搜索能否凑出 24，返回带括号的展示表达式，否则 null
  function findSolution(nums) {
    var items = nums.map(function (n) { return { v: frac(n, 1), e: String(n) }; });

    function solve(list) {
      if (list.length === 1) {
        var it = list[0];
        return (isFracInt(it.v) && it.v.n === TARGET) ? it.e : null;
      }
      for (var i = 0; i < list.length; i++) {
        for (var j = 0; j < list.length; j++) {
          if (i === j) continue;
          var a = list[i], b = list[j];
          for (var op = 0; op < OPS.length; op++) {
            var o = OPS[op], r = null;
            if (o === "+") r = fadd(a.v, b.v);
            else if (o === "-") r = fsub(a.v, b.v);
            else if (o === "*") r = fmul(a.v, b.v);
            else r = fdiv(a.v, b.v);
            if (r === null) continue;
            // 合并出的子表达式一律加括号，保证标准优先级下结果一致
            var rest = list.filter(function (_, k) { return k !== i && k !== j; });
            rest.push({ v: r, e: "(" + a.e + " " + o + " " + b.e + ")" });
            var res = solve(rest);
            if (res) return res;
          }
        }
      }
      return null;
    }

    var ans = solve(items);
    if (ans === null) return null;
    // 把原始算子换成展示符号（− × ÷）
    return ans.replace(/[\+\-\*\/]/g, function (m) { return OP_SYMBOL[m]; });
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function randomCards() {
    return [1, 2, 3, 4].map(function () { return 1 + Math.floor(Math.random() * 13); });
  }

  /* ---------- 发牌 ---------- */
  function deal() {
    var nums = randomCards();
    var sol = findSolution(nums);
    var tries = 0;
    // 尽量保证这关有解（这样"提示"始终可用、也能通关）
    while (sol === null && tries < 200) {
      nums = randomCards();
      sol = findSolution(nums);
      tries++;
    }
    hasSolution = sol !== null;
    solvedExpr = sol || "";

    var suits = shuffle(SUITS.slice());
    cardView = nums.map(function (value, idx) { return { value: value, suit: suits[idx % suits.length] }; });
    cards = nums.slice();

    deckCount = {};
    remaining = {};
    nums.forEach(function (v) { deckCount[v] = (deckCount[v] || 0) + 1; remaining[v] = (remaining[v] || 0) + 1; });

    tokens = [];
    renderCards();
    renderExpr();
    updatePadState();
    updateHud();
    updatePreview();
    setMsg("");
  }

  /* ---------- 校验：数字是否恰好用一次 ---------- */
  function validateUsage() {
    var used = {}, numCount = 0;
    tokens.forEach(function (t) {
      if (t.t === "num") { used[t.v] = (used[t.v] || 0) + 1; numCount++; }
    });
    if (numCount !== 4) return "需恰好使用 4 张牌（当前已用 " + numCount + " 张）";
    var keys = Object.keys(deckCount);
    for (var i = 0; i < keys.length; i++) {
      var v = keys[i];
      if ((used[v] || 0) !== deckCount[v]) return "每张牌只能使用一次";
    }
    for (var u in used) { if (!(u in deckCount)) return "使用了未发出的牌"; }
    return null;
  }

  function countUnused() {
    var c = 0;
    for (var v in remaining) c += Math.max(0, remaining[v]);
    return c;
  }

  /* ---------- 表达式解析（标准四则运算 + 括号） ---------- */
  // 传入 token 数组，返回分数；语法错误则抛 Error
  function parseTokens(toks) {
    var i = 0;
    function peek() { return toks[i]; }
    function next() {
      var t = toks[i]; if (!t) throw new Error("表达式不完整"); i++;
      return t;
    }
    // expr := term (('+'|'-') term)*
    function expr() {
      var left = term();
      while (peek() && peek().t === "op" && (peek().op === "+" || peek().op === "-")) {
        var op = next().op;
        var right = term();
        left = op === "+" ? fadd(left, right) : fsub(left, right);
      }
      return left;
    }
    // term := factor (('*'|'/') factor)*
    function term() {
      var left = factor();
      while (peek() && peek().t === "op" && (peek().op === "*" || peek().op === "/")) {
        var op = next().op;
        var right = factor();
        var r = op === "*" ? fmul(left, right) : fdiv(left, right);
        if (r === null) throw new Error("除数不能为 0");
        left = r;
      }
      return left;
    }
    // factor := num | '(' expr ')'
    function factor() {
      var t = peek();
      if (!t) throw new Error("表达式不完整");
      if (t.t === "num") { next(); return frac(t.v, 1); }
      if (t.t === "lp") {
        next();
        var val = expr();
        var c = next();
        if (c.t !== "rp") throw new Error("括号不匹配");
        return val;
      }
      throw new Error("数字或括号位置有误");
    }
    var result = expr();
    if (i !== toks.length) throw new Error("表达式有多余内容");
    return result;
  }

  // 当前括号平衡（lp 多于 rp 的个数）
  function parenBalance() {
    var b = 0;
    tokens.forEach(function (t) {
      if (t.t === "lp") b++;
      else if (t.t === "rp") b--;
    });
    return b;
  }

  /* ---------- 渲染 ---------- */
  function renderCards() {
    cardsEl.innerHTML = "";
    cardView.forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card " + (c.suit === "♥" || c.suit === "♦" ? "red" : "black");
      btn.dataset.value = c.value;
      btn.innerHTML = '<span class="card-num">' + c.value + '</span><span class="card-suit">' + c.suit + '</span>';
      btn.addEventListener("click", function () { placeValue(c.value); });
      cardsEl.appendChild(btn);
    });
  }

  function renderExpr() {
    if (!tokens.length) {
      exprEl.innerHTML = '<span class="expr-placeholder">点击下方卡片与符号拼出算式</span>';
      return;
    }
    exprEl.textContent = renderExprString();
  }

  function renderExprString() {
    var s = "";
    tokens.forEach(function (t) {
      if (t.t === "num") s += t.v;
      else if (t.t === "op") s += OP_SYMBOL[t.op];
      else if (t.t === "lp") s += "(";
      else s += ")";
    });
    return s;
  }

  /* 依据当前 token 合法与否，更新各按钮禁用态 */
  function updatePadState() {
    var last = tokens[tokens.length - 1];
    var lastIsValue = last && (last.t === "num" || last.t === "rp");
    var canNum = !last || last.t === "op" || last.t === "lp";

    // 数字牌
    cardsEl.querySelectorAll(".card").forEach(function (btn) {
      var v = Number(btn.dataset.value);
      var usable = remaining[v] > 0;
      btn.classList.toggle("used", !usable);
      btn.classList.remove("pop");
      btn.disabled = !usable || !canNum;
    });

    // 运算符、括号、退格、清除
    document.querySelectorAll(".op-btn").forEach(function (btn) {
      if (btn.id === "back" || btn.id === "clear") { btn.disabled = tokens.length === 0; return; }
      if (btn.dataset.op) { btn.disabled = !lastIsValue; return; }
      if (btn.dataset.paren === "(") {
        btn.disabled = !(tokens.length === 0 || last.t === "op" || last.t === "lp");
        return;
      }
      if (btn.dataset.paren === ")") {
        btn.disabled = !(lastIsValue && parenBalance() > 0);
        return;
      }
    });
  }

  function updateHud() {
    roundEl.textContent = round;
    solvedEl.textContent = solved;
    leftEl.textContent = countUnused();
  }

  function updatePreview() {
    if (!tokens.length) {
      previewEl.textContent = "";
      previewEl.className = "preview";
      return;
    }
    var usageErr = validateUsage();
    var result = null, parseErr = null;
    try { result = parseTokens(tokens); } catch (e) { parseErr = e.message; }

    if (parseErr) { previewEl.textContent = "…"; previewEl.className = "preview"; return; }

    if (usageErr) {
      previewEl.textContent = "= " + fracToText(result) + "（还差 " + countUnused() + " 张牌）";
      previewEl.className = "preview bad";
      return;
    }
    var ok = isFracInt(result) && result.n === TARGET;
    previewEl.textContent = "= " + fracToText(result);
    previewEl.className = "preview" + (ok ? " ok" : "");
  }

  function setMsg(text, cls) {
    msgEl.textContent = text;
    msgEl.className = "msg" + (cls ? " " + cls : "");
  }

  function showModal() { winModal.classList.add("show"); }
  function hideModal() { winModal.classList.remove("show"); }

  /* ---------- 输入操作 ---------- */
  function appendToken(tok) {
    tokens.push(tok);
    if (tok.t === "num") remaining[tok.v]--;
    renderCards();
    renderExpr();
    updatePadState();
    updateHud();
    updatePreview();
  }

  // 能不能再放一个数字（当前 token 末尾必须是 运算符 或 左括号）
  function canPlaceNum() {
    var last = tokens[tokens.length - 1];
    return !last || last.t === "op" || last.t === "lp";
  }

  function placeValue(v) {
    if (!(remaining[v] > 0) || !canPlaceNum()) return;
    appendToken({ t: "num", v: v });
    popCard(v);
  }

  // 给刚用掉的牌一个高亮脉冲
  function popCard(v) {
    var btns = cardsEl.querySelectorAll('.card[data-value="' + v + '"]');
    btns.forEach(function (b) { if (!b.disabled) return; b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); });
  }

  function appendOp(op) {
    var last = tokens[tokens.length - 1];
    if (!(last && (last.t === "num" || last.t === "rp"))) return;
    appendToken({ t: "op", op: op });
  }

  function appendParen(p) {
    var last = tokens[tokens.length - 1];
    if (p === "(") {
      if (!(tokens.length === 0 || last.t === "op" || last.t === "lp")) return;
      appendToken({ t: "lp" });
    } else {
      if (!(last && (last.t === "num" || last.t === "rp") && parenBalance() > 0)) return;
      appendToken({ t: "rp" });
    }
  }

  function backspace() {
    var last = tokens.pop();
    if (last && last.t === "num") remaining[last.v]++;
    renderCards();
    renderExpr();
    updatePadState();
    updateHud();
    updatePreview();
  }

  function clearExpr() {
    tokens.forEach(function (t) { if (t.t === "num") remaining[t.v]++; });
    tokens = [];
    renderCards();
    renderExpr();
    updatePadState();
    updateHud();
    updatePreview();
  }

  /* ---------- 计算 / 验证 ---------- */
  function check() {
    if (!tokens.length) { setMsg("请先拼出算式", "lose"); return; }

    var usageErr = validateUsage();
    if (usageErr) { setMsg("⚠ " + usageErr, "lose"); return; }

    var result;
    try {
      result = parseTokens(tokens);
    } catch (e) {
      setMsg("⚠ " + e.message, "lose");
      return;
    }

    if (isFracInt(result) && result.n === TARGET) {
      solved++;
      solvedEl.textContent = solved;
      setMsg("🎉 恭喜，凑出 24！", "win");
      winText.textContent = "算式：" + renderExprString() + " = 24";
      showModal();
    } else {
      setMsg("结果为 " + fracToText(result) + "，不等于 24，再试试", "lose");
    }
  }

  /* ---------- 提示 ---------- */
  function showHint() {
    if (!hasSolution || !solvedExpr) {
      setMsg("这组牌似乎无解，试试「新牌局」", "lose");
      return;
    }
    setMsg("💡 一个解：" + solvedExpr, "tips");
  }

  /* ---------- 关卡流 ---------- */
  function newRound(increment) {
    if (increment) round++;
    roundEl.textContent = round;
    deal();
  }

  function restart() {
    round = 1;
    solved = 0;
    deal();
  }

  /* ---------- 键盘 ---------- */
  function handleKey(e) {
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
    var k = e.key;

    if (/^[1-9]$/.test(k)) { e.preventDefault(); placeValue(Number(k)); return; }
    if (k === "+" || k === "-") { e.preventDefault(); appendOp(k === "+" ? "+" : "-"); return; }
    if (k === "*" || k === "/") { e.preventDefault(); appendOp(k === "*" ? "*" : "/"); return; }
    if (k === "(") { e.preventDefault(); appendParen("("); return; }
    if (k === ")") { e.preventDefault(); appendParen(")"); return; }
    if (k === "Enter") { e.preventDefault(); check(); return; }
    if (k === "Backspace") { e.preventDefault(); backspace(); return; }

    var lower = (k || "").toLowerCase();
    if (lower === "n") { e.preventDefault(); newRound(true); return; }
    if (lower === "h") { e.preventDefault(); showHint(); return; }
    if (lower === "c") { e.preventDefault(); clearExpr(); return; }
  }

  /* ---------- 事件绑定 ---------- */
  document.getElementById("check").addEventListener("click", check);
  document.getElementById("newRound").addEventListener("click", function () { newRound(true); });
  document.getElementById("hint").addEventListener("click", showHint);
  document.getElementById("restart").addEventListener("click", restart);
  document.getElementById("winNext").addEventListener("click", function () { hideModal(); newRound(true); });
  document.getElementById("winClose").addEventListener("click", hideModal);
  winModal.addEventListener("click", function (e) { if (e.target === winModal) hideModal(); });

  document.getElementById("opPad").addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    if (btn.id === "back") { backspace(); return; }
    if (btn.id === "clear") { clearExpr(); return; }
    if (btn.dataset.op) { appendOp(btn.dataset.op); return; }
    if (btn.dataset.paren) { appendParen(btn.dataset.paren); return; }
  });

  document.addEventListener("keydown", handleKey);

  /* ---------- 启动 ---------- */
  restart();
})();
