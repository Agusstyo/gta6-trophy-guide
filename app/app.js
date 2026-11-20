// Leonida Legend — an offline GTA VI trophy guide and tracker.
// All 55 official trophies with a checklist that saves in the browser, numeric
// counters for the trophies PlayStation gives a target, filters, search, a
// spoiler setting, export/import, a staged roadmap and a missables watch list.
// It loads exactly one file besides itself: data/trophies.json, from its own
// folder. Nothing is fetched from the network, ever.

const STORE_KEY = 'leonida-legend-v1';
const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;
const byId = new Map(trophies.map((t) => [t.id, t]));
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];

const state = loadState();
let selectedId = null;

function loadState() {
  const fresh = { earned: [], counts: {}, spoilers: true };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return fresh;
    return {
      earned: Array.isArray(raw.earned) ? raw.earned.filter((id) => byId.has(id)) : [],
      counts: raw.counts && typeof raw.counts === 'object' ? raw.counts : {},
      spoilers: raw.spoilers !== false,
    };
  } catch {
    return fresh;
  }
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

const earnedSet = () => new Set(state.earned);
const isEarned = (id) => earnedSet().has(id);
const countOf = (t) => Math.max(0, Number(state.counts[t.id] ?? 0) || 0);
const isHidden = (t) => state.spoilers && t.spoiler && !isEarned(t.id);
const fmt = (n) => n.toLocaleString('en-US');

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function medal(grade, large = false) {
  const m = el('span', `medal ${grade}${large ? ' lg' : ''}`);
  m.setAttribute('aria-hidden', 'true');
  return m;
}

function chipsFor(t) {
  const wrap = el('div', 'chips');
  wrap.append(el('span', 'chip grade', t.grade));
  wrap.append(el('span', 'chip', t.kind));
  if (t.missable === 'watch') wrap.append(el('span', 'chip watch', 'Watch list'));
  if (isEarned(t.id)) wrap.append(el('span', 'chip done', 'Earned'));
  else if (t.target && countOf(t) >= t.target) wrap.append(el('span', 'chip done', 'Target reached'));
  return wrap;
}

/* ---------- header scoreboard ---------- */
function renderHeader() {
  const earned = earnedSet();
  document.getElementById('earned-count').textContent = String(earned.size);
  const bar = document.getElementById('overall-bar');
  bar.setAttribute('aria-valuenow', String(earned.size));
  document.getElementById('overall-fill').style.width = `${(earned.size / trophies.length) * 100}%`;
  for (const g of GRADES) {
    const all = trophies.filter((t) => t.grade === g);
    const got = all.filter((t) => earned.has(t.id)).length;
    document.getElementById(`count-${g}`).textContent = `${got}/${all.length}`;
  }
  document.getElementById('watch-count').textContent =
    String(trophies.filter((t) => t.missable === 'watch').length);
}

/* ---------- numeric progress counter ---------- */
function makeCounter(t) {
  const wrap = el('div', 'counter');
  const minus = el('button', '', '−');
  minus.type = 'button';
  minus.setAttribute('aria-label', `One fewer for ${t.name}`);
  const plus = el('button', '', '+');
  plus.type = 'button';
  plus.setAttribute('aria-label', `One more for ${t.name}`);
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = t.target >= 10000 ? '1000' : '1';
  input.value = String(countOf(t));
  input.setAttribute('aria-label', `Your count for ${t.name}`);
  const set = (v) => {
    state.counts[t.id] = Math.max(0, Math.floor(Number(v) || 0));
    saveState();
    refresh();
  };
  minus.addEventListener('click', () => set(countOf(t) - Number(input.step)));
  plus.addEventListener('click', () => set(countOf(t) + Number(input.step)));
  input.addEventListener('change', () => set(input.value));
  const mini = el('div', 'mini-bar');
  const fill = el('span');
  fill.style.width = `${Math.min(100, (countOf(t) / t.target) * 100)}%`;
  mini.append(fill);
  wrap.append(minus, input, plus, mini,
    el('span', 'target-note', `of ${fmt(t.target)} ${t.targetLabel}`));
  return wrap;
}

/* ---------- tracker list ---------- */
const listEl = document.getElementById('trophy-list');

function cardFor(t) {
  const li = el('li', `card${isEarned(t.id) ? ' earned' : ''}${selectedId === t.id ? ' selected' : ''}${isHidden(t) ? ' hidden-trophy' : ''}`);
  li.dataset.id = String(t.id);
  const tick = el('label', 'tick');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = isEarned(t.id);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('change', () => toggleEarned(t.id, box.checked));
  tick.append(box);
  li.append(tick, medal(t.grade));
  const main = el('div', 'card-main');
  if (isHidden(t)) {
    main.append(el('div', 'card-name', 'Hidden story trophy'));
    main.append(el('div', 'card-desc', 'Spoiler protection is on: this trophy belongs to the story, so its name and description stay hidden until you earn it.'));
  } else {
    main.append(el('div', 'card-name', t.name));
    main.append(el('div', 'card-desc', t.description));
  }
  main.append(chipsFor(t));
  if (t.target && !isHidden(t)) main.append(makeCounter(t));
  li.append(main);
  li.addEventListener('click', (ev) => {
    if (ev.target.closest('button, input, label, select, a')) return;
    selectTrophy(t.id);
  });
  return li;
}

function currentFilters() {
  return {
    q: document.getElementById('search').value.trim().toLowerCase(),
    grade: document.getElementById('filter-grade').value,
    kind: document.getElementById('filter-kind').value,
    status: document.getElementById('filter-status').value,
  };
}

function renderList() {
  const f = currentFilters();
  const shown = trophies.filter((t) => {
    if (f.grade !== 'all' && t.grade !== f.grade) return false;
    if (f.kind !== 'all' && t.kind !== f.kind) return false;
    if (f.status === 'earned' && !isEarned(t.id)) return false;
    if (f.status === 'unearned' && isEarned(t.id)) return false;
    if (f.status === 'watch' && t.missable !== 'watch') return false;
    if (f.q && !`${t.name} ${t.description} ${t.kind}`.toLowerCase().includes(f.q)) return false;
    return true;
  });
  listEl.replaceChildren(...shown.map(cardFor));
  document.getElementById('result-line').textContent =
    shown.length === trophies.length
      ? 'All 55 trophies shown.'
      : `${shown.length} of 55 trophies match.`;
}

function toggleEarned(id, on) {
  const set = earnedSet();
  if (on) set.add(id); else set.delete(id);
  state.earned = [...set];
  saveState();
  refresh();
}

/* ---------- guide pane ---------- */
const paneBody = document.getElementById('pane-body');
const paneEmpty = document.getElementById('pane-empty');

function selectTrophy(id) {
  selectedId = id;
  renderList();
  renderPane();
  document.getElementById('guide-pane').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderPane() {
  const t = selectedId ? byId.get(selectedId) : null;
  if (!t) {
    paneBody.hidden = true;
    paneEmpty.hidden = false;
    return;
  }
  paneEmpty.hidden = true;
  paneBody.hidden = false;
  paneBody.replaceChildren();
  if (isHidden(t)) {
    paneBody.append(el('h2', '', 'Hidden story trophy'));
    paneBody.append(el('p', '', 'Spoiler protection is on, and this trophy belongs to the story. Its name, description and guide stay hidden until you earn it — then the full entry appears here. Turn spoiler protection off in the tracker controls if you would rather read everything now.'));
    return;
  }
  const head = el('div', 'pane-head');
  head.append(medal(t.grade, true));
  const headText = el('div');
  headText.append(el('h2', '', t.name));
  headText.append(chipsFor(t));
  head.append(headText);
  paneBody.append(head);
  paneBody.append(el('h3', '', 'Official description'));
  paneBody.append(el('p', 'pane-official', `“${t.description}”`));
  paneBody.append(el('h3', '', 'The guide — our own words'));
  paneBody.append(el('p', '', t.guide));
  if (t.target) {
    paneBody.append(el('h3', '', 'Progress'));
    paneBody.append(el('p', '', `PlayStation's target for this trophy is ${fmt(t.target)} ${t.targetLabel}. Your logged count:`));
    paneBody.append(makeCounter(t));
  }
  paneBody.append(el('h3', '', 'Can it be missed?'));
  if (t.missable === 'watch') {
    paneBody.append(el('p', 'missable-note', t.missableNote));
  } else {
    paneBody.append(el('p', '', 'Nothing in the official description suggests this one can be missed: it is a completion, collection or counter trophy whose opportunity does not appear to close. If the game proves otherwise, it will not be because the description warned anyone.'));
  }
  paneBody.append(el('h3', '', 'Sources'));
  paneBody.append(el('p', 'sources', t.sources));
  const earn = el('label', 'pane-earn');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = isEarned(t.id);
  box.addEventListener('change', () => toggleEarned(t.id, box.checked));
  earn.append(box, document.createTextNode('I have earned this trophy'));
  paneBody.append(earn);
}

/* ---------- roadmap ---------- */
const ROADMAP = [
  {
    title: 'Run the story',
    text: 'The story is a straight line of chapters, named missions and a finale, and twelve trophies sit on it. Play it first, at your own pace, with spoiler protection on. Two habits to start now: take stranger missions as they appear instead of saving them all for later, and read the watch list once before the final mission, because a few one-off moments may live near the endgame.',
    ids: [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 7],
  },
  {
    title: 'The strangers of Leonida',
    text: 'Six strangers run mission strands across the state — Andy, Kenton, Billy, Randy, Tyrone and Bret — and each finished strand earns its own trophy. Those six, plus two more strands the game offers, complete the silver Strangers & Freaks. Bret\u2019s strand also carries the unique-animal hunt, so go to that one prepared.',
    ids: [22, 23, 24, 26, 27, 29, 25],
  },
  {
    title: 'Better together',
    text: 'Two trophies need your partner beside you and a wanted level managed on purpose: one escape from four stars, and three shop robberies in a single unbroken run of heat. Both are quick to stage deliberately and awkward to leave to chance, so do them while you are roaming together anyway.',
    ids: [33, 34],
  },
  {
    title: 'See and do everything',
    text: 'The great sweep. Sample every activity type once, then work the counters: 250 stunts, 42 shooting-range golds, drone-race wins at 14 locations, 20 different race wins, 50 challenges, 10 vehicles registered. Fold in the exploration set — 18 meditation spots, 3 card sets, 100 WAiNK locations, 100 vehicles discovered, all 52 areas of Leonida — because these overlap heavily with simply travelling the state.',
    ids: [16, 15, 17, 18, 19, 20, 21, 46, 32, 55, 28, 30, 31, 35, 42],
  },
  {
    title: 'Crime pays, slowly',
    text: 'Crime, organised. A quiet jewelry job, five bank vaults with escapes, an armored truck, one illegal operation from each of the nine gangs, and the combat feats. The money trophies ride along: $250,000 laundered through your contacts, $100,000 spent across the shops, and all eight garage properties once the robberies have made you rich enough to buy them.',
    ids: [39, 40, 41, 43, 36, 51, 38, 52, 53, 54],
  },
  {
    title: 'Loose ends, then the summit',
    text: 'Whatever is left. Sweep up the one-off moments the descriptions hint at — a cocktail on Ocean Beach, a showroom exit in classic style, the strange encounter — then push the game\u2019s own completion counter to 100% for A Long Road. The platinum, Vice Got a Price!, arrives by itself the moment the fifty-fourth other trophy lands.',
    ids: [37, 44, 45, 47, 48, 49, 50, 14, 1],
  },
];

function renderRoadmap() {
  const wrap = document.getElementById('roadmap-stages');
  wrap.replaceChildren();
  ROADMAP.forEach((stage, i) => {
    const got = stage.ids.filter((id) => isEarned(id)).length;
    const box = el('section', 'stage');
    const head = el('div', 'stage-head');
    head.append(el('span', 'stage-num', `${i + 1}.`));
    head.append(el('h3', '', stage.title));
    head.append(el('span', 'stage-count', `${got} of ${stage.ids.length} earned`));
    box.append(head);
    const bar = el('div', 'bar');
    const fill = el('span');
    fill.style.width = `${(got / stage.ids.length) * 100}%`;
    bar.append(fill);
    box.append(bar);
    box.append(el('p', '', stage.text));
    const ul = el('ul');
    for (const id of stage.ids) {
      const t = byId.get(id);
      const li = el('li');
      const b = el('button', isEarned(id) ? 'is-earned' : '', isHidden(t) ? 'Hidden story trophy' : t.name);
      b.type = 'button';
      b.addEventListener('click', () => {
        switchView('tracker');
        selectTrophy(id);
      });
      li.append(b);
      ul.append(li);
    }
    box.append(ul);
    wrap.append(box);
  });
}

/* ---------- missables watch list ---------- */
function renderWatch() {
  const wrap = document.getElementById('watch-list');
  wrap.replaceChildren();
  for (const t of trophies.filter((x) => x.missable === 'watch')) {
    const li = el('li', `card${isEarned(t.id) ? ' earned' : ''}`);
    li.append(medal(t.grade));
    const main = el('div', 'card-main');
    main.append(el('div', 'card-name', t.name));
    main.append(el('div', 'card-desc', t.description));
    main.append(chipsFor(t));
    const note = el('p', 'missable-note', t.missableNote);
    note.style.marginTop = '9px';
    main.append(note);
    li.append(main);
    li.addEventListener('click', (ev) => {
      if (ev.target.closest('button, input, label, select, a')) return;
      switchView('tracker');
      selectTrophy(t.id);
    });
    wrap.append(li);
  }
}

/* ---------- views ---------- */
function switchView(name) {
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.view === name);
  }
  for (const view of document.querySelectorAll('.view')) {
    view.classList.toggle('active', view.id === `view-${name}`);
  }
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
}
for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
}

/* ---------- export / import / reset ---------- */
const ioNote = document.getElementById('io-note');
function note(msg) {
  ioNote.textContent = msg;
  setTimeout(() => { if (ioNote.textContent === msg) ioNote.textContent = ''; }, 5000);
}

document.getElementById('export-btn').addEventListener('click', () => {
  const payload = {
    app: 'leonida-legend',
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: state.earned.map((id) => byId.get(id)?.name).filter(Boolean),
    earnedIds: [...state.earned],
    counts: Object.fromEntries(Object.entries(state.counts).map(([id, n]) => [byId.get(Number(id))?.name ?? id, n])),
    countIds: state.counts,
    spoilers: state.spoilers,
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'leonida-legend-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
  note('Progress exported.');
});

document.getElementById('import-file').addEventListener('change', async (ev) => {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const nameToId = new Map(trophies.map((t) => [t.name, t.id]));
    let earned = [];
    let counts = {};
    if (Array.isArray(parsed)) {
      // A plain list of trophy names (the shape simple checklists export).
      earned = parsed.map((n) => nameToId.get(n)).filter((id) => id !== undefined);
    } else {
      if (Array.isArray(parsed.earnedIds)) earned = parsed.earnedIds.filter((id) => byId.has(id));
      else if (Array.isArray(parsed.earned)) earned = parsed.earned.map((n) => nameToId.get(n)).filter((id) => id !== undefined);
      const rawCounts = parsed.countIds && typeof parsed.countIds === 'object' ? parsed.countIds : parsed.counts;
      if (rawCounts && typeof rawCounts === 'object') {
        for (const [k, v] of Object.entries(rawCounts)) {
          const id = byId.has(Number(k)) ? Number(k) : nameToId.get(k);
          if (id !== undefined && Number.isFinite(Number(v))) counts[id] = Math.max(0, Math.floor(Number(v)));
        }
      }
      if (typeof parsed.spoilers === 'boolean') state.spoilers = parsed.spoilers;
    }
    state.earned = [...new Set(earned)];
    state.counts = counts;
    saveState();
    syncControls();
    refresh();
    note(`Imported: ${state.earned.length} trophies marked earned.`);
  } catch {
    note('That file could not be read as progress JSON.');
  }
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!confirm('Clear every tick and counter in this tracker? This cannot be undone.')) return;
  state.earned = [];
  state.counts = {};
  saveState();
  refresh();
  note('Progress reset.');
});

/* ---------- wiring ---------- */
function refresh() {
  renderHeader();
  renderList();
  renderPane();
  renderRoadmap();
  renderWatch();
}

function syncControls() {
  document.getElementById('spoiler-toggle').checked = state.spoilers;
}

const kindSelect = document.getElementById('filter-kind');
for (const kind of [...new Set(trophies.map((t) => t.kind))]) {
  const opt = document.createElement('option');
  opt.value = kind;
  opt.textContent = kind;
  kindSelect.append(opt);
}
for (const id of ['search', 'filter-grade', 'filter-kind', 'filter-status']) {
  document.getElementById(id).addEventListener('input', renderList);
  document.getElementById(id).addEventListener('change', renderList);
}
document.getElementById('spoiler-toggle').addEventListener('change', (ev) => {
  state.spoilers = ev.target.checked;
  saveState();
  refresh();
});

syncControls();
refresh();
const startView = ['roadmap', 'missables'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'tracker';
switchView(startView);
