// Leonida Legend — regenerate the four screenshots (1280x800 JPEG, <=256 KiB).
//
// Drives the headless Chromium shell from the Playwright cache over CDP, using
// Node 22+'s built-in WebSocket and the standard library only — no extra
// dependencies. It serves app/ with serve.ts, seeds the same demo hunt on
// every run (13 of 55 earned, Cunning Stunts at 212 of 250, Positive Mental
// Attitude at 11 of 18, a saved note on Catch Me If You Can), then captures:
//
//   1 tracker — night look, guide pane open on Catch Me If You Can
//   2 guide pane, with the paper look switched on
//   3 roadmap to the platinum
//   4 planner, scrolled to the one-off moments group
//
// Usage: node shots.mjs
// The script refuses to finish quietly with an oversized or wrong-sized shot:
// it reports each file's size and dimensions, and exits non-zero on any
// console error from the page or any shot over the 256 KiB gate cap.

import { spawn } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const PORT = 8123;
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const SHOTS = [
  { file: '1-tracker.jpg', path: '/', theme: 'dark', setup: 'tracker' },
  { file: '2-guide.jpg', path: '/', theme: 'paper', setup: 'guide' },
  { file: '3-roadmap.jpg', path: '/#roadmap', theme: 'dark', setup: 'top' },
  { file: '4-planner.jpg', path: '/#planner', theme: 'dark', setup: 'planner' },
];

// The demo hunt every shot is taken from: 13 earned (4 of them story, so
// roadmap stage 1 reads 4 of 12), two counters part-way, spoiler protection
// on, one saved note. The same object the app itself stores in localStorage.
const seedFor = (theme) => JSON.stringify({
  earned: [2, 3, 4, 5, 16, 19, 21, 32, 36, 38, 42, 46, 55],
  counts: { 15: 212, 28: 11 },
  spoilers: true,
  notes: { 37: 'Tried a free-roam takeoff from the VCIA runway — no pop yet. Next: try during a story visit, before leaving the airfield.' },
  theme,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`never came up: ${url}`);
}

// Read a JPEG's dimensions from its start-of-frame marker.
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

// ---- CDP over the built-in WebSocket ---------------------------------------
let msgId = 0;
const pending = new Map();
const loadWaiters = [];
const pageErrors = [];

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(new Error(`WebSocket error: ${e.message ?? 'unknown'}`));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(`CDP ${msg.error.message}`));
        else res(msg.result);
      } else if (msg.method === 'Page.loadEventFired') {
        for (const w of loadWaiters.splice(0)) w();
      } else if (msg.method === 'Runtime.exceptionThrown') {
        pageErrors.push(msg.params.exceptionDetails.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        pageErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    };
  });
}

function send(ws, sessionId, method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, sessionId, method, params }));
  });
}

const waitLoad = () => new Promise((r) => loadWaiters.push(r));

async function evaluate(ws, sessionId, expression) {
  const res = await send(ws, sessionId, 'Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  if (res.exceptionDetails) throw new Error(`page JS failed: ${res.exceptionDetails.text}`);
  return res.result.value;
}

// Per-shot page setup, run after the seeded reload.
const SETUPS = {
  tracker: `(() => {
    document.querySelector('li[data-id="37"]').click();
    window.scrollTo(0, 0);
    return document.getElementById('earned-count').textContent;
  })()`,
  guide: `(() => {
    document.querySelector('li[data-id="37"]').click();
    // Scroll the page until the sticky guide pane docks at the top, so the
    // pane gets the full viewport height instead of the strip below the
    // list, then scroll inside the pane to the guide itself: guide text,
    // missable note, sources and the reader's own note all in one frame.
    window.scrollTo({ top: 700, behavior: 'instant' });
    const pane = document.getElementById('guide-pane');
    const head = [...pane.querySelectorAll('h3')].find((e) => e.textContent === 'The guide — our own words');
    if (head) pane.scrollTop = head.offsetTop + 40;
    return document.getElementById('earned-count').textContent;
  })()`,
  top: `(() => { window.scrollTo(0, 0); return 'ok'; })()`,
  planner: `(() => {
    // The counter group is long, so scroll just far enough that the tail of
    // it and the whole one-off moments group are in frame together.
    const groups = document.querySelectorAll('.plan-group');
    const target = groups[1];
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 130, behavior: 'instant' });
    return document.getElementById('plan-count').textContent;
  })()`,
};

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: repoDir, stdio: 'ignore' });
  const chrome = spawn(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--hide-scrollbars', '--window-size=1280,800',
    '--user-data-dir=/tmp/leonida-shots-profile',
    '--remote-debugging-port=9222', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitFor(`http://127.0.0.1:${PORT}/`);
    await waitFor('http://127.0.0.1:9222/json/version');
    const { webSocketDebuggerUrl } = await (await fetch('http://127.0.0.1:9222/json/version')).json();
    const ws = await connect(webSocketDebuggerUrl);
    const { targetId } = await send(ws, undefined, 'Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send(ws, undefined, 'Target.attachToTarget', { targetId, flatten: true });
    await send(ws, sessionId, 'Page.enable');
    await send(ws, sessionId, 'Runtime.enable');
    const firstLoad = waitLoad();
    await send(ws, sessionId, 'Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await firstLoad;
    await sleep(400);

    mkdirSync(join(repoDir, 'screenshots'), { recursive: true });
    for (const shot of SHOTS) {
      // Seed, then reload so the app boots from the seeded state. A hash-only
      // change is a same-document navigation with no load event, so hash
      // shots reload explicitly after setting the hash.
      await evaluate(ws, sessionId, `localStorage.setItem('leonida-legend-v1', ${JSON.stringify(seedFor(shot.theme))})`);
      const load = waitLoad();
      if (shot.path.startsWith('/#')) {
        await evaluate(ws, sessionId, `(() => { location.hash = ${JSON.stringify(shot.path.slice(1))}; location.reload(); })()`);
      } else {
        await evaluate(ws, sessionId, `location.assign(${JSON.stringify(`http://127.0.0.1:${PORT}${shot.path}`)})`);
      }
      await load;
      await sleep(500);
      const marker = await evaluate(ws, sessionId, SETUPS[shot.setup]);
      await sleep(400);
      let quality = 82;
      let buf;
      for (;;) {
        const { data } = await send(ws, sessionId, 'Page.captureScreenshot', { format: 'jpeg', quality });
        buf = Buffer.from(data, 'base64');
        if (buf.length <= 262144 || quality <= 55) break;
        quality -= 10;
      }
      const out = join(repoDir, 'screenshots', shot.file);
      writeFileSync(out, buf);
      const dims = jpegSize(buf);
      console.log(`${shot.file}: ${(buf.length / 1024).toFixed(1)} KiB, ${dims ? `${dims.width}x${dims.height}` : 'size unreadable'}, quality ${quality}, marker ${marker}${buf.length > 262144 ? ' — OVER THE 256 KiB CAP' : ''}`);
      if (!dims || dims.width !== 1280 || dims.height !== 800) throw new Error(`${shot.file} is not 1280x800`);
      if (buf.length > 262144) throw new Error(`${shot.file} is over the 256 KiB cap`);
    }
    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(' | ')}`);
    console.log('All four shots done, no page errors.');
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
