// NEON HARBOR — shared tuning, names and data tables.
// The city is Port Meridian: a sun-soaked harbour town of five districts.
// Everything here is original fiction; no real place, person or brand.

export const WORLD_W = 3400;
export const WORLD_H = 3400;
export const BLOCK = 340; // distance between street centrelines
export const ROAD_W = 96;
export const STEP = 1 / 60;

export const SAVE_KEY = 'neon-harbor-save-v1';
export const BEST_KEY = 'neon-harbor-best-v1';

export const DISTRICTS = [
  { name: 'Downtown', x: 1100, y: 300, w: 1200, h: 900, tint: '#2b3a5e', tall: true },
  { name: 'Old Town', x: 300, y: 300, w: 800, h: 900, tint: '#7a5a3a', tall: false },
  { name: 'Marina', x: 2300, y: 300, w: 800, h: 900, tint: '#2e6f7a', tall: false },
  { name: 'Foundry Row', x: 300, y: 1400, w: 1000, h: 1000, tint: '#5e4a3a', tall: false },
  { name: 'Harbor Lights', x: 1500, y: 1400, w: 1600, h: 1000, tint: '#7a3a6e', tall: true },
  { name: 'Sandside', x: 300, y: 2600, w: 2800, h: 500, tint: '#c9a86a', tall: false },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Port Meridian';
}

// Vehicle models the player can steal or drive. All invented.
export const CAR_MODELS = [
  { name: 'Civic Dart', color: '#d84a4a', top: 240, accel: 150, len: 52, w: 26 },
  { name: 'Harbor Taxi', color: '#f2c230', top: 220, accel: 140, len: 52, w: 26 },
  { name: 'Kestrel GT', color: '#3a86d8', top: 320, accel: 210, len: 54, w: 26 },
  { name: 'Mule Van', color: '#8a8f96', top: 190, accel: 110, len: 62, w: 28 },
  { name: 'Sunset Coupe', color: '#e86aa8', top: 300, accel: 190, len: 52, w: 26 },
  { name: 'Dune Buggy', color: '#7ac74a', top: 230, accel: 160, len: 50, w: 28 },
  { name: 'Meridian PD', color: '#22304a', top: 300, accel: 200, len: 54, w: 26 },
  { name: 'Vault Runner', color: '#1a1a22', top: 340, accel: 230, len: 56, w: 26 },
];

export const PED_NAMES = [
  'Milo', 'Priya', 'Otto', 'Lena', 'Kofi', 'Sana', 'Ruth', 'Diego',
  'Ines', 'Tomas', 'Aya', 'Marco', 'Nia', 'Felix', 'June', 'Omar',
];

export const PED_COLORS = [
  '#e8b04b', '#4ba3e8', '#e84b7a', '#7ac74a', '#b06ae8',
  '#e86a3a', '#4bd8c2', '#d8d84b', '#8a6a4b', '#c24b4b',
];

// Story cast (original characters).
export const CAST = {
  player: 'Rae Calloway',
  fixer: 'Marisol Vega',
  rival: 'Dario Kess',
  cop: 'Sgt. Ilya Brandt',
  boss: 'The Tide',
};

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
