// NEON HARBOR — save / load through localStorage: cash, reputation,
// missions done, player position and health, and the best run.

import { SAVE_KEY, BEST_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash, rep: state.rep,
      doneMissions: state.doneMissions,
      x: state.player.x, y: state.player.y,
      health: state.player.health, ammo: state.player.ammo,
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
