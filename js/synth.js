(function (global) {
  let access = null;
  let midiOut = null;
  let audio = null;
  let master = null;
  let mode = "browser";
  let preferred = "";
  const voices = new Map();

  function freq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function key(ch, midi) {
    return (ch & 15) + ":" + midi;
  }

  function ensureAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audio) {
      audio = new AC();
      master = audio.createGain();
      master.gain.value = 0.2;
      const filter = audio.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2200;
      filter.Q.value = 0.7;
      master.connect(filter);
      filter.connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  function rankPort(name) {
    const n = String(name || "").toLowerCase();
    if (/dls|wavetable|microsoft gs|gs wavetable|apple.*synth|default synth/.test(n)) return 0;
    if (/synth|sound canvas|fluid|yamaha|roland/.test(n)) return 1;
    if (/\biac\b|bus/.test(n)) return 2;
    return 3;
  }

  function listPorts() {
    const ports = [];
    if (access) {
      access.outputs.forEach((out) => {
        ports.push({ id: out.id, name: out.name || "MIDI output", rank: rankPort(out.name) });
      });
      ports.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
    }
    return ports;
  }

  function pickDefault(ports) {
    if (preferred && ports.some((p) => p.id === preferred)) return preferred;
    if (ports.length) return ports[0].id;
    return "browser";
  }

  function sendProgram() {
    if (!midiOut) return;
    try {
      midiOut.send([0xc0, 33]);
      midiOut.send([0xc1, 4]);
    } catch (err) {
      /* ignore */
    }
  }

  function setOutput(id) {
    preferred = id || "browser";
    midiOut = null;
    mode = "browser";
    if (id && id !== "browser" && access) {
      const out = access.outputs.get(id);
      if (out) {
        midiOut = out;
        mode = "midi";
        sendProgram();
      }
    }
    return mode;
  }

  async function enable() {
    ensureAudio();
    if (navigator.requestMIDIAccess && !access) {
      try {
        access = await navigator.requestMIDIAccess({ sysex: false });
        access.onstatechange = () => {
          /* ports may appear after IAC is enabled */
        };
      } catch (err) {
        access = null;
      }
    }
    const ports = listPorts();
    const id = pickDefault(ports);
    setOutput(id);
    return { mode, output: id, ports };
  }

  function disable() {
    panic();
    midiOut = null;
    mode = "browser";
    if (audio && audio.state === "running") {
      /* keep context; just silent */
    }
  }

  function browserOn(ch, midi, vel) {
    const ac = ensureAudio();
    if (!ac || !master) return;
    const k = key(ch, midi);
    browserOff(ch, midi);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = ch === 0 ? "triangle" : "sawtooth";
    osc.frequency.value = freq(midi);
    const peak = (Math.max(1, vel) / 127) * (ch === 0 ? 0.34 : 0.2);
    const t = ac.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    voices.set(k, { osc, gain });
  }

  function browserOff(ch, midi) {
    const ac = audio;
    const v = voices.get(key(ch, midi));
    if (!v) return;
    voices.delete(key(ch, midi));
    if (!ac) return;
    const t = ac.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      v.osc.stop(t + 0.14);
    } catch (err) {
      try {
        v.osc.stop();
      } catch (e2) {
        /* ignore */
      }
    }
  }

  function noteOn(ch, midi, vel) {
    const c = ch & 15;
    const n = Math.max(0, Math.min(127, midi | 0));
    const v = Math.max(1, Math.min(127, vel | 0));
    if (midiOut) {
      try {
        midiOut.send([0x90 | c, n, v]);
      } catch (err) {
        /* ignore */
      }
      return;
    }
    browserOn(c, n, v);
  }

  function noteOff(ch, midi) {
    const c = ch & 15;
    const n = Math.max(0, Math.min(127, midi | 0));
    if (midiOut) {
      try {
        midiOut.send([0x80 | c, n, 0]);
      } catch (err) {
        /* ignore */
      }
      return;
    }
    browserOff(c, n);
  }

  function panic() {
    voices.forEach((_, k) => {
      const parts = k.split(":");
      browserOff(Number(parts[0]), Number(parts[1]));
    });
    voices.clear();
    if (midiOut) {
      for (let ch = 0; ch < 16; ch += 1) {
        try {
          midiOut.send([0xb0 | ch, 123, 0]);
          midiOut.send([0xb0 | ch, 120, 0]);
        } catch (err) {
          /* ignore */
        }
      }
    }
  }

  global.NCSynth = {
    enable,
    disable,
    setOutput,
    listPorts,
    noteOn,
    noteOff,
    panic,
    unlock: ensureAudio,
    getMode: () => mode,
    getPreferred: () => preferred,
    setPreferred: (id) => {
      preferred = id || "";
    },
  };
})(window);
