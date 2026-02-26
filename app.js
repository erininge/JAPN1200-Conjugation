import { loadSettings, saveSettings, loadStars, saveStars, loadStats, saveStats } from "./storage.js";
import { conjugateVerb, conjugateAdj, isAnswerCorrect, normalizeAnswer } from "./conjugationEngine.js";

let settings = loadSettings();
let stars = loadStars();
let stats = loadStats();

let verbs = [];
let adjs = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function setTab(name) {
  $$(".tabbtn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $("#tab-study").classList.toggle("hidden", name !== "study");
  $("#tab-view").classList.toggle("hidden", name !== "view");
  $("#tab-stats").classList.toggle("hidden", name !== "stats");
  $("#tab-settings").classList.toggle("hidden", name !== "settings");
  $("#tab-quiz").classList.add("hidden");
}

function showQuiz() {
  $("#tab-study").classList.add("hidden");
  $("#tab-view").classList.add("hidden");
  $("#tab-stats").classList.add("hidden");
  $("#tab-settings").classList.add("hidden");
  $("#tab-quiz").classList.remove("hidden");
}

function updateTopPills() {
  $("#pillTotal").textContent = `Verbs: ${verbs.length}`;
  $("#pillAdj").textContent = `Adjectives: ${adjs.length}`;
  const starCount = Object.values(stars).filter(Boolean).length;
  $("#pillStars").textContent = `⭐ ${starCount}`;
}

function getJP(item, displayMode) {
  if (displayMode === "kanji" && item.jp_kanji) return item.jp_kanji;
  return item.jp_kana;
}

function getConjugated(item, form, displayMode) {
  if (item.type === "verb") {
    const c = conjugateVerb(item, form);
    if (displayMode === "kanji" && c.kanji) return c.kanji;
    return c.kana;
  }
  const c = conjugateAdj(item, form);
  if (displayMode === "kanji" && c.kanji) return c.kanji;
  return c.kana;
}

function getExpectedAnswers(item, form) {
  const base = [];
  if (item.type === "verb") {
    const c = conjugateVerb(item, form);
    base.push(c.kana);
    if (c.kanji) base.push(c.kanji);
  } else {
    const c = conjugateAdj(item, form);
    base.push(c.kana);
    if (c.kanji) base.push(c.kanji);
  }
  return base;
}

function getAudioBaseNames(item, form = null) {
  if (form) return [`${item.id}_${form}`, item.id];
  return [item.id];
}

function getPrimaryAudioPath(item, form = null) {
  const [base] = getAudioBaseNames(item, form);
  return `audio/${base}.wav`;
}

function isStarred(id) { return !!stars[id]; }
function toggleStar(id) {
  stars[id] = !stars[id];
  saveStars(stars);
  updateTopPills();
}

function applyWordTypeUI() {
  const wt = $$("input[name='wordType']").find(r => r.checked)?.value || "verbs";
  const verbBox = $("#verbFormsBox");
  const adjBox = $("#adjFormsBox");
  if (wt === "verbs") {
    verbBox.classList.remove("hidden");
    adjBox.classList.add("hidden");
  } else if (wt === "adjs") {
    verbBox.classList.add("hidden");
    adjBox.classList.remove("hidden");
  } else {
    verbBox.classList.remove("hidden");
    adjBox.classList.remove("hidden");
  }
}

function loadDefaultsToStudyUI() {
  $("#displayMode").value = settings.displayMode;
  $("#questionCount").value = settings.questionCount;
  $("#starredOnly").checked = settings.starredOnly;
  $("#showEnglish").checked = settings.showEnglish;
}

function loadSettingsUI() {
  $("#setAudioOn").checked = settings.audioOn;
  $("#setAutoplay").checked = settings.autoplayAudio;
  $("#setSmart").checked = settings.smartGrading;
  $("#setVol").value = settings.volume;
  $("#setDisplay").value = settings.displayMode;
  $("#setQCount").value = settings.questionCount;
  $("#setShowEnglish").checked = settings.showEnglish;
  $("#setStarOnly").checked = settings.starredOnly;
  $("#setDewa").checked = settings.acceptDewaArimasen;
}

function saveSettingsFromUI() {
  settings.audioOn = $("#setAudioOn").checked;
  settings.autoplayAudio = $("#setAutoplay").checked;
  settings.smartGrading = $("#setSmart").checked;
  settings.volume = Math.max(0, Math.min(1, Number($("#setVol").value || 0.9)));
  settings.displayMode = $("#setDisplay").value;
  settings.questionCount = Number($("#setQCount").value || 20);
  settings.showEnglish = $("#setShowEnglish").checked;
  settings.starredOnly = $("#setStarOnly").checked;
  settings.acceptDewaArimasen = $("#setDewa").checked;
  saveSettings(settings);
  loadDefaultsToStudyUI();
}

async function fetchData() {
  // IMPORTANT: Many users will open index.html directly from a file picker
  // while testing. `fetch()` is blocked under file:// in most browsers,
  // which would prevent the entire app from initializing.
  // So we (1) try fetch, (2) fall back to a tiny built-in dataset,
  // and (3) still keep the UI fully functional either way.
  const fallbackVerbs = [
    { id: "verb_001", jp_kana: "たべる", jp_kanji: "食べる", en: "to eat", type: "verb", class: "ichidan" },
    { id: "verb_002", jp_kana: "いく", jp_kanji: "行く", en: "to go", type: "verb", class: "godan" },
    { id: "verb_003", jp_kana: "する", jp_kanji: "", en: "to do", type: "verb", class: "irregular" }
  ];
  const fallbackAdjs = [
    { id: "adj_001", jp_kana: "きれい", jp_kanji: "", en: "beautiful; clean", type: "adj", class: "na" },
    { id: "adj_002", jp_kana: "あたらしい", jp_kanji: "新しい", en: "new", type: "adj", class: "i" }
  ];

  try {
    const vUrl = new URL("./data/verbs.json", import.meta.url);
    const aUrl = new URL("./data/adjectives.json", import.meta.url);
    const [vRes, aRes] = await Promise.all([fetch(vUrl), fetch(aUrl)]);
    if (!vRes.ok || !aRes.ok) throw new Error("Fetch failed");
    verbs = await vRes.json();
    adjs = await aRes.json();
  } catch (e) {
    // Fall back so the app still works locally.
    verbs = fallbackVerbs;
    adjs = fallbackAdjs;
    console.warn("Could not load data via fetch(). Using fallback sample data. Deploy or run a local server to load your full lists.", e);

    const msg = document.createElement("div");
    msg.className = "meta";
    msg.style.marginTop = "10px";
    msg.innerHTML = "⚠️ Couldn’t load <code>data/verbs.json</code> / <code>data/adjectives.json</code>. If you opened this as a local file, that’s normal. Deploy to GitHub Pages (or run a local server) to use your full word lists. Using a tiny sample list for now.";
    const study = document.querySelector("#tab-study");
    if (study && !document.querySelector("#dataLoadWarning")) {
      msg.id = "dataLoadWarning";
      study.appendChild(msg);
    }
  }

  updateTopPills();
}

let session = null;

function readStudySetup() {
  const wt = $$("input[name='wordType']").find(r => r.checked)?.value || "verbs";
  const verbForms = $$(".vf").filter(x => x.checked).map(x => x.value);
  const adjForms = $$(".af").filter(x => x.checked).map(x => x.value);
  return {
    wt,
    verbForms,
    adjForms,
    questionMode: $("#questionMode").value,
    answerType: $("#answerType").value,
    displayMode: $("#displayMode").value,
    questionCount: Number($("#questionCount").value || 20),
    starredOnly: $("#starredOnly").checked,
    showEnglish: $("#showEnglish").checked
  };
}

function buildPool(setup) {
  let items = [];
  if (setup.wt === "verbs") items = verbs.slice();
  else if (setup.wt === "adjs") items = adjs.slice();
  else items = verbs.concat(adjs);

  if (setup.starredOnly) items = items.filter(it => isStarred(it.id));

  const tasks = [];
  for (const it of items) {
    const forms = (it.type === "verb") ? setup.verbForms : setup.adjForms;
    for (const form of forms) {
      if (it.type === "adj" && form === "present") continue;
      tasks.push({ item: it, form });
    }
  }
  return tasks;
}

function shuffle(a) {
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function randPick(arr) {
  return arr[Math.floor(Math.random()*arr.length)];
}

function startSession(setup, forceStarred=false) {
  if (forceStarred) setup.starredOnly = true;
  if ((setup.wt === "verbs" || setup.wt === "both") && setup.verbForms.length === 0) {
    alert("Pick at least one verb form.");
    return;
  }
  if ((setup.wt === "adjs" || setup.wt === "both") && setup.adjForms.length === 0) {
    alert("Pick at least one adjective form.");
    return;
  }

  const pool = buildPool(setup);
  if (pool.length === 0) {
    alert("No items matched your selection (try turning off Starred only or add words).");
    return;
  }

  const questions = [];
  for (let i=0;i<setup.questionCount;i++){
    const task = randPick(pool);
    let direction = setup.questionMode;
    if (direction === "mixed") direction = (Math.random() < 0.5) ? "dict_to_conj" : "conj_to_dict";
    questions.push({ item: task.item, form: task.form, direction, answered:false, correct:false });
  }

  session = { setup, idx:0, questions, awaitingNext:false, lastChoices:null };
  showQuiz();
  renderQuestion();
}

function describeForm(itemType, form) {
  const mapV = { present:"Present (ます)", negative:"Negative (ません)", past:"Past (ました)", past_negative:"Past negative (ませんでした)" };
  const mapA = { negative:"Negative", past:"Past", past_negative:"Past negative" };
  return (itemType === "verb") ? mapV[form] : mapA[form];
}

function renderQuestion() {
  const q = session.questions[session.idx];
  const { displayMode, showEnglish, answerType } = session.setup;

  const total = session.questions.length;
  const n = session.idx + 1;
  $("#quizMeta").textContent = `${n}/${total} • ${q.item.type === "verb" ? "Verb" : "Adjective"} • ${describeForm(q.item.type, q.form)} • ${q.direction === "dict_to_conj" ? "Dict→Conj" : "Conj→Dict"}`;
  $("#quizBar").style.width = `${(n-1)/total*100}%`;

  $("#btnStar").textContent = isStarred(q.item.id) ? "★" : "☆";

  let promptJP = "";
  let expected = [];
  const sub = [];

  if (q.direction === "dict_to_conj") {
    promptJP = getJP(q.item, displayMode);
    expected = getExpectedAnswers(q.item, q.form);
    sub.push("Answer: conjugation");
  } else {
    promptJP = getConjugated(q.item, q.form, displayMode);
    expected = [q.item.jp_kana, ...(q.item.jp_kanji ? [q.item.jp_kanji] : [])];
    sub.push("Answer: dictionary form");
  }

  $("#prompt").textContent = promptJP;
  if (showEnglish && q.item.en) sub.push(`EN: ${q.item.en}`);
  $("#subPrompt").textContent = sub.join(" • ");

  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";

  session.awaitingNext = false;
  $("#btnNext").classList.add("hidden");
  $("#btnSubmit").classList.remove("hidden");

  const useTyping = (answerType === "typing" || answerType === "both");
  $("#typingBox").classList.toggle("hidden", !useTyping);
  $("#mcBox").classList.toggle("hidden", useTyping);

  $("#answerInput").value = "";
  $("#answerInput").focus();

  if (answerType === "mc") {
    buildAndShowChoices(expected[0], q);
  }
}

function buildAndShowChoices(_correctAnswer, q) {
  const { displayMode } = session.setup;
  const allItems = (q.item.type === "verb") ? verbs : adjs;

  const makeAnswerFor = (it) => {
    if (q.direction === "dict_to_conj") return getConjugated(it, q.form, displayMode) || getConjugated(it, q.form, "kana");
    return getJP(it, displayMode) || it.jp_kana;
  };

  const correct = (q.direction === "dict_to_conj")
    ? (getConjugated(q.item, q.form, displayMode) || getConjugated(q.item, q.form, "kana"))
    : (getJP(q.item, displayMode) || q.item.jp_kana);

  const distractors = [];
  const shuffled = shuffle(allItems.slice());
  for (const it of shuffled) {
    if (it.id === q.item.id) continue;
    const ans = makeAnswerFor(it);
    if (!ans) continue;
    if (normalizeAnswer(ans) === normalizeAnswer(correct)) continue;
    if (distractors.some(x => normalizeAnswer(x) === normalizeAnswer(ans))) continue;
    distractors.push(ans);
    if (distractors.length >= 3) break;
  }

  const options = shuffle([correct, ...distractors].slice(0,4));
  session.lastChoices = options;

  const box = $("#choices");
  box.innerHTML = "";
  options.forEach((opt, i) => {
    const div = document.createElement("div");
    div.className = "choice";
    div.dataset.index = String(i);
    div.innerHTML = `<strong>${i+1}</strong><span>${opt}</span>`;
    div.addEventListener("click", () => onChooseMC(i));
    box.appendChild(div);
  });

  $("#mcBox").classList.remove("hidden");
}

function playAudioForItem(item, form = null) {
  if (!settings.audioOn) return;
  const exts = ["wav","mp3","m4a","ogg"];
  const audio = new Audio();
  audio.volume = settings.volume;

  const paths = [];
  for (const baseName of getAudioBaseNames(item, form)) {
    for (const ext of exts) {
      paths.push(`./audio/${baseName}.${ext}`);
    }
  }

  let idx = 0;
  const tryNext = () => {
    if (idx >= paths.length) return;
    audio.src = paths[idx++];
    audio.play().catch(() => tryNext());
  };
  tryNext();
}

function recordStats(q, correct) {
  const bucket = (q.item.type === "verb") ? stats.verbs : stats.adjectives;
  bucket.answered += 1;
  if (correct) bucket.correct += 1;

  bucket.perForm[q.form] = bucket.perForm[q.form] || { answered: 0, correct: 0 };
  bucket.perForm[q.form].answered += 1;
  if (correct) bucket.perForm[q.form].correct += 1;

  saveStats(stats);
}

function checkAnswer(userAnswer) {
  const q = session.questions[session.idx];
  if (session.awaitingNext) return;

  let expected = [];
  if (q.direction === "dict_to_conj") expected = getExpectedAnswers(q.item, q.form);
  else expected = [q.item.jp_kana, ...(q.item.jp_kanji ? [q.item.jp_kanji] : [])];

  const correct = isAnswerCorrect({
    userAnswer,
    expected,
    itemType: q.item.type === "verb" ? "verb" : "adj",
    form: q.form,
    settings
  });

  q.answered = true;
  q.correct = correct;
  recordStats(q, correct);

  if (correct) {
    $("#feedback").textContent = "✓ Correct";
    $("#feedback").classList.add("good");
  } else {
    $("#feedback").textContent = `✗ Not quite. Correct: ${expected[0]}`;
    $("#feedback").classList.add("bad");
  }

  session.awaitingNext = true;
  $("#btnNext").classList.remove("hidden");
  $("#btnSubmit").classList.add("hidden");
  $("#quizBar").style.width = `${(session.idx+1)/session.questions.length*100}%`;

  if (settings.autoplayAudio) {
    const audioForm = (q.direction === "dict_to_conj") ? q.form : null;
    playAudioForItem(q.item, audioForm);
  }
}

function nextQuestionOrFinish() {
  if (!session) return;
  if (session.idx >= session.questions.length - 1) {
    setTab("stats");
    renderStats();
    session = null;
    return;
  }
  session.idx += 1;
  renderQuestion();
}

function onChooseMC(i) {
  const opt = session.lastChoices?.[i];
  if (!opt) return;
  checkAnswer(opt);
  const nodes = $$("#choices .choice");
  nodes.forEach((n, idx) => {
    n.classList.remove("correct","wrong");
    if (idx === i) n.classList.add(session.questions[session.idx].correct ? "correct" : "wrong");
  });
}

function renderStats() {
  const v = stats.verbs;
  const a = stats.adjectives;
  const pct = (x) => x.answered ? Math.round((x.correct / x.answered) * 100) : 0;

  const formLines = (bucket) => {
    const entries = Object.entries(bucket.perForm || {});
    if (!entries.length) return "<span class='meta'>No form stats yet.</span>";
    return entries.map(([k,val]) => {
      const p = val.answered ? Math.round((val.correct/val.answered) * 100) : 0;
      return `<div class='meta'>${k}: ${val.correct}/${val.answered} (${p}%)</div>`;
    }).join("");
  };

  $("#statsBox").innerHTML = `
    <div class='row'>
      <div class='card' style='padding:14px; flex:1'>
        <div style='font-weight:700; margin-bottom:6px'>Verbs</div>
        <div class='meta'>Answered: ${v.answered} • Correct: ${v.correct} • Accuracy: ${pct(v)}%</div>
        <hr class='sep'/>
        ${formLines(v)}
      </div>
      <div class='card' style='padding:14px; flex:1'>
        <div style='font-weight:700; margin-bottom:6px'>Adjectives</div>
        <div class='meta'>Answered: ${a.answered} • Correct: ${a.correct} • Accuracy: ${pct(a)}%</div>
        <hr class='sep'/>
        ${formLines(a)}
      </div>
    </div>
  `;
}

function resetStats() {
  stats = {
    verbs: { answered: 0, correct: 0, perForm: {} },
    adjectives: { answered: 0, correct: 0, perForm: {} }
  };
  saveStats(stats);
  renderStats();
}

function renderView() {
  const set = $("#viewSet").value;
  const display = $("#viewDisplay").value;
  const starOnly = $("#viewStarOnly").checked;
  const sort = $("#viewSort").value;
  const q = ($("#viewSearch").value || "").trim().toLowerCase();

  let items = (set === "verbs") ? verbs.slice() : adjs.slice();
  if (starOnly) items = items.filter(it => isStarred(it.id));

  if (q) {
    items = items.filter(it => {
      const blob = `${it.jp_kana} ${it.jp_kanji || ""} ${it.en || ""}`.toLowerCase();
      return blob.includes(q);
    });
  }

  if (sort === "starred") {
    items.sort((a,b) => (isStarred(b.id) - isStarred(a.id)) || a.jp_kana.localeCompare(b.jp_kana));
  } else if (sort === "alpha") {
    items.sort((a,b) => a.jp_kana.localeCompare(b.jp_kana));
  }

  $("#viewCount").textContent = `Showing ${items.length} item(s).`;

  const body = $("#viewBody");
  body.innerHTML = "";

  for (const it of items) {
    const tr = document.createElement("tr");

    const tdStar = document.createElement("td");
    const b = document.createElement("button");
    b.className = "secondary starBtn";
    b.textContent = isStarred(it.id) ? "★" : "☆";
    b.addEventListener("click", () => {
      toggleStar(it.id);
      renderView();
    });
    tdStar.appendChild(b);

    const tdJP = document.createElement("td");
    tdJP.innerHTML = `<div style='font-weight:700'>${getJP(it, display)}</div><div class='meta'>${it.type === "verb" ? "verb" : (it.class === "na" ? "な-adj" : "い-adj")}</div><div class='meta'>${getPrimaryAudioPath(it)}</div>`;

    const tdForms = document.createElement("td");
    const chips = document.createElement("div");
    chips.className = "chips";

    const forms = (it.type === "verb") ? ["present","past","negative","past_negative"] : ["past","negative","past_negative"];

    const out = document.createElement("div");
    out.className = "meta";
    out.style.marginTop = "8px";

    forms.forEach(form => {
      const c = document.createElement("button");
      c.className = "chip";
      c.textContent = (it.type === "verb")
        ? ({present:"Present",past:"Past",negative:"Neg",past_negative:"PastNeg"}[form])
        : ({past:"Past",negative:"Neg",past_negative:"PastNeg"}[form]);

      c.addEventListener("click", () => {
        chips.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
        c.classList.add("active");
        const conj = getConjugated(it, form, display) || getConjugated(it, form, "kana");
        if (!conj) {
          out.textContent = "(no conjugation)";
          return;
        }
        out.innerHTML = `<div>${conj}</div><div class='meta'>${getPrimaryAudioPath(it, form)}</div>`;
      });
      chips.appendChild(c);
    });

    tdForms.appendChild(chips);
    tdForms.appendChild(out);

    const tdEN = document.createElement("td");
    tdEN.textContent = it.en || "";

    tr.appendChild(tdStar);
    tr.appendChild(tdJP);
    tr.appendChild(tdForms);
    tr.appendChild(tdEN);
    body.appendChild(tr);
  }
}

function audioSelfCheck() {
  $("#audioStatus").textContent = "Audio self-check works best after deploying. Add files to /audio named <id>.<ext> (e.g., audio/verb_001.wav).";
}

function initEvents() {
  $$(".tabbtn").forEach(btn => btn.addEventListener("click", () => {
    setTab(btn.dataset.tab);
    if (btn.dataset.tab === "view") renderView();
    if (btn.dataset.tab === "stats") renderStats();
    if (btn.dataset.tab === "settings") loadSettingsUI();
  }));

  $$("input[name='wordType']").forEach(r => r.addEventListener("change", applyWordTypeUI));

  $("#btnStart").addEventListener("click", () => startSession(readStudySetup(), false));
  $("#btnPracticeStar").addEventListener("click", () => startSession(readStudySetup(), true));

  $("#btnSubmit").addEventListener("click", () => checkAnswer($("#answerInput").value));
  $("#btnNext").addEventListener("click", nextQuestionOrFinish);

  $("#btnExit").addEventListener("click", () => { session = null; setTab("study"); loadDefaultsToStudyUI(); });

  $("#btnStar").addEventListener("click", () => {
    const q = session?.questions?.[session.idx];
    if (!q) return;
    toggleStar(q.item.id);
    $("#btnStar").textContent = isStarred(q.item.id) ? "★" : "☆";
  });

  $("#btnReplay").addEventListener("click", () => {
    const q = session?.questions?.[session.idx];
    if (!q) return;
    const audioForm = (q.direction === "dict_to_conj") ? q.form : null;
    playAudioForItem(q.item, audioForm);
  });

  $("#viewSet").addEventListener("change", renderView);
  $("#viewDisplay").addEventListener("change", renderView);
  $("#viewSort").addEventListener("change", renderView);
  $("#viewStarOnly").addEventListener("change", renderView);
  $("#viewSearch").addEventListener("input", renderView);
  $("#btnViewReset").addEventListener("click", () => {
    $("#viewSet").value = "verbs";
    $("#viewDisplay").value = settings.displayMode;
    $("#viewSort").value = "default";
    $("#viewStarOnly").checked = false;
    $("#viewSearch").value = "";
    renderView();
  });

  ["setAudioOn","setAutoplay","setSmart","setVol","setDisplay","setQCount","setShowEnglish","setStarOnly","setDewa"].forEach(id => {
    $("#"+id).addEventListener("change", saveSettingsFromUI);
  });

  $("#btnResetStars").addEventListener("click", () => {
    if (!confirm("Reset all stars?")) return;
    stars = {};
    saveStars(stars);
    updateTopPills();
    renderView();
  });

  $("#btnResetStats").addEventListener("click", () => {
    if (!confirm("Reset stats?")) return;
    resetStats();
  });

  $("#btnAudioCheck").addEventListener("click", audioSelfCheck);

  window.addEventListener("keydown", (e) => {
    if ($("#tab-quiz").classList.contains("hidden")) return;

    if (e.key === "/") { e.preventDefault(); $("#answerInput").focus(); }
    if (e.key === "`") { e.preventDefault(); $("#btnStar").click(); }
    if (e.key === "=") { e.preventDefault(); $("#btnReplay").click(); }

    if (e.key === "Enter") {
      e.preventDefault();
      if (!session) return;
      if (session.awaitingNext) $("#btnNext").click();
      else {
        if (session.setup.answerType === "mc") return;
        $("#btnSubmit").click();
      }
    }

    if (["1","2","3","4"].includes(e.key)) {
      if (session?.setup?.answerType !== "mc") return;
      onChooseMC(Number(e.key) - 1);
    }
  });
}

async function init() {
  await fetchData();
  initEvents();
  applyWordTypeUI();
  loadDefaultsToStudyUI();
  loadSettingsUI();
  renderStats();

  $("#viewDisplay").value = settings.displayMode;
  renderView();

  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  }
}

init();
