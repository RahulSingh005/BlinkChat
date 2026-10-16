// Tiny synthesized UI sounds (no audio files to download). Browsers only
// allow audio after a user gesture, so unlockAudio() runs on first tap.
let ctx = null;

const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
};

export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  const source = c.createBufferSource();
  source.buffer = c.createBuffer(1, 1, 22050);
  source.connect(c.destination);
  source.start(0);
}

function note(c, { freq, at = 0, duration = 0.16, type = "sine", gain = 0.05, glideTo }) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration * 0.8);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(amp).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

const play = (fn) => {
  const c = getCtx();
  if (!c || c.state !== "running") return;
  try {
    fn(c);
  } catch {
    // ignore audio errors
  }
};

const loop = (pattern, every) => {
  let stopped = false;
  let timer;
  const run = () => {
    if (stopped) return;
    play(pattern);
    timer = setTimeout(run, every);
  };
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
};

export const sounds = {
  message: () =>
    play((c) => {
      note(c, { freq: 880, duration: 0.12, gain: 0.045 });
      note(c, { freq: 1318.5, at: 0.09, duration: 0.2, gain: 0.04 });
    }),
  sent: () => play((c) => note(c, { freq: 520, glideTo: 880, duration: 0.09, gain: 0.025 })),
  reminder: () =>
    play((c) => {
      [784, 988, 1175].forEach((freq, i) => note(c, { freq, at: i * 0.14, duration: 0.3, type: "triangle", gain: 0.05 }));
    }),
  callEnd: () =>
    play((c) => {
      note(c, { freq: 660, duration: 0.16, gain: 0.05 });
      note(c, { freq: 440, at: 0.16, duration: 0.26, gain: 0.05 });
    }),
  /** Incoming call: soft marimba arpeggio. Returns a stop function. */
  ringtone: () =>
    loop((c) => {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((freq, i) =>
        note(c, { freq, at: i * 0.13, duration: 0.32, type: "triangle", gain: 0.07 })
      );
    }, 2200),
  /** Outgoing call ringback tone. Returns a stop function. */
  ringback: () =>
    loop((c) => {
      note(c, { freq: 440, duration: 1.1, gain: 0.025 });
      note(c, { freq: 480, duration: 1.1, gain: 0.025 });
    }, 3600),
};
