(function (global) {
  const GREEN = "3dff7a";
  const BG = "050705";
  const ALLOWED = [
    "soundcloud.com",
    "w.soundcloud.com",
    "bandcamp.com",
    "youtube.com",
    "www.youtube.com",
    "youtu.be",
    "m.youtube.com",
    "open.spotify.com",
    "player.spotify.com",
  ];

  function hostname(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (err) {
      return "";
    }
  }

  function allowed(url) {
    const host = hostname(url);
    if (!host) return false;
    return ALLOWED.some((h) => host === h || host.endsWith("." + h));
  }

  function youtubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0];
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "embed" || p === "shorts");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    } catch (err) {
      return "";
    }
    return "";
  }

  function normalize(kind, raw) {
    const url = String(raw || "").trim();
    if (!url) return "";
    const k = kind || guessKind(url);

    if (k === "soundcloud") {
      if (url.includes("w.soundcloud.com/player")) return url;
      return "https://w.soundcloud.com/player/?url=" + encodeURIComponent(url);
    }

    if (k === "youtube") {
      const id = youtubeId(url);
      if (id) return "https://www.youtube.com/embed/" + id;
      return url;
    }

    if (k === "spotify") {
      return url.replace("open.spotify.com/", "open.spotify.com/embed/");
    }

    return url;
  }

  function guessKind(url) {
    const host = hostname(url);
    if (host.includes("soundcloud")) return "soundcloud";
    if (host.includes("bandcamp")) return "bandcamp";
    if (host.includes("youtube") || host === "youtu.be") return "youtube";
    if (host.includes("spotify")) return "spotify";
    return "";
  }

  function tint(kind, url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      return url;
    }

    const k = kind || guessKind(url);

    if (k === "soundcloud") {
      parsed.searchParams.set("color", GREEN);
      parsed.searchParams.set("visual", "false");
      parsed.searchParams.set("auto_play", "false");
      return parsed.toString();
    }

    if (k === "spotify") {
      parsed.searchParams.set("theme", "0");
      return parsed.toString();
    }

    if (k === "youtube") {
      parsed.searchParams.set("modestbranding", "1");
      parsed.searchParams.set("rel", "0");
      return parsed.toString();
    }

    if (k === "bandcamp") {
      let path = parsed.pathname;
      if (!path.endsWith("/")) path += "/";
      if (/bgcol=/i.test(path)) path = path.replace(/bgcol=[^/]*/i, "bgcol=" + BG);
      else path += "bgcol=" + BG + "/";
      if (/linkcol=/i.test(path)) path = path.replace(/linkcol=[^/]*/i, "linkcol=" + GREEN);
      else path += "linkcol=" + GREEN + "/";
      parsed.pathname = path;
      return parsed.toString();
    }

    return parsed.toString();
  }

  function iframeSize(kind) {
    if (kind === "soundcloud") return { height: "166" };
    if (kind === "spotify") return { height: "152" };
    if (kind === "youtube") return { height: "200" };
    if (kind === "bandcamp") return { height: "120" };
    return { height: "166" };
  }

  function mount(container, track) {
    if (!container || !track) return;
    const kind = track.kind || guessKind(track.embed_url || "");

    if (kind === "audio" && track.audio) {
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = track.audio;
      container.appendChild(audio);
      return;
    }

    const raw = track.embed_url || "";
    if (!raw) return;
    const src = tint(kind, normalize(kind, raw));
    if (!allowed(src)) return;

    const iframe = document.createElement("iframe");
    const size = iframeSize(kind);
    iframe.src = src;
    iframe.width = "100%";
    iframe.height = size.height;
    iframe.loading = "lazy";
    iframe.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "");
    iframe.title = track.title ? String(track.title) : "Embedded audio";
    container.appendChild(iframe);
  }

  global.NCEmbeds = { allowed, normalize, tint, mount, guessKind };
})(window);
