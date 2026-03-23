export function createSpeechController() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return {
      supported: false,
      listen: async () => "",
      cancel: () => {},
      stop: () => {},
      isListening: () => false
    };
  }

  let activeRecognition = null;
  let activeStopTimer = null;
  let listening = false;
  let stopRequested = false;

  const clearStopTimer = () => {
    if (activeStopTimer) {
      clearTimeout(activeStopTimer);
      activeStopTimer = null;
    }
  };

  const cancel = () => {
    clearStopTimer();
    stopRequested = false;
    if (activeRecognition) {
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      listening = false;
      activeRecognition.abort();
      activeRecognition = null;
    }
  };

  const stop = () => {
    if (!activeRecognition) return;
    stopRequested = true;
    clearStopTimer();
    try {
      activeRecognition.stop();
    } catch {
      // Ignore stop errors and let the active listener resolve via onend/error.
    }
  };

  const mapSpeechError = (code) => {
    if (code === "not-allowed" || code === "service-not-allowed") return "Microphone permission denied.";
    if (code === "aborted") return "Listening stopped.";
    if (code === "no-speech") return "No speech detected. Try again.";
    if (code === "audio-capture") return "No microphone available.";
    if (code === "network") return "Network issue while recognizing speech.";
    return "Could not listen. Please try again.";
  };

  const listen = ({ lang = "ja-JP", maxAlternatives = 3, timeoutMs = 9000 } = {}) => new Promise((resolve, reject) => {
    cancel();
    const recognition = new SpeechRecognition();
    activeRecognition = recognition;
    listening = true;
    stopRequested = false;
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = maxAlternatives;

    let finalized = false;
    let transcript = "";
    const finish = (fn) => (value) => {
      if (finalized) return;
      finalized = true;
      listening = false;
      clearStopTimer();
      activeRecognition = null;
      stopRequested = false;
      fn(value);
    };

    recognition.onresult = (event) => {
      const latest = event.results?.[0]?.[0]?.transcript || "";
      transcript = latest.trim();
    };
    recognition.onerror = (event) => {
      if (stopRequested && event?.error === "aborted") {
        finish(resolve)(transcript);
        return;
      }
      const message = mapSpeechError(event?.error);
      finish(reject)(new Error(message));
    };
    recognition.onend = () => {
      finish(resolve)(transcript);
    };
    activeStopTimer = setTimeout(() => {
      if (activeRecognition === recognition) {
        recognition.stop();
      }
    }, timeoutMs);

    try {
      recognition.start();
    } catch {
      finish(reject)(new Error("Could not start speech recognition."));
    }
  });

  return { supported: true, listen, cancel, stop, isListening: () => listening };
}
