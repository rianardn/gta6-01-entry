// NEON HARBOR — the city of Port Meridian: streets, blocks, buildings,
// parks, the beach and the harbour. Everything is generated from a seed
// so the map is identical every run; collision helpers live here too.

import { WORLD_W, WORLD_H, BLOCK, ROAD_W, DISTRICTS, mulberry32, pick, randRange } from './config.js';

export function streetCenters() {
  const xs = [], ys = [];
  for (let x = BLOCK; x < WORLD_W; x += BLOCK) xs.push(x);
  for (let y = BLOCK; y < WORLD_H; y += BLOCK) ys.push(y);
  return { xs, ys };
}

// Is this point on a road (drivable) or on a sidewalk / plaza?
export function onRoad(x, y) {
  const { xs, ys } = streetCenters();
  for (const cx of xs) if (Math.abs(x - cx) < ROAD_W / 2) return true;
  for (const cy of ys) if (Math.abs(y - cy) < ROAD_W / 2) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  const { xs, ys } = streetCenters();
  let bx = xs[0], bd = Infinity;
  for (const cx of xs) { const d = Math.abs(x - cx); if (d < bd) { bd = d; bx = cx; } }
  let by = ys[0]; bd = Infinity;
  for (const cy of ys) { const d = Math.abs(y - cy); if (d < bd) { bd = d; by = cy; } }
  return { x: bx, y: by };
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const parks = [];
  const { xs, ys } = streetCenters();
  const palette = ['#3a4a6b', '#6b4a3a', '#4a6b5a', '#5e4a6b', '#6b5a3a', '#41586b', '#54423a'];

  // One building per block interior, with a plaza or park in some blocks.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx0 = xs[i] + ROAD_W / 2 + 14;
      const by0 = ys[j] + ROAD_W / 2 + 14;
      const bx1 = xs[i + 1] - ROAD_W / 2 - 14;
      const by1 = ys[j + 1] - ROAD_W / 2 - 14;
      const cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2;
      const roll = rng();
      // Beach strip: the southern row is sand, no buildings.
      if (by0 > 2700) {
        for (let t = 0; t < 3; t++) {
          trees.push({ x: cx + randRange(rng, -90, 90), y: cy + randRange(rng, -60, 60), palm: true, r: 10 });
        }
        continue;
      }
      if (roll < 0.14) {
        parks.push({ x: cx, y: cy, w: bx1 - bx0, h: by1 - by0 });
        for (let t = 0; t < 5; t++) {
          trees.push({ x: cx + randRange(rng, -90, 90), y: cy + randRange(rng, -70, 70), palm: false, r: 12 });
        }
        continue;
      }
      const tall = DISTRICTS.some(d => d.tall && cx >= d.x && cx < d.x + d.w && cy >= d.y && cy < d.y + d.h);
      const w = (bx1 - bx0) * randRange(rng, 0.55, 0.85);
      const h = (by1 - by0) * randRange(rng, 0.55, 0.85);
      buildings.push({
        x: cx - w / 2, y: cy - h / 2, w, h,
        color: pick(rng, palette),
        roof: pick(rng, ['#2c3550', '#3a2f28', '#2f4038', '#463a52']),
        height: tall ? randRange(rng, 26, 46) : randRange(rng, 10, 22),
        windows: Math.floor(randRange(rng, 3, 7)),
      });
    }
  }
  // Harbour pier on the east edge.
  const pier = { x: WORLD_W - 60, y: 1500, w: 120, h: 700 };
  return { buildings, trees, parks, pier, seed };
}

// Circle vs building-rect collision. Returns the push-out for a circle.
export function collideBuildings(city, x, y, r) {
  let px = x, py = y;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(px, b.x + b.w));
    const ny = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - nx, dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.0001) { px += r; continue; }
      const d = Math.sqrt(d2);
      px = nx + (dx / d) * r;
      py = ny + (dy / d) * r;
    }
  }
  px = Math.max(r, Math.min(WORLD_W - r, px));
  py = Math.max(r, Math.min(WORLD_H - r, py));
  return { x: px, y: py };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// A random drivable point (on a street) for spawns.
export function randomRoadPoint(rng) {
  const { xs, ys } = streetCenters();
  if (rng() < 0.5) return { x: pick(rng, xs), y: randRange(rng, 200, WORLD_H - 200) };
  return { x: randRange(rng, 200, WORLD_W - 200), y: pick(rng, ys) };
}

// A random walkable point (sidewalk / plaza / park).
export function randomWalkPoint(rng, city) {
  for (let tries = 0; tries < 40; tries++) {
    const x = randRange(rng, 200, WORLD_W - 200);
    const y = randRange(rng, 200, WORLD_H - 300);
    if (!pointInBuilding(city, x, y) && !onRoad(x, y)) return { x, y };
  }
  return { x: 500, y: 500 };
}

// Named landmarks used by missions (all invented).
export const LANDMARKS = {
  hideout: { x: 510, y: 510, label: 'Rae\u2019s Hideout' },
  garage: { x: 2380, y: 1020, label: 'Vega\u2019s Garage' },
  marina: { x: 2720, y: 510, label: 'Marina Point' },
  foundry: { x: 680, y: 1700, label: 'Foundry Row' },
  plaza: { x: 1700, y: 1700, label: 'Harbor Lights Plaza' },
  pier: { x: 3230, y: 1700, label: 'East Pier' },
  beach: { x: 1700, y: 3060, label: 'Sandside Beach' },
  bank: { x: 1360, y: 510, label: 'Meridian Vault' },
};
