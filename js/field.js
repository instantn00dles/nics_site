(function () {
  const canvas = document.getElementById("field");
  if (!canvas) return;
  const mode = canvas.getAttribute("data-field") || "cipher";
  if (mode !== "cipher") return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+/=";
  const TOKENS = ["POAM", "SCN", "VDR", "OSCAL", "IL-5", "800-53", "CR2026", "KSI", "SSP", "AU-2", "SC-13", "VER", "SDR", "20x"];
  const pickGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
  const pickToken = () => TOKENS[(Math.random() * TOKENS.length) | 0];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let cell = 18;
  let cols = 0;
  let rows = 0;
  let columns = [];
  let quiet = 0;
  let last = 0;
  let running = true;
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
  const trail = [];

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = width < 700 ? 15 : 18;
    cols = Math.ceil(width / cell) + 1;
    rows = Math.ceil(height / cell) + 8;
    columns = Array.from({ length: cols }, (_, i) => {
      const depth = 0.35 + Math.random() * 0.65;
      return {
        offset: Math.random() * rows * cell,
        speed: (0.08 + Math.random() * 0.32) * (0.55 + depth * 0.7),
        dir: Math.random() < 0.16 ? -1 : 1,
        depth,
        packet: Math.random() < 0.08,
        glyphs: Array.from({ length: rows + 16 }, pickGlyph),
        tokenAt: Math.random() < 0.22 ? (Math.random() * (rows + 8)) | 0 : -1,
        token: pickToken(),
      };
    });
    ctx.fillStyle = "#050705";
    ctx.fillRect(0, 0, width, height);
  };

  const radius = () => Math.min(260, Math.max(130, Math.min(width, height) * 0.3));

  const updateQuiet = () => {
    const panel = document.querySelector(".panel");
    if (!panel || !height) {
      quiet = 0;
      return;
    }
    const top = panel.getBoundingClientRect().top;
    const t = 1 - Math.min(1, Math.max(0, top / height));
    quiet += (t - quiet) * 0.08;
  };

  const drawStatic = () => {
    ctx.fillStyle = "#050705";
    ctx.fillRect(0, 0, width, height);
    ctx.font = `400 ${Math.floor(cell * 0.7)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let c = 0; c < columns.length; c += 3) {
      const col = columns[c];
      const x = c * cell + cell * 0.5;
      for (let row = 0; row < rows; row += 2) {
        const y = row * cell + cell * 0.5;
        ctx.fillStyle = `rgba(61, 255, 122, ${0.04 + col.depth * 0.06})`;
        ctx.fillText(col.glyphs[row % col.glyphs.length], x, y);
      }
    }
  };

  const draw = (now) => {
    if (!running) return;
    const dt = Math.min(40, now - last || 16);
    last = now;
    const skipMutate = dt > 28;

    pointer.x += (pointer.tx - pointer.x) * 0.18;
    pointer.y += (pointer.ty - pointer.y) * 0.18;
    if (pointer.tx > -1000) {
      trail.push({ x: pointer.x, y: pointer.y, life: 1 });
      if (trail.length > 16) trail.shift();
    }
    for (let i = 0; i < trail.length; i += 1) trail[i].life *= 0.84;

    updateQuiet();

    ctx.fillStyle = "rgba(5, 7, 5, 0.2)";
    ctx.fillRect(0, 0, width, height);

    ctx.font = `400 ${Math.floor(cell * 0.72)}px "IBM Plex Mono", ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;

    const r = radius();
    const r2 = r * r;
    const dim = 1 - quiet * 0.78;

    for (let c = 0; c < columns.length; c += 1) {
      const col = columns[c];
      col.offset += col.speed * col.dir * (dt / 16);
      const span = col.glyphs.length * cell;
      if (col.offset > span) col.offset -= span;
      if (col.offset < 0) col.offset += span;

      const x = c * cell + cell * 0.5;

      for (let row = 0; row < rows; row += 1) {
        const y = ((row * cell + col.offset) % span) - cell;
        if (y < -cell || y > height + cell) continue;

        const idx = ((row % col.glyphs.length) + col.glyphs.length) % col.glyphs.length;
        if (!skipMutate && Math.random() < 0.003) col.glyphs[idx] = pickGlyph();

        let heat = 0;
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const t = 1 - Math.sqrt(d2) / r;
          heat = t * t;
        }
        for (let t = 0; t < trail.length; t += 1) {
          const point = trail[t];
          const td2 = (x - point.x) * (x - point.x) + (y - point.y) * (y - point.y);
          if (td2 < r2 * 0.42) {
            const fall = 1 - Math.sqrt(td2) / (r * 0.65);
            heat = Math.max(heat, fall * fall * point.life * 0.7);
          }
        }

        if (heat > 0.55 && !skipMutate && Math.random() < 0.1) col.glyphs[idx] = pickGlyph();

        const useToken = col.tokenAt === idx && heat > 0.28;
        const ch = useToken ? col.token : col.glyphs[idx];
        if (useToken && heat > 0.8 && Math.random() < 0.04) {
          col.token = pickToken();
          col.tokenAt = (Math.random() * col.glyphs.length) | 0;
        }

        const packet = col.packet ? 0.12 : 0;
        const alpha = (0.045 + col.depth * 0.05 + heat * 0.82 + packet) * dim;
        if (alpha < 0.02) continue;

        if (heat > 0.4) {
          ctx.fillStyle = `rgba(61, 255, 122, ${Math.min(0.95, alpha)})`;
          if (heat > 0.7) {
            ctx.shadowColor = "rgba(61, 255, 122, 0.65)";
            ctx.shadowBlur = 8;
          }
        } else {
          ctx.fillStyle = `rgba(${90 + col.depth * 40}, ${140 + col.depth * 50}, ${110 + col.depth * 30}, ${alpha})`;
        }
        ctx.fillText(ch, x, y);
        if (ctx.shadowBlur) {
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";
        }
      }
    }

    requestAnimationFrame(draw);
  };

  window.addEventListener("resize", () => {
    resize();
    if (reduced) drawStatic();
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
    running = !document.hidden && !reduced;
    if (running) {
      last = performance.now();
      requestAnimationFrame(draw);
    }
  });

  resize();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      resize();
      if (reduced) drawStatic();
    });
  }
  if (reduced) {
    drawStatic();
  } else {
    last = performance.now();
    requestAnimationFrame(draw);
  }
})();
