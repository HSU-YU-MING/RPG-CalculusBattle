/* ============================================================
   學分危機 — 遊戲引擎
   ============================================================ */
(function () {
  "use strict";

  const SAVE_KEY = "xuefen_save_v1";
  const CHAPTER_NAMES = { 1: "第一章 · 小考", 2: "第二章 · 期中考", 3: "第三章 · 期末考" };

  // ---- DOM ----
  const $ = (id) => document.getElementById(id);
  const screens = { lobby: $("lobby"), game: $("game"), result: $("result") };
  const el = {
    sceneBg: $("scene-bg"), speaker: $("speaker"), dialogue: $("dialogue"),
    choices: $("choices"), continueTip: $("continue-tip"),
    hudChapter: $("hud-chapter"), hudCourse: $("hud-course"),
    hudPrep: $("hud-prep").querySelector("b"), hudFatigue: $("hud-fatigue"),
    hudBagCount: $("hud-bagcount"),
    stage: $("stage"), saveHint: $("save-hint"), continueBtn: $("continue-btn"),
    modal: $("modal"), modalTitle: $("modal-title"), modalBody: $("modal-body"),
    toast: $("toast"),
  };

  // ---- 狀態 ----
  let state = null;
  let awaitingContinue = false; // 旁白等待點擊繼續

  function freshState() {
    return {
      sceneId: STORY.start, chapter: 1, prep: 0, fatigue: 0, lastScore: 0,
      scores: { quiz: null, mid: null, final: null },
      inventory: STARTING_ITEMS.slice(), flags: {},
    };
  }

  // ---- 存檔 ----
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
  function loadSave() { try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function hasSave() { return !!loadSave(); }

  function refreshLobby() {
    const s = loadSave();
    if (s) {
      el.continueBtn.disabled = false;
      el.saveHint.textContent = `存檔進度：${CHAPTER_NAMES[s.chapter] || "第一章"}`;
    } else {
      el.continueBtn.disabled = true;
      el.saveHint.textContent = "尚無存檔，從新遊戲開始吧";
    }
  }

  // ---- 畫面切換 ----
  function show(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
  }

  // ---- 小工具 ----
  function toast(text, type) {
    el.toast.textContent = text;
    el.toast.className = "toast show" + (type ? " " + type : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.toast.className = "toast"; }, 1400);
  }
  const IMG_BASE = "image/";
  function backdrop(img) {
    // 由上而下加深，底部最暗，確保對話框/選項區的文字清楚
    return `linear-gradient(to bottom, rgba(8,11,22,.20) 0%, rgba(8,11,22,.38) 42%, rgba(8,11,22,.86) 100%), url("${encodeURI(IMG_BASE + img)}")`;
  }
  function setBg(bg, img) {
    el.sceneBg.className = "scene-bg" + (bg ? " bg-" + bg : "");
    el.sceneBg.style.backgroundImage = img ? backdrop(img) : "";
  }
  function updateHud() {
    el.hudChapter.textContent = CHAPTER_NAMES[state.chapter] || "";
    el.hudCourse.textContent = STORY.meta.course;
    el.hudPrep.textContent = state.prep;
    el.hudFatigue.textContent = state.fatigue > 0 ? "😵 疲勞 " + state.fatigue : "";
    el.hudBagCount.textContent = state.inventory.length;
  }

  // ---- 場景渲染 ----
  function goTo(id) {
    state.sceneId = id;
    renderScene();
  }

  function renderScene() {
    const sc = STORY.scenes[state.sceneId];
    awaitingContinue = false;
    el.choices.innerHTML = "";
    el.continueTip.classList.add("hidden");

    if (!sc) { console.error("找不到場景", state.sceneId); return; }
    if (sc.chapter) state.chapter = sc.chapter;
    if (sc.resetPrep) { state.prep = 0; state.fatigue = 0; }
    setBg(sc.bg, sc.img);
    updateHud();

    switch (sc.type) {
      case "exam":   return renderExam(sc);
      case "branch": return renderBranch(sc);
      case "save":   return renderSave(sc);
      case "end":    return renderEnd();
      default:       return renderDialogue(sc);
    }
  }

  // 一般對話 / 選擇
  function renderDialogue(sc) {
    el.speaker.textContent = sc.speaker || "";
    el.dialogue.textContent = sc.text || "";

    if (sc.choices && sc.choices.length) {
      sc.choices.forEach((ch) => {
        const locked = ch.require && !state.inventory.includes(ch.require);
        const b = document.createElement("button");
        b.className = "choice" + (locked ? " locked" : "");
        b.innerHTML = escapeHtml(ch.text) +
          (ch.require ? ` <span class="tag">需要：${ITEMS[ch.require] ? ITEMS[ch.require].name : ch.require}</span>` : "");
        if (!locked) b.addEventListener("click", () => applyChoice(ch));
        el.choices.appendChild(b);
      });
    } else if (sc.next) {
      awaitingContinue = true;
      el.continueTip.classList.remove("hidden");
    }
  }

  function applyChoice(ch) {
    if (typeof ch.points === "number" && ch.points !== 0) {
      state.prep += ch.points;
      toast((ch.points > 0 ? "準備度 +" : "準備度 ") + ch.points, ch.points > 0 ? "good" : "bad");
    }
    if (ch.fatigue) {
      state.fatigue += ch.fatigue;
      setTimeout(() => toast("😵 熬夜疲勞 +" + ch.fatigue, "bad"), 350);
    }
    const grants = ch.items ? ch.items.slice() : (ch.item ? [ch.item] : []);
    grants.forEach((id, i) => {
      if (!ITEMS[id]) return;
      state.inventory.push(id);
      setTimeout(() => toast("獲得道具：" + ITEMS[id].name, "good"), 700 + i * 700);
    });
    if (ch.flag) state.flags[ch.flag] = true;
    updateHud();
    goTo(ch.next);
  }

  // 分歧劇情（依分數）
  function renderBranch(sc) {
    const val = sc.on === "lastScore" ? state.lastScore : state.prep;
    const cases = sc.cases.slice().sort((a, b) => b.min - a.min);
    const pick = cases.find((c) => val >= c.min) || cases[cases.length - 1];
    el.speaker.textContent = pick.speaker || "";
    el.dialogue.textContent = pick.text || "";
    setBg(sc.bg, pick.img || sc.img);
    state._branchNext = sc.next;
    awaitingContinue = true;
    el.continueTip.classList.remove("hidden");
  }

  // 存檔點
  function renderSave(sc) {
    state._branchNext = sc.next;
    // 存檔時把進度指向下一章起點
    const snapshot = JSON.parse(JSON.stringify(state));
    snapshot.sceneId = sc.next;
    delete snapshot._branchNext;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot)); } catch (e) {}
    el.speaker.textContent = "💾 存檔點";
    el.dialogue.textContent = (sc.text || "進度已存檔。") + "\n（隨時可從大廳「繼續遊戲」回到這裡）";
    awaitingContinue = true;
    el.continueTip.classList.remove("hidden");
  }

  // 點擊繼續
  el.stage.addEventListener("click", (e) => {
    if (!awaitingContinue) return;
    if (e.target.closest(".choices")) return;
    awaitingContinue = false;
    const sc = STORY.scenes[state.sceneId];
    const next = state._branchNext || sc.next;
    state._branchNext = null;
    if (next) goTo(next);
  });

  // ---- 考試 ----
  let exam = null; // { sc, bonus, qPoints, qIndex }

  // 隨機洗牌（Fisher–Yates）
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  // 依難度從題庫隨機抽題，並打亂選項順序（pointsOverride 用於補考的高分配題）
  function pickExamQuestions(difficulty, count, pointsOverride) {
    const pool = (QUESTION_BANK[difficulty] || []).slice();
    const pts = pointsOverride || POINTS_BY_DIFFICULTY[difficulty] || 8;
    return shuffle(pool).slice(0, count).map((q) => {
      const correctText = q.opts[q.answer];
      const opts = shuffle(q.opts.slice());
      return { q: q.q, opts, answer: opts.indexOf(correctText), hint: q.hint, points: pts };
    });
  }

  function renderExam(sc) {
    exam = { sc, bonus: 0, relief: 0, qPoints: 0, qIndex: -1, used: 0 };
    exam.questions = sc.questions || pickExamQuestions(sc.difficulty, sc.count || 4, sc.pointsPerQ);
    setBg(sc.bg || "exam", sc.img);
    el.speaker.textContent = "📝 考試";
    const fatigueLine = state.fatigue > 0 ? `　😵 熬夜疲勞：${state.fatigue}（會在成績扣分）` : "";
    el.dialogue.textContent = sc.intro + `\n（本章準備度：${state.prep}${fatigueLine}）`;
    renderExamItems();
  }

  function renderExamItems() {
    el.choices.innerHTML = "";
    const remaining = EXAM_ITEM_LIMIT - exam.used;
    const limitReached = remaining <= 0;

    // 作答前可使用的道具：加分 / 消除疲勞（提示型道具留到作答中使用）
    const preItems = state.inventory.filter((id) => ITEMS[id].type !== "hint");
    const hintCount = state.inventory.filter((id) => ITEMS[id].type === "hint").length;

    // 本場可使用額度
    const quota = document.createElement("div");
    quota.className = "empty-note";
    quota.style.cssText = "padding:4px 0 10px;color:" + (limitReached ? "var(--bad)" : "var(--accent2)");
    quota.textContent = limitReached
      ? `🚫 本場道具額度已用完（每場上限 ${EXAM_ITEM_LIMIT} 件）`
      : `👜 本場還可使用 ${remaining} / ${EXAM_ITEM_LIMIT} 件道具（用過即消耗，沒用到的留到下一場）`;
    el.choices.appendChild(quota);

    if (preItems.length) {
      preItems.forEach((id) => {
        const it = ITEMS[id];
        const realIdx = state.inventory.indexOf(id);
        const row = document.createElement("div");
        row.className = "item-row" + (limitReached ? " used" : "");
        row.innerHTML =
          `<span class="icon">${it.icon}</span>` +
          `<span class="info"><div class="nm">${escapeHtml(it.name)}</div><div class="ds">${escapeHtml(it.desc)}</div></span>`;
        const btn = document.createElement("button");
        btn.className = "use-btn";
        const label = (it.bonus ? `+${it.bonus}` : "") + (it.relief ? (it.bonus ? " · " : "") + `醒腦` : "");
        btn.textContent = limitReached ? "額度用完" : "使用 " + label;
        btn.disabled = limitReached;
        if (!limitReached) btn.addEventListener("click", () => {
          exam.bonus += it.bonus || 0;
          exam.relief += it.relief || 0;
          exam.used++;
          state.inventory.splice(realIdx, 1);
          let msg = it.name + " 已使用";
          if (it.bonus) msg += "，+" + it.bonus + " 分";
          if (it.relief) msg += "，消除疲勞 " + it.relief;
          toast(msg, "good");
          updateHud();
          renderExamItems();
        });
        row.appendChild(btn);
        el.choices.appendChild(row);
      });
    }
    if (hintCount && !limitReached) {
      const hn = document.createElement("div");
      hn.className = "empty-note";
      hn.style.cssText = "padding:2px 0 10px;color:var(--accent)";
      hn.textContent = `💡 你有 ${hintCount} 張公式小抄，可在作答某一題時揭曉提示（也算 1 件額度）。`;
      el.choices.appendChild(hn);
    }
    const start = document.createElement("button");
    start.className = "choice";
    start.style.textAlign = "center";
    start.style.borderColor = "var(--accent)";
    start.innerHTML = "<b>開始作答 ▶</b>";
    start.addEventListener("click", nextExamQuestion);
    el.choices.appendChild(start);
  }

  function nextExamQuestion() {
    exam.qIndex++;
    const qs = exam.questions;
    if (exam.qIndex >= qs.length) return finishExam();

    const q = qs[exam.qIndex];
    el.speaker.textContent = `📝 考試 — 第 ${exam.qIndex + 1} / ${qs.length} 題`;
    el.dialogue.textContent = q.q;
    el.choices.innerHTML = "";

    // 公式小抄：作答中揭曉提示（受本場道具額度限制）
    if (q.hint && state.inventory.includes("formula") && exam.used < EXAM_ITEM_LIMIT) {
      const hintBtn = document.createElement("button");
      hintBtn.className = "choice";
      hintBtn.style.cssText = "text-align:center;border-color:var(--accent)";
      hintBtn.innerHTML = "💡 使用公式小抄看提示";
      hintBtn.addEventListener("click", () => {
        state.inventory.splice(state.inventory.indexOf("formula"), 1);
        exam.used++;
        updateHud();
        el.dialogue.textContent = q.q + "\n\n💡 提示：" + q.hint;
        hintBtn.remove();
      });
      el.choices.appendChild(hintBtn);
    }

    const optButtons = [];
    q.opts.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "exam-opt";
      b.textContent = opt;
      b.addEventListener("click", () => {
        // 鎖定所有按鈕（含提示鈕）
        [...el.choices.children].forEach((c) => (c.disabled = true));
        const correct = i === q.answer;
        b.classList.add(correct ? "correct" : "wrong");
        if (!correct) optButtons[q.answer].classList.add("correct");
        if (correct) { exam.qPoints += q.points; toast("答對！+" + q.points + " 分", "good"); }
        else toast("答錯了……", "bad");
        setTimeout(nextExamQuestion, 950);
      });
      optButtons.push(b);
      el.choices.appendChild(b);
    });
  }

  function finishExam() {
    if (exam.sc.makeup) return finishMakeup();
    const penalty = Math.max(0, state.fatigue - exam.relief);
    const raw = state.prep + exam.bonus + exam.qPoints - penalty;
    const score = Math.max(0, Math.min(100, raw));
    state.scores[exam.sc.scoreKey] = score;
    state.lastScore = score;
    updateHud();

    el.speaker.textContent = "📊 成績單";
    el.dialogue.textContent =
      `本章準備度 ${state.prep} ＋ 道具加分 ${exam.bonus} ＋ 答題得分 ${exam.qPoints}` +
      (penalty > 0 ? ` − 熬夜疲勞 ${penalty}` : "") + "\n" +
      `＝ 這次考試成績：${score} 分`;
    el.choices.innerHTML = "";
    const cont = document.createElement("button");
    cont.className = "choice";
    cont.style.textAlign = "center";
    cont.style.borderColor = "var(--accent)";
    cont.innerHTML = "<b>看看結果 ▶</b>";
    cont.addEventListener("click", () => goTo(exam.sc.next));
    el.choices.appendChild(cont);
  }

  // ---- 補考關卡 ----
  function startMakeup(avg) {
    show("game");
    setBg("exam", MAKEUP_EXAM.img);
    el.continueTip.classList.add("hidden");
    el.speaker.textContent = "📩 補考通知";
    el.dialogue.textContent =
      `學期加權成績 ${avg} 分，落在及格邊緣下方（50–59）。\n` +
      `系統寄來一封補考通知——這是保住這個學分的最後機會。`;
    el.choices.innerHTML = "";
    const cont = document.createElement("button");
    cont.className = "choice";
    cont.style.textAlign = "center";
    cont.style.borderColor = "var(--accent)";
    cont.innerHTML = "<b>前往補考 ▶</b>";
    cont.addEventListener("click", () => renderExam(MAKEUP_EXAM));
    el.choices.appendChild(cont);
  }

  function finishMakeup() {
    const score = Math.max(0, Math.min(100, exam.bonus + exam.qPoints));
    state.makeupScore = score;
    state.makeupPassed = score >= MAKEUP_PASS_LINE;
    state.makeupDone = true;
    updateHud();

    el.speaker.textContent = "📊 補考成績";
    el.dialogue.textContent =
      `答題得分 ${exam.qPoints}` + (exam.bonus ? ` ＋ 道具加分 ${exam.bonus}` : "") +
      ` ＝ 補考成績 ${score} 分\n` +
      (state.makeupPassed ? `達到 ${MAKEUP_PASS_LINE} 分，補考通過！` : `未達 ${MAKEUP_PASS_LINE} 分……`);
    el.choices.innerHTML = "";
    const cont = document.createElement("button");
    cont.className = "choice";
    cont.style.textAlign = "center";
    cont.style.borderColor = "var(--accent)";
    cont.innerHTML = "<b>看看最終結果 ▶</b>";
    cont.addEventListener("click", renderEnd);
    el.choices.appendChild(cont);
  }

  // ---- 結算 ----
  // 學期成績為加權：小考 20% ＋ 期中 35% ＋ 期末 45%
  const WEIGHTS = { quiz: 0.20, mid: 0.35, final: 0.45 };

  function renderEnd() {
    const sc = state.scores;
    const vals = { quiz: sc.quiz || 0, mid: sc.mid || 0, final: sc.final || 0 };
    const weighted = vals.quiz * WEIGHTS.quiz + vals.mid * WEIGHTS.mid + vals.final * WEIGHTS.final;
    const avg = Math.round(weighted);
    let res = judge(avg);

    // 補考機制：落在補考區(50–59)且尚未補考 → 先進補考關卡
    if (res.key === "makeup" && !state.makeupDone) return startMakeup(avg);

    let cards =
      scoreCard("小考", vals.quiz, "20%") +
      scoreCard("期中考", vals.mid, "35%") +
      scoreCard("期末考", vals.final, "45%");
    let avgLine = `學期加權總分：<b>${avg}</b> 分　<span style="font-size:14px;color:var(--muted)">（小考 20% ＋ 期中 35% ＋ 期末 45%）</span>`;

    // 補考結束後覆寫結局
    if (state.makeupDone) {
      cards += scoreCard("補考", state.makeupScore, state.makeupPassed ? "通過" : "未過");
      if (state.makeupPassed) {
        res = MAKEUP_RESULT.pass;
        avgLine = `原始加權 ${avg} 分（補考區）→ 補考通過，學期成績以 <b>60</b> 分計 🎓`;
      } else {
        res = MAKEUP_RESULT.fail;
        avgLine = `原始加權 ${avg} 分，補考 ${state.makeupScore} 分未達 ${MAKEUP_PASS_LINE} → 重修`;
      }
    }

    $("result-verdict").textContent = res.verdict;
    $("result-verdict").className = "result-verdict " + res.cls;
    $("result-scores").innerHTML = cards;
    $("result-avg").innerHTML = avgLine;
    $("result-story").textContent = res.story;

    const resultImg = (res.cls === "pass" || res.cls === "warn") ? "期末考及格.png" : "期末考不及格.png";
    $("result").style.backgroundImage =
      `linear-gradient(to bottom, rgba(14,18,32,.80), rgba(14,18,32,.93)), url("${encodeURI(IMG_BASE + resultImg)}")`;

    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    show("result");
  }
  function scoreCard(lbl, val, weight) {
    return `<div class="score-card"><div class="lbl">${lbl} <span style="opacity:.7">(${weight})</span></div><div class="val">${val}</div></div>`;
  }

  // ---- 道具彈窗 ----
  function openInventory() {
    el.modalTitle.textContent = "🎒 我的道具";
    const list = state ? state.inventory : STARTING_ITEMS;
    const intro = state
      ? `<p class="empty-note" style="color:var(--accent2);padding:0 0 12px">每場考試最多用 ${EXAM_ITEM_LIMIT} 件，沒用到的會留到下一場。</p>`
      : `<p class="empty-note" style="color:var(--accent2);padding:0 0 12px">開局就會拿到以下完整「求生包」，自己決定哪場考試用哪些（每場上限 ${EXAM_ITEM_LIMIT} 件）。</p>`;
    if (!list.length) {
      el.modalBody.innerHTML = `<p class="empty-note">道具都用完了。</p>`;
    } else {
      el.modalBody.innerHTML = intro + list.map((id) => {
        const it = ITEMS[id];
        return `<div class="item-row"><span class="icon">${it.icon}</span>` +
          `<span class="info"><div class="nm">${escapeHtml(it.name)}</div><div class="ds">${escapeHtml(it.desc)}</div></span></div>`;
      }).join("");
    }
    el.modal.classList.add("active");
  }
  function openHow() {
    el.modalTitle.textContent = "❔ 玩法說明";
    el.modalBody.innerHTML = `
      <div style="line-height:1.9">
      🎮 你是一名大一新生，要修完一學期的<b>微積分</b>。<br><br>
      📖 故事分為<b>三章</b>：小考、期中考、期末考。每章都有沉浸式的劇情與選擇。<br><br>
      🧭 你的<b>每個選擇</b>都會影響「準備度」，並讓劇情走向不同分支。<br><br>
      🎒 <b>開局就拿到完整道具求生包</b>：筆記/考古題/御守(考前加分)、能量飲料/咖啡(消除疲勞)、💡公式小抄(作答時揭曉提示)。<b>每場考試最多用 2 件</b>，自己決定把好料留給哪場（期末佔比最重）。<br><br>
      😵 <b>熬夜</b>能多衝一點準備度，但會累積「疲勞」，在考試時<b>扣分</b>；能量飲料、咖啡可消除疲勞。<br><br>
      📝 每章結尾考試 4 題，<b>從題庫隨機抽題</b>、連選項都會打亂，每次玩都不一樣。難度遞增：小考(簡單) → 期中(中等) → 期末(困難)。成績 ＝ 準備度 ＋ 道具加分 ＋ 答題得分 − 熬夜疲勞（上限 100）。<br><br>
      💾 每章結束會自動<b>存檔</b>，可從大廳繼續。<br><br>
      🎓 學期成績為<b>加權</b>：小考 20% ＋ 期中 35% ＋ 期末 45%，再判定：<br>
      ・75↑ 順利通過　・60–74 低空飛過(預警)　・50–59 補考　・50↓ 重修<br><br>
      📩 落在 <b>50–59</b> 會觸發<b>補考關卡</b>：5 題困難、每題 20 分，可用剩下的道具，達 60 分即低空通過（成績以 60 計），否則重修。
      </div>`;
    el.modal.classList.add("active");
  }

  // ---- 流程控制 ----
  function newGame() {
    state = freshState();
    show("game");
    renderScene();
  }
  function continueGame() {
    const s = loadSave();
    if (!s) return;
    state = Object.assign(freshState(), s);
    show("game");
    renderScene();
  }
  function toLobby() { show("lobby"); refreshLobby(); }

  // ---- 事件綁定 ----
  document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const a = btn.dataset.action;
      if (a === "new-game") {
        if (hasSave() && !confirm("已有存檔，開始新遊戲會在下次存檔時覆蓋。確定要重新開始嗎？")) return;
        newGame();
      } else if (a === "continue") continueGame();
      else if (a === "inventory") openInventory();
      else if (a === "how") openHow();
      else if (a === "to-lobby") toLobby();
    });
  });
  $("hud-bag").addEventListener("click", openInventory);
  $("hud-menu").addEventListener("click", () => {
    if (confirm("回大廳嗎？目前章節進度未到存檔點的部分會遺失。")) toLobby();
  });
  $("modal-close").addEventListener("click", () => el.modal.classList.remove("active"));
  el.modal.addEventListener("click", (e) => { if (e.target === el.modal) el.modal.classList.remove("active"); });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---- 啟動 ----
  refreshLobby();
})();
