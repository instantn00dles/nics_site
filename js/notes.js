(function () {
  const canvas = document.getElementById("field");
  if (!canvas) return;
  if ((canvas.getAttribute("data-field") || "") !== "notes") return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const FRAMES = [
    { name: "quarter-up", sx: 2, sy: 2, sw: 23, sh: 43 },
    { name: "half-down", sx: 27, sy: 2, sw: 19, sh: 44 },
    { name: "quarter-up-b", sx: 48, sy: 2, sw: 18, sh: 43 },
    { name: "half-down-dot", sx: 68, sy: 2, sw: 25, sh: 44 },
    { name: "quarter-up-dot", sx: 95, sy: 2, sw: 23, sh: 43 },
    { name: "eighth-up", sx: 120, sy: 2, sw: 30, sh: 43 },
    { name: "eighth-down", sx: 152, sy: 2, sw: 31, sh: 43 },
    { name: "sixteenth-up", sx: 185, sy: 2, sw: 29, sh: 43 },
    { name: "thirtysecond-up", sx: 216, sy: 2, sw: 31, sh: 44 },
    { name: "sixtyfourth-up", sx: 249, sy: 2, sw: 29, sh: 44 },
    { name: "hundredtwentyeighth-up", sx: 280, sy: 2, sw: 31, sh: 44 },
    { name: "half-up", sx: 313, sy: 2, sw: 24, sh: 43 },
    { name: "quarter-down", sx: 339, sy: 2, sw: 18, sh: 43 },
    { name: "half-down-b", sx: 359, sy: 2, sw: 20, sh: 44 },
    { name: "quarter-down-dot", sx: 381, sy: 2, sw: 18, sh: 43 },
    { name: "half-up-dot", sx: 401, sy: 2, sw: 20, sh: 44 },
    { name: "quarter-up-c", sx: 423, sy: 2, sw: 23, sh: 43 },
    { name: "beam-eighth-2", sx: 448, sy: 2, sw: 42, sh: 43 },
    { name: "beam-eighth-3", sx: 492, sy: 2, sw: 65, sh: 44 },
    { name: "beam-eighth-4", sx: 559, sy: 2, sw: 88, sh: 44 },
    { name: "beam-sixteenth-2", sx: 649, sy: 2, sw: 41, sh: 44 },
    { name: "beam-thirtytwo-2", sx: 692, sy: 2, sw: 41, sh: 44 },
    { name: "beam-sixtyfour-2", sx: 735, sy: 2, sw: 41, sh: 44 },
    { name: "beam-sixteenth-3", sx: 778, sy: 2, sw: 64, sh: 44 },
    { name: "beam-sixteenth-4", sx: 2, sy: 48, sw: 88, sh: 44 },
    { name: "beam-sixteenth-3b", sx: 92, sy: 48, sw: 64, sh: 44 },
    { name: "grp-sixteenth-up", sx: 158, sy: 48, sw: 41, sh: 48 },
    { name: "grp-eighth-up", sx: 201, sy: 48, sw: 41, sh: 48 },
    { name: "grp-eighth-2up", sx: 244, sy: 48, sw: 42, sh: 48 },
    { name: "grp-eighth-2down", sx: 288, sy: 48, sw: 42, sh: 49 },
    { name: "grp-sixteenth-2up", sx: 332, sy: 48, sw: 41, sh: 48 },
    { name: "grp-sixteenth-3down", sx: 375, sy: 48, sw: 65, sh: 55 },
    { name: "grp-eighth-3down", sx: 442, sy: 48, sw: 65, sh: 55 },
    { name: "grp-eighth-3up", sx: 509, sy: 48, sw: 65, sh: 50 },
  ];
  const BY_NAME = {};
  FRAMES.forEach((f) => {
    BY_NAME[f.name] = f;
  });

  const STORE = {
    bpm: "nc-score-bpm",
    open: "nc-score-open",
    paused: "nc-score-paused",
    sound: "nc-score-sound",
    out: "nc-score-out",
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let last = 0;
  let running = true;
  let rafId = 0;
  let ready = false;
  let tint = null;
  let absBeat = 0;
  let prevAbs = 0;
  let bpm = 120;
  let defaultBpm = 120;
  let paused = false;
  let midiUrl = "media/score.mid";
  let score = null;
  let live = [];
  let sounding = [];
  let soundOn = false;
  let soundReady = false;
  let statusText = "Loading score…";
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };

  try {
    paused = localStorage.getItem(STORE.paused) === "1";
    soundOn = localStorage.getItem(STORE.sound) === "1";
    const outPref = localStorage.getItem(STORE.out);
    if (outPref && window.NCSynth) window.NCSynth.setPreferred(outPref);
  } catch (err) {
    /* ignore */
  }

  function clampBpm(n) {
    n = Number(n);
    if (!Number.isFinite(n)) return 120;
    return Math.max(40, Math.min(240, Math.round(n)));
  }

  function classify(beats) {
    if (beats >= 2.4) return "half-dot";
    if (beats >= 1.75) return "half";
    if (beats >= 1.25) return "quarter-dot";
    if (beats >= 0.875) return "quarter";
    if (beats >= 0.375) return "eighth";
    if (beats >= 0.187) return "sixteenth";
    if (beats >= 0.09) return "thirtysecond";
    if (beats >= 0.045) return "sixtyfourth";
    return "hundredtwentyeighth";
  }

  function frameFor(note, up) {
    const kind = classify(note.durationBeats);
    const table = {
      "half-dot": up ? "half-up-dot" : "half-down-dot",
      half: up ? "half-up" : "half-down",
      "quarter-dot": up ? "quarter-up-dot" : "quarter-down-dot",
      quarter: up ? "quarter-up" : "quarter-down",
      eighth: up ? "eighth-up" : "eighth-down",
      sixteenth: up ? "sixteenth-up" : "grp-sixteenth-up",
      thirtysecond: "thirtysecond-up",
      sixtyfourth: "sixtyfourth-up",
      hundredtwentyeighth: "hundredtwentyeighth-up",
    };
    return BY_NAME[table[kind]] || BY_NAME["quarter-up"];
  }

  const DEGREE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const TREBLE_LINES = [37, 39, 41, 43, 45];
  const BASS_LINES = [25, 27, 29, 31, 33];
  const STAFF_LO = 18;
  const STAFF_HI = 52;
  const SHARP_TREBLE = [45, 42, 46, 43, 40, 44, 41];
  const FLAT_TREBLE = [41, 44, 40, 43, 39, 42, 38];
  const SHARP_BASS = [31, 28, 32, 29, 26, 30, 27];
  const FLAT_BASS = [27, 30, 26, 29, 25, 28, 24];
  let staff = { padTop: 80, stepMin: STAFF_LO, stepMax: STAFF_HI, stepPx: 12 };

  function diatonicStep(midi) {
    const n = Math.max(0, midi | 0);
    return Math.floor(n / 12) * 7 + DEGREE[n % 12];
  }

  function ottavaFor(step) {
    if (step > STAFF_HI) return Math.floor((step - (STAFF_HI + 1)) / 7) + 1;
    if (step < STAFF_LO) return -(Math.floor((STAFF_LO - 1 - step) / 7) + 1);
    return 0;
  }

  function ottavaLabel(o) {
    if (o >= 2) return "15ma";
    if (o <= -2) return "15mb";
    if (o > 0) return "8va";
    return "8vb";
  }

  function layoutStaff() {
    const lo = STAFF_LO;
    const hi = STAFF_HI;
    const steps = hi - lo;
    const stepPx = Math.min(11, Math.max(6.5, (height * 0.52) / steps));
    const span = steps * stepPx;
    const padTop = Math.max(40, (height - span) / 2);
    staff = {
      padTop,
      stepMin: lo,
      stepMax: hi,
      stepPx,
    };
  }

  function yForStep(step) {
    return staff.padTop + (staff.stepMax - step) * staff.stepPx;
  }

  function noteDispStep(n) {
    if (n && n.dispStep != null) return n.dispStep;
    const step = n && n.step != null ? n.step : diatonicStep(n.midi);
    return step - ottavaFor(step) * 7;
  }

  function noteClef(n) {
    if (n && n.clef) return n.clef;
    const step = n && n.step != null ? n.step : diatonicStep(n.midi);
    return step >= 35 ? "treble" : "bass";
  }

  function staffClef(midi) {
    return diatonicStep(midi) >= 35 ? "treble" : "bass";
  }

  function staffMiddleStep(clef) {
    return clef === "treble" ? 41 : 29;
  }

  function chordStemUp(members) {
    const clef = noteClef(members[0]);
    const mid = staffMiddleStep(clef);
    let best = -1;
    let up = false;
    members.forEach((m) => {
      const s = noteDispStep(m);
      const dist = Math.abs(s - mid);
      const thisUp = s < mid;
      if (dist > best) {
        best = dist;
        up = thisUp;
      } else if (dist === best && s >= mid) {
        up = false;
      }
    });
    return up;
  }

  function localBeat(abs) {
    if (!score || !score.durationBeats) return 0;
    const d = score.durationBeats;
    return ((abs % d) + d) % d;
  }

  function activeKey(beat) {
    if (!window.NCMidi) return { startBeat: 0, sf: 0, minor: 0 };
    return NCMidi.keySigAt(score && score.keySigs, beat == null ? localBeat(absBeat) : beat);
  }

  function annotateScore(sc) {
    if (!sc || !sc.notes) return;
    const hasMidi = !!window.NCMidi;
    const keySigs = sc.keySigs && sc.keySigs.length ? sc.keySigs : [{ startBeat: 0, sf: 0, minor: 0 }];
    sc.notes.forEach((n) => {
      const ks = hasMidi ? NCMidi.keySigAt(keySigs, n.startBeat) : { sf: 0, minor: 0 };
      const sp = hasMidi
        ? NCMidi.spellMidi(n.midi, ks.sf)
        : { letter: DEGREE[(n.midi % 12 + 12) % 12], acc: 0, oct: Math.floor(n.midi / 12), step: diatonicStep(n.midi) };
      n.letter = sp.letter;
      n.acc = sp.acc;
      n.oct = sp.oct;
      n.step = sp.step;
      n.ottava = ottavaFor(sp.step);
      n.dispStep = sp.step - n.ottava * 7;
      n.clef = sp.step >= 35 ? "treble" : "bass";
      n.showAcc = false;
    });
    const measures = sc.measures && sc.measures.length ? sc.measures : [{ start: 0, len: sc.durationBeats || 4 }];
    measures.forEach((m) => {
      const ks = hasMidi ? NCMidi.keySigAt(keySigs, m.start) : { sf: 0 };
      const state = Object.create(null);
      const notes = sc.notes
        .filter((n) => n.startBeat >= m.start - 1e-9 && n.startBeat < m.start + m.len - 1e-9)
        .sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
      notes.forEach((n) => {
        const k = n.letter + ":" + n.oct;
        const keyAcc = hasMidi ? NCMidi.keyAccidental(n.letter, ks.sf) : 0;
        const expected = Object.prototype.hasOwnProperty.call(state, k) ? state[k] : keyAcc;
        n.showAcc = n.acc !== expected;
        state[k] = n.acc;
      });
    });
  }

  function assignBeams(sc) {
    if (!sc || !sc.notes) return;
    annotateScore(sc);
    sc.notes.forEach((n) => {
      n.kind = classify(n.durationBeats);
      n.beamId = null;
      n.clef = n.clef || staffClef(n.midi);
    });
    if (!window.NCMidi || !sc.measures) return;
    let seq = 0;
    const beamable = (n) => n.durationBeats <= 0.5 + 1e-4;
    sc.measures.forEach((m) => {
      const groups = NCMidi.beamGrouping(m.ts);
      ["treble", "bass"].forEach((clef) => {
        let acc = 0;
        groups.forEach((gLen) => {
          const g0 = m.start + acc;
          const g1 = g0 + gLen;
          acc += gLen;
          const cols = [];
          sc.notes.forEach((n) => {
            if (!beamable(n) || n.clef !== clef) return;
            if (n.startBeat < g0 - 1e-6 || n.startBeat >= g1 - 1e-6) return;
            const last = cols[cols.length - 1];
            if (last && Math.abs(last.startBeat - n.startBeat) < 1e-4) {
              last.notes.push(n);
              last.durationBeats = Math.min(last.durationBeats, n.durationBeats);
            } else {
              cols.push({
                startBeat: n.startBeat,
                durationBeats: n.durationBeats,
                notes: [n],
              });
            }
          });
          cols.sort((a, b) => a.startBeat - b.startBeat);
          let run = [];
          const flush = () => {
            if (run.length >= 2) {
              const id = "b" + seq;
              seq += 1;
              run.forEach((col) => col.notes.forEach((n) => (n.beamId = id)));
            }
            run = [];
          };
          cols.forEach((col) => {
            if (!run.length) {
              run = [col];
              return;
            }
            const prev = run[run.length - 1];
            const rest = col.startBeat - (prev.startBeat + prev.durationBeats);
            const ioi = col.startBeat - prev.startBeat;
            const eighths = Math.abs(ioi - 0.5) < 0.12;
            const sixteenths = Math.abs(ioi - 0.25) < 0.08;
            if (rest < 0.2 || eighths || sixteenths) run.push(col);
            else {
              flush();
              run = [col];
            }
          });
          flush();
        });
      });
    });
  }

  function spawnAt(note, originAbs) {
    const vel = (note.velocity || 96) / 127;
    live.push({
      originAbs,
      startBeat: note.startBeat,
      durationBeats: note.durationBeats,
      midi: note.midi,
      step: note.step,
      dispStep: noteDispStep(note),
      ottava: note.ottava || 0,
      acc: note.acc || 0,
      showAcc: !!note.showAcc,
      clef: noteClef(note),
      y: yForStep(noteDispStep(note)),
      kind: note.kind || classify(note.durationBeats),
      beamId: note.beamId || null,
      heat: 1,
      depth: 0.45 + vel * 0.5,
    });
  }

  const atlas = new Image();
  atlas.decoding = "async";
  atlas.onload = () => {
    const sheet = document.createElement("canvas");
    sheet.width = atlas.naturalWidth;
    sheet.height = atlas.naturalHeight;
    const g = sheet.getContext("2d");
    g.drawImage(atlas, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#3dff7a";
    g.fillRect(0, 0, sheet.width, sheet.height);
    tint = sheet;
    ready = true;
    resize();
    last = performance.now();
    kick();
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutStaff();
    live.forEach((n) => {
      n.y = yForStep(noteDispStep(n));
    });
    ctx.fillStyle = "#050705";
    ctx.fillRect(0, 0, width, height);
  };

  function currentKeyCount() {
    return Math.min(7, Math.abs((activeKey().sf || 0) | 0));
  }

  function preambleWidth() {
    const sp = staff.stepPx * 2;
    const n = currentKeyCount();
    const clefW = sp * 2.25;
    const keyW = n ? n * sp * 0.52 + sp * 0.12 : sp * 0.1;
    return 16 + sp * 0.7 + clefW + keyW + 8;
  }

  function playheadX() {
    const pre = preambleWidth();
    const hist = Math.max(28, width * 0.045);
    return pre + hist;
  }

  function pxPerQuarter() {
    return 168;
  }

  function collectVisible(nowBeat) {
    if (!score || !score.notes) return [];
    const x0 = playheadX();
    const pq = pxPerQuarter();
    const d = score.durationBeats || 4;
    const t0 = nowBeat - 1.25;
    const t1 = nowBeat + (width - x0) / pq + 2;
    const items = [];
    const have = new Set();

    function add(note, origin) {
      const sig = note.startBeat + ":" + note.midi + ":" + origin;
      if (have.has(sig)) return;
      have.add(sig);
      items.push({
        originAbs: origin,
        startBeat: note.startBeat,
        durationBeats: note.durationBeats,
        midi: note.midi,
        step: note.step,
        dispStep: noteDispStep(note),
        ottava: note.ottava || 0,
        acc: note.acc || 0,
        showAcc: !!note.showAcc,
        letter: note.letter,
        clef: noteClef(note),
        y: yForStep(noteDispStep(note)),
        kind: note.kind || classify(note.durationBeats),
        beamId: note.beamId || null,
        x: x0 + (origin - nowBeat) * pq + 12,
        heat: origin <= nowBeat + 0.02 ? 0.45 : 0.12,
        depth: 0.6,
      });
    }

    score.notes.forEach((note) => {
      const kLo = Math.floor((t0 - note.startBeat) / d) - 1;
      const kHi = Math.ceil((t1 - note.startBeat) / d) + 1;
      for (let k = kLo; k <= kHi; k += 1) {
        const origin = note.startBeat + k * d;
        if (origin >= t0 && origin <= t1) add(note, origin);
      }
    });

    const byId = {};
    score.notes.forEach((n) => {
      if (!n.beamId) return;
      if (!byId[n.beamId]) byId[n.beamId] = [];
      byId[n.beamId].push(n);
    });
    items.slice().forEach((it) => {
      if (!it.beamId) return;
      const loopOff = it.originAbs - it.startBeat;
      (byId[it.beamId] || []).forEach((n) => add(n, n.startBeat + loopOff));
    });
    return items;
  }

  function startsBetween(note, t0, t1) {
    const d = score.durationBeats;
    const first = note.startBeat;
    const k0 = Math.ceil((t0 - first) / d - 1e-6);
    const k1 = Math.floor((t1 - first) / d + 1e-9);
    const out = [];
    for (let k = Math.max(0, k0); k <= k1; k += 1) out.push(first + k * d);
    return out;
  }

  function emit(t0, t1) {
    if (!score) return;
    score.notes.forEach((note) => {
      startsBetween(note, t0, t1).forEach((origin) => {
        if (soundOn && soundReady && window.NCSynth) {
          window.NCSynth.noteOn(note.channel || 0, note.midi, note.velocity || 96);
          sounding.push({
            endAbs: origin + note.durationBeats,
            ch: note.channel || 0,
            midi: note.midi,
          });
        }
      });
    });
    if (soundOn && soundReady && window.NCSynth && sounding.length) {
      const keep = [];
      for (let i = 0; i < sounding.length; i += 1) {
        const s = sounding[i];
        if (s.endAbs <= t1) window.NCSynth.noteOff(s.ch, s.midi);
        else keep.push(s);
      }
      sounding = keep;
    }
  }

  function panicSound() {
    sounding = [];
    if (window.NCSynth) window.NCSynth.panic();
  }

  function fillOutSelect(info) {
    const sel = document.getElementById("score-out");
    const hint = document.getElementById("score-sound-hint");
    if (!sel) return;
    const ports = (info && info.ports) || (window.NCSynth && window.NCSynth.listPorts()) || [];
    sel.replaceChildren();
    ports.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });
    const browser = document.createElement("option");
    browser.value = "browser";
    browser.textContent = "Browser synth";
    sel.appendChild(browser);
    const current = (info && info.output) || (window.NCSynth && window.NCSynth.getPreferred()) || "browser";
    sel.value = current;
    sel.hidden = !soundOn;
    if (hint) {
      if (!soundOn) hint.textContent = "";
      else if (!ports.length) {
        hint.textContent =
          "No system MIDI port found. Using the browser synth. Connect a device or enable IAC Driver in Audio MIDI Setup to route to the system synth.";
      } else {
        hint.textContent = "Playing through system MIDI.";
      }
    }
  }

  async function setSound(on) {
    soundOn = !!on;
    try {
      localStorage.setItem(STORE.sound, soundOn ? "1" : "0");
    } catch (err) {
      /* ignore */
    }
    if (!soundOn) {
      soundReady = false;
      panicSound();
      if (window.NCSynth) window.NCSynth.disable();
      fillOutSelect({ ports: [], output: "browser" });
      syncDock();
      return;
    }
    if (window.NCSynth && window.NCSynth.unlock) window.NCSynth.unlock();
    let info = { ports: [], output: "browser", mode: "browser" };
    if (window.NCSynth) {
      try {
        info = await window.NCSynth.enable();
      } catch (err) {
        info = { ports: [], output: "browser", mode: "browser" };
      }
    }
    soundReady = true;
    fillOutSelect(info);
    syncDock();
  }

  function headSize() {
    const space = staff.stepPx * 2;
    return { w: space * 1.32, h: space * 0.88, space: space };
  }

  function flagsFor(kind) {
    if (kind === "eighth" || kind === "eighth-dot") return 1;
    if (kind === "sixteenth") return 2;
    if (kind === "thirtysecond") return 3;
    if (kind === "sixtyfourth" || kind === "hundredtwentyeighth") return 4;
    return 0;
  }

  function drawHead(x, y, filled, alpha) {
    const sz = headSize();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.28);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(0, 0, sz.w / 2, sz.h / 2, 0, 0, Math.PI * 2);
    if (filled) {
      ctx.fillStyle = "#3dff7a";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#3dff7a";
      ctx.lineWidth = Math.max(1.4, sz.h * 0.22);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDot(x, y, alpha) {
    const sz = headSize();
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#3dff7a";
    ctx.beginPath();
    ctx.arc(x + sz.w * 0.82, y, Math.max(1.5, sz.h * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function stemX(x, up) {
    const sz = headSize();
    return up ? x + sz.w * 0.42 : x - sz.w * 0.42;
  }

  function stemLength(extremeY, clef, up, flagCount) {
    const octave = staff.stepPx * 7;
    const extra = Math.max(0, (flagCount || 0) - 2) * staff.stepPx * 2;
    const midY = yForStep(staffMiddleStep(clef));
    const toMid = up ? extremeY - midY : midY - extremeY;
    return Math.max(octave + extra, toMid > 0 ? toMid : octave + extra);
  }

  function layoutHeads(members, up) {
    members.sort((a, b) => noteDispStep(a) - noteDispStep(b) || a.midi - b.midi);
    const dx = headSize().w * 0.92;
    members.forEach((m) => {
      m.headDx = 0;
    });
    for (let i = 1; i < members.length; i += 1) {
      if (noteDispStep(members[i]) - noteDispStep(members[i - 1]) !== 1) continue;
      if (up) members[i].headDx = dx;
      else members[i - 1].headDx = -dx;
    }
  }

  function layoutAccidentals(members) {
    const accs = members.filter((m) => m.showAcc);
    accs.sort((a, b) => noteDispStep(b) - noteDispStep(a));
    const colW = staff.stepPx * 1.4;
    const sz = headSize();
    const left = Math.min.apply(
      null,
      members.map((m) => m.headDx || 0)
    );
    accs.forEach((m, i) => {
      m.accDx = left - sz.w * 0.95;
      if (i > 0 && noteDispStep(accs[i - 1]) - noteDispStep(m) <= 2) {
        m.accDx = accs[i - 1].accDx - colW;
      }
    });
  }

  function fillBeam(x1, y1, x2, y2, thick, alpha) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (thick / 2);
    const ny = (dx / len) * (thick / 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#3dff7a";
    ctx.beginPath();
    ctx.moveTo(x1 + nx, y1 + ny);
    ctx.lineTo(x2 + nx, y2 + ny);
    ctx.lineTo(x2 - nx, y2 - ny);
    ctx.lineTo(x1 - nx, y1 - ny);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFlags(sx, tipY, up, count, alpha) {
    if (!count) return;
    const space = staff.stepPx * 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.lineWidth = Math.max(1.2, space * 0.12);
    ctx.lineCap = "round";
    for (let i = 0; i < count; i += 1) {
      const y = tipY + (up ? 1 : -1) * i * space * 0.52;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.quadraticCurveTo(
        sx + space * 1.2,
        y + (up ? space * 0.65 : -space * 0.65),
        sx + space * 0.12,
        y + (up ? space * 1.35 : -space * 1.35)
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawChordColumn(members, x, alpha, beamed, forceUp) {
    const up = forceUp == null ? chordStemUp(members) : forceUp;
    layoutHeads(members, up);
    layoutAccidentals(members);
    const flags = beamed
      ? Math.max.apply(
          null,
          members.map((m) => flagsFor(m.kind || classify(m.durationBeats)))
        )
      : flagsFor(members[0].kind || classify(members[0].durationBeats));
    members.forEach((n) => {
      const hx = x + (n.headDx || 0);
      drawLedger(hx, noteDispStep(n));
      if (n.showAcc) drawAccidental(n.acc, x + (n.accDx || 0), n.y, alpha);
      const filled = n.kind !== "half" && n.kind !== "half-dot";
      drawHead(hx, n.y, filled, alpha);
      if (n.kind && n.kind.indexOf("dot") !== -1) drawDot(hx, n.y, alpha);
    });
    const extremeY = up
      ? Math.min.apply(null, members.map((m) => m.y))
      : Math.max.apply(null, members.map((m) => m.y));
    const farY = up
      ? Math.max.apply(null, members.map((m) => m.y))
      : Math.min.apply(null, members.map((m) => m.y));
    const len = stemLength(extremeY, noteClef(members[0]), up, beamed ? flags : flags);
    const tip = up ? extremeY - len : extremeY + len;
    const sx = stemX(x, up);
    if (!beamed) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#3dff7a";
      ctx.lineWidth = Math.max(1.1, staff.stepPx * 0.14);
      ctx.beginPath();
      ctx.moveTo(sx, farY);
      ctx.lineTo(sx, tip);
      ctx.stroke();
      ctx.restore();
      drawFlags(sx, tip, up, flags, alpha);
    }
    return { sx, tip, up, flags, farY };
  }

  function drawSingle(n, x, alpha) {
    drawChordColumn([n], x, alpha, false);
  }

  function drawBeamed(group, alpha) {
    const cols = [];
    group.forEach((n) => {
      const last = cols[cols.length - 1];
      if (last && Math.abs(last.x - n.x) < 4) last.members.push(n);
      else cols.push({ x: n.x, members: [n], kind: n.kind, durationBeats: n.durationBeats });
    });
    if (cols.length < 2) {
      cols.forEach((c) => drawChordColumn(c.members, c.x, alpha, false));
      return;
    }
    const up = chordStemUp(cols.flatMap((c) => c.members));
    cols.forEach((c) => {
      const info = drawChordColumn(c.members, c.x, alpha, true, up);
      c.sx = info.sx;
      c.tip = info.tip;
      c.farY = info.farY;
      c.up = info.up;
    });
    const xFirst = cols[0].x;
    const xLast = cols[cols.length - 1].x;
    let y1 = cols[0].tip;
    let y2 = cols[cols.length - 1].tip;
    if (noteDispStep(cols[0].members[0]) === noteDispStep(cols[cols.length - 1].members[0])) {
      y1 = y2 = (y1 + y2) / 2;
    }
    const maxDy = staff.stepPx * 2;
    if (Math.abs(y2 - y1) > maxDy) y2 = y1 + Math.sign(y2 - y1) * maxDy;
    cols.forEach((c) => {
      c.by = y1 + ((c.x - xFirst) / (xLast - xFirst || 1)) * (y2 - y1);
    });
    const thick = staff.stepPx;
    const gap = staff.stepPx * 0.55;
    cols.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "#3dff7a";
      ctx.lineWidth = Math.max(1.1, staff.stepPx * 0.14);
      ctx.beginPath();
      ctx.moveTo(c.sx, c.farY);
      ctx.lineTo(c.sx, c.by);
      ctx.stroke();
      ctx.restore();
    });
    fillBeam(cols[0].sx, cols[0].by, cols[cols.length - 1].sx, cols[cols.length - 1].by, thick, alpha);
    for (let level = 2; level <= 4; level += 1) {
      let i = 0;
      while (i < cols.length) {
        if (flagsFor(cols[i].kind) < level) {
          i += 1;
          continue;
        }
        let j = i;
        while (j + 1 < cols.length && flagsFor(cols[j + 1].kind) >= level) j += 1;
        const o = (up ? 1 : -1) * (level - 1) * (thick + gap);
        if (j > i) {
          fillBeam(cols[i].sx, cols[i].by + o, cols[j].sx, cols[j].by + o, thick, alpha);
        } else {
          const dir = i > 0 ? -1 : 1;
          fillBeam(cols[i].sx, cols[i].by + o, cols[i].sx + dir * 10, cols[i].by + o, thick, alpha);
        }
        i = j + 1;
      }
    }
  }

  function drawPlayhead() {
    const x = playheadX();
    ctx.save();
    ctx.strokeStyle = "rgba(61, 255, 122, 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yForStep(45) - staff.stepPx * 8);
    ctx.lineTo(x, yForStep(25) + staff.stepPx * 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawStaff() {
    if (!width || !height) return;
    ctx.save();
    ctx.strokeStyle = "rgba(61, 255, 122, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    TREBLE_LINES.concat(BASS_LINES).forEach((step) => {
      if (step < staff.stepMin || step > staff.stepMax) return;
      const y = yForStep(step);
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawBarLines() {
    if (!score || !score.measures) return;
    const x0 = playheadX();
    const pq = pxPerQuarter();
    const d = score.durationBeats;
    const k0 = Math.floor(absBeat / d) - 1;
    const k1 = Math.floor(absBeat / d) + 4;
    ctx.save();
    ctx.strokeStyle = "rgba(61, 255, 122, 0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    score.measures.forEach((m) => {
      for (let k = k0; k <= k1; k += 1) {
        const origin = m.start + k * d;
        const x = x0 + (origin - absBeat) * pq;
        if (x < -6 || x > width + 6) continue;
        ctx.moveTo(x, yForStep(45) - 1);
        ctx.lineTo(x, yForStep(37) + 1);
        ctx.moveTo(x, yForStep(33) - 1);
        ctx.lineTo(x, yForStep(25) + 1);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawLedger(x, step) {
    const lines = [];
    if (step === 35) lines.push(35);
    if (step < 25) {
      for (let s = 23; s >= step; s -= 2) lines.push(s);
    }
    if (step > 45) {
      for (let s = 47; s <= step; s += 2) lines.push(s);
    }
    if (!lines.length) return;
    const half = Math.max(12, staff.stepPx * 1.7);
    ctx.save();
    ctx.strokeStyle = "rgba(61, 255, 122, 0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    lines.forEach((s) => {
      const y = yForStep(s);
      ctx.moveTo(x - half, y);
      ctx.lineTo(x + half, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawSharp(x, y, alpha) {
    const sp = staff.stepPx * 2;
    const h = sp * 1.12;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1.15, sp * 0.11);
    ctx.beginPath();
    ctx.moveTo(-sp * 0.16, -h * 0.52);
    ctx.lineTo(-sp * 0.16, h * 0.48);
    ctx.moveTo(sp * 0.16, -h * 0.48);
    ctx.lineTo(sp * 0.16, h * 0.52);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.55, sp * 0.17);
    ctx.beginPath();
    ctx.moveTo(-sp * 0.38, -sp * 0.08);
    ctx.lineTo(sp * 0.38, -sp * 0.22);
    ctx.moveTo(-sp * 0.38, sp * 0.22);
    ctx.lineTo(sp * 0.38, sp * 0.08);
    ctx.stroke();
    ctx.restore();
  }

  function drawFlat(x, y, alpha) {
    const sp = staff.stepPx * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.lineWidth = Math.max(1.2, sp * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-sp * 0.14, -sp * 0.95);
    ctx.lineTo(-sp * 0.14, sp * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-sp * 0.14, sp * 0.42);
    ctx.bezierCurveTo(sp * 0.52, sp * 0.18, sp * 0.48, -sp * 0.38, -sp * 0.14, -sp * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawNatural(x, y, alpha) {
    const sp = staff.stepPx * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.lineCap = "square";
    ctx.lineWidth = Math.max(1.15, sp * 0.12);
    ctx.beginPath();
    ctx.moveTo(-sp * 0.16, -sp * 0.7);
    ctx.lineTo(-sp * 0.16, sp * 0.38);
    ctx.moveTo(sp * 0.16, -sp * 0.38);
    ctx.lineTo(sp * 0.16, sp * 0.7);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.55, sp * 0.17);
    ctx.beginPath();
    ctx.moveTo(-sp * 0.16, -sp * 0.12);
    ctx.lineTo(sp * 0.16, -sp * 0.28);
    ctx.moveTo(-sp * 0.16, sp * 0.28);
    ctx.lineTo(sp * 0.16, sp * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  function drawDoubleSharp(x, y, alpha) {
    const sp = staff.stepPx * 2;
    const r = sp * 0.22;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.lineWidth = Math.max(1.3, sp * 0.13);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-r, -r);
    ctx.lineTo(r, r);
    ctx.moveTo(-r, r);
    ctx.lineTo(r, -r);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.1, sp * 0.1);
    ctx.strokeRect(-r * 0.95, -r * 0.95, r * 1.9, r * 1.9);
    ctx.restore();
  }

  function drawDoubleFlat(x, y, alpha) {
    const sp = staff.stepPx * 2;
    drawFlat(x - sp * 0.22, y, alpha);
    drawFlat(x + sp * 0.18, y, alpha);
  }

  function drawAccidental(acc, x, y, alpha) {
    if (acc >= 2) drawDoubleSharp(x, y, alpha);
    else if (acc === 1) drawSharp(x, y, alpha);
    else if (acc === -1) drawFlat(x, y, alpha);
    else if (acc <= -2) drawDoubleFlat(x, y, alpha);
    else drawNatural(x, y, alpha);
  }

  function keyPositions(sf, clef) {
    if (sf > 0) return clef === "treble" ? SHARP_TREBLE : SHARP_BASS;
    if (sf < 0) return clef === "treble" ? FLAT_TREBLE : FLAT_BASS;
    return [];
  }

  function drawKeySigAt(x, sf, alpha) {
    const n = Math.min(7, Math.abs(sf | 0));
    if (!n) return 0;
    const sp = staff.stepPx * 2;
    const gap = sp * 0.52;
    const acc = sf > 0 ? 1 : -1;
    ["treble", "bass"].forEach((clef) => {
      const pos = keyPositions(sf, clef);
      for (let i = 0; i < n; i += 1) {
        drawAccidental(acc, x + i * gap, yForStep(pos[i]), alpha);
      }
    });
    return n * gap + sp * 0.08;
  }

  function drawNaturalsAt(x, sf, alpha) {
    const n = Math.min(7, Math.abs(sf | 0));
    if (!n) return 0;
    const sp = staff.stepPx * 2;
    const gap = sp * 0.52;
    ["treble", "bass"].forEach((clef) => {
      const pos = keyPositions(sf, clef);
      for (let i = 0; i < n; i += 1) {
        drawNatural(x + i * gap, yForStep(pos[i]), alpha);
      }
    });
    return n * gap + sp * 0.08;
  }

  function drawTrebleClef(x, alpha) {
    const sp = staff.stepPx * 2;
    const yG = yForStep(39);
    ctx.save();
    ctx.translate(x, yG);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.fillStyle = "#3dff7a";
    ctx.lineWidth = Math.max(1.35, sp * 0.13);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(sp * 0.18, sp * 3.05);
    ctx.bezierCurveTo(sp * 0.55, sp * 2.45, sp * -0.08, sp * 1.95, sp * 0.1, sp * 1.25);
    ctx.bezierCurveTo(sp * 0.28, sp * 0.35, sp * 0.2, -sp * 1.65, sp * 0.02, -sp * 2.55);
    ctx.bezierCurveTo(sp * -0.14, -sp * 3.2, sp * 0.58, -sp * 3.12, sp * 0.44, -sp * 2.38);
    ctx.bezierCurveTo(sp * 0.28, -sp * 1.45, sp * 0.58, -sp * 0.05, sp * 0.16, sp * 0.58);
    ctx.bezierCurveTo(sp * -0.32, sp * 1.28, sp * -0.58, sp * 0.22, sp * -0.06, -sp * 0.18);
    ctx.bezierCurveTo(sp * 0.48, -sp * 0.58, sp * 0.66, sp * 0.38, sp * 0.1, sp * 0.78);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sp * 0.16, sp * 3.12, Math.max(1.35, sp * 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBassClef(x, alpha) {
    const sp = staff.stepPx * 2;
    const yF = yForStep(31);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.fillStyle = "#3dff7a";
    ctx.lineWidth = Math.max(1.5, sp * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + sp * 0.06, yF - sp * 0.04);
    ctx.bezierCurveTo(x + sp * 1.2, yF - sp * 1.38, x + sp * 1.08, yF + sp * 1.58, x + sp * 0.08, yF + sp * 1.88);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + sp * 0.14, yF, sp * 0.28, 0, Math.PI * 2);
    ctx.fill();
    const r = Math.max(1.15, sp * 0.11);
    ctx.beginPath();
    ctx.arc(x + sp * 1.28, yF - sp * 0.5, r, 0, Math.PI * 2);
    ctx.arc(x + sp * 1.28, yF + sp * 0.5, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBrace(x, y1, y2, alpha) {
    const h = y2 - y1;
    const w = Math.max(7, staff.stepPx * 1.05);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#3dff7a";
    ctx.lineWidth = Math.max(1.35, staff.stepPx * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + w, y1);
    ctx.bezierCurveTo(x - w * 0.15, y1 + h * 0.12, x + w * 1.05, y1 + h * 0.38, x, y1 + h * 0.5);
    ctx.bezierCurveTo(x + w * 1.05, y1 + h * 0.62, x - w * 0.15, y1 + h * 0.88, x + w, y2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPreamble() {
    const pw = preambleWidth();
    const sp = staff.stepPx * 2;
    const alpha = 0.82;
    ctx.save();
    const fade = ctx.createLinearGradient(pw - 18, 0, pw + 8, 0);
    fade.addColorStop(0, "rgba(5, 7, 5, 0.82)");
    fade.addColorStop(1, "rgba(5, 7, 5, 0)");
    ctx.fillStyle = "rgba(5, 7, 5, 0.82)";
    ctx.fillRect(0, 0, Math.max(0, pw - 18), height);
    ctx.fillStyle = fade;
    ctx.fillRect(Math.max(0, pw - 18), 0, 26, height);
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = "rgba(61, 255, 122, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    TREBLE_LINES.concat(BASS_LINES).forEach((step) => {
      const y = yForStep(step);
      ctx.moveTo(0, y);
      ctx.lineTo(pw, y);
    });
    ctx.stroke();
    ctx.restore();
    const yTop = yForStep(45);
    const yBot = yForStep(25);
    drawBrace(4, yTop, yBot, 0.55);
    ctx.save();
    ctx.strokeStyle = "rgba(61, 255, 122, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(14, yTop);
    ctx.lineTo(14, yBot);
    ctx.stroke();
    ctx.restore();
    const xClef = 20;
    drawTrebleClef(xClef, alpha);
    drawBassClef(xClef, alpha);
    const ks = activeKey();
    drawKeySigAt(xClef + sp * 2.15, ks.sf || 0, alpha);
  }

  function drawKeyChanges(nowBeat) {
    if (!score || !score.keySigs || score.keySigs.length < 2) return;
    const x0 = playheadX();
    const pq = pxPerQuarter();
    const d = score.durationBeats || 4;
    const t0 = nowBeat - 1.25;
    const t1 = nowBeat + (width - x0) / pq + 2;
    const sigs = score.keySigs;
    for (let i = 1; i < sigs.length; i += 1) {
      const prev = sigs[i - 1];
      const cur = sigs[i];
      if ((cur.sf || 0) === (prev.sf || 0)) continue;
      const kLo = Math.floor((t0 - cur.startBeat) / d) - 1;
      const kHi = Math.ceil((t1 - cur.startBeat) / d) + 1;
      for (let k = kLo; k <= kHi; k += 1) {
        const origin = cur.startBeat + k * d;
        if (origin < t0 || origin > t1) continue;
        const x = x0 + (origin - nowBeat) * pq + 6;
        if (x < x0 - 4 || x < preambleWidth() || x > width + 8) continue;
        if ((cur.sf || 0) === 0) drawNaturalsAt(x, prev.sf || 0, 0.7);
        else drawKeySigAt(x, cur.sf || 0, 0.7);
      }
    }
  }

  function drawOttavaMarks(items) {
    const xClip = preambleWidth();
    const marked = items.filter((n) => n.ottava && n.x >= xClip && n.x < width + 40);
    if (!marked.length) return;
    marked.sort((a, b) => (a.clef || "").localeCompare(b.clef || "") || a.ottava - b.ottava || a.x - b.x);
    const runs = [];
    const gap = pxPerQuarter() * 1.6;
    marked.forEach((n) => {
      const last = runs[runs.length - 1];
      if (last && last.clef === n.clef && last.ottava === n.ottava && n.x - last.xLast < gap) {
        last.members.push(n);
        last.xLast = n.x;
      } else {
        runs.push({
          clef: n.clef,
          ottava: n.ottava,
          members: [n],
          xLast: n.x,
        });
      }
    });
    const sp = staff.stepPx * 2;
    runs.forEach((run) => {
      const x1 = run.members[0].x - sp * 0.35;
      const x2 = run.members[run.members.length - 1].x + sp * 0.55;
      const up = run.ottava > 0;
      const yNotes = up
        ? Math.min.apply(
            null,
            run.members.map((m) => m.y)
          )
        : Math.max.apply(
            null,
            run.members.map((m) => m.y)
          );
      const yStaff = up ? yForStep(45) : yForStep(25);
      const y = up ? Math.min(yNotes, yStaff) - sp * 1.15 : Math.max(yNotes, yStaff) + sp * 1.15;
      const label = ottavaLabel(run.ottava);
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = "#3dff7a";
      ctx.font = "italic 600 " + Math.max(10, sp * 0.72) + 'px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(label, x1, y);
      const tw = ctx.measureText(label).width;
      const lx = x1 + tw + 8;
      ctx.strokeStyle = "#3dff7a";
      ctx.lineWidth = 1;
      ctx.setLineDash([3.5, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x2, y);
      ctx.lineTo(x2, y + (up ? sp * 0.28 : -sp * 0.28));
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawStaticScore() {
    ctx.fillStyle = "#050705";
    ctx.fillRect(0, 0, width, height);
    drawStaff();
    if (!ready || !score) {
      drawPreamble();
      return;
    }
    const saved = absBeat;
    absBeat = 0;
    drawBarLines();
    drawKeyChanges(0);
    absBeat = saved;
    const x0 = playheadX();
    const unit = pxPerQuarter();
    const byBeam = new Map();
    const drawn = [];
    score.notes.forEach((note) => {
      if (note.startBeat > 12) return;
      const n = {
        x: x0 + note.startBeat * unit + 12,
        y: yForStep(noteDispStep(note)),
        midi: note.midi,
        step: note.step,
        dispStep: noteDispStep(note),
        ottava: note.ottava || 0,
        acc: note.acc || 0,
        showAcc: !!note.showAcc,
        clef: noteClef(note),
        kind: note.kind || classify(note.durationBeats),
        durationBeats: note.durationBeats,
        beamId: note.beamId,
        heat: 0,
        depth: 0.5,
      };
      drawn.push(n);
      if (n.beamId) {
        if (!byBeam.has(n.beamId)) byBeam.set(n.beamId, []);
        byBeam.get(n.beamId).push(n);
      } else drawSingle(n, n.x, 0.28);
    });
    byBeam.forEach((arr) => {
      arr.sort((a, b) => a.x - b.x);
      if (arr.length >= 2) drawBeamed(arr, 0.28);
      else arr.forEach((n) => drawSingle(n, n.x, 0.28));
    });
    drawOttavaMarks(drawn);
    drawPlayhead();
    drawPreamble();
  }

  function kick() {
    if (rafId) return;
    rafId = requestAnimationFrame(draw);
  }

  const draw = (now) => {
    rafId = 0;
    if (!running) return;
    const dt = Math.min(32, now - last || 16);
    last = now;

    pointer.x += (pointer.tx - pointer.x) * 0.16;
    pointer.y += (pointer.ty - pointer.y) * 0.16;

    if (!reduced && !paused && score) {
      prevAbs = absBeat;
      const local = ((absBeat % score.durationBeats) + score.durationBeats) % score.durationBeats;
      const ts = window.NCMidi ? NCMidi.tsAt(score.timeSigs, local) : { num: 4, den: 4 };
      const unit = window.NCMidi ? NCMidi.beatUnit(ts) : 1;
      absBeat += (bpm / 60) * unit * (dt / 1000);
      if (absBeat > prevAbs) emit(prevAbs, absBeat);
    }

    ctx.fillStyle = "rgba(5, 7, 5, 0.2)";
    ctx.fillRect(0, 0, width, height);

    if (reduced) {
      drawStaticScore();
      kick();
      return;
    }

    drawStaff();
    drawBarLines();
    drawKeyChanges(absBeat);

    const vis = collectVisible(absBeat);
    const x0 = playheadX();
    vis.forEach((n) => {
      if (pointer.tx > -1000) {
        const dx = n.x - pointer.x;
        const dy = n.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130) n.heat = Math.max(n.heat, 1 - Math.sqrt(d2) / 130);
      }
    });
    const byBeam = new Map();
    const singles = [];
    const pre = preambleWidth();
    vis.forEach((n) => {
      if (n.x < pre - 8 || n.x > width + 80) return;
      if (n.beamId) {
        if (!byBeam.has(n.beamId)) byBeam.set(n.beamId, []);
        byBeam.get(n.beamId).push(n);
      } else singles.push(n);
    });
    const chordCols = [];
    singles
      .slice()
      .sort((a, b) => a.x - b.x || noteClef(a).localeCompare(noteClef(b)) || a.midi - b.midi)
      .forEach((n) => {
        const last = chordCols[chordCols.length - 1];
        if (last && Math.abs(last.x - n.x) < 4 && noteClef(last.members[0]) === noteClef(n)) {
          last.members.push(n);
        } else chordCols.push({ x: n.x, members: [n] });
      });
    chordCols.forEach((c) => {
      const fade = c.x >= x0 - 6 ? 0.88 : Math.max(0.12, 0.88 - (x0 - c.x) / 220);
      const heat = Math.max.apply(null, c.members.map((m) => m.heat));
      drawChordColumn(c.members, c.x, Math.min(0.95, fade + heat * 0.15), false);
    });
    byBeam.forEach((arr) => {
      arr.sort((a, b) => a.x - b.x || a.y - b.y);
      const fade = Math.max.apply(
        null,
        arr.map((n) => (n.x >= x0 - 6 ? 0.88 : Math.max(0.12, 0.88 - (x0 - n.x) / 220)))
      );
      if (arr.length >= 2) drawBeamed(arr, fade);
      else arr.forEach((n) => drawSingle(n, n.x, fade));
    });
    drawOttavaMarks(vis.filter((n) => n.x > -80 && n.x < width + 80));
    drawPlayhead();
    drawPreamble();
    syncDock();
    kick();
  };

  function fileLabel(url) {
    if (!url) return "No MIDI";
    const parts = String(url).split("/");
    return parts[parts.length - 1] || url;
  }

  function syncDock() {
    const bpmEl = document.getElementById("score-bpm");
    const range = document.getElementById("score-bpm-range");
    const chip = document.getElementById("score-chip-bpm");
    const pos = document.getElementById("score-pos");
    if (bpmEl && Number(bpmEl.value) !== bpm) bpmEl.value = String(bpm);
    if (range && Number(range.value) !== bpm) range.value = String(bpm);
    if (chip) chip.textContent = String(bpm);
    if (pos && score) {
      const beat = ((absBeat % score.durationBeats) + score.durationBeats) % score.durationBeats;
      let bar = 1;
      let beatIn = 1;
      let ts = { num: 4, den: 4 };
      if (score.measures) {
        for (let i = 0; i < score.measures.length; i += 1) {
          const m = score.measures[i];
          if (beat < m.start + m.len - 1e-6) {
            ts = m.ts;
            bar = i + 1;
            const unit = window.NCMidi ? NCMidi.beatUnit(m.ts) : 1;
            beatIn = Math.floor((beat - m.start) / unit) + 1;
            break;
          }
        }
      }
      pos.textContent = "BAR " + bar + "." + beatIn;
      const meter = document.getElementById("score-meter");
      if (meter) meter.textContent = ts.num + "/" + ts.den;
      const keyEl = document.getElementById("score-key");
      if (keyEl && window.NCMidi) {
        const ks = NCMidi.keySigAt(score.keySigs, beat);
        keyEl.textContent = NCMidi.keyName(ks.sf, ks.minor);
      }
    }
    const soundBtn = document.getElementById("score-sound");
    if (soundBtn) {
      soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
      soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    }
  }

  function setBpm(n, persist) {
    bpm = clampBpm(n);
    if (persist !== false) {
      try {
        localStorage.setItem(STORE.bpm, String(bpm));
      } catch (err) {
        /* ignore */
      }
    }
    syncDock();
  }

  function setPaused(on) {
    paused = !!on;
    try {
      localStorage.setItem(STORE.paused, paused ? "1" : "0");
    } catch (err) {
      /* ignore */
    }
    const btn = document.getElementById("score-play");
    if (btn) {
      btn.textContent = paused ? "Play" : "Pause";
      btn.setAttribute("aria-pressed", paused ? "false" : "true");
    }
    if (paused) panicSound();
  }

  function setOpen(on) {
    const dock = document.getElementById("score-dock");
    if (!dock) return;
    dock.classList.toggle("is-open", on);
    const toggle = document.getElementById("score-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", on ? "true" : "false");
    try {
      localStorage.setItem(STORE.open, on ? "1" : "0");
    } catch (err) {
      /* ignore */
    }
  }

  async function loadMidi(url, label) {
    statusText = "Loading score…";
    const nameEl = document.getElementById("score-file");
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const buf = await res.arrayBuffer();
      applyScore(buf, label || fileLabel(url));
    } catch (err) {
      statusText = "MIDI missing — using pulse";
      score = metronomeScore();
      live = [];
      panicSound();
      absBeat = 0;
      prevAbs = 0;
      layoutStaff();
      if (nameEl) nameEl.textContent = statusText;
    }
  }

  function applyScore(buffer, label) {
    if (!globalThis.NCMidi) throw new Error("MIDI parser missing");
    score = NCMidi.parse(buffer);
    assignBeams(score);
    live = [];
    panicSound();
    absBeat = 0;
    prevAbs = 0;
    layoutStaff();
    emit(-1e-9, 1e-6);
    statusText = label || score.name || "score.mid";
    bpm = clampBpm(score.bpm || defaultBpm);
    try {
      localStorage.setItem(STORE.bpm, String(bpm));
    } catch (err) {
      /* ignore */
    }
    const nameEl = document.getElementById("score-file");
    if (nameEl) nameEl.textContent = statusText;
    syncDock();
  }

  function metronomeScore() {
    const timeSigs = [{ startBeat: 0, num: 4, den: 4 }];
    const notes = [];
    for (let i = 0; i < 16; i += 1) {
      notes.push({
        startBeat: i,
        durationBeats: 1,
        midi: i % 4 === 0 ? 52 : 40,
        velocity: i % 4 === 0 ? 110 : 80,
        channel: 0,
      });
    }
    const durationBeats = 16;
    const sc = {
      notes,
      durationBeats,
      timeSigs,
      keySigs: [{ startBeat: 0, sf: 0, minor: 0 }],
      measures: window.NCMidi ? NCMidi.buildMeasures(timeSigs, durationBeats) : [],
      minPitch: 40,
      maxPitch: 52,
      bpm: 120,
      quarterBpm: 120,
      name: "pulse",
    };
    assignBeams(sc);
    return sc;
  }

  function bindDock() {
    const dock = document.getElementById("score-dock");
    if (!dock) return;
    let open = window.innerWidth >= 800;
    try {
      const stored = localStorage.getItem(STORE.open);
      if (stored === "0") open = false;
      if (stored === "1") open = true;
    } catch (err) {
      /* ignore */
    }
    setOpen(open);
    setPaused(paused);

    const toggle = document.getElementById("score-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        setOpen(!dock.classList.contains("is-open"));
      });
    }
    const range = document.getElementById("score-bpm-range");
    const number = document.getElementById("score-bpm");
    if (range) {
      range.addEventListener("input", () => setBpm(range.value));
    }
    if (number) {
      number.addEventListener("change", () => setBpm(number.value));
    }
    const play = document.getElementById("score-play");
    if (play) play.addEventListener("click", () => setPaused(!paused));
    const soundBtn = document.getElementById("score-sound");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => setSound(!soundOn));
    }
    const out = document.getElementById("score-out");
    if (out) {
      out.addEventListener("change", () => {
        if (!window.NCSynth) return;
        panicSound();
        window.NCSynth.setOutput(out.value);
        try {
          localStorage.setItem(STORE.out, out.value);
        } catch (err) {
          /* ignore */
        }
        window.NCSynth.setPreferred(out.value);
        fillOutSelect({
          ports: window.NCSynth.listPorts(),
          output: out.value,
        });
      });
    }
    dock.addEventListener("pointerdown", () => {
      if (window.NCSynth && window.NCSynth.unlock) window.NCSynth.unlock();
    });
    if (soundOn) setSound(true);
    const file = document.getElementById("score-upload");
    if (file) {
      file.addEventListener("change", async () => {
        const picked = file.files && file.files[0];
        if (!picked) return;
        const buf = await picked.arrayBuffer();
        try {
          applyScore(buf, picked.name);
        } catch (err) {
          const nameEl = document.getElementById("score-file");
          if (nameEl) nameEl.textContent = "Could not parse MIDI";
        }
      });
    }
    syncDock();
  }

  window.addEventListener("resize", () => {
    if (!ready) return;
    resize();
  });
  window.addEventListener("pointermove", (event) => {
    pointer.tx = event.clientX;
    pointer.ty = event.clientY;
  });
  window.addEventListener("pointerleave", () => {
    pointer.tx = -9999;
    pointer.ty = -9999;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
      panicSound();
      return;
    }
    running = true;
    last = performance.now();
    kick();
  });

  bindDock();

  window.NCNotes = {
    configure(opts) {
      opts = opts || {};
      if (opts.defaultBpm) defaultBpm = clampBpm(opts.defaultBpm);
      if (opts.midiUrl) midiUrl = opts.midiUrl;
      loadMidi(midiUrl);
    },
    setAnalyser() {},
    getScore() {
      return score;
    },
  };

  loadMidi(midiUrl);
  atlas.src = "assets/notation-atlas.png";
})();
