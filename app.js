import { loadSettings, saveSettings, loadStars, saveStars, loadClassMarks, saveClassMarks, loadStats, saveStats } from "./storage.js";
import { conjugateVerb, conjugateAdj, isAnswerCorrect, normalizeAnswer } from "./conjugationEngine.js";
import { createSpeechController } from "./speechRecognition.js";

let settings = loadSettings();
let stars = loadStars();
let classMarks = loadClassMarks();
let stats = loadStats();

let verbs = [];
let adjs = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function applyMobileLayout() {
  const isMobile = window.matchMedia("(max-width: 780px)").matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  document.body.classList.toggle("mobile", isMobile);
}

function showToast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 220);
  }, 1800);
}

function syncSpeakingPanels() {
  const setup = $("#speakingSetup");
  const game = $("#speakingGame");
  if (!setup || !game) return;

  const hasSpeakingSession = !!(speakingSession && speakingSession.questions?.length);
  setup.classList.toggle("hidden", hasSpeakingSession);
  game.classList.toggle("hidden", !hasSpeakingSession);

  if (setup.classList.contains("hidden") && game.classList.contains("hidden")) {
    setup.classList.remove("hidden");
  }
}

function setTab(name) {
  $$(".tabbtn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  $("#tab-study").classList.toggle("hidden", name !== "study");
  $("#tab-speaking").classList.toggle("hidden", name !== "speaking");
  $("#tab-type").classList.toggle("hidden", name !== "type");
  $("#tab-view").classList.toggle("hidden", name !== "view");
  $("#tab-stats").classList.toggle("hidden", name !== "stats");
  $("#tab-settings").classList.toggle("hidden", name !== "settings");
  $("#tab-quiz").classList.add("hidden");
  if (name !== "type") {
    $("#typeSetup").classList.remove("hidden");
    $("#typeGame").classList.add("hidden");
  }
  if (name === "speaking") {
    syncSpeakingPanels();
  }
}

function showQuiz() {
  $("#tab-study").classList.add("hidden");
  $("#tab-speaking").classList.add("hidden");
  $("#tab-type").classList.add("hidden");
  $("#tab-view").classList.add("hidden");
  $("#tab-stats").classList.add("hidden");
  $("#tab-settings").classList.add("hidden");
  $("#tab-quiz").classList.remove("hidden");
}

function updateTopPills() {
  $("#pillTotal").textContent = `Verbs: ${verbs.length}`;
  $("#pillAdj").textContent = `Adjectives: ${adjs.length}`;
  const starCount = Object.values(stars).filter(Boolean).length;
  const classCount = Object.values(classMarks).filter(Boolean).length;
  $("#pillStars").textContent = `⭐ ${starCount}`;
  $("#pillClass").textContent = `📘 ${classCount}`;
}

function getJP(item, displayMode) {
  if (displayMode === "kanji" && item.jp_kanji) return item.jp_kanji;
  return item.jp_kana;
}

function getWordTypeHint(item) {
  if (item.type === "adj") return item.class === "na" ? "(な)" : "(い)";
  if (item.class === "ichidan") return "(Ichidan)";
  if (item.class === "godan") return "(Godan)";
  return "(Irregular)";
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

function isClassMarked(id) { return !!classMarks[id]; }
function toggleClassMark(id) {
  classMarks[id] = !classMarks[id];
  saveClassMarks(classMarks);
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

function applySpeakingWordTypeUI() {
  const wt = $$("input[name='speakingWordType']").find(r => r.checked)?.value || "verbs";
  const verbBox = $("#speakingVerbFormsBox");
  const adjBox = $("#speakingAdjFormsBox");
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
  $("#classOnly").checked = settings.classOnly;
  $("#showEnglish").checked = settings.showEnglish;
  $("#showHint").checked = settings.showHint;
  $("#showWordTypeHint").checked = settings.showWordTypeHint;

  $("#typeDisplayMode").value = settings.displayMode;
  $("#typeQuestionCount").value = settings.questionCount;
  $("#typeStarredOnly").checked = settings.starredOnly;
  $("#typeClassOnly").checked = settings.classOnly;
  $("#typeShowEnglish").checked = settings.showEnglish;

  $("#speakingDisplayMode").value = settings.displayMode;
  $("#speakingQuestionCount").value = settings.questionCount;
  $("#speakingStarredOnly").checked = settings.starredOnly;
  $("#speakingClassOnly").checked = settings.classOnly;
  $("#speakingShowEnglish").checked = settings.showEnglish;
  $("#speakingShowHint").checked = settings.showHint;
  $("#speakingShowWordTypeHint").checked = settings.showWordTypeHint;
}

function loadSettingsUI() {
  $("#setAudioOn").checked = settings.audioOn;
  $("#setAutoplay").checked = settings.autoplayAudio;
  $("#setSmart").checked = settings.smartGrading;
  $("#setVol").value = settings.volume;
  $("#setDisplay").value = settings.displayMode;
  $("#setQCount").value = settings.questionCount;
  $("#setShowEnglish").checked = settings.showEnglish;
  $("#setShowHint").checked = settings.showHint;
  $("#setStarOnly").checked = settings.starredOnly;
  $("#setClassOnly").checked = settings.classOnly;
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
  settings.showHint = $("#setShowHint").checked;
  settings.starredOnly = $("#setStarOnly").checked;
  settings.classOnly = $("#setClassOnly").checked;
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

  const allItems = verbs.concat(adjs);
  let changed = false;
  for (const it of allItems) {
    if (it.list === "class" && !classMarks[it.id]) {
      classMarks[it.id] = true;
      changed = true;
    }
  }
  if (changed) saveClassMarks(classMarks);

  updateTopPills();
}

let session = null;
let typeSession = null;
let speakingSession = null;
const speechController = createSpeechController();
let swRegistration = null;
let appRefreshInProgress = false;



function readTypeSetup() {
  const wt = $$("input[name='typeWordType']").find(r => r.checked)?.value || "verbs";
  return {
    wt,
    displayMode: $("#typeDisplayMode").value,
    questionCount: Number($("#typeQuestionCount").value || 20),
    starredOnly: $("#typeStarredOnly").checked,
    classOnly: $("#typeClassOnly").checked,
    showEnglish: $("#typeShowEnglish").checked,
    showWordTypeHint: $("#showWordTypeHint").checked
  };
}

function getWaitingWorker(reg) {
  return reg?.waiting || null;
}

function promptUpdateReady() {
  showToast("Update ready. Tap Refresh app.");
}

async function refreshAppNow() {
  if (appRefreshInProgress) return;
  appRefreshInProgress = true;
  const btn = $("#btnRefreshApp");
  if (btn) btn.disabled = true;
  showToast("Checking for updates…");

  try {
    const reg = swRegistration || await navigator.serviceWorker.getRegistration();
    if (!reg) {
      window.location.reload();
      return;
    }

    swRegistration = reg;
    await reg.update();
    const waiting = getWaitingWorker(reg);
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      return;
    }

    // If no update is waiting, force a network reload for index.
    window.location.reload();
  } catch (e) {
    console.warn("Refresh failed, reloading page instead.", e);
    window.location.reload();
  } finally {
    setTimeout(() => {
      appRefreshInProgress = false;
      if (btn) btn.disabled = false;
    }, 800);
  }
}

function initRefreshButton() {
  const btn = $("#btnRefreshApp");
  if (!btn) return;
  btn.addEventListener("click", refreshAppNow);
}

function watchServiceWorkerUpdates(reg) {
  const attachInstallListener = (worker) => {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        promptUpdateReady();
      }
    });
  };

  attachInstallListener(reg.installing);
  reg.addEventListener("updatefound", () => attachInstallListener(reg.installing));

  if (getWaitingWorker(reg)) promptUpdateReady();
}

function buildTypePool(setup) {
  let items = [];
  if (setup.wt === "verbs") items = verbs.slice();
  else if (setup.wt === "adjs") items = adjs.slice();
  else items = verbs.concat(adjs);

  if (setup.starredOnly) items = items.filter(it => isStarred(it.id));
  if (setup.classOnly) items = items.filter(it => isClassMarked(it.id));
  return items;
}

function startTypeSession(setup) {
  const pool = buildTypePool(setup);
  if (pool.length === 0) {
    alert("No items matched your selection (try turning off Starred only or add words).");
    return;
  }

  const questions = [];
  for (let i=0;i<setup.questionCount;i++) questions.push({ item: randPick(pool), answered:false, correct:false });

  typeSession = { setup, idx:0, questions, awaitingNext:false, lastChoices:[] };
  $("#typeSetup").classList.add("hidden");
  $("#typeGame").classList.remove("hidden");
  renderTypeQuestion();
}

function getTypeChoices(item) {
  if (item.type === "verb") return [
    { label: "Ichidan", value: "ichidan" },
    { label: "Godan", value: "godan" },
    { label: "Irregular", value: "irregular" }
  ];
  return [
    { label: "な-adjective", value: "na" },
    { label: "い-adjective", value: "i" }
  ];
}

function renderTypeQuestion() {
  const q = typeSession.questions[typeSession.idx];
  const total = typeSession.questions.length;
  const n = typeSession.idx + 1;

  $("#typeMeta").textContent = `${n}/${total} • ${q.item.type === "verb" ? "Verb" : "Adjective"} type`;
  $("#typeBar").style.width = `${(n-1)/total*100}%`;
  $("#typePrompt").textContent = getJP(q.item, typeSession.setup.displayMode);
  const typePrompt = getJP(q.item, typeSession.setup.displayMode);
  const typeHint = typeSession.setup.showWordTypeHint ? ` ${getWordTypeHint(q.item)}` : "";
  $("#typePrompt").textContent = `${typePrompt}${typeHint}`;
  $("#btnTypeStar").textContent = isStarred(q.item.id) ? "★" : "☆";
  $("#btnTypeClass").textContent = isClassMarked(q.item.id) ? "📘" : "📗";

  const englishLine = $("#typeEnglishPrompt");
  if (typeSession.setup.showEnglish && q.item.en) {
    englishLine.textContent = q.item.en;
    englishLine.classList.remove("hidden");
  } else {
    englishLine.textContent = "";
    englishLine.classList.add("hidden");
  }

  const options = getTypeChoices(q.item);
  typeSession.lastChoices = options;
  const box = $("#typeChoices");
  box.innerHTML = "";
  options.forEach((opt, i) => {
    const div = document.createElement("div");
    div.className = "choice";
    div.dataset.index = String(i);
    div.innerHTML = `<strong>${i+1}</strong><span>${opt.label}</span>`;
    div.addEventListener("click", () => onChooseType(i));
    box.appendChild(div);
  });

  $("#typeFeedback").textContent = "";
  $("#typeFeedback").className = "feedback";
  $("#btnTypeNext").classList.add("hidden");
  typeSession.awaitingNext = false;
}

function recordTypeStats(q, correct) {
  const bucket = (q.item.type === "verb") ? stats.verbs : stats.adjectives;
  bucket.answered += 1;
  if (correct) bucket.correct += 1;

  const key = "type_guess";
  bucket.perForm[key] = bucket.perForm[key] || { answered: 0, correct: 0 };
  bucket.perForm[key].answered += 1;
  if (correct) bucket.perForm[key].correct += 1;

  saveStats(stats);
}

function checkTypeAnswer(selectedValue) {
  const q = typeSession.questions[typeSession.idx];
  if (typeSession.awaitingNext) return;

  const correct = selectedValue === q.item.class;
  q.answered = true;
  q.correct = correct;
  recordTypeStats(q, correct);

  if (correct) {
    $("#typeFeedback").textContent = "✓ Correct";
    $("#typeFeedback").classList.add("good");
  } else {
    const options = getTypeChoices(q.item);
    const label = options.find(x => x.value === q.item.class)?.label || q.item.class;
    $("#typeFeedback").textContent = `✗ Not quite. Correct: ${label}`;
    $("#typeFeedback").classList.add("bad");
  }

  typeSession.awaitingNext = true;
  $("#btnTypeNext").classList.remove("hidden");
  $("#typeBar").style.width = `${(typeSession.idx+1)/typeSession.questions.length*100}%`;

  if (settings.autoplayAudio) playAudioForItem(q.item);
}

function onChooseType(i) {
  const opt = typeSession.lastChoices?.[i];
  if (!opt) return;
  checkTypeAnswer(opt.value);
  const nodes = $$("#typeChoices .choice");
  nodes.forEach((n, idx) => {
    n.classList.remove("correct", "wrong");
    if (idx === i) n.classList.add(typeSession.questions[typeSession.idx].correct ? "correct" : "wrong");
    if (typeSession.awaitingNext && typeSession.lastChoices[idx]?.value === typeSession.questions[typeSession.idx].item.class) n.classList.add("correct");
  });
}

function nextTypeQuestionOrFinish() {
  if (!typeSession) return;
  if (typeSession.idx >= typeSession.questions.length - 1) {
    setTab("stats");
    renderStats();
    typeSession = null;
    $("#typeGame").classList.add("hidden");
    $("#typeSetup").classList.remove("hidden");
    return;
  }
  typeSession.idx += 1;
  renderTypeQuestion();
}

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
    classOnly: $("#classOnly").checked,
    showEnglish: $("#showEnglish").checked,
    showHint: $("#showHint").checked
  };
}

function readSpeakingSetup() {
  const wt = $$("input[name='speakingWordType']").find(r => r.checked)?.value || "verbs";
  const verbForms = $$(".svf").filter(x => x.checked).map(x => x.value);
  const adjForms = $$(".saf").filter(x => x.checked).map(x => x.value);
  return {
    wt,
    verbForms,
    adjForms,
    questionType: $("#speakingQuestionType").value,
    answerType: "speech",
    displayMode: $("#speakingDisplayMode").value,
    questionCount: Number($("#speakingQuestionCount").value || 20),
    starredOnly: $("#speakingStarredOnly").checked,
    classOnly: $("#speakingClassOnly").checked,
    showEnglish: $("#speakingShowEnglish").checked,
    showHint: $("#speakingShowHint").checked,
    showWordTypeHint: $("#speakingShowWordTypeHint").checked
  };
}

function buildPool(setup) {
  let items = [];
  if (setup.wt === "verbs") items = verbs.slice();
  else if (setup.wt === "adjs") items = adjs.slice();
  else items = verbs.concat(adjs);

  if (setup.starredOnly) items = items.filter(it => isStarred(it.id));
  if (setup.classOnly) items = items.filter(it => isClassMarked(it.id));

  const tasks = [];
  for (const it of items) {
    const forms = (it.type === "verb") ? setup.verbForms : setup.adjForms;
    for (const form of forms) {
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

function startSession(setup, forceStarred=false, forceClass=false) {
  if (forceStarred) setup.starredOnly = true;
  if (forceClass) setup.classOnly = true;
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

  const maxUniqueQuestions = pool.length;
  const targetQuestionCount = Math.min(setup.questionCount, maxUniqueQuestions);
  if (setup.questionCount > maxUniqueQuestions) {
    showToast(`Only ${maxUniqueQuestions} unique word+form questions available. Using ${maxUniqueQuestions}.`);
  }

  const uniqueTasks = shuffle(pool.slice()).slice(0, targetQuestionCount);
  const questions = [];
  for (const task of uniqueTasks) {
    let direction = setup.questionMode;
    if (direction === "mixed") direction = (Math.random() < 0.5) ? "dict_to_conj" : "conj_to_dict";
    questions.push({ item: task.item, form: task.form, direction, answered:false, correct:false });
  }

  session = { setup, idx:0, questions, awaitingNext:false, lastChoices:null };
  showQuiz();
  renderQuestion();
}

function buildSpeakingQuestions(setup, tasks) {
  const uniqueTasks = shuffle(tasks.slice()).slice(0, Math.min(setup.questionCount, tasks.length));
  return uniqueTasks.map(task => ({
    item: task.item,
    form: task.form,
    direction: setup.questionType === "mixed"
      ? (Math.random() < 0.5 ? "dict_to_conj" : "conj_to_dict")
      : setup.questionType,
    answered: false,
    correct: false,
    heard: ""
  }));
}

function startSpeakingSession(setup, forceStarred = false, forceClass = false) {
  if (!speechController.supported) {
    $("#speakingUnsupported").classList.remove("hidden");
    return;
  }
  if (forceStarred) setup.starredOnly = true;
  if (forceClass) setup.classOnly = true;
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
  if (setup.questionCount > pool.length) {
    showToast(`Only ${pool.length} unique word+form questions available. Using ${pool.length}.`);
  }

  speakingSession = { setup, idx: 0, questions: buildSpeakingQuestions(setup, pool), awaitingNext: false };
  $("#speakingSetup").classList.add("hidden");
  $("#speakingGame").classList.remove("hidden");
  renderSpeakingQuestion();
}

function describeFormBase(itemType, form) {
  const mapV = { present:"Present", negative:"Negative", past:"Past", past_negative:"Past negative" };
  const mapA = { present:"Present", negative:"Negative", past:"Past", past_negative:"Past negative" };
  return (itemType === "verb") ? mapV[form] : mapA[form];
}

function describeFormHint(item, form) {
  if (item.type === "verb") {
    const map = { present:"(ます)", negative:"(ません)", past:"(ました)", past_negative:"(ませんでした)" };
    return map[form] || "";
  }

  if (item.class === "i") {
    const map = { present:"(〜です)", negative:"(〜くないです)", past:"(〜かったです)", past_negative:"(〜くなかったです)" };
    return map[form] || "";
  }

  const map = { present:"(〜です)", negative:"(〜じゃないです)", past:"(〜でした)", past_negative:"(〜じゃなかったです)" };
  return map[form] || "";
}


function renderQuestion() {
  const q = session.questions[session.idx];
  const { displayMode, showEnglish, answerType } = session.setup;

  const total = session.questions.length;
  const n = session.idx + 1;
  $("#quizMeta").textContent = `${n}/${total} • ${q.item.type === "verb" ? "Verb" : "Adjective"} • ${q.direction === "dict_to_conj" ? "Dict→Conj" : "Conj→Dict"}`;
  $("#quizBar").style.width = `${(n-1)/total*100}%`;

  $("#btnStar").textContent = isStarred(q.item.id) ? "★" : "☆";
  $("#btnClass").textContent = isClassMarked(q.item.id) ? "📘" : "📗";

  let promptJP = "";
  let expected = [];
  let answerLabel = "";

  if (q.direction === "dict_to_conj") {
    promptJP = getJP(q.item, displayMode);
    expected = getExpectedAnswers(q.item, q.form);
    const base = describeFormBase(q.item.type, q.form);
    const hint = session.setup.showHint ? ` ${describeFormHint(q.item, q.form)}` : "";
    answerLabel = `Answer: ${base}${hint}`.trim();
  } else {
    promptJP = getConjugated(q.item, q.form, displayMode);
    expected = [q.item.jp_kana, ...(q.item.jp_kanji ? [q.item.jp_kanji] : [])];
    answerLabel = "Answer: Dictionary";
  }

  const showHintTag = settings.showWordTypeHint && q.direction === "dict_to_conj";
  const promptWithHint = showHintTag ? `${promptJP} ${getWordTypeHint(q.item)}` : promptJP;
  $("#prompt").textContent = promptWithHint;
  $("#subPrompt").textContent = answerLabel;

  const englishLine = $("#englishPrompt");
  if (showEnglish && q.item.en) {
    englishLine.textContent = q.item.en;
    englishLine.classList.remove("hidden");
  } else {
    englishLine.textContent = "";
    englishLine.classList.add("hidden");
  }

  $("#feedback").textContent = "";
  $("#feedback").className = "feedback";

  session.awaitingNext = false;
  $("#btnNext").classList.add("hidden");
  $("#btnSubmit").classList.remove("hidden");

  const useTyping = (answerType === "typing" || answerType === "both");
  $("#typingBox").classList.toggle("hidden", !useTyping);
  $("#mcBox").classList.toggle("hidden", useTyping);
  $("#btnSubmit").classList.toggle("hidden", !useTyping);

  $("#answerInput").value = "";
  $("#answerInput").focus();

  if (answerType === "mc") {
    buildAndShowChoices(expected[0], q);
  }
}

function getSpeakingExpectedAnswers(q) {
  if (q.direction === "dict_to_conj") return getExpectedAnswers(q.item, q.form);
  return [q.item.jp_kana, ...(q.item.jp_kanji ? [q.item.jp_kanji] : [])];
}

function renderSpeakingQuestion() {
  const q = speakingSession.questions[speakingSession.idx];
  const total = speakingSession.questions.length;
  const n = speakingSession.idx + 1;
  const modeLabel = q.direction === "dict_to_conj" ? "Dict→Conj" : "Conj→Dict";
  $("#speakingMeta").textContent = `${n}/${total} • ${q.item.type === "verb" ? "Verb" : "Adjective"} • ${modeLabel}`;
  $("#speakingBar").style.width = `${(n - 1) / total * 100}%`;
  $("#btnSpeakingStar").textContent = isStarred(q.item.id) ? "★" : "☆";
  $("#btnSpeakingClass").textContent = isClassMarked(q.item.id) ? "📘" : "📗";

  if (q.direction === "dict_to_conj") {
    const promptJP = getJP(q.item, speakingSession.setup.displayMode);
    const base = describeFormBase(q.item.type, q.form).toLowerCase();
    const typeHint = speakingSession.setup.showWordTypeHint ? ` ${getWordTypeHint(q.item)}` : "";
    $("#speakingPrompt").textContent = `${promptJP} ${base}${typeHint}`.trim();
    const hint = speakingSession.setup.showHint ? ` ${describeFormHint(q.item, q.form)}` : "";
    $("#speakingSubPrompt").textContent = `Speak the conjugated form${hint}`.trim();
    if (speakingSession.setup.showEnglish && q.item.en) {
      $("#speakingEnglishPrompt").textContent = q.item.en;
      $("#speakingEnglishPrompt").classList.remove("hidden");
    } else {
      $("#speakingEnglishPrompt").textContent = "";
      $("#speakingEnglishPrompt").classList.add("hidden");
    }
  } else {
    const promptJP = getConjugated(q.item, q.form, speakingSession.setup.displayMode);
    $("#speakingPrompt").textContent = promptJP;
    $("#speakingSubPrompt").textContent = "Speak: Dictionary form";
    if (speakingSession.setup.showEnglish) {
      const base = getJP(q.item, speakingSession.setup.displayMode);
      const hint = speakingSession.setup.showWordTypeHint ? ` ${getWordTypeHint(q.item)}` : "";
      $("#speakingEnglishPrompt").textContent = `Answer concept: ${base}${hint}`.trim();
      $("#speakingEnglishPrompt").classList.remove("hidden");
    } else {
      $("#speakingEnglishPrompt").textContent = "";
      $("#speakingEnglishPrompt").classList.add("hidden");
    }
  }

  $("#speakingFeedback").textContent = "";
  $("#speakingFeedback").className = "feedback";
  $("#speakingHeard").textContent = "";
  $("#speakingListenStatus").textContent = "Tap 🎤 Speak to answer.";
  $("#btnSpeakingListen").textContent = "🎤 Tap to speak";
  $("#btnSpeakingListen").disabled = false;
  $("#btnSpeakingNext").classList.add("hidden");
  speakingSession.awaitingNext = false;
}

function buildAndShowChoices(_correctAnswer, q) {
  const { displayMode } = session.setup;
  const allItems = (q.item.type === "verb") ? verbs : adjs;
  const formsForType = q.item.type === "verb"
    ? ["present", "negative", "past", "past_negative"]
    : ["present", "negative", "past", "past_negative"];

  const makeAnswerFor = (it, form = q.form) => {
    if (q.direction === "dict_to_conj") return getConjugated(it, form, displayMode) || getConjugated(it, form, "kana");
    return getJP(it, displayMode) || it.jp_kana;
  };

  const correct = (q.direction === "dict_to_conj")
    ? (getConjugated(q.item, q.form, displayMode) || getConjugated(q.item, q.form, "kana"))
    : (getJP(q.item, displayMode) || q.item.jp_kana);

  const seen = new Set([normalizeAnswer(correct)]);
  const distractors = [];

  const tryAddDistractor = (candidate) => {
    if (!candidate) return;
    const key = normalizeAnswer(candidate);
    if (!key || seen.has(key)) return;
    seen.add(key);
    distractors.push(candidate);
  };

  // 1) Hard distractors: same word, wrong form (only for dictionary -> conjugation).
  if (q.direction === "dict_to_conj") {
    for (const form of shuffle(formsForType.filter(f => f !== q.form))) {
      tryAddDistractor(makeAnswerFor(q.item, form));
      if (distractors.length >= 3) break;
    }
  }

  // 2) Same-form distractors from other words of the same part of speech.
  for (const it of shuffle(allItems.slice())) {
    if (it.id === q.item.id) continue;
    tryAddDistractor(makeAnswerFor(it, q.form));
    if (distractors.length >= 3) break;
  }

  // 3) Fallback pool: any allowed form from other words (avoids repeated options).
  if (distractors.length < 3 && q.direction === "dict_to_conj") {
    const extraPairs = [];
    for (const it of allItems) {
      if (it.id === q.item.id) continue;
      for (const form of formsForType) extraPairs.push([it, form]);
    }
    for (const [it, form] of shuffle(extraPairs)) {
      tryAddDistractor(makeAnswerFor(it, form));
      if (distractors.length >= 3) break;
    }
  }

  const options = shuffle([correct, ...distractors].slice(0, 4));
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

function checkSpeakingAnswer(userAnswer) {
  const q = speakingSession.questions[speakingSession.idx];
  if (speakingSession.awaitingNext) return;

  const expected = getSpeakingExpectedAnswers(q);
  const correct = isAnswerCorrect({
    userAnswer,
    expected,
    itemType: q.item.type === "verb" ? "verb" : "adj",
    form: q.form,
    settings
  });

  q.answered = true;
  q.correct = correct;
  q.heard = userAnswer;
  recordStats(q, correct);

  if (correct) {
    $("#speakingFeedback").textContent = "✓ Correct";
    $("#speakingFeedback").classList.add("good");
  } else {
    $("#speakingFeedback").textContent = `✗ Not quite. Expected: ${expected[0]}`;
    $("#speakingFeedback").classList.add("bad");
  }

  speakingSession.awaitingNext = true;
  $("#btnSpeakingNext").classList.remove("hidden");
  $("#speakingBar").style.width = `${(speakingSession.idx + 1) / speakingSession.questions.length * 100}%`;
}

async function runSpeechCapture() {
  if (!speakingSession || speakingSession.awaitingNext) return;
  if (!speechController.supported) {
    $("#speakingListenStatus").textContent = "Speech recognition is not supported in this browser.";
    return;
  }

  if (speechController.isListening()) {
    speechController.cancel();
    $("#btnSpeakingListen").textContent = "🎤 Tap to speak";
    $("#speakingListenStatus").textContent = "Listening stopped.";
    return;
  }

  $("#btnSpeakingListen").textContent = "⏹ Stop listening";
  $("#speakingListenStatus").textContent = "Listening…";
  try {
    const heard = await speechController.listen({ lang: "ja-JP", maxAlternatives: 3, timeoutMs: 9000 });
    $("#speakingHeard").textContent = `Heard: ${heard || "(no speech detected)"}`;
    checkSpeakingAnswer(heard || "");
    $("#speakingListenStatus").textContent = "Done listening.";
  } catch (err) {
    $("#speakingListenStatus").textContent = err?.message || "Could not listen. Please try again.";
  } finally {
    $("#btnSpeakingListen").textContent = "🎤 Tap to speak";
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

function nextSpeakingQuestionOrFinish() {
  if (!speakingSession) return;
  if (speakingSession.idx >= speakingSession.questions.length - 1) {
    setTab("stats");
    renderStats();
    speakingSession = null;
    $("#speakingGame").classList.add("hidden");
    $("#speakingSetup").classList.remove("hidden");
    return;
  }
  speakingSession.idx += 1;
  renderSpeakingQuestion();
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

function updateViewWordClassOptions() {
  const set = $("#viewSet").value;
  const select = $("#viewWordClass");
  const options = (set === "verbs")
    ? [
      { value: "all", label: "All verbs" },
      { value: "godan", label: "Godan" },
      { value: "ichidan", label: "Ichidan" },
      { value: "irregular", label: "Irregular" }
    ]
    : [
      { value: "all", label: "All adjectives" },
      { value: "i", label: "い-adjective" },
      { value: "na", label: "な-adjective" }
    ];

  const previous = select.value;
  select.innerHTML = "";
  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    select.appendChild(el);
  }
  const stillExists = options.some(opt => opt.value === previous);
  select.value = stillExists ? previous : "all";
}

function renderView() {
  const set = $("#viewSet").value;
  const display = $("#viewDisplay").value;
  const starOnly = $("#viewStarOnly").checked;
  const classOnly = $("#viewClassOnly").checked;
  const wordClass = $("#viewWordClass").value;
  const sort = $("#viewSort").value;
  const q = ($("#viewSearch").value || "").trim().toLowerCase();

  let items = (set === "verbs") ? verbs.slice() : adjs.slice();
  if (wordClass !== "all") items = items.filter(it => it.class === wordClass);
  if (starOnly) items = items.filter(it => isStarred(it.id));
  if (classOnly) items = items.filter(it => isClassMarked(it.id));

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
    b.title = "Toggle star";
    b.addEventListener("click", () => {
      toggleStar(it.id);
      renderView();
    });
    const cmark = document.createElement("button");
    cmark.className = "secondary starBtn";
    cmark.textContent = isClassMarked(it.id) ? "📘" : "📗";
    cmark.title = "Toggle class word";
    cmark.style.marginLeft = "6px";
    cmark.addEventListener("click", () => {
      toggleClassMark(it.id);
      renderView();
    });
    tdStar.appendChild(b);
    tdStar.appendChild(cmark);

    const tdJP = document.createElement("td");
    tdJP.innerHTML = `<div style='font-weight:700'>${getJP(it, display)}</div><div class='meta'>${it.type === "verb" ? `verb (${it.class})` : (it.class === "na" ? "な-adj" : "い-adj")}</div><div class='meta'>List: ${it.list === "class" ? "Class" : "Extra"}</div><div class='meta'>${getPrimaryAudioPath(it)}</div>`;

    const tdForms = document.createElement("td");
    const chips = document.createElement("div");
    chips.className = "chips";

    const forms = (it.type === "verb") ? ["present","past","negative","past_negative"] : ["present","past","negative","past_negative"];

    const out = document.createElement("div");
    out.className = "meta";
    out.style.marginTop = "8px";

    forms.forEach(form => {
      const c = document.createElement("button");
      c.className = "chip";
      c.textContent = (it.type === "verb")
        ? ({present:"Present",past:"Past",negative:"Neg",past_negative:"PastNeg"}[form])
        : ({present:"Present",past:"Past",negative:"Neg",past_negative:"PastNeg"}[form]);

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
    if (btn.dataset.tab === "speaking") {
      $("#speakingUnsupported").classList.toggle("hidden", speechController.supported);
    }
  }));

  $$("input[name='wordType']").forEach(r => r.addEventListener("change", applyWordTypeUI));
  $$("input[name='speakingWordType']").forEach(r => r.addEventListener("change", applySpeakingWordTypeUI));

  $("#showWordTypeHint").addEventListener("change", () => {
    settings.showWordTypeHint = $("#showWordTypeHint").checked;
    saveSettings(settings);
  });

  $("#btnStart").addEventListener("click", () => startSession(readStudySetup(), false));
  $("#btnPracticeStar").addEventListener("click", () => startSession(readStudySetup(), true));
  $("#btnPracticeClass").addEventListener("click", () => startSession(readStudySetup(), false, true));
  $("#btnStartType").addEventListener("click", () => startTypeSession(readTypeSetup()));
  $("#btnTypeNext").addEventListener("click", nextTypeQuestionOrFinish);
  $("#btnTypeExit").addEventListener("click", () => {
    typeSession = null;
    $("#typeGame").classList.add("hidden");
    $("#typeSetup").classList.remove("hidden");
  });

  $("#btnStartSpeaking").addEventListener("click", () => startSpeakingSession(readSpeakingSetup(), false));
  $("#btnSpeakingPracticeStar").addEventListener("click", () => startSpeakingSession(readSpeakingSetup(), true));
  $("#btnSpeakingPracticeClass").addEventListener("click", () => startSpeakingSession(readSpeakingSetup(), false, true));
  $("#btnSpeakingListen").addEventListener("click", runSpeechCapture);
  $("#btnSpeakingNext").addEventListener("click", nextSpeakingQuestionOrFinish);
  $("#btnSpeakingExit").addEventListener("click", () => {
    speakingSession = null;
    speechController.cancel();
    $("#speakingGame").classList.add("hidden");
    $("#speakingSetup").classList.remove("hidden");
  });

  $("#btnSubmit").addEventListener("click", () => checkAnswer($("#answerInput").value));
  $("#btnNext").addEventListener("click", nextQuestionOrFinish);

  $("#btnExit").addEventListener("click", () => { session = null; setTab("study"); loadDefaultsToStudyUI(); });

  $("#btnTypeStar").addEventListener("click", () => {
    const q = typeSession?.questions?.[typeSession.idx];
    if (!q) return;
    toggleStar(q.item.id);
    $("#btnTypeStar").textContent = isStarred(q.item.id) ? "★" : "☆";
  });

  $("#btnTypeClass").addEventListener("click", () => {
    const q = typeSession?.questions?.[typeSession.idx];
    if (!q) return;
    toggleClassMark(q.item.id);
    $("#btnTypeClass").textContent = isClassMarked(q.item.id) ? "📘" : "📗";
  });

  $("#btnTypeReplay").addEventListener("click", () => {
    showToast("Audio is not available at this time.");
  });

  $("#btnStar").addEventListener("click", () => {
    const q = session?.questions?.[session.idx];
    if (!q) return;
    toggleStar(q.item.id);
    $("#btnStar").textContent = isStarred(q.item.id) ? "★" : "☆";
  });

  $("#btnSpeakingStar").addEventListener("click", () => {
    const q = speakingSession?.questions?.[speakingSession.idx];
    if (!q) return;
    toggleStar(q.item.id);
    $("#btnSpeakingStar").textContent = isStarred(q.item.id) ? "★" : "☆";
  });

  $("#btnSpeakingClass").addEventListener("click", () => {
    const q = speakingSession?.questions?.[speakingSession.idx];
    if (!q) return;
    toggleClassMark(q.item.id);
    $("#btnSpeakingClass").textContent = isClassMarked(q.item.id) ? "📘" : "📗";
  });

  $("#btnClass").addEventListener("click", () => {
    const q = session?.questions?.[session.idx];
    if (!q) return;
    toggleClassMark(q.item.id);
    $("#btnClass").textContent = isClassMarked(q.item.id) ? "📘" : "📗";
  });

  $("#btnReplay").addEventListener("click", () => {
    showToast("Audio is not available at this time.");
  });

  $("#viewSet").addEventListener("change", () => {
    updateViewWordClassOptions();
    renderView();
  });
  $("#viewDisplay").addEventListener("change", renderView);
  $("#viewSort").addEventListener("change", renderView);
  $("#viewWordClass").addEventListener("change", renderView);
  $("#viewStarOnly").addEventListener("change", renderView);
  $("#viewClassOnly").addEventListener("change", renderView);
  $("#viewSearch").addEventListener("input", renderView);
  $("#btnViewReset").addEventListener("click", () => {
    $("#viewSet").value = "verbs";
    updateViewWordClassOptions();
    $("#viewDisplay").value = settings.displayMode;
    $("#viewSort").value = "default";
    $("#viewWordClass").value = "all";
    $("#viewStarOnly").checked = false;
    $("#viewClassOnly").checked = false;
    $("#viewSearch").value = "";
    renderView();
  });

  ["setAudioOn","setAutoplay","setSmart","setVol","setDisplay","setQCount","setShowEnglish","setShowHint","setStarOnly","setClassOnly","setDewa"].forEach(id => {
    $("#"+id).addEventListener("change", saveSettingsFromUI);
  });

  $("#btnResetStars").addEventListener("click", () => {
    if (!confirm("Reset all stars?")) return;
    stars = {};
    saveStars(stars);
    updateTopPills();
    renderView();
  });

  $("#btnResetClassMarks").addEventListener("click", () => {
    if (!confirm("Reset all class marks?")) return;
    classMarks = {};
    saveClassMarks(classMarks);
    updateTopPills();
    renderView();
  });

  $("#btnResetStats").addEventListener("click", () => {
    if (!confirm("Reset stats?")) return;
    resetStats();
  });

  $("#btnAudioCheck").addEventListener("click", audioSelfCheck);

  window.addEventListener("keydown", (e) => {
    const inConjQuiz = !$("#tab-quiz").classList.contains("hidden");
    const inTypeQuiz = !$("#tab-type").classList.contains("hidden") && !$("#typeGame").classList.contains("hidden");
    const inSpeakingQuiz = !$("#tab-speaking").classList.contains("hidden") && !$("#speakingGame").classList.contains("hidden");
    if (!inConjQuiz && !inTypeQuiz && !inSpeakingQuiz) return;

    if (e.key === "/" && inConjQuiz) { e.preventDefault(); $("#answerInput").focus(); }
    if (e.key === "`") {
      e.preventDefault();
      if (inConjQuiz) $("#btnStar").click();
      else if (inTypeQuiz) $("#btnTypeStar").click();
      else if (inSpeakingQuiz) $("#btnSpeakingStar").click();
    }
    if (e.key.toLowerCase() === "c") {
      e.preventDefault();
      if (inConjQuiz) $("#btnClass").click();
      else if (inTypeQuiz) $("#btnTypeClass").click();
      else if (inSpeakingQuiz) $("#btnSpeakingClass").click();
    }
    if (e.key === "=") {
      e.preventDefault();
      if (inConjQuiz) $("#btnReplay").click();
      else if (inTypeQuiz) $("#btnTypeReplay").click();
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (inConjQuiz) {
        if (!session) return;
        if (session.awaitingNext) $("#btnNext").click();
        else {
          if (session.setup.answerType === "mc") return;
          $("#btnSubmit").click();
        }
      } else if (inTypeQuiz) {
        if (!typeSession) return;
        if (typeSession.awaitingNext) $("#btnTypeNext").click();
      } else if (inSpeakingQuiz) {
        if (!speakingSession) return;
        if (speakingSession.awaitingNext) $("#btnSpeakingNext").click();
        else $("#btnSpeakingListen").click();
      }
    }

    if (["1","2","3","4"].includes(e.key)) {
      if (inConjQuiz) {
        if (session?.setup?.answerType !== "mc") return;
        onChooseMC(Number(e.key) - 1);
      } else if (inTypeQuiz) {
        onChooseType(Number(e.key) - 1);
      }
    }
  });
}

async function init() {
  applyMobileLayout();
  window.addEventListener("resize", applyMobileLayout);

  await fetchData();
  initEvents();
  applyWordTypeUI();
  applySpeakingWordTypeUI();
  loadDefaultsToStudyUI();
  loadSettingsUI();
  $("#speakingUnsupported").classList.toggle("hidden", speechController.supported);
  syncSpeakingPanels();
  renderStats();

  $("#viewDisplay").value = settings.displayMode;
  updateViewWordClassOptions();
  renderView();
  initRefreshButton();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
    try {
      swRegistration = await navigator.serviceWorker.register("./sw.js");
      watchServiceWorkerUpdates(swRegistration);
      setInterval(() => swRegistration?.update().catch(() => {}), 60 * 1000);
    } catch {}
  }
}

init();
