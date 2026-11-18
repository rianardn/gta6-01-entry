// Neon Harbor — the entry program (Node 22, standard library only).
// The game is the static files in game/ beside this file: open
// game/index.html in a desktop browser and it plays offline, no build
// step and no network request. This program hands the entry in: it
// copies game/ and screenshots/ into the output directory and writes
// output/dossier.json with the make.fun library's buildDossier.
//
// Local check:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

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
