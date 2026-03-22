export function createSpeechController() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return {
      supported: false,
      listen: async () => "",
      cancel: () => {}
    };
  }

  let activeRecognition = null;

  const cancel = () => {
    if (activeRecognition) {
      activeRecognition.onresult = null;
      activeRecognition.onerror = null;
      activeRecognition.onend = null;
      activeRecognition.stop();
      activeRecognition = null;
    }
  };

  const listen = ({ lang = "ja-JP" } = {}) => new Promise((resolve, reject) => {
    cancel();
    const recognition = new SpeechRecognition();
    activeRecognition = recognition;
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalized = false;
    const finish = (fn) => (value) => {
      if (finalized) return;
      finalized = true;
      activeRecognition = null;
      fn(value);
    };

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      finish(resolve)(transcript.trim());
    };
    recognition.onerror = (event) => {
      const message = event?.error || "speech recognition error";
      finish(reject)(new Error(message));
    };
    recognition.onend = () => {
      finish(resolve)("");
    };
    recognition.start();
  });

  return { supported: true, listen, cancel };
}
