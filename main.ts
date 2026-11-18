// Neon Harbor — the entry program (Node 22, standard library only).
// The game is the static files in game/ beside this file: open
// game/index.html in a desktop browser and it plays offline, no build
// step and no network request. This program hands the entry in: it
// copies game/ and screenshots/ into the output directory and writes
// output/dossier.json with the make.fun library's buildDossier.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// The program runs twice in grading and both runs must write the
// same bytes, so it writes nothing but the copied files and the
// dossier, and it never prints a timestamp.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
const srcDir = join(gameDir, 'src');

// Pre-flight: the entry is not an entry without its game and shots.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing — the game cannot be entered');
}
if (!existsSync(srcDir)) {
  throw new Error('game/src/ is missing — the game sources cannot be entered');
}
const srcFiles = readdirSync(srcDir).filter(f => f.endsWith('.js')).sort();
const shots = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter(f => !f.startsWith('.')).sort()
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
}
for (const f of shots) {
  const size = statSync(join(shotsDir, f)).size;
  if (size > 262144) throw new Error(`screenshot ${f} is ${size} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's caps from the competition gate: the text budget shapes
// the dossier bytes; the rest refuse an entry the scorer would refuse
// (over 4 screenshots or one over 256 KiB; game/ over 993 files or
// 48 MiB in all, or any path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Neon Harbor: ${srcFiles.length} source files, ${shots.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
