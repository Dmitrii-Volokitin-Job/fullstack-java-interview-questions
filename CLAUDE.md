# CLAUDE.md — fullstack-java-interview-questions

> 🧠 **Brain:** Global rules → `~/.claude/CLAUDE.md` (canonical: `ai-brain-repository/global/CLAUDE.md`) + `~/.claude/docs/`.
> Wiki: [[fullstack-java-interview-questions]] · Skills: [[static-educational-site]]. This file lists ONLY what is unique to this project.

<!-- BRAIN:CONTEXT (auto-generated from the wiki note — edit the note, then run scripts/sync-context.py) -->
## Context
- **Group:** learning
- Full-stack Java interview prep site — multi-page static HTML (one page per topic).
<!-- /BRAIN:CONTEXT -->

## Overview

Full-stack Java interview prep site.

## Stack

Multi-page static HTML (one page per topic) + `css/` + `js/`; mastery state in localStorage. No build step.

## Project-specific rules

- **Sidebar = `NAV` in `js/app.js`.** Pages ship an empty `<aside class="sidebar"></aside>`; never hand-write sidebar links. A new topic page needs a `NAV` entry whose `count` equals its `.qa-card` count (check-site enforces it).
- **Card markup** (only one allowed): `.qa-card[data-pillar] > .qa-question(.qa-num, .qa-question-text, .qa-difficulty, .qa-chevron) + .qa-answer`. New cards carry `data-new` so the legacy-key migration skips them.
- **Card state keys** are `<page>:<fnv1a of question text>` — editing a question's text resets its saved mastery/notes/SRS. Fix typos in answers freely; change question text only on purpose.
- **Diagrams** (`.pat-svg` / `.uml-svg`): font ≥ 11, labels ≥ 6px inside their shape, nothing within 4px of the viewBox edge, no line through text, and each diagram must match the code beside it.
- **Never `innerHTML` with data**; Font Awesome 6 icons for controls.
- **Before every commit** run both checks (server on 8000 via `scripts/serve.sh`, or pass a URL):
  - `python3 scripts/check-site.py` → `OK`
  - `node scripts/check-browser.js diagrams` and `node scripts/check-browser.js flows` → all ok / PASS; then look at the changed screenshots in `screenshots/diagrams/` (git-ignored).
- **Bump `?v=`** on `css/styles.css`, `js/app.js`, `js/quiz.js` in every page when that file changes.
- Live site: https://dmitrii-volokitin-job.github.io/fullstack-java-interview-questions/ (GitHub Pages from `main` /).
<!-- Ports, schema, gotchas, sanctioned exceptions only. Shared stack conventions live in the linked skills. -->
