# Leonida Legend — a GTA VI trophy guide & tracker

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/Agusstyo/gta6-trophy-guide/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/Agusstyo/gta6-trophy-guide/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

A free, open-source trophy guide and tracker for Grand Theft Auto VI on PlayStation 5. It covers all **55 official trophies** — 1 platinum, 2 gold, 6 silver, 46 bronze — and it runs **completely offline**: open it from its own files and it never touches the network. No account, no PSN sync, no ads.

## What it does

- **Tracker** — a checklist of all 55 trophies with the official name, description and grade for each. Ticks are saved in the browser (localStorage), and progress can be **exported to and imported from a JSON file**, so a hunt survives a cleared cache or a new machine.
- **Numeric progress** — where PlayStation publishes a target (250 stunts, 42 shooting-range golds, $250,000 laundered, 500 choices…), the tracker keeps a counter with a progress bar, so part-way progress is never lost.
- **Next up** — a strip at the top of the tracker names the counter trophy closest to its target (with its percentage and how much is left) and opens that trophy's guide on click, so the next job to grind is always one glance away.
- **Planner** — a full "what next" view that ranks the whole hunt from your saved progress: counters nearest their PlayStation target first (with the exact count left), then the watch-list trophies still unearned, then the quick wins — unearned, spoiler-free trophies rated as a single short job. It rebuilds itself every time you tick a trophy or move a counter, and every row opens that trophy's guide.
- **Your own notes** — every guide pane carries a notes field of your own: where you left a counter, what worked, what to try next. Notes save with your progress in the browser and travel inside the export/import JSON, and a trophy with notes wears a chip in the list so you can find it again.
- **Two looks** — the dark "night in Leonida" and a light paper look, switched from the tab row and remembered with the rest of your state.
- **Filters and search** — by grade, by kind (story, strangers, activities, collectibles & exploration, crime & combat, partner, money & property, moments), by status, or by text.
- **Spoiler protection** — story trophies' names and descriptions stay hidden until you earn them, so the tracker can sit open from day one without spoiling the game.
- **A guide for every trophy** — click any trophy for its full guide: what to do, a missable note, its progress target, and its sources. Every guide is written for this page, in our own words, from the official trophy descriptions.
- **Roadmap to the platinum** — six stages (story → strangers → partner work → the great sweep → crime & money → loose ends and the 100% summit), each with its own progress read live from your tracker.
- **Missables watch list** — no trophy on the official list is *confirmed* missable, and the guide says so plainly. Seven trophies whose wording suggests a one-off moment, a unique target, a choice or a second attempt are flagged, each with the reasoning spelled out.

## Sources & honesty

- Trophy names, descriptions and grades: the official list on **Exophase** (the list frozen 2026-11-18), held in `app/data/trophies.json` exactly as published.
- Progress targets, where a trophy has one: **PSNProfiles**, for PSN's count for that trophy, or the figure in the official description itself.
- The guides are this project's own advice, drawn from the official descriptions and **not yet checked in the game**. Where a description does not pin down a location, a step or a requirement, the guide says so instead of inventing one. No text is copied from any existing guide site.

## Run it

Serve the app locally (any static file server works; it must be served, not opened as a `file://` page, because it loads its data file):

```sh
node serve.ts            # then open http://localhost:8080
```

Build the hand-in (copies `app/` and `screenshots/` to the output directory and writes `dossier.json`):

```sh
node main.ts             # writes to /output, or $MAKEFUN_OUTPUT_DIR
```

## Layout

- `app/index.html`, `app/app.js`, `app/style.css` — the whole app: no build step, no dependencies, system fonts only, medal swatches drawn in CSS.
- `app/data/trophies.json` — the official list plus, per trophy: kind, spoiler flag, progress target, missable flag/note, an effort estimate the planner ranks by (this project's own judgement, not an official figure), the full guide, and its sources.
- `main.ts` / `vendor/makefun-frontend.ts` — the hand-in program and the vendored dossier library (the scorer's own copy; left byte-for-byte as shipped).
- `screenshots/` — four screens of the app with a hunt in progress (13 of 55 earned, spoiler protection on): the tracker, a guide pane with the reader's own notes, the roadmap, and the planner.

Leonida Legend is a fan-made tool. It is not affiliated with Rockstar Games or Take-Two Interactive, and it uses no Rockstar artwork, logos or assets. MIT licensed — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=hh8nsv3m&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
