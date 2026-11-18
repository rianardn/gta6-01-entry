// NEON HARBOR — sound: everything is synthesised with WebAudio.
// No audio files, no network. Engine hum (higher and raspier on a
// bike), gunshots, the scattergun's boom, sirens, pickups, a mission
// jingle, a boss sting, and a looping synthwave bassline.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let engineOsc = null, engineGain = null, engineBike = false;
  let sirenOsc = null, sirenGain = null;
  const bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42]; // A1 A1 C2 G1 ...
  let bassStep = 0;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, vol, filterFreq) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() { muted = !muted; if (muted) this.stopEngine(); return muted; },

    shoot() { noise(0.12, 0.5, 2400); tone(180, 0.08, 'square', 0.18, 60); },
    boom() { noise(0.35, 0.7, 900); tone(120, 0.25, 'sawtooth', 0.3, 40); },
    hit() { tone(220, 0.1, 'sawtooth', 0.2, 110); },
    pickup() { tone(660, 0.09, 'sine', 0.25); setTimeout(() => tone(990, 0.12, 'sine', 0.25), 70); },
    cash() { tone(880, 0.08, 'triangle', 0.25); setTimeout(() => tone(1174, 0.14, 'triangle', 0.25), 80); },
    crash() { noise(0.3, 0.5, 900); },
    explosion() { noise(0.7, 0.7, 500); tone(70, 0.6, 'sine', 0.4, 30); },
    enterCar() { tone(300, 0.08, 'square', 0.15, 420); },
    fail() { tone(220, 0.35, 'sawtooth', 0.22, 110); },
    missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.25), i * 110)); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.28), i * 120)); },
    busted() { tone(330, 0.5, 'sawtooth', 0.25, 165); },
    // Short low sting when Dario Kess himself shows up.
    bossSting() { [110, 116.5, 110].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.22, f * 0.9), i * 160)); },

    startEngine(isBike) {
      const c = ensure(); if (!c || engineOsc || muted) return;
      engineBike = !!isBike;
      engineOsc = c.createOscillator(); engineGain = c.createGain();
      engineOsc.type = engineBike ? 'square' : 'sawtooth';
      engineOsc.frequency.value = engineBike ? 90 : 60;
      engineGain.gain.value = 0.03;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = engineBike ? 900 : 420;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(c.destination);
      engineOsc.start();
    },
    setEngine(speed01) {
      if (engineOsc && ctx) {
        const base = engineBike ? 90 : 55;
        const span = engineBike ? 190 : 130;
        engineOsc.frequency.setTargetAtTime(base + speed01 * span, ctx.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, ctx.currentTime, 0.1);
      }
    },
    stopEngine() {
      if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; engineGain = null; }
    },
    startSiren() {
      const c = ensure(); if (!c || sirenOsc || muted) return;
      sirenOsc = c.createOscillator(); sirenGain = c.createGain();
      sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
      sirenGain.gain.value = 0.035;
      const lfo = c.createOscillator(); lfo.frequency.value = 1.6;
      const lfoGain = c.createGain(); lfoGain.gain.value = 260;
      lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenOsc.connect(sirenGain); sirenGain.connect(c.destination);
      sirenOsc.start(); lfo.start();
      sirenOsc._lfo = lfo;
    },
    stopSiren() {
      if (sirenOsc) {
        try { sirenOsc.stop(); sirenOsc._lfo && sirenOsc._lfo.stop(); } catch { /* stopped */ }
        sirenOsc = null; sirenGain = null;
      }
    },
    startMusic() {
      const c = ensure(); if (!c || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const f = bassNotes[bassStep % bassNotes.length]; bassStep += 1;
        tone(f, 0.42, 'triangle', 0.11);
        if (bassStep % 4 === 0) tone(f * 4, 0.12, 'sine', 0.045);
      }, 230);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };
}
