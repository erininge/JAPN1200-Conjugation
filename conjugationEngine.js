// Conjugation engine (formal / ます-style, plus adjective polite forms)

const GODAN_I_STEM = {
  "う":"い","く":"き","ぐ":"ぎ","す":"し","つ":"ち","ぬ":"に","ぶ":"び","む":"み","る":"り"
};

function replaceOkurigana(kanji, kana, newKana) {
  // Best-effort: replace the kana ending in the kanji string.
  if (!kanji) return "";
  for (let n = 2; n >= 1; n--) {
    const suf = kana.slice(-n);
    if (kanji.endsWith(suf)) {
      return kanji.slice(0, kanji.length - n) + newKana;
    }
  }
  return "";
}

export function conjugateVerb(item, form) {
  const kana = item.jp_kana;
  const kanji = item.jp_kanji || "";
  const cls = item.class;

  let stemKana = "";
  let stemKanji = "";

  if (cls === "irregular") {
    if (kana === "する" || kana.endsWith("する")) {
      stemKana = kana.slice(0, -2) + "し";
      stemKanji = kanji ? (kanji.endsWith("する") ? kanji.slice(0, -2) + "し" : "") : "";
    } else if (kana === "くる" || kana.endsWith("くる")) {
      stemKana = kana.slice(0, -2) + "き";
      stemKanji = kanji ? replaceOkurigana(kanji, kana, "き") : "";
    } else {
      stemKana = kana.slice(0, -1);
      stemKanji = kanji ? replaceOkurigana(kanji, kana, stemKana.slice(-1)) : "";
    }
  } else if (cls === "ichidan") {
    if (!kana.endsWith("る")) throw new Error("Ichidan verb must end with る: " + kana);
    stemKana = kana.slice(0, -1);
    stemKanji = kanji ? replaceOkurigana(kanji, kana, "") : "";
  } else {
    const last = kana.slice(-1);
    const repl = GODAN_I_STEM[last];
    if (!repl) throw new Error("Unknown godan ending: " + kana);
    stemKana = kana.slice(0, -1) + repl;
    stemKanji = kanji ? replaceOkurigana(kanji, kana, repl) : "";
  }

  const ending = (f) => {
    if (f === "present") return "ます";
    if (f === "negative") return "ません";
    if (f === "past") return "ました";
    if (f === "past_negative") return "ませんでした";
    throw new Error("Unknown verb form: " + f);
  };

  const end = ending(form);
  return {
    kana: stemKana + end,
    kanji: stemKanji ? stemKanji + end : ""
  };
}

export function conjugateAdj(item, form) {
  const kana = item.jp_kana;
  const kanji = item.jp_kanji || "";
  const cls = item.class; // i|na

  if (cls === "i") {
    const baseKana = (kana === "いい") ? "よ" : kana.slice(0, -1);
    const baseKanji = (() => {
      if (!kanji) return "";
      if (kana === "いい") return "";
      if (kanji.endsWith("い")) return kanji.slice(0, -1);
      return replaceOkurigana(kanji, kana, "");
    })();

    if (form === "negative") return { kana: baseKana + "くないです", kanji: baseKanji ? baseKanji + "くないです" : "" };
    if (form === "past") return { kana: baseKana + "かったです", kanji: baseKanji ? baseKanji + "かったです" : "" };
    if (form === "past_negative") return { kana: baseKana + "くなかったです", kanji: baseKanji ? baseKanji + "くなかったです" : "" };
    throw new Error("Unknown i-adj form: " + form);
  } else {
    if (form === "negative") return { kana: kana + "じゃないです", kanji: kanji ? kanji + "じゃないです" : "" };
    if (form === "past") return { kana: kana + "でした", kanji: kanji ? kanji + "でした" : "" };
    if (form === "past_negative") return { kana: kana + "じゃなかったです", kanji: kanji ? kanji + "じゃなかったです" : "" };
    throw new Error("Unknown na-adj form: " + form);
  }
}

export function normalizeAnswer(s) {
  return (s || "").trim().replace(/\s+/g, "");
}

export function isAnswerCorrect({ userAnswer, expected, itemType, form, settings }) {
  const ua = normalizeAnswer(userAnswer);
  const exp = Array.isArray(expected) ? expected.map(normalizeAnswer) : [normalizeAnswer(expected)];

  if (exp.includes(ua)) return true;

  // Accept ではありません style for な-adj if enabled
  if (settings?.acceptDewaArimasen && itemType === "adj") {
    if (form === "negative") {
      const alt = normalizeAnswer((expected[0] || "").replace("じゃないです", "ではありません"));
      if (ua === alt) return true;
    }
    if (form === "past_negative") {
      const alt = normalizeAnswer((expected[0] || "").replace("じゃなかったです", "ではありませんでした"));
      if (ua === alt) return true;
    }
  }

  // Smart grading: allow missing です for adjectives
  if (settings?.smartGrading && itemType === "adj") {
    const expNoDesu = exp.map(x => x.replace(/です$/, ""));
    if (expNoDesu.includes(ua)) return true;
  }

  return false;
}
