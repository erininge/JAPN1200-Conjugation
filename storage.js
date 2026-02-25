const STORAGE_KEYS = {
  SETTINGS: "j1200c_settings_v1",
  STARS: "j1200c_stars_v1",
  STATS: "j1200c_stats_v1"
};

export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  const defaults = {
    audioOn: true,
    volume: 0.9,
    autoplayAudio: false,
    smartGrading: true,
    displayMode: "kana", // kana|kanji
    showEnglish: false,
    starredOnly: false,
    questionCount: 20,
    acceptDewaArimasen: false
  };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function loadStars() {
  const raw = localStorage.getItem(STORAGE_KEYS.STARS);
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
}

export function saveStars(stars) {
  localStorage.setItem(STORAGE_KEYS.STARS, JSON.stringify(stars));
}

export function loadStats() {
  const raw = localStorage.getItem(STORAGE_KEYS.STATS);
  const defaults = {
    verbs: { answered: 0, correct: 0, perForm: {} },
    adjectives: { answered: 0, correct: 0, perForm: {} }
  };
  if (!raw) return defaults;
  try { return { ...defaults, ...JSON.parse(raw) }; } catch { return defaults; }
}

export function saveStats(stats) {
  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}
