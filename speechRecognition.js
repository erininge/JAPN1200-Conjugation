export function createSpeechController() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return {
      supported: false,
      listen: async () => "",
      cancel: () => {},
      isListening: () => false
    };
  }

  let activeRecognition = null;
  let activeStopTimer = null;
  let listening = false;

  const clearStopTimer = () => {
    if (activeStopTimer) {
      clearTimeout(activeStopTimer);
      activeStopTimer = null;
    }
  };

  const cancel = () => {
    clearStopTimer();
    if (activeRecognition) {
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      listening = false;
      activeRecognition.abort();
      activeRecognition = null;
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
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = maxAlternatives;

    let finalized = false;
    const finish = (fn) => (value) => {
      if (finalized) return;
      finalized = true;
      listening = false;
      clearStopTimer();
      activeRecognition = null;
      fn(value);
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      finish(resolve)(transcript.trim());
    };
    recognition.onerror = (event) => {
      const message = mapSpeechError(event?.error);
      finish(reject)(new Error(message));
    };
    recognition.onend = () => {
      finish(resolve)("");
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

  return { supported: true, listen, cancel, isListening: () => listening };
}
