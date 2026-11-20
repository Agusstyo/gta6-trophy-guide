// Leonida Legend — the hand-in program (Node 22, standard library only).
//
// What this does, in order:
//   1. works out where the entry goes: $MAKEFUN_OUTPUT_DIR when it is set,
//      otherwise /output (the grader's container provides the real /output;
//      the environment variable is how we rehearse the same run locally);
//   2. copies the guide itself — the app/ folder of static files sitting next
//      to this program — into the output folder, with plain direct copies;
//   3. copies the screenshots/ folder the same way;
//   4. asks the vendored dossier library to describe the finished output
//      folder and writes what it returns to dossier.json, untouched.
//
// vendor/makefun-frontend.ts is make.fun's own library and stays exactly as
// shipped: the scorer rebuilds the dossier with its own copy and requires
// the two to agree byte for byte, so the caps passed below are the scorer's
// caps from the competition gate, not numbers I picked.
//
// Rehearse it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const entryDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's limits, handed to buildDossier so this program refuses anything
// the scorer would refuse: a dossier text budget, at most 4 screenshots of
// 256 KiB each, and the app tree's entry and byte ceilings.
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

// Total the files under a folder (recursively) so the summary at the end can
// say what was actually handed in. Returns null for a folder that is absent.
function tally(dir) {
  if (!existsSync(dir)) return null;
  let files = 0;
  let bytes = 0;
  const pending = [dir];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const name of readdirSync(current)) {
      const path = join(current, name);
      const info = statSync(path);
      if (info.isDirectory()) pending.push(path);
      else {
        files += 1;
        bytes += info.size;
      }
    }
  }
  return { files, bytes };
}

mkdirSync(outputDir, { recursive: true });

// The app itself. cpSync writes the destination files directly — no
// temporary files, no rename dance — so what lands in the output folder is
// exactly what sits beside this program.
cpSync(join(entryDir, 'app'), join(outputDir, 'app'), { recursive: true });

// The screenshots ride along under their own folder; the dossier refers to
// them, so they must be in place before buildDossier runs.
const shotsSource = join(entryDir, 'screenshots');
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(shotsSource)) {
  cpSync(shotsSource, join(outputDir, 'screenshots'), { recursive: true });
}

// The dossier describes the output folder as it now stands; write its bytes
// straight to dossier.json in one plain write.
const dossier = buildDossier(outputDir, GATE_CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);

// A short summary for whoever ran this, so a rehearsal shows at a glance
// that the hand-in is complete: what was copied, how many trophies the
// copied guide data actually carries (read back from the output folder, so
// a truncated data file would show up here as a short count), and the
// dossier's size.
const appTally = tally(join(outputDir, 'app'));
const shotTally = tally(join(outputDir, 'screenshots'));
const kib = (n) => `${(n / 1024).toFixed(1)} KiB`;
let trophyCount = 'unreadable';
try {
  const guideData = JSON.parse(readFileSync(join(outputDir, 'app', 'data', 'trophies.json'), 'utf8'));
  trophyCount = String(guideData.trophies.length);
} catch {
  // Leave the marker: the summary then says plainly that the data did not parse.
}
console.log('Leonida Legend — hand-in assembled:');
console.log(`  app/:         ${appTally.files} files, ${kib(appTally.bytes)}`);
console.log(`  trophies:     ${trophyCount} in the guide data`);
console.log(`  screenshots/: ${shotTally ? shotTally.files : 0} files, ${shotTally ? kib(shotTally.bytes) : '0 KiB'}`);
console.log(`  dossier.json: ${kib(Buffer.byteLength(dossier))}`);
console.log(`  output:       ${outputDir}`);
