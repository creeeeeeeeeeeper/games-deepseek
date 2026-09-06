// ============================================================
// 小游戏大全 · 首页数据 & 渲染（HTML / CSS / JS 分离）
// ------------------------------------------------------------
// 卡片结构 = 封面图 + 名称 + 简介：
//   · 封面：优先读取 assets/covers/<slug>.png（真实截图，放入即自动生效）；
//     没有截图时自动生成一张渐变色占位封面，不影响整体美观。
//   · slug 对应 games/<slug>/ 目录下的 index.html / style.css / script.js。
//   · 53 款游戏已全部收录完成（built: true），可直接点击游玩。
// ============================================================

// ---- 分类 & 游戏数据（53 款 / 6 大分类，全部已收录）----
const CATEGORIES = [
  {
    key: "puzzle", name: "经典益智", color: "#e6a33e",
    games: [
      { slug: "2048",             name: "2048",       emoji: "🧮", desc: "滑动方块，合并数字冲击 2048", built: true },
      { slug: "minesweeper",      name: "扫雷",       emoji: "💣", desc: "推理地雷位置，避开所有雷区", built: true },
      { slug: "sudoku",           name: "数独",       emoji: "9️⃣", desc: "经典 9x9 数独推理填数",        built: true },
      { slug: "guess-number",     name: "猜数字",     emoji: "❓", desc: "1-100 猜中随机数字",          built: true },
      { slug: "hanoi",            name: "汉诺塔",     emoji: "🗼", desc: "移动圆盘，完成经典递归挑战", built: true },
      { slug: "game-24",          name: "24点",       emoji: "🃏", desc: "用四张牌算出 24",             built: true },
      { slug: "huarong",          name: "华容道",     emoji: "🚪", desc: "移动方块让曹操逃出关口",     built: true },
      { slug: "link-link",        name: "连连看",     emoji: "🔗", desc: "连接两个相同图案并消除",     built: true },
      { slug: "tic-tac-toe",      name: "井字棋",     emoji: "⭕", desc: "三子连线，挑战简单 AI",       built: true },
      { slug: "number-puzzle",    name: "数字拼图",   emoji: "🔢", desc: "滑动数字块还原 4x4 拼图",    built: true },
      { slug: "mastermind",       name: "珠玑猜色",   emoji: "🎨", desc: "猜出隐藏的颜色序列",         built: true },
      { slug: "word-search",      name: "找单词",     emoji: "🔍", desc: "在字母矩阵中找出隐藏单词",   built: true },
      { slug: "fox-goat-cabbage", name: "农夫过河",   emoji: "🚣", desc: "巧渡狼羊菜，考验逻辑推理",   built: true },
      { slug: "lights-out",      name: "灭灯",       emoji: "💡", desc: "翻转十字灯阵，全部熄灭",     built: true, alias: "lights out 灭灯 翻转" },
      { slug: "nonogram",        name: "数织",       emoji: "🧩", desc: "按行列数字提示涂出像素画",   built: true, alias: "nonogram 数织 picross 图谜" },
      { slug: "set-card",        name: "找集合",     emoji: "🃏", desc: "在卡牌中找出一个 Set 集合",  built: true, alias: "set 集合 找三张 逻辑" },
    ],
  },
  {
    key: "arcade", name: "动作街机", color: "#f5633f",
    games: [
      { slug: "snake",            name: "贪吃蛇",     emoji: "🐍", desc: "吃食物变长，躲避自己和墙壁", built: true },
      { slug: "tetris",           name: "俄罗斯方块", emoji: "🧱", desc: "经典堆叠消除，挑战最高分", built: true },
      { slug: "breakout",         name: "打砖块",     emoji: "🧨", desc: "挡板弹球，击碎所有砖块",     built: true },
      { slug: "pong",             name: "乒乓球",     emoji: "🏓", desc: "双人对战经典乒乓",           built: true },
      { slug: "space-invaders",   name: "太空入侵者", emoji: "👾", desc: "驾驶战机消灭外星入侵者",     built: true },
      { slug: "frogger",          name: "青蛙过河",   emoji: "🐸", desc: "穿越车流与河流到达对岸",     built: true },
      { slug: "doodle-jump",      name: "涂鸦跳跃",   emoji: "🖍️", desc: "不断向上跳跃，别掉下去",    built: true },
      { slug: "whack-a-mole",     name: "打地鼠",     emoji: "🔨", desc: "地鼠冒头就打，越快越好",     built: true },
      { slug: "flappy-bird",      name: "飞扬的小鸟", emoji: "🐤", desc: "点击跳跃，穿越管道",         built: true },
      { slug: "asteroids",        name: "小行星",     emoji: "☄️", desc: "驾驶飞船击碎来袭小行星",    built: true },
      { slug: "dino-run",         name: "恐龙跑酷",   emoji: "🦖", desc: "跳跃躲避障碍的跑酷游戏",     built: true },
      { slug: "piano-tiles",      name: "钢琴块",     emoji: "🎹", desc: "跟随节奏点击黑色方块",       built: true },
      { slug: "fruit-ninja",      name: "水果忍者",   emoji: "🍉", desc: "挥砍水果，别切到炸弹",       built: true },
      { slug: "pop-balloon",      name: "扎气球",     emoji: "🎈", desc: "点击气球，限时得高分",       built: true },
      { slug: "space-shooter",    name: "太空射击",   emoji: "🚀", desc: "移动战机消灭敌人",           built: true },
      { slug: "math-speed",       name: "数学速算",   emoji: "➗", desc: "限时口算挑战",               built: true },
      { slug: "reaction-test",    name: "反应测试",   emoji: "⚡", desc: "看谁反应最快",               built: true },
      { slug: "archery",         name: "神射手",     emoji: "🏹", desc: "蓄力拉弓射箭，射中靶心",       built: true, alias: "shield 射箭 archery 弓箭" },
    ],
  },
  {
    key: "casual", name: "休闲娱乐", color: "#86b23c",
    games: [
      { slug: "bubble-shooter",   name: "泡泡射手",   emoji: "🫧", desc: "发射泡泡，三连消除",         built: true },
      { slug: "catch-apple",      name: "接苹果",     emoji: "🍎", desc: "移动篮子接住掉落的苹果",     built: true },
      { slug: "catch-coins",      name: "接金币",     emoji: "🪙", desc: "接住金币，避开炸弹",         built: true },
      { slug: "memory-flip",      name: "记忆翻牌",   emoji: "🎴", desc: "翻牌配对，考验记忆力",       built: true },
      { slug: "simon-says",       name: "西蒙记忆",   emoji: "🎵", desc: "记住并复现灯光序列",         built: true },
      { slug: "slot-machine",     name: "老虎机",     emoji: "🎰", desc: "拉动拉杆，幸运三连",         built: true },
      { slug: "spot-difference",  name: "找不同",     emoji: "🔎", desc: "找出两图中的不同之处",       built: true },
      { slug: "tower-stack",      name: "叠塔",       emoji: "🏗️", desc: "稳准放置方块叠起高塔",      built: true },
      { slug: "typing-game",      name: "打字游戏",   emoji: "⌨️", desc: "快速敲击下落的字母",        built: true },
      { slug: "match-3",          name: "宝石消消乐", emoji: "💎", desc: "交换宝石三连消，连锁冲高分", built: true, alias: "match 消消乐 三消 宝石" },
      { slug: "cookie-clicker",   name: "点饼干",     emoji: "🍪", desc: "疯狂点饼干，攒钱升装备",     built: true, alias: "cookie clicker 点饼干 挂机" },
      { slug: "pet-feed",         name: "喂宠物",     emoji: "🐹", desc: "喂食玩耍，养好一只仓鼠",     built: true, alias: "pet 喂宠物 仓鼠 养成" },
      { slug: "flower-garden",    name: "种花",       emoji: "🌻", desc: "种花浇水收获，经营花园",     built: true, alias: "flower 种花 花园 养花" },
      { slug: "koi-pond",         name: "锦鲤池",     emoji: "🐟", desc: "撒鱼食引来锦鲤，聚群得分",   built: true, alias: "koi 锦鲤 鱼池 投喂" },
    ],
  },
  {
    key: "race", name: "竞速冒险", color: "#2aa6ad",
    games: [
      { slug: "mini-racer",       name: "极简赛车",   emoji: "🏎️", desc: "躲避车流，极速前进",        built: true },
      { slug: "maze",             name: "迷宫",       emoji: "🌀", desc: "走出随机生成的迷宫",         built: true },
      { slug: "tower-defense",    name: "塔防",       emoji: "🏰", desc: "布置炮塔，阻挡怪物进攻",     built: true },
      { slug: "treasure-hunt",    name: "寻宝探险",   emoji: "💎", desc: "翻开格子，避开地雷寻宝",     built: true },
      { slug: "bunny-hop",        name: "跳跳兔",     emoji: "🐰", desc: "长按蓄力向前跳，别踩空",     built: true, alias: "rabbit 兔子 跳跃 跳" },
      { slug: "ski-slope",        name: "滑雪大冒险", emoji: "⛷️", desc: "三车道变道，躲障碍吃星星",   built: true, alias: "ski 滑雪 雪坡" },
      { slug: "rock-climb",       name: "攀岩",       emoji: "🧗", desc: "点击岩点向上爬，回体力",     built: true, alias: "climb 爬山 攀岩" },
      { slug: "moto-jump",        name: "摩托飞跃",   emoji: "🏍️", desc: "加速冲坡台，腾空做空翻",     built: true, alias: "moto 摩托 飞跃 空翻" },
      { slug: "river-raft",       name: "激流勇进",   emoji: "🛶", desc: "顺流躲避礁石，吃浮标",       built: true, alias: "raft 漂流 激流" },
      { slug: "surf",             name: "冲浪高手",   emoji: "🏄", desc: "站在浪尖保持平衡",           built: true, alias: "surf 冲浪 浪尖" },
      { slug: "hover-car",        name: "悬浮赛车",   emoji: "🛸", desc: "悬浮车躲障碍，越开越快",     built: true, alias: "hover 悬浮车 赛车 开车" },
      { slug: "jetpack",          name: "喷气背包",   emoji: "🚀", desc: "按住飞升，穿柱隙飞更远",     built: true, alias: "jetpack 喷气 背包 飞行" },
      { slug: "submarine",        name: "深海潜艇",   emoji: "🛥️", desc: "潜航躲水雷，吃氧气瓶",       built: true, alias: "submarine 潜艇 潜水 深海" },
      { slug: "glider",           name: "滑翔伞",     emoji: "🪂", desc: "借热流爬升，穿环躲飞鸟",     built: true, alias: "glider 滑翔 伞 热流" },
    ],
  },
  {
    key: "board", name: "棋牌对战", color: "#d04b2f",
    games: [
      { slug: "gomoku",             name: "五子棋",     emoji: "⚪", desc: "五子连珠，人机对战",       built: true },
      { slug: "connect-four",       name: "四子棋",     emoji: "🟡", desc: "竖直四子连线获胜",         built: true },
      { slug: "checkers",           name: "跳棋",       emoji: "🔴", desc: "国际跳棋简化对战",         built: true },
      { slug: "blackjack",          name: "21点",       emoji: "♠️", desc: "比点数更接近 21 点",        built: true },
      { slug: "battleship",         name: "海战棋",     emoji: "⚓", desc: "布阵击沉对手舰队",         built: true },
      { slug: "rock-paper-scissors", name: "石头剪刀布", emoji: "🪨", desc: "经典猜拳人机对战",         built: true },
      { slug: "nim-game",         name: "尼姆博弈",   emoji: "🧮", desc: "取火柴博弈，取走最后一根输", built: true, alias: "nim 火柴 尼姆" },
      { slug: "old-maid",         name: "抽乌龟",     emoji: "🐢", desc: "抽牌配对，最后持龟者输",     built: true, alias: "old maid 乌龟 抽牌" },
      { slug: "mancala",          name: "播棋",       emoji: "🪨", desc: "取子播种，仓库多子者胜",     built: true, alias: "kalah 播棋 取子" },
      { slug: "bingo",            name: "宾果",       emoji: "🔢", desc: "数字卡报数，先连一条线赢",  built: true, alias: "bingo 宾果 连百" },
      { slug: "dots-and-boxes",   name: "方格连线",   emoji: "✏️", desc: "画线围方格，多者胜",         built: true, alias: "dots 方格 连线 圈地" },
      { slug: "baccarat",         name: "百家乐",     emoji: "🎴", desc: "押注比点数个位，运气说话",   built: true, alias: "baccarat 百家乐 押注" },
      { slug: "memory-duel",      name: "记忆对战",   emoji: "🧠", desc: "翻卡配对，和 AI 抢分",       built: true, alias: "memory 记忆 翻牌 对战" },
      { slug: "hex",              name: "六角棋",     emoji: "⬡", desc: "六边形连通棋，堵路取胜",     built: true, alias: "hex 六角 连通 棋" },
    ],
  },
  {
    key: "classic", name: "经典桌游", color: "#e2c266",
    games: [
      { slug: "hangman",        name: "猜单词",       emoji: "🪢", desc: "猜字母，拯救小人",           built: true, alias: "hangman 刽子手" },
      { slug: "snake-ladder",   name: "蛇梯棋",       emoji: "🎲", desc: "掷骰前进，攀梯避蛇",         built: true, alias: "飞行棋 蛇梯" },
      { slug: "wordle",         name: "Wordle 猜词",  emoji: "🟩", desc: "六次机会猜出五个字母单词",  built: true, alias: "wordle 猜词 单词" },
      { slug: "dice-duel",      name: "骰子对决",     emoji: "🎲", desc: "双方滚骰比点，三局两胜",       built: true, alias: "dice 骰子 对决" },
      { slug: "dice-size",      name: "骰子比大小",   emoji: "🎲", desc: "押大押小，猜对骰面就赢",       built: true, alias: "dice 骰子 大小" },
      { slug: "card-war",       name: "战争卡牌",     emoji: "🃏", desc: "翻牌比大小，赢牌抢走对方的牌",  built: true, alias: "card 卡牌 战争" },
      { slug: "yahtzee-lite",   name: "快意骰",       emoji: "🎯", desc: "十轮滚骰，凑组合拿高分",       built: true, alias: "yahtzee 骰子 快意" },
      { slug: "pig-dice",       name: "贪心骰",       emoji: "🐷", desc: "继续滚还是落袋，别贪过头",     built: true, alias: "pig 贪心 骰子" },
      { slug: "dice-blackjack", name: "骰子21点",     emoji: "♠️", desc: "滚骰凑点，越接近21点越好",     built: true, alias: "dice 21点 黑杰克" },
      { slug: "take-ten",       name: "凑十",         emoji: "🔟", desc: "挑牌配成十，清空整堆牌",       built: true, alias: "ten 凑十 10" },
      { slug: "reversi-lite",   name: "黑白棋",       emoji: "⚫", desc: "夹住翻转，占最多的棋盘",        built: true, alias: "reversi 奥赛罗 黑白棋" },
      { slug: "double-up",      name: "翻倍大作战",   emoji: "💰", desc: "押上筹码，猜中点数就翻倍",     built: true, alias: "double 翻倍 押注" },
      { slug: "domino-lite",    name: "骨牌接龙",     emoji: "🁫", desc: "骨牌两端配对，接成整条龙",     built: true, alias: "domino 骨牌 接龙" },
      { slug: "mahjong-solitaire", name: "麻将消消",   emoji: "🀄", desc: "配对消除自由麻将牌",         built: true, alias: "mahjong 麻将 消消 配对" },
      { slug: "clock-solitaire",   name: "时钟接龙",   emoji: "🕐", desc: "按钟点抽牌接龙，避开紫K",    built: true, alias: "clock 时钟 接龙 纸牌" },
      { slug: "monte",             name: "三张牌",     emoji: "🃏", desc: "盯住皇后，洗牌后再猜",       built: true, alias: "monte 三张牌 皇后 洗牌" },
    ],
  },
  {
    key: "lab", name: "整活实验室", color: "#cf8b2d",
    games: [
      { slug: "magnet-stars",   name: "磁吸星辰",   emoji: "🧲", desc: "按住屏幕吸附星辰送入采集槽，金色+5、黑洞-3", built: true },
      { slug: "pan-flip",       name: "翻煎饼",     emoji: "🥞", desc: "按住蓄力甩起煎饼，金黄面朝上才成功", built: true },
      { slug: "inflate",        name: "软糖充气",   emoji: "🍬", desc: "按住充气变大松开缩小，挤过越来越窄的缺口", built: true },
      { slug: "balloon-tug",    name: "拔河气球",   emoji: "🎈", desc: "按住给气球打气，先过中线者赢（人机对拉）", built: true },
      { slug: "timing-catch",   name: "时机捕手",   emoji: "🎯", desc: "趁游标扫进绿区的瞬间按下定格，越准分越高", built: true },
      { slug: "keep-up",        name: "别让它落地", emoji: "🏀", desc: "点按顶起小球，躲开下压的尖刺撑得更久", built: true },
      { slug: "shadow-chase",   name: "追光人",     emoji: "🔦", desc: "移动手电光点亮会逃跑的萤火虫", built: true },
      { slug: "gravity-flip",   name: "重力翻面",   emoji: "🪐", desc: "点按翻转重力，贴着缺口一侧过闸门", built: true },
    ],
  },
];

// 已收录游戏总数（100）
const TOTAL = CATEGORIES.reduce((n, c) => n + c.games.length, 0);
const READY_COUNT = CATEGORIES.reduce((n, c) => n + c.games.filter((g) => g.built).length, 0);

// ============================================================
// 中英文切换（本地保存，默认中文）
// ============================================================
const EN = {
  cats: {
    puzzle: "Classic Puzzles",
    arcade: "Arcade Action",
    casual: "Casual",
    race: "Racing & Adventure",
    board: "Board & Card",
    classic: "Tabletop Classics",
    lab: "Quirky Lab",
  },
  games: {
    "2048": ["2048", "Slide & merge tiles to reach 2048"],
    "minesweeper": ["Minesweeper", "Deduce mines & clear them all"],
    "sudoku": ["Sudoku", "Classic 9x9 logic fill-in"],
    "guess-number": ["Number Guess", "Guess the random number from 1-100"],
    "hanoi": ["Tower of Hanoi", "Move the disks, classic recursion"],
    "game-24": ["24 Game", "Use four cards to make 24"],
    "huarong": ["Huarong Dao", "Slide blocks to free the general"],
    "link-link": ["Link Link", "Connect matching pairs to clear"],
    "tic-tac-toe": ["Tic-Tac-Toe", "Line up three, beat a simple AI"],
    "number-puzzle": ["15 Puzzle", "Slide the numbers to restore 4x4"],
    "mastermind": ["Mastermind", "Deduce the hidden color code"],
    "word-search": ["Word Search", "Find hidden words in the grid"],
    "fox-goat-cabbage": ["River Crossing", "Get the wolf, goat & cabbage across"],
    "snake": ["Snake", "Eat, grow long, avoid the walls"],
    "tetris": ["Tetris", "Stack & clear lines for a high score"],
    "breakout": ["Breakout", "Bounce the ball, smash all bricks"],
    "pong": ["Pong", "Classic two-paddle duel"],
    "space-invaders": ["Space Invaders", "Blast the invading aliens"],
    "frogger": ["Frogger", "Cross traffic & the river alive"],
    "doodle-jump": ["Doodle Jump", "Keep bouncing upward, don't fall"],
    "whack-a-mole": ["Whack-a-Mole", "Whack the moles, fast as you can"],
    "flappy-bird": ["Flappy Bird", "Tap to flap through the pipes"],
    "asteroids": ["Asteroids", "Shoot the drifting asteroids"],
    "dino-run": ["Dino Run", "Jump the obstacles, endless runner"],
    "piano-tiles": ["Piano Tiles", "Tap the black tiles to the beat"],
    "fruit-ninja": ["Fruit Ninja", "Slice fruit, never hit the bomb"],
    "pop-balloon": ["Balloon Pop", "Pop balloons fast for points"],
    "space-shooter": ["Space Shooter", "Move & shoot down enemies"],
    "math-speed": ["Math Sprint", "Beat the clock on quick arithmetic"],
    "reaction-test": ["Reaction Test", "How fast are your reflexes?"],
    "bubble-shooter": ["Bubble Shooter", "Shoot bubbles, match 3 to pop"],
    "catch-apple": ["Catch Apples", "Move the basket to catch apples"],
    "catch-coins": ["Catch Coins", "Grab coins, dodge the bombs"],
    "memory-flip": ["Memory Flip", "Flip cards to find matching pairs"],
    "simon-says": ["Simon", "Repeat the light sequence"],
    "slot-machine": ["Slots", "Pull the lever, line them up"],
    "spot-difference": ["Spot the Difference", "Find the differences between two images"],
    "tower-stack": ["Tower Stack", "Stack the blocks level and high"],
    "typing-game": ["Typing Blast", "Type the falling letters fast"],
    "mini-racer": ["Mini Racer", "Dodge traffic, speed ahead"],
    "maze": ["Maze", "Escape the random maze"],
    "tower-defense": ["Tower Defense", "Build turrets to stop the monsters"],
    "treasure-hunt": ["Treasure Hunt", "Reveal tiles, avoid the mines"],
    "gomoku": ["Gomoku", "Five in a row vs the AI"],
    "connect-four": ["Connect Four", "Connect four vertically to win"],
    "checkers": ["Checkers", "Simplified draughts duel"],
    "blackjack": ["Blackjack", "Closest to 21 without going over"],
    "battleship": ["Battleship", "Deploy & sink the enemy fleet"],
    "rock-paper-scissors": ["Rock-Paper-Scissors", "Classic three-way duel"],
    "hangman": ["Hangman", "Guess the letters to save the man"],
    "snake-ladder": ["Snakes & Ladders", "Roll dice, climb ladders, dodge snakes"],
    "wordle": ["Wordle", "Guess the five-letter word in six tries"],
    "magnet-stars": ["Magnetic Stardust", "Hold to attract stars into the collector; gold +5, black hole -3"],
    "pan-flip": ["Pancake Flip", "Charge and flip; land golden-side up to score"],
    "inflate": ["Gummy Inflate", "Hold to inflate, release to shrink, squeeze through the gaps"],
    "balloon-tug": ["Balloon Tug", "Hold to blow your balloon across the line (vs AI)"],
    "timing-catch": ["Timing Catch", "Tap when the cursor sweeps into the green zone; closer is better"],
    "keep-up": ["Don't Let It Drop", "Tap to bounce the ball, dodge the descending spikes"],
    "shadow-chase": ["Light Chaser", "Chase the fleeing fireflies with your flashlight"],
    "gravity-flip": ["Gravity Flip", "Tap to flip gravity and pass the gate on the gap side"],
    "dice-duel": ["Dice Duel", "Roll dice and compare; best of three"],
    "dice-size": ["Dice Over-Under", "Bet big or small; guess the dice face"],
    "card-war": ["Card War", "Flip the higher card to win both"],
    "yahtzee-lite": ["Blitz Yacht", "Roll dice over ten rounds to collect combos"],
    "pig-dice": ["Greedy Pig", "Roll or bank; don't get too greedy"],
    "dice-blackjack": ["Dice 21", "Roll dice to get as close to 21 as you can"],
    "take-ten": ["Make Ten", "Pick cards that pair up to ten, clear the pile"],
    "reversi-lite": ["Reversi Lite", "Flip tiles by trapping; own the most"],
    "double-up": ["Double Up", "Bet chips and double them on a correct guess"],
    "domino-lite": ["Domino Chain", "Match the domino ends into one long chain"],
    "match-3": ["Gem Match", "Swap gems to match three and chain combos"],
    "bunny-hop": ["Bunny Hop", "Charge and hop forward without falling"],
    "ski-slope": ["Ski Slalom", "Change lanes, dodge obstacles, grab stars"],
    "rock-climb": ["Rock Climb", "Tap holds to climb up and recover stamina"],
    "moto-jump": ["Moto Jump", "Boost over ramps and spin in the air"],
    "river-raft": ["River Raft", "Drift down dodging rocks and collect buoys"],
    "surf": ["Surf Rider", "Stay on the wave crest and keep your balance"],
    "nim-game": ["Nim", "Take matches; the one who takes the last loses"],
    "old-maid": ["Old Maid", "Draw cards, match pairs; whoever holds the turtle loses"],
    "mancala": ["Mancala", "Sow stones; the one with the most in the store wins"],
    "bingo": ["Bingo", "Call numbers and be first to make a line"],
    "lights-out": ["Lights Out", "Flip the cross of lights; turn them all off"],
    "nonogram": ["Nonogram", "Fill cells by the row and column clues"],
    "set-card": ["Set", "Find three cards that form a set"],
    "archery": ["Archery", "Charge and shoot; hit the bullseye for max points"],
    "cookie-clicker": ["Cookie Clicker", "Click cookies, buy upgrades, reach 10,000"],
    "pet-feed": ["Pet Feed", "Feed and play with a hamster to keep it happy"],
    "flower-garden": ["Flower Garden", "Plant, water and harvest to earn coins"],
    "koi-pond": ["Koi Pond", "Feed the pond to gather koi and score"],
    "hover-car": ["Hover Car", "Lane-dodge obstacles and speed up"],
    "jetpack": ["Jetpack", "Hold to rise, dodge pillars, fly far"],
    "submarine": ["Submarine", "Dive and dodge mines, grab oxygen"],
    "glider": ["Glider", "Ride thermals, pass rings, dodge birds"],
    "dots-and-boxes": ["Dots & Boxes", "Draw lines to claim squares; most wins"],
    "baccarat": ["Baccarat", "Bet on player, banker or tie; closest to 9 wins"],
    "memory-duel": ["Memory Duel", "Flip cards to match pairs against the AI"],
    "hex": ["Hex", "Connect opposite sides on a hexagonal board"],
    "mahjong-solitaire": ["Mahjong Solitaire", "Match free tiles to clear the board"],
    "clock-solitaire": ["Clock Solitaire", "Draw to the clock position; avoid the fourth king"],
    "monte": ["Three-Card Monte", "Track the queen while the cards are shuffled"],
  },
};

let LANG = "zh";

function tCat(cat) { return LANG === "en" && EN.cats[cat.key] ? EN.cats[cat.key] : cat.name; }
function tName(g) { return LANG === "en" && EN.games[g.slug] ? EN.games[g.slug][0] : g.name; }
function tDesc(g) { return LANG === "en" && EN.games[g.slug] ? EN.games[g.slug][1] : g.desc; }
function enFields(g) { return EN.games[g.slug] || ["", ""]; }

// ============================================================
// 小工具
// ============================================================

// 颜色混合：hex 与 target(hex) 按 t∈[0,1] 混合，返回 rgb() 字符串
function mix(hex, target, t) {
  const p = (h) => {
    h = h.replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const a = p(hex), b = p(target);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
}

// 由分类色生成卡片封面渐变
function coverGradient(color) {
  return `linear-gradient(140deg, ${mix(color, "#ffffff", 0.45)} 0%, ${color} 50%, ${mix(color, "#000000", 0.55)} 130%)`;
}

// 探测某个游戏目录是否已存在（仅在 http/https 下有效，file:// 直接返回 false）
async function pageExists(slug) {
  if (!/^https?:$/.test(location.protocol)) return false;
  try {
    const res = await fetch(`games/${slug}/index.html`, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// ============================================================
// 渲染
// ============================================================

const container = document.getElementById("categoryContainer");
const emptyTip = document.getElementById("emptyTip");
const searchInput = document.getElementById("searchInput");
const navBox = document.getElementById("categoryNav");

const sectionIds = {};      // key -> section 元素（每次渲染后重建）
const pendingProbes = [];   // 需要探测的卡片（全部已收录后为空）

function matchQuery(g, q) {
  if (!q) return true;
  return [g.name, g.slug, g.desc, g.alias || ""].some((s) =>
    s.toLowerCase().includes(q.toLowerCase())
  );
}

function buildNav() {
  navBox.innerHTML = "";
  CATEGORIES.forEach((cat, i) => {
    const chip = document.createElement("a");
    chip.className = "cat-chip";
    chip.href = `#cat-${cat.key}`;
    chip.style.setProperty("--cat", cat.color);
    chip.style.animationDelay = `${i * 45}ms`;
    chip.dataset.key = cat.key;
    chip.innerHTML = `
      <span class="cat-dot"></span>
      <span class="cat-name">${tCat(cat)}</span>
      <em class="cat-count">${cat.games.length}</em>
    `;
    navBox.appendChild(chip);
  });
}

function render() {
  container.innerHTML = "";
  pendingProbes.length = 0;
  // 每次重建区块集合，丢弃上一轮的节点引用，避免滚动判定读到已脱离文档的旧区块
  for (const k in sectionIds) delete sectionIds[k];
  const q = searchInput.value.trim().toLowerCase();

  let shown = 0;

  CATEGORIES.forEach((cat, idx) => {
    const items = cat.games.filter((g) => matchQuery(g, q));
    if (!items.length) return;
    shown += items.length;

    const section = document.createElement("section");
    section.className = "category";
    section.id = `cat-${cat.key}`;
    section.style.setProperty("--cat", cat.color);
    sectionIds[cat.key] = section;

    const head = document.createElement("div");
    head.className = "category-head";
    head.setAttribute("data-ghost", String(idx + 1).padStart(2, "0"));
    head.innerHTML = `
      <span class="category-flag"></span>
      <h2 class="category-title">${tCat(cat)}</h2>
      <span class="category-count">${items.length} 款</span>
    `;
    section.appendChild(head);

    const grid = document.createElement("div");
    grid.className = "grid";

    items.forEach((g) => {
      const card = document.createElement("a");
      card.className = "card";
      card.style.setProperty("--cat", cat.color);
      card.href = `games/${g.slug}/index.html`;

      card.innerHTML = `
        <div class="card-cover" style="background:${coverGradient(cat.color)}">
          <span class="cover-emoji" aria-hidden="true">${g.emoji}</span>
          <span class="cover-play" aria-hidden="true"></span>
        </div>
        <div class="card-body">
          <div class="card-name">${tName(g)}</div>
          <div class="card-desc">${tDesc(g)}</div>
        </div>
      `;
      grid.appendChild(card);

      // 封面截图：放入 assets/covers/<slug>.png 后自动展示，失败则保留占位封面
      const coverEl = card.querySelector(".card-cover");
      const img = new Image();
      img.className = "cover-img";
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("load", () => coverEl.classList.add("has-img"));
      img.src = `assets/covers/${g.slug}.png`;
      coverEl.appendChild(img);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });

  emptyTip.hidden = shown > 0;
  updateChips(q);
  updateActiveChip();
  stagger();
  revealAnimate();
}

function updateChips(q) {
  [...navBox.children].forEach((chip) => {
    const cat = CATEGORIES.find((c) => c.key === chip.dataset.key);
    const n = q ? cat.games.filter((g) => matchQuery(g, q)).length : cat.games.length;
    chip.querySelector(".cat-count").textContent = n;
    chip.classList.toggle("dim", n === 0);
  });
}

function updateActiveChip() {
  const mb = document.getElementById("menubar");
  if (!mb) return;
  // 菜单条顶线（贴顶时 = 当前滚动位置；未贴顶时 = 静态文档位置）
  const topDoc = mb.getBoundingClientRect().top + window.scrollY;

  // 规则：从第一个分类开始找——它的“整个区块还没被划出菜单上方”，就高亮它；
  // 即上一个分类整体被划走之后，立刻轮到下一个高亮。
  let activeKey = null;
  for (const cat of CATEGORIES) {
    const sec = sectionIds[cat.key];
    if (!sec || !sec.isConnected) continue;
    const bottomDoc = sec.getBoundingClientRect().bottom + window.scrollY;
    // 1px 容差：避免锚点 54px 恰好对齐时因亚像素残差误判为“上一个还没划走”
    if (bottomDoc > topDoc + 1) { activeKey = cat.key; break; }
  }
  if (!activeKey) {
    // 极端兜底：所有分类都被划走（页尾）时保持最后一个
    activeKey = CATEGORIES[CATEGORIES.length - 1].key;
  }
  [...navBox.children].forEach((chip) =>
    chip.classList.toggle("on", chip.dataset.key === activeKey)
  );
}

function stagger() {
  let i = 0;
  container.querySelectorAll(".card").forEach((card) => {
    card.style.animation = "fadeUp 0.3s cubic-bezier(0.9, 0, 0.1, 1) both";
    card.style.animationDelay = `${Math.min(i * 22, 380)}ms`;
    i++;
  });
}

// 分类区块滚动渐显（进入视口时浮现）
let revealIO = null;
function revealAnimate() {
  const fresh = Array.from(container.querySelectorAll(".category")).filter(
    (el) => !el.classList.contains("reveal-shown")
  );
  if (!("IntersectionObserver" in window)) {
    fresh.forEach((el) => el.classList.add("reveal-shown"));
    return;
  }
  if (revealIO) revealIO.disconnect();
  revealIO = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          en.target.classList.add("reveal-shown");
          revealIO.unobserve(en.target);
        }
      }
    },
    { threshold: 0.06, rootMargin: "0px 0px -40px 0px" }
  );
  fresh.forEach((el) => {
    el.classList.add("reveal");
    revealIO.observe(el);
  });
}

// ============================================================
// 事件
// ============================================================

searchInput.addEventListener("input", render);

const clearBtn = document.getElementById("clearBtn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchInput.focus();
    render();
  });
}

navBox.addEventListener("click", (e) => {
  const chip = e.target.closest(".cat-chip");
  if (!chip) return;
  const key = chip.dataset.key;
  const section = document.getElementById(`cat-${key}`);
  // 该分类当前没有结果时：先清空搜索再定位
  if (!section || chip.classList.contains("dim")) {
    if (searchInput.value) {
      searchInput.value = "";
      render();
    }
    const sec = document.getElementById(`cat-${key}`);
    if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  e.preventDefault();
  section.scrollIntoView({ behavior: "smooth", block: "start" });
});

emptyTip.querySelector("button").addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  render();
});

// ============================================================
// 计算彩蛋：一个真能算的"车间收款机"
// ============================================================
(function calcEgg() {
  const read = document.getElementById("calcRead");
  const keysEl = document.getElementById("calcKeys");
  const eggEl = document.getElementById("calcEgg");
  if (!read || !keysEl) return;

  // 触摸设备无 hover：点空白处切换彩蛋显隐
  if (eggEl) {
    eggEl.addEventListener("click", (e) => {
      if (!e.target.closest("button[data-k]")) eggEl.classList.toggle("open");
    });
  }

  let acc = null;        // 已输入的左操作数
  let op = null;         // '+ - × ÷'
  let cur = "0";
  let fresh = true;      // 刚输入完运算符，下一个数字要重开

  const ops = {
    "+": (a, b) => a + b,
    "−": (a, b) => a - b,
    "×": (a, b) => a * b,
    "÷": (a, b) => (b === 0 ? null : a / b),
  };

  function fmt(n) {
    const r = Math.round(n * 1e9) / 1e9;
    return String(r);
  }
  function show(v, err) {
    read.textContent = v;
    read.classList.toggle("err", !!err);
  }
  function boom() {
    acc = null; op = null; cur = "0"; fresh = true;
    show("除法不能碰 0，兄弟", true);
  }
  function resetAll() {
    acc = null; op = null; cur = "0"; fresh = true;
    show("0", false);
  }
  function evaluate() {
    if (acc === null || op === null) return null;
    const b = parseFloat(cur);
    const res = ops[op](acc, b);
    if (res === null) { boom(); return true; }
    cur = fmt(res);
    acc = null; op = null; fresh = true;
    show(cur, false);
    return true;
  }

  keysEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-k]");
    if (!btn) return;
    const k = btn.dataset.k;

    if (k === "C") { resetAll(); return; }
    if (k === "⌫") {
      if (read.classList.contains("err")) { resetAll(); return; }
      cur = cur.length > 1 ? cur.slice(0, -1) : "0";
      show(cur, false);
      return;
    }
    if (k === "=") { if (acc !== null && op !== null) evaluate(); return; }
    if (ops[k]) {
      if (read.classList.contains("err")) return;
      if (acc !== null && op !== null && !fresh) evaluate(); // 连续运算
      acc = parseFloat(cur);
      op = k;
      fresh = true;
      return;
    }
    // 数字 / 小数点
    if (read.classList.contains("err")) resetAll();
    if (fresh) { cur = k === "." ? "0." : k; fresh = false; }
    else if (k === ".") {
      if (cur.includes(".")) return;
      cur += ".";
    } else if (cur === "0") {
      cur = k;
    } else {
      if (cur.length >= 12) return;
      cur += k;
    }
    show(cur, false);
  });
})();

window.addEventListener("scroll", () => updateActiveChip(), { passive: true });
window.addEventListener("resize", () => updateActiveChip());

// ============================================================
// 启动
// ============================================================

document.getElementById("statTotal").textContent = TOTAL;
document.getElementById("statReady").textContent = READY_COUNT;

buildNav();
render();
