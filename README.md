# niccolarossi.com

Static HTML/CSS/JS. Career home, a music room, and Pages CMS for copy. No WordPress, no build step, no page builder runtime.

## Local preview

Serve the repo root (JSON fetch does not work from `file://`):

```bash
python3 -m http.server 8080
```

Open http://localhost:8080 and http://localhost:8080/music.html

## What you can edit in Pages CMS

Sign in at [app.pagescms.org](https://app.pagescms.org), connect this GitHub repo, and use the sidebar:

| Sidebar | File | For |
|---|---|---|
| Site → Chrome & SEO | `content/site.json` | Title, description, nav, footer, email |
| Home | `content/home.json` | Hero plus every career section |
| Music | `content/music.json` | Music kicker/lede and tracks |

Everyday copy, section order, hiding a section, and adding another **existing** block type (facts, work, jobs, groups, about, prose, contact) are CMS edits. After you save, GitHub gets a commit and the live host serves the new JSON.

### Reorder or drop a section

In Home → Sections, drag blocks or set **Enabled** to off. Disabled blocks stay in the CMS so you can turn them back on.

### Add a Certifications (or similar) section

1. Home → Sections → add a **Prose** block.
2. Set `id` to `certs` (or anything).
3. Fill title / lede / body.
4. Site → Navigation → add `{ label: Certifications, href: index.html#certs }`.

### Add a track

Music → Tracks → new item. Set **Player** and paste a share URL (SoundCloud, Bandcamp, YouTube, Spotify) or upload an audio file. Leave Tracks empty to keep the designed empty state.

### MIDI field

The music page background is a score, not random notes. It reads a Standard MIDI file (`media/score.mid` by default). Set **Score MIDI** and **Default BPM** in Pages CMS, or drop a `.mid` on the page from the corner tempo menu. Glyphs appear as the file plays and scrub left to right; BPM is the pace. The menu remembers tempo in the browser.

**Sound** is off until you turn it on. If the browser can see a system MIDI port (OS synth, IAC Driver, a connected device), the score is sent there. If not, it uses a small in-page synth so the toggle still makes sound. Pick the port from the Output menu.

SoundCloud and Bandcamp pick up the phosphor green via their own embed params. Spotify goes dark. YouTube stays stock. No extra hosting is required for that.

## What still needs a code change

- A **new block type** (timeline, PDF card, photo grid): add a `<template>` in `index.html`, a renderer in `js/content.js`, and a block definition in `.pages.yml`.
- A **new HTML page**: duplicate chrome from `music.html`, add a nav href.
- Palette, canvases, type.

Unknown block types are skipped with a console warning. The page does not blank.

## HTML fallback

`index.html` and `music.html` ship with today’s copy so the site is complete if JavaScript is off. Pages CMS edits JSON; JS-on visitors see that. JS-off visitors keep the snapshot in the HTML until those files are restamped. Everyday edits go in Pages CMS.

## Deploy

Drop the repo root on **GitHub Pages**, **Cloudflare Pages**, or **Netlify**. Publish directory is `.` (this folder). Point `niccolarossi.com` DNS at the host when you are ready to leave WordPress.

Connect Pages CMS after the repo exists on GitHub. The GitHub App is a one-time browser step; it is not part of the static files.

## Layout

```
index.html          career home
music.html          listening room
styles.css
js/                 nav, content hydration, canvases, embeds
content/            CMS JSON
assets/             photo, favicon
media/              CMS uploads
.pages.yml          Pages CMS schema
```
