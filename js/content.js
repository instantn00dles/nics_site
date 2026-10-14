(function () {
  const page = document.body.getAttribute("data-page") || "home";

  function text(el, value) {
    if (!el) return;
    el.textContent = value == null ? "" : String(value);
  }

  function show(el, on) {
    if (!el) return;
    el.hidden = !on;
  }

  function tpl(id) {
    return document.getElementById(id);
  }

  function clone(id) {
    const node = tpl(id);
    if (!node) return null;
    return node.content.firstElementChild.cloneNode(true);
  }

  async function getJSON(path) {
    try {
      const res = await fetch(path, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (err) {
      console.warn("content: failed to load", path, err);
      return null;
    }
  }

  function setMeta(name, value, attr) {
    if (!value) return;
    let el = document.querySelector(`meta[${attr ? attr : "name"}="${name}"]`);
    if (!el) return;
    el.setAttribute("content", value);
  }

  function applyChrome(site) {
    if (!site) return;
    const brand = document.querySelector(".brand");
    text(brand, site.brand || site.title);
    if (site.title) document.title = page === "music" ? site.title + " — Music" : site.title;
    if (site.description) {
      setMeta("description", site.description);
      setMeta("og:description", site.description, "property");
    }
    if (site.title) setMeta("og:title", site.title, "property");
    if (site.canonical) {
      const link = document.querySelector('link[rel="canonical"]');
      if (link) link.href = site.canonical;
    }

    const nav = document.getElementById("nav-links");
    if (nav && Array.isArray(site.nav)) {
      nav.replaceChildren();
      site.nav.forEach((item) => {
        if (!item || !item.href || !item.label) return;
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.label;
        if (page === "music" && String(item.href).indexOf("music.html") !== -1) {
          a.classList.add("is-active");
        }
        nav.appendChild(a);
      });
    }

    const footerNote = document.getElementById("footer-note");
    text(footerNote, site.footer);
  }

  function heading(node, value) {
    const h = node.querySelector("[data-bind='title']");
    if (!h) return;
    if (!String(value || "").trim()) {
      h.remove();
      return;
    }
    h.textContent = value;
  }

  function lede(node, value) {
    const p = node.querySelector("[data-bind='lede']");
    if (!p) return;
    if (!String(value || "").trim()) {
      p.remove();
      return;
    }
    p.textContent = value;
  }

  function markCount(el, value) {
    const str = String(value || "");
    const m = str.match(/^(~)?(\d+)(\+)?$/);
    if (!m) return;
    el.setAttribute("data-count", m[2]);
    if (m[1]) el.setAttribute("data-count-prefix", m[1]);
    if (m[3]) el.setAttribute("data-count-suffix", m[3]);
  }

  function renderHero(block) {
    const node = clone("tpl-hero");
    if (!node) return null;
    text(node.querySelector("[data-bind='kicker']"), block.kicker);
    text(node.querySelector("[data-bind='title']"), block.title);
    text(node.querySelector("[data-bind='sub']"), block.sub);
    return node;
  }

  function renderFacts(block) {
    const node = clone("tpl-facts");
    if (!node) return null;
    if (block.id) node.id = block.id;
    heading(node, block.title);
    lede(node, block.lede);
    const grid = node.querySelector("[data-list='items']");
    const itemTpl = tpl("tpl-fact");
    if (grid && itemTpl && Array.isArray(block.items)) {
      grid.replaceChildren();
      block.items.forEach((item) => {
        const row = itemTpl.content.firstElementChild.cloneNode(true);
        const b = row.querySelector("[data-bind='value']");
        text(b, item.value);
        markCount(b, item.value);
        text(row.querySelector("[data-bind='label']"), item.label);
        grid.appendChild(row);
      });
    }
    return node;
  }

  function renderWork(block) {
    const node = clone("tpl-work");
    if (!node) return null;
    if (block.id) node.id = block.id;
    heading(node, block.title);
    lede(node, block.lede);
    const list = node.querySelector("[data-list='items']");
    const itemTpl = tpl("tpl-work-item");
    if (list && itemTpl && Array.isArray(block.items)) {
      list.replaceChildren();
      block.items.forEach((item, i) => {
        const row = itemTpl.content.firstElementChild.cloneNode(true);
        const idx = i + 1;
        text(row.querySelector("[data-bind='idx']"), idx < 10 ? "0" + idx : String(idx));
        text(row.querySelector("[data-bind='heading']"), item.heading);
        text(row.querySelector("[data-bind='body']"), item.body);
        list.appendChild(row);
      });
    }
    return node;
  }

  function renderJobs(block) {
    const node = clone("tpl-jobs");
    if (!node) return null;
    if (block.id) node.id = block.id;
    heading(node, block.title);
    lede(node, block.lede);
    const list = node.querySelector("[data-list='items']");
    const itemTpl = tpl("tpl-job");
    if (list && itemTpl && Array.isArray(block.items)) {
      list.replaceChildren();
      block.items.forEach((item) => {
        const row = itemTpl.content.firstElementChild.cloneNode(true);
        text(row.querySelector("[data-bind='role']"), item.role);
        text(row.querySelector("[data-bind='when']"), item.when);
        const ul = row.querySelector("[data-list='bullets']");
        if (ul && Array.isArray(item.bullets)) {
          ul.replaceChildren();
          item.bullets.forEach((line) => {
            const li = document.createElement("li");
            li.textContent = line;
            ul.appendChild(li);
          });
        }
        list.appendChild(row);
      });
    }
    return node;
  }

  function renderGroups(block) {
    const node = clone("tpl-groups");
    if (!node) return null;
    if (block.id) node.id = block.id;
    heading(node, block.title);
    lede(node, block.lede);
    const list = node.querySelector("[data-list='items']");
    const itemTpl = tpl("tpl-group");
    if (list && itemTpl && Array.isArray(block.items)) {
      list.replaceChildren();
      block.items.forEach((item) => {
        const row = itemTpl.content.firstElementChild.cloneNode(true);
        text(row.querySelector("[data-bind='heading']"), item.heading);
        text(row.querySelector("[data-bind='body']"), item.body);
        list.appendChild(row);
      });
    }
    return node;
  }

  function renderAbout(block) {
    const node = clone("tpl-about");
    if (!node) return null;
    if (block.id) node.id = block.id;
    heading(node, block.title);
    lede(node, block.lede);
    const img = node.querySelector("[data-bind='image']");
    if (img && block.image) {
      img.src = block.image;
      img.alt = block.title ? String(block.title) : "Portrait";
    }
    const list = node.querySelector("[data-list='meta']");
    const itemTpl = tpl("tpl-meta");
    if (list && itemTpl && Array.isArray(block.meta)) {
      list.replaceChildren();
      block.meta.forEach((item) => {
        const row = itemTpl.content.firstElementChild.cloneNode(true);
        text(row.querySelector("[data-bind='label']"), item.label);
        text(row.querySelector("[data-bind='body']"), item.body);
        list.appendChild(row);
      });
    }
    return node;
  }

  function renderProse(block) {
    const node = clone("tpl-prose");
    if (!node) return null;
    if (block.id) node.id = block.id;
    heading(node, block.title);
    lede(node, block.lede);
    const body = node.querySelector("[data-bind='body']");
    text(body, block.body);
    if (!block.body && body) body.remove();
    return node;
  }

  function renderContact(block, email) {
    const node = clone("tpl-contact");
    if (!node) return null;
    if (block.id) node.id = block.id;
    heading(node, block.title);
    lede(node, block.lede);
    const row = node.querySelector("[data-list='links']");
    if (row && Array.isArray(block.links)) {
      row.replaceChildren();
      block.links.forEach((item) => {
        if (!item || !item.href || !item.label) return;
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.label;
        row.appendChild(a);
      });
    }
    if (email) node.setAttribute("data-email", email);
    return node;
  }

  const renderers = {
    hero: renderHero,
    facts: renderFacts,
    work: renderWork,
    jobs: renderJobs,
    groups: renderGroups,
    about: renderAbout,
    prose: renderProse,
    contact: (block) => renderContact(block),
  };

  function renderHome(sections, email) {
    const mount = document.getElementById("sections");
    if (!mount || !Array.isArray(sections)) return;
    const enabled = sections.filter((s) => s && s.enabled !== false);
    const frag = document.createDocumentFragment();
    const rest = document.createElement("div");
    rest.className = "panel";
    let sawHero = false;

    enabled.forEach((block) => {
      const type = block.type;
      const fn = renderers[type];
      if (!fn) {
        console.warn("content: unknown block type", type);
        return;
      }
      const node = type === "contact" ? renderContact(block, email) : fn(block);
      if (!node) return;
      if (type === "hero" && !sawHero) {
        frag.appendChild(node);
        sawHero = true;
      } else {
        rest.appendChild(node);
      }
    });

    frag.appendChild(rest);
    mount.replaceChildren(frag);
  }

  function renderTrack(track) {
    const node = clone("tpl-track");
    if (!node) return null;
    text(node.querySelector("[data-bind='title']"), track.title);
    const year = node.querySelector("[data-bind='year']");
    if (year) {
      if (track.year) year.textContent = track.year;
      else year.remove();
    }
    const desc = node.querySelector("[data-bind='description']");
    if (desc) {
      if (track.description) desc.textContent = track.description;
      else desc.remove();
    }
    const cover = node.querySelector("[data-bind='cover']");
    if (cover) {
      if (track.cover) {
        cover.src = track.cover;
        cover.alt = track.title ? String(track.title) : "";
      } else {
        cover.remove();
      }
    }
    const slot = node.querySelector("[data-embed]");
    if (slot && window.NCEmbeds) window.NCEmbeds.mount(slot, track);
    return node;
  }

  function renderMusic(music) {
    text(document.querySelector("[data-bind='kicker']"), music.kicker);
    text(document.querySelector("[data-bind='title']"), music.title);
    text(document.querySelector("[data-bind='lede']"), music.lede);
    const empty = document.getElementById("music-empty");
    const grid = document.getElementById("track-grid");
    const tracks = Array.isArray(music.tracks) ? music.tracks : [];
    const visible = tracks.filter((t) => t && t.title);
    if (!visible.length) {
      if (empty && music.empty) text(empty.querySelector("p") || empty, music.empty);
      show(empty, true);
      show(grid, false);
      return;
    }
    show(empty, false);
    show(grid, true);
    if (!grid) return;
    grid.replaceChildren();
    visible.forEach((track) => {
      const card = renderTrack(track);
      if (card) grid.appendChild(card);
    });
  }

  async function boot() {
    const site = await getJSON("content/site.json");
    applyChrome(site);
    if (page === "home") {
      const home = await getJSON("content/home.json");
      if (home && Array.isArray(home.sections)) renderHome(home.sections, site && site.email);
    }
    if (page === "music") {
      const music = await getJSON("content/music.json");
      if (music) renderMusic(music);
      if (window.NCNotes && typeof window.NCNotes.configure === "function") {
        window.NCNotes.configure({
          midiUrl: (music && music.midi) || "media/score.mid",
          defaultBpm: music && music.bpm,
        });
      }
    }
    if (typeof window.initNav === "function") {
      window.initNav({ email: site && site.email });
    }
  }

  boot();
})();
