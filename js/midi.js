(function (global) {
  function readStr(bytes, i, n) {
    let s = "";
    for (let k = 0; k < n; k += 1) s += String.fromCharCode(bytes[i + k]);
    return s;
  }

  function measureLength(ts) {
    return (ts.num * 4) / ts.den;
  }

  function beatUnit(ts) {
    const noteQ = 4 / ts.den;
    if (ts.den >= 8 && ts.num % 3 === 0) return noteQ * 3;
    return noteQ;
  }

  function tsAt(timeSigs, beat) {
    let cur = timeSigs[0] || { startBeat: 0, num: 4, den: 4 };
    for (let i = 0; i < timeSigs.length; i += 1) {
      if (timeSigs[i].startBeat <= beat + 1e-9) cur = timeSigs[i];
    }
    return cur;
  }

  function beamGrouping(ts) {
    const n = ts.num;
    const d = ts.den;
    if (n === 4 && d === 4) return [2, 2];
    if (n === 2 && d === 4) return [1, 1];
    if (n === 3 && d === 4) return [1, 1, 1];
    if (n === 5 && d === 4) return [3, 2];
    if (n === 6 && d === 8) return [1.5, 1.5];
    if (n === 9 && d === 8) return [1.5, 1.5, 1.5];
    if (n === 12 && d === 8) return [1.5, 1.5, 1.5, 1.5];
    if (n === 3 && d === 8) return [1.5];
    if (n === 5 && d === 8) return [1, 1.5];
    if (n === 7 && d === 8) return [1, 1, 1.5];
    if (n === 2 && d === 2) return [2, 2];
    if (n === 3 && d === 2) return [2, 2, 2];
    const u = 4 / d;
    if (d >= 8 && n % 3 === 0) return Array.from({ length: n / 3 }, () => u * 3);
    return Array.from({ length: n }, () => u);
  }

  function buildMeasures(timeSigs, durationBeats) {
    const measures = [];
    let beat = 0;
    let guard = 0;
    while (beat < durationBeats - 1e-9 && guard < 4096) {
      const ts = tsAt(timeSigs, beat);
      const len = measureLength(ts);
      measures.push({ start: beat, len: len, ts: ts });
      beat += len;
      guard += 1;
    }
    return measures;
  }

  function metronomeBpm(quarterBpm, ts) {
    const unit = beatUnit(ts);
    if (!unit) return quarterBpm;
    return Math.round(quarterBpm / unit);
  }

  function s8(v) {
    return v > 127 ? v - 256 : v;
  }

  function keySigAt(keySigs, beat) {
    let cur = keySigs && keySigs[0] ? keySigs[0] : { startBeat: 0, sf: 0, minor: 0 };
    if (!keySigs) return cur;
    for (let i = 0; i < keySigs.length; i += 1) {
      if (keySigs[i].startBeat <= beat + 1e-9) cur = keySigs[i];
    }
    return cur;
  }

  function keyAccidental(letter, sf) {
    if (sf > 0) {
      const order = [3, 0, 4, 1, 5, 2, 6];
      const idx = order.indexOf(letter);
      return idx >= 0 && idx < sf ? 1 : 0;
    }
    if (sf < 0) {
      const order = [6, 2, 5, 1, 4, 0, 3];
      const idx = order.indexOf(letter);
      return idx >= 0 && idx < -sf ? -1 : 0;
    }
    return 0;
  }

  function keyName(sf, minor) {
    sf = sf || 0;
    const i = Math.min(7, Math.abs(sf | 0));
    const maj = ["C", "G", "D", "A", "E", "B", "F#", "C#"];
    const majb = ["C", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"];
    const minn = ["A", "E", "B", "F#", "C#", "G#", "D#", "A#"];
    const minb = ["A", "D", "G", "C", "F", "Bb", "Eb", "Ab"];
    const name = sf < 0 ? (minor ? minb[i] : majb[i]) : minor ? minn[i] : maj[i];
    return minor ? name + "m" : name;
  }

  function spellMidi(midi, sf) {
    const pc = ((midi % 12) + 12) % 12;
    const letters = [0, 2, 4, 5, 7, 9, 11];
    let best = null;
    for (let L = 0; L < 7; L += 1) {
      const nat = letters[L];
      let acc = pc - nat;
      if (acc > 6) acc -= 12;
      if (acc < -6) acc += 12;
      if (acc < -2 || acc > 2) continue;
      const raw = midi - acc - nat;
      if (raw % 12 !== 0) continue;
      const oct = raw / 12;
      if (oct < 0) continue;
      const step = oct * 7 + L;
      const kacc = keyAccidental(L, sf);
      let weight = Math.abs(acc - kacc) * 2 + Math.abs(acc);
      if (sf > 0 && acc < 0) weight += 2;
      if (sf < 0 && acc > 0) weight += 2;
      if (!best || weight < best.weight) best = { letter: L, acc: acc, oct: oct, step: step, weight: weight };
    }
    if (!best) {
      const L = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc];
      return { letter: L, acc: 0, oct: Math.floor(midi / 12), step: Math.floor(midi / 12) * 7 + L };
    }
    return best;
  }

  function parseMidi(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const cur = { i: 0 };

    function u8() {
      return bytes[cur.i++];
    }
    function u16() {
      const v = (bytes[cur.i] << 8) | bytes[cur.i + 1];
      cur.i += 2;
      return v;
    }
    function u32() {
      const v =
        ((bytes[cur.i] << 24) | (bytes[cur.i + 1] << 16) | (bytes[cur.i + 2] << 8) | bytes[cur.i + 3]) >>> 0;
      cur.i += 4;
      return v;
    }
    function vlq() {
      let v = 0;
      let b;
      do {
        b = bytes[cur.i++];
        v = (v << 7) | (b & 0x7f);
      } while (b & 0x80);
      return v;
    }

    if (readStr(bytes, cur.i, 4) !== "MThd") {
      throw new Error("Not a MIDI file");
    }
    cur.i += 4;
    const hdrLen = u32();
    const format = u16();
    const ntrks = u16();
    const division = u16();
    if (hdrLen > 6) cur.i += hdrLen - 6;
    if (division & 0x8000) {
      throw new Error("SMPTE MIDI time is not supported");
    }
    const ppq = division || 480;

    const raw = [];
    const tempoEvents = [];
    let name = "";
    const timeSigs = [];
    const keySigs = [];

    for (let t = 0; t < ntrks; t += 1) {
      if (readStr(bytes, cur.i, 4) !== "MTrk") {
        throw new Error("Missing MIDI track");
      }
      cur.i += 4;
      const len = u32();
      const end = cur.i + len;
      let tick = 0;
      let status = 0;
      while (cur.i < end) {
        tick += vlq();
        const peek = bytes[cur.i];
        if (peek >= 0x80) {
          status = u8();
        }
        if (status === 0xff) {
          const type = u8();
          const n = vlq();
          if (type === 0x51 && n >= 3) {
            const us = ((bytes[cur.i] << 16) | (bytes[cur.i + 1] << 8) | bytes[cur.i + 2]) >>> 0;
            tempoEvents.push({ tick: tick, us: us });
          }
          if (type === 0x58 && n >= 2) {
            const num = bytes[cur.i];
            const den = Math.pow(2, bytes[cur.i + 1]);
            timeSigs.push({
              tick: tick,
              startBeat: tick / ppq,
              num: num || 4,
              den: den || 4,
            });
          }
          if (type === 0x59 && n >= 2) {
            keySigs.push({
              tick: tick,
              startBeat: tick / ppq,
              sf: s8(bytes[cur.i]),
              minor: bytes[cur.i + 1] ? 1 : 0,
            });
          }
          if (type === 0x03 && n && !name) {
            name = readStr(bytes, cur.i, n);
          }
          cur.i += n;
          if (type === 0x2f) break;
        } else if (status === 0xf0 || status === 0xf7) {
          const n = vlq();
          cur.i += n;
        } else {
          const hi = status & 0xf0;
          const ch = status & 0x0f;
          if (hi === 0xc0 || hi === 0xd0) {
            u8();
          } else {
            const d1 = u8();
            const d2 = u8();
            raw.push({ tick, ch, status: hi, d1, d2 });
          }
        }
      }
      cur.i = end;
    }

    tempoEvents.sort((a, b) => a.tick - b.tick);
    const tempoUs = tempoEvents.length ? tempoEvents[0].us : 500000;

    timeSigs.sort((a, b) => a.startBeat - b.startBeat);
    if (!timeSigs.length || timeSigs[0].startBeat > 0) {
      timeSigs.unshift({ tick: 0, startBeat: 0, num: 4, den: 4 });
    }
    keySigs.sort((a, b) => a.startBeat - b.startBeat);
    if (!keySigs.length || keySigs[0].startBeat > 0) {
      keySigs.unshift({ tick: 0, startBeat: 0, sf: 0, minor: 0 });
    }

    const open = new Map();
    const notes = [];
    const key = (ch, note) => ch + ":" + note;

    raw.sort((a, b) => a.tick - b.tick);
    raw.forEach((ev) => {
      if (ev.status === 0x90 && ev.d2 > 0) {
        const k = key(ev.ch, ev.d1);
        if (!open.has(k)) open.set(k, []);
        open.get(k).push({ tick: ev.tick, vel: ev.d2, note: ev.d1, ch: ev.ch });
      } else if (ev.status === 0x80 || (ev.status === 0x90 && ev.d2 === 0)) {
        const k = key(ev.ch, ev.d1);
        const stack = open.get(k);
        if (!stack || !stack.length) return;
        const start = stack.pop();
        const dur = Math.max(1, ev.tick - start.tick);
        notes.push({
          startTicks: start.tick,
          durationTicks: dur,
          startBeat: start.tick / ppq,
          durationBeats: dur / ppq,
          midi: start.note,
          velocity: start.vel,
          channel: start.ch,
        });
      }
    });

    open.forEach((stack) => {
      stack.forEach((start) => {
        notes.push({
          startTicks: start.tick,
          durationTicks: ppq,
          startBeat: start.tick / ppq,
          durationBeats: 1,
          midi: start.note,
          velocity: start.vel,
          channel: start.ch,
        });
      });
    });

    notes.sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);
    let durationBeats = 0;
    notes.forEach((n) => {
      durationBeats = Math.max(durationBeats, n.startBeat + n.durationBeats);
    });
    if (durationBeats < 1) durationBeats = measureLength(timeSigs[0]);

    let end = 0;
    let guard = 0;
    while (end < durationBeats - 1e-9 && guard < 4096) {
      end += measureLength(tsAt(timeSigs, end));
      guard += 1;
    }
    durationBeats = end || measureLength(timeSigs[0]);

    const measures = buildMeasures(timeSigs, durationBeats);

    let min = 127;
    let max = 0;
    notes.forEach((n) => {
      min = Math.min(min, n.midi);
      max = Math.max(max, n.midi);
    });
    if (!notes.length) {
      min = 40;
      max = 64;
    }

    const quarterBpm = Math.round(60000000 / (tempoUs || 500000));
    const bpm = metronomeBpm(quarterBpm, timeSigs[0]);

    return {
      format,
      ppq,
      name,
      quarterBpm,
      bpm,
      timeSigs,
      keySigs,
      measures,
      notes,
      durationBeats,
      minPitch: min,
      maxPitch: max,
    };
  }

  global.NCMidi = {
    parse: parseMidi,
    measureLength,
    beatUnit,
    tsAt,
    beamGrouping,
    buildMeasures,
    metronomeBpm,
    keySigAt,
    keyAccidental,
    keyName,
    spellMidi,
  };
})(window);
