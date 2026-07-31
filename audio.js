let audioContext = null;

function playAlertSound() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 800;
    gain.gain.value = 0.2;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 500);
  } catch (error) {
    console.log("Sound error:", error);
  }
}

function speakSwitch(message) {
  if (!("speechSynthesis" in window)) return;
  const speech = new SpeechSynthesisUtterance(message);
  speech.rate = 0.9;
  speech.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}

function testAlert() {
  playAlertSound();
  speakSwitch("HeatSync alert test successful.");
}
