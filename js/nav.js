(function (global) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function animateCount(el) {
    const raw = el.getAttribute("data-count");
    if (!raw) return;
    const prefix = el.getAttribute("data-count-prefix") || "";
    const suffix = el.getAttribute("data-count-suffix") || "";
    const target = Number(raw);
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + String(Math.round(target * eased)) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function bindForm(email) {
    const form = document.getElementById("reach");
    if (!form) return;
    const to = email || "nic.colarossi@gmail.com";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const from = String(data.get("email") || "").trim();
      const message = String(data.get("message") || "").trim();
      const subject = encodeURIComponent(`Note from ${name || "niccolarossi.com"}`);
      const body = encodeURIComponent(`${message}\n\n— ${name}\n${from}`);
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });
  }

  function bindMenu() {
    const burger = document.querySelector(".burger");
    const links = document.querySelector(".nav-links");
    if (!burger || !links) return;
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
    });
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        links.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      })
    );
  }

  function spy() {
    const links = [...document.querySelectorAll(".nav-links a")];
    const sections = [...document.querySelectorAll("main section[id]")];
    if (!links.length || !sections.length) return;

    const map = new Map();
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const hash = href.includes("#") ? href.slice(href.indexOf("#") + 1) : "";
      if (hash) map.set(hash, a);
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          links.forEach((a) => a.classList.remove("is-active"));
          const active = map.get(id);
          if (active) active.classList.add("is-active");
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0.01 }
    );

    sections.forEach((s) => io.observe(s));
  }

  function reveals() {
    const nav = document.querySelector(".nav");
    const onScroll = () => {
      if (nav) nav.classList.toggle("is-scrolled", window.scrollY > 10);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    if (reduced) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
          entry.target.querySelectorAll("[data-count]").forEach(animateCount);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );

    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  }

  function initNav(opts) {
    const year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
    bindMenu();
    bindForm(opts && opts.email);
    spy();
    reveals();
  }

  global.initNav = initNav;
})(window);
