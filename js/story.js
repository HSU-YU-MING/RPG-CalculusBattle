/* ============================================================
   學分危機 — 劇情資料
   資料驅動的場景圖：每個場景用 id 索引。
   場景型別：
     - 一般旁白/對話：有 text，靠 next 前進（點擊繼續）
     - 選擇：有 choices[]，每個選項可給 points / item / flag
     - type:'exam'   考試場景（可用道具加分 + 答題）
     - type:'branch' 依分數分歧劇情
     - type:'save'   存檔點
     - type:'end'    進入結算
   ============================================================ */

const ITEMS = {
  notes:     { name: "學姐的微積分筆記", desc: "重點整理超清楚，考前使用 +12 分", bonus: 12, icon: "📓" },
  past_exam: { name: "歷年考古題",       desc: "題型命中率高，考前使用 +15 分",   bonus: 15, icon: "📄" },
  charm:     { name: "文昌帝君御守",     desc: "保佑金榜題名，考前使用 +5 分",     bonus: 5,  icon: "🧧" },
  energy:    { name: "能量飲料",         desc: "提神 +4 分，並消除 10 點熬夜疲勞", bonus: 4,  relief: 10, icon: "🥤" },
  coffee:    { name: "黑咖啡",           desc: "醒腦 +3 分，並消除 8 點熬夜疲勞",  bonus: 3,  relief: 8,  icon: "☕" },
  formula:   { name: "公式小抄",         desc: "作答時可揭曉某一題的公式提示", type: "hint", icon: "💡" },
};

// 開局發給玩家的完整「求生包」。道具不再從劇情取得，而是改由「何時、哪一場考試使用」來決定策略。
const STARTING_ITEMS = ["notes", "past_exam", "charm", "energy", "coffee", "formula"];

// 每場考試最多可使用的道具數量（含加分、消疲勞、公式小抄）。
const EXAM_ITEM_LIMIT = 2;

// 每題分數依難度而定（小考較好拿、期末較硬）。
const POINTS_BY_DIFFICULTY = { easy: 8, medium: 8, hard: 9 };

/* 題庫：依難度分組，考試時隨機抽題、選項也會打亂。
   easy=小考（極限與基本微分）／medium=期中（積分與微分技巧）／hard=期末（定積分、連鎖律、乘積律）。 */
const QUESTION_BANK = {
  easy: [
    { q: "lim(x→0) sin(x) / x = ？", opts: ["0", "1", "∞", "不存在"], answer: 1,
      hint: "著名極限：x→0 時 sin x 與 x 幾乎相等，比值趨近 1。" },
    { q: "d/dx ( x² ) = ？", opts: ["x", "2x", "x²", "2"], answer: 1,
      hint: "冪次規則：d/dx xⁿ = n·xⁿ⁻¹。" },
    { q: "d/dx ( 3x + 1 ) = ？", opts: ["3", "1", "3x", "0"], answer: 0,
      hint: "x 的係數保留，常數項微分後為 0。" },
    { q: "lim(x→2) (x² − 4)/(x − 2) = ？", opts: ["0", "2", "4", "不存在"], answer: 2,
      hint: "因式分解 x²−4=(x−2)(x+2)，約掉後代入 x=2。" },
    { q: "d/dx ( 5 ) = ？", opts: ["5", "1", "0", "x"], answer: 2,
      hint: "常數的微分恆為 0。" },
    { q: "d/dx ( x³ ) = ？", opts: ["3x²", "x²", "3x", "x⁴/4"], answer: 0,
      hint: "冪次規則：把指數 3 拉到前面，指數減 1。" },
    { q: "lim(x→3) ( x + 2 ) = ？", opts: ["3", "5", "2", "不存在"], answer: 1,
      hint: "連續函數直接代入 x=3。" },
    { q: "d/dx ( x ) = ？", opts: ["0", "x", "1", "2x"], answer: 2,
      hint: "x 的斜率固定為 1。" },
  ],
  medium: [
    { q: "∫ 2x dx = ？", opts: ["x² + C", "2 + C", "x + C", "2x² + C"], answer: 0,
      hint: "反冪次規則：∫xⁿ dx = xⁿ⁺¹/(n+1) + C。" },
    { q: "d/dx ( sin x ) = ？", opts: ["cos x", "−cos x", "−sin x", "tan x"], answer: 0,
      hint: "sin 的導數是 cos。" },
    { q: "d/dx ( eˣ ) = ？", opts: ["eˣ", "x·eˣ⁻¹", "1", "ln x"], answer: 0,
      hint: "eˣ 微分後仍是 eˣ。" },
    { q: "∫ 1 dx = ？", opts: ["x + C", "1 + C", "0", "C"], answer: 0,
      hint: "常數 1 的積分是 x（別忘了 +C）。" },
    { q: "d/dx ( cos x ) = ？", opts: ["sin x", "−sin x", "cos x", "−cos x"], answer: 1,
      hint: "cos 的導數是 −sin（注意負號）。" },
    { q: "∫ x² dx = ？", opts: ["x³/3 + C", "2x + C", "x³ + C", "3x² + C"], answer: 0,
      hint: "反冪次：指數 +1 再除以新指數。" },
    { q: "d/dx ( ln x ) = ？", opts: ["1/x", "ln x", "x", "−1/x²"], answer: 0,
      hint: "ln x 的導數是 1/x。" },
    { q: "∫ eˣ dx = ？", opts: ["eˣ + C", "x·eˣ + C", "eˣ⁺¹ + C", "ln x + C"], answer: 0,
      hint: "eˣ 積分後仍是 eˣ。" },
  ],
  hard: [
    { q: "∫₀¹ x dx = ？", opts: ["1", "1/2", "0", "2"], answer: 1,
      hint: "∫x dx = x²/2，代入上限 1、下限 0 相減。" },
    { q: "lim(x→∞) 1/x = ？", opts: ["∞", "1", "0", "−1"], answer: 2,
      hint: "分母越來越大，整體趨近 0。" },
    { q: "∫₀² 3 dx = ？", opts: ["3", "6", "2", "9"], answer: 1,
      hint: "常數定積分 = 常數 × 區間長度 = 3 × 2。" },
    { q: "d/dx ( x·eˣ ) = ？", opts: ["eˣ", "(1 + x)eˣ", "x·eˣ", "eˣ − x"], answer: 1,
      hint: "乘積律：(uv)' = u'v + uv' = eˣ + x·eˣ。" },
    { q: "∫₀^π sin x dx = ？", opts: ["0", "1", "2", "π"], answer: 2,
      hint: "∫sin x dx = −cos x，−cos π+cos 0 = 1+1 = 2。" },
    { q: "lim(x→0) (1 − cos x)/x = ？", opts: ["0", "1", "1/2", "∞"], answer: 0,
      hint: "分子比分母更快趨近 0，極限為 0。" },
    { q: "∫₁^e (1/x) dx = ？", opts: ["1", "e", "e − 1", "0"], answer: 0,
      hint: "∫(1/x)dx = ln x，ln e − ln 1 = 1 − 0 = 1。" },
    { q: "d/dx ( sin 2x ) = ？", opts: ["cos 2x", "2 cos 2x", "−2 cos 2x", "2 sin 2x"], answer: 1,
      hint: "連鎖律：外層 cos 2x 乘上內層導數 2。" },
  ],
};

const STORY = {
  meta: { course: "微積分", title: "駱是能重來" },

  start: "ch1_intro",

  scenes: {

  /* ================= 第一章 · 小考 ================= */
  ch1_intro: {
    chapter: 1, resetPrep: true, bg: "campus", img: "封面.webp", speaker: "旁白",
    text: "九月，大一上學期。你抱著「微積分應該還好吧」的天真想法走進校園。\n你不知道的是——這堂課的死當率，是全系第一。",
    next: "ch1_alarm",
  },
  ch1_alarm: {
    chapter: 1, bg: "dorm", img: "鬧鐘_0.webp", speaker: "鬧鐘",
    text: "嗶——嗶——嗶——！早上 7:40，第一堂微積分 8:10 開始。\n棉被很暖，外面很冷。你的手指懸在貪睡鍵上方……",
    choices: [
      { text: "翻身起床，準時去上課", points: 15, flag: "attended", next: "ch1_class" },
      { text: "再睡五分鐘……（按下貪睡鍵）", points: 0, next: "ch1_oversleep" },
    ],
  },
  ch1_class: {
    chapter: 1, bg: "class", img: "教室上課.webp", speaker: "微積分教授",
    text: "「同學，極限是微積分的地基。」教授在黑板寫下一排符號。\n「下週五，小考，考極限與基本微分。會當人喔。」\n你默默把這句話抄進筆記。",
    next: "ch1_meet",
  },
  ch1_oversleep: {
    chapter: 1, bg: "dorm", img: "鬧鐘_0.webp", speaker: "旁白",
    text: "等你睜開眼，已經中午 12 點。第一堂微積分，翹了。\n手機跳出同學阿哲的訊息：「欸教授說下週要小考耶，你死定了哈哈。」",
    next: "ch1_meet",
  },
  ch1_meet: {
    chapter: 1, bg: "campus", img: "封面.webp", speaker: "阿哲",
    text: "「下午有空嗎？小考要怎麼準備啊我好慌。」阿哲在群組裡哀號。\n你打算怎麼度過這個下午？",
    choices: [
      { text: "拉阿哲一起去圖書館預習", points: 20, flag: "studied", next: "ch1_lib" },
      { text: "照著求生包裡學姐的筆記自己研讀", points: 14, next: "ch1_senior" },
      { text: "讀什麼書，開一場 game 壓壓驚", points: 0, flag: "gamed", next: "ch1_game" },
    ],
  },
  ch1_lib: {
    chapter: 1, bg: "library", img: "白天圖書館.webp", speaker: "旁白",
    text: "圖書館裡，你和阿哲把極限的 ε-δ 定義啃了一遍。\n雖然頭很痛，但「sin x / x」這類題目你已經有手感了。",
    next: "ch1_night",
  },
  ch1_senior: {
    chapter: 1, bg: "library", img: "白天圖書館.webp", speaker: "旁白",
    text: "你翻開求生包裡學姐留下的筆記，重點都畫好了，連公式小抄都附了一張。\n一個人讀雖然有點悶，但也算把極限的觀念摸熟了。",
    next: "ch1_night",
  },
  ch1_game: {
    chapter: 1, bg: "dorm", img: "宿舍打電動耍廢的夜景.webp", speaker: "旁白",
    text: "「一場就好」變成「最後一場」，最後一場又變成天亮。\n微積分？那是什麼，能吃嗎？",
    next: "ch1_night",
  },
  ch1_night: {
    chapter: 1, bg: "night", img: "熬夜讀書.webp", speaker: "旁白",
    text: "小考前一晚。書桌上的講義攤開著，你的眼皮也在打架。\n最後衝刺，你選擇——",
    choices: [
      { text: "熬夜把例題狂算一遍（衝準備度，但會疲勞）", points: 14, fatigue: 12, next: "ch1_exam" },
      { text: "算完重點題就早點睡，養足精神", points: 10, flag: "rested", next: "ch1_exam" },
      { text: "随便翻兩頁就躺平滑手機", points: 2, next: "ch1_exam" },
    ],
  },
  ch1_exam: {
    chapter: 1, type: "exam", scoreKey: "quiz", bg: "exam", img: "小考_0.webp",
    intro: "小考開始了！題目為「簡單」難度，從題庫隨機抽 4 題。每場考試最多使用 2 件道具：加分/消疲勞道具在作答前用、公式小抄在作答中用。想清楚要不要留好料給後面的大考。",
    difficulty: "easy", count: 4,
    next: "ch1_react",
  },
  ch1_react: {
    chapter: 1, type: "branch", on: "lastScore", bg: "campus",
    cases: [
      { min: 75, speaker: "阿哲", img: "小考及格.webp", text: "「欸你考超好的吧？教授還點名稱讚你！」\n你笑而不語——原來認真是有回報的。地基打穩了，期中就靠這股氣勢。" },
      { min: 50, speaker: "旁白", img: "小考_0.webp", text: "小考成績普普，剛好踩在邊緣。教授發考卷時看了你一眼。\n還來得及，期中加把勁吧。" },
      { min: 0,  speaker: "微積分教授", img: "小考不及格.webp", text: "「這位同學……下課後到我辦公室一下。」\n你的小考分數慘不忍睹。期中再這樣，這學期就危險了。" },
    ],
    next: "ch1_save",
  },
  ch1_save: {
    chapter: 1, type: "save", img: "封面.webp", next: "ch2_intro",
    text: "── 第一章 結束。進度已存檔。 ──",
  },

  /* ================= 第二章 · 期中考 ================= */
  ch2_intro: {
    chapter: 2, resetPrep: true, bg: "campus", img: "封面.webp", speaker: "旁白",
    text: "十一月，期中週。整個校園瀰漫著咖啡因與絕望的味道。\n微積分的進度已經到積分與微分技巧，難度直線上升。",
    next: "ch2_group",
  },
  ch2_group: {
    chapter: 2, bg: "class", img: "教授講期中.webp", speaker: "微積分教授",
    text: "「期中考佔學期成績很重。另外，這週的分組作業也要交。」\n作業和讀書時間互相擠壓，你決定——",
    choices: [
      { text: "認真做作業，順便把範圍讀熟", points: 18, flag: "diligent", next: "ch2_studygroup" },
      { text: "跟阿哲組讀書會，互相罩", points: 15, next: "ch2_studygroup" },
      { text: "作業抄一抄，抱大腿就好", points: 3, flag: "slacker", next: "ch2_studygroup" },
    ],
  },
  ch2_studygroup: {
    chapter: 2, bg: "library", img: "白天讀書會.webp", speaker: "阿哲",
    text: "你想起求生包裡那份歷年考古題，把它攤開來研究。\n「題型好像有跡可循耶！」阿哲湊過來一起看。",
    next: "ch2_method",
  },
  ch2_method: {
    chapter: 2, bg: "library", img: "白天圖書館.webp", speaker: "旁白",
    text: "距離期中考剩三天。你的讀書策略是？",
    choices: [
      { text: "弄懂觀念，每種題型都親手算過", points: 17, next: "ch2_night" },
      { text: "背公式、衝刷題量，速成", points: 10, next: "ch2_night" },
      { text: "只看考古題答案，賭它重出", points: 5, flag: "gambler", next: "ch2_night" },
    ],
  },
  ch2_night: {
    chapter: 2, bg: "night", img: "熬夜讀書.webp", speaker: "旁白",
    text: "期中考前夜，凌晨兩點。你還在跟一題分部積分搏鬥，睏意排山倒海。",
    choices: [
      { text: "再讀一小時就睡，適度衝刺", points: 9, fatigue: 6, next: "ch2_exam" },
      { text: "見好就收，睡覺保腦力", points: 6, flag: "rested", next: "ch2_exam" },
      { text: "硬撐到天亮，多算一題是一題", points: 13, fatigue: 16, flag: "exhausted", next: "ch2_exam" },
    ],
  },
  ch2_exam: {
    chapter: 2, type: "exam", scoreKey: "mid", bg: "exam", img: "考期中考時.webp",
    intro: "期中考登場！題目升到「中等」難度（積分與微分技巧），從題庫隨機抽 4 題。記得善用道具與公式小抄。",
    difficulty: "medium", count: 4,
    next: "ch2_react",
  },
  ch2_react: {
    chapter: 2, type: "branch", on: "lastScore", bg: "campus",
    cases: [
      { min: 75, speaker: "旁白", img: "期中考及格.webp", text: "走出考場，你長舒一口氣。那些難題你大多扛住了。\n阿哲衝過來抱住你：「兄弟你是我看過最猛的！」期末，穩住就贏。" },
      { min: 50, speaker: "旁白", img: "考期中考時.webp", text: "期中考有寫完，但有幾題不太確定。成績應該是中段班。\n期末是最後的翻身機會，不能再失分了。" },
      { min: 0,  speaker: "阿哲", img: "期中考不及格.webp", text: "「欸……你還好嗎？臉好白。」期中考你被電慘了。\n系統寄來一封信：學業預警通知。期末若再不及格，這科就掰了。" },
    ],
    next: "ch2_save",
  },
  ch2_save: {
    chapter: 2, type: "save", img: "封面.webp", next: "ch3_intro",
    text: "── 第二章 結束。進度已存檔。 ──",
  },

  /* ================= 第三章 · 期末考 ================= */
  ch3_intro: {
    chapter: 3, resetPrep: true, bg: "campus", img: "封面.webp", speaker: "旁白",
    text: "一月，期末週。寒風刺骨，圖書館卻一位難求。\n微積分這學期能不能過，就看這最後一戰了。",
    next: "ch3_plan",
  },
  ch3_plan: {
    chapter: 3, bg: "library", img: "白天圖書館.webp", speaker: "旁白",
    text: "期末範圍包山包海。你怎麼規劃這最後一週？",
    choices: [
      { text: "排讀書計畫，從頭到尾系統複習", points: 20, flag: "planned", next: "ch3_temple" },
      { text: "主攻考古題與教授劃的重點", points: 15, next: "ch3_temple" },
      { text: "靠運氣，看到哪讀到哪", points: 4, next: "ch3_temple" },
    ],
  },
  ch3_temple: {
    chapter: 3, bg: "campus", img: "拜文昌帝君.webp", speaker: "阿哲",
    text: "「走啦，陪我去文昌廟拜一下，心安。」阿哲拉著你。\n要去嗎？",
    choices: [
      { text: "去！求個心安（順便帶上求生包的御守）", points: 5, next: "ch3_cafe" },
      { text: "不了，這時間拿來多算兩題", points: 10, next: "ch3_cafe" },
    ],
  },
  ch3_cafe: {
    chapter: 3, bg: "library", img: "白天咖啡廳.webp", speaker: "旁白",
    text: "考前最後一個下午，你在咖啡廳做最後衝刺。店員問要不要續杯。",
    choices: [
      { text: "拼了，多趕一點進度", points: 11, fatigue: 6, next: "ch3_final_night" },
      { text: "讀到一個段落就收，別太累", points: 8, flag: "rested", next: "ch3_final_night" },
    ],
  },
  ch3_final_night: {
    chapter: 3, bg: "night", img: "熬夜讀書.webp", speaker: "旁白",
    text: "期末考前夜。一學期的辛苦、翹過的課、熬過的夜，全部濃縮在明天那張考卷上。\n你闔上講義，深吸一口氣。",
    choices: [
      { text: "我準備好了，睡飽再戰", points: 9, flag: "rested", next: "ch3_exam" },
      { text: "熬夜把最不熟的章節掃最後一遍（疲勞）", points: 15, fatigue: 14, next: "ch3_exam" },
    ],
  },
  ch3_exam: {
    chapter: 3, type: "exam", scoreKey: "final", bg: "exam", img: "期末_0.webp",
    intro: "期末考——決勝的一戰！題目為「困難」難度（定積分、連鎖律、乘積律），從題庫隨機抽 4 題。把背包裡的東西都用上吧。",
    difficulty: "hard", count: 4,
    next: "ch3_react",
  },
  ch3_react: {
    chapter: 3, type: "branch", on: "lastScore", bg: "campus",
    cases: [
      { min: 75, speaker: "旁白", img: "期末考及格.webp", text: "你放下筆，是全場前幾個寫完的。窗外的陽光好像特別溫暖。\n一學期的努力，答案就在這張考卷裡。" },
      { min: 50, speaker: "旁白", img: "期末_0.webp", text: "鈴聲響起，你勉強寫完最後一題。\n結果如何，只能交給教授的紅筆了。" },
      { min: 0,  speaker: "旁白", img: "期末考不及格.webp", text: "考卷上還有大片空白。你盯著時鐘，心一點一點往下沉。\n但無論如何，這學期，結束了。" },
    ],
    next: "ch3_end",
  },
  ch3_end: { type: "end" },

  },
};

/* 結算：依三科平均判定 */
function judge(avg) {
  if (avg >= 75) return {
    key: "pass", cls: "pass", verdict: "順利通過 🎓",
    story: "成績單上，微積分的欄位寫著漂亮的數字。你不只過了，還過得有底氣。\n那些早起的清晨、圖書館的夜晚，都化成了這個學分。下學期，繼續加油。",
  };
  if (avg >= 60) return {
    key: "warn", cls: "warn", verdict: "低空飛過 · 學業預警 ⚠️",
    story: "過了，但只差一點就摔下來。系統還是寄來了一封學業預警信。\n這次是僥倖，下次未必。把這份心驚，當成下學期的鬧鐘吧。",
  };
  if (avg >= 50) return {
    key: "makeup", cls: "makeup", verdict: "需要補考 📝",
    story: "平均落在及格邊緣下方，教授給了你一次補考的機會。\n這是一根救命繩——抓緊它。暑假前，把這科補回來。",
  };
  return {
    key: "fail", cls: "fail", verdict: "這科……重修 💀",
    story: "成績單上那個刺眼的數字，宣告了這學期微積分的結局：重修。\n別灰心，很多人都重修過。重點是——下一次，你會怎麼選？",
  };
}

/* 補考關卡：學期加權平均落在 50–59 時觸發。
   5 題困難、每題 20 分（滿分 100），可用背包剩下的道具；達 60 分通過（學期成績以 60 計），否則重修。 */
const MAKEUP_PASS_LINE = 60;
const MAKEUP_EXAM = {
  type: "exam", makeup: true, scoreKey: "makeup", bg: "exam", img: "期末_0.webp",
  intro: "補考——最後的救贖機會！這場補考共 5 題（困難難度），每題 20 分。達到 60 分就能低空通過（學期成績以 60 分計），否則就要重修。可使用背包剩下的道具。",
  difficulty: "hard", count: 5, pointsPerQ: 20,
};
const MAKEUP_RESULT = {
  pass: {
    cls: "warn", verdict: "補考通過 · 低空過關 🎓",
    story: "補考那天，你穩穩答完了關鍵題。教授在成績欄填上 60——不漂亮，但你過了。\n這一科總算保住了。記住這次的心驚，下學期別再走到補考這一步。",
  },
  fail: {
    cls: "fail", verdict: "補考未過 · 重修 💀",
    story: "補考還是沒能跨過那條線。微積分這一科，最終的結局是重修。\n別太自責，你已經拼到最後一刻。重來一次，你會更清楚該怎麼準備。",
  },
};
