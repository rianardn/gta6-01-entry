// NEON HARBOR — save / load through localStorage: cash, reputation,
// missions done, player position and health, the weapons Rae owns,
// and the best run. Saves from the old format (v1) load fine — the
// weapon fields simply default to the pistol.

import { SAVE_KEY, BEST_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash, rep: state.rep,
      doneMissions: state.doneMissions,
      x: state.player.x, y: state.player.y,
      health: state.player.health,
      weapon: state.player.weapon,
      ownedWeapons: state.player.ownedWeapons,
      ammoByWeapon: state.player.ammoByWeapon,
      clock: state.clock, playTime: state.playTime,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    // Normalise the weapon fields so a v1 save still loads.
    if (!Array.isArray(data.ownedWeapons)) data.ownedWeapons = ['pistol'];
    if (typeof data.weapon !== 'string' || !data.ownedWeapons.includes(data.weapon)) data.weapon = 'pistol';
    if (typeof data.ammoByWeapon !== 'object' || data.ammoByWeapon === null) data.ammoByWeapon = { pistol: 24, scattergun: 0 };
    return data;
  } catch { return null; }
}

export function hasSave() { return loadGame() !== null; }

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

export function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* ignore */ }
}
