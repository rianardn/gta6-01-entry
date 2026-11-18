// NEON HARBOR — pedestrians: they stroll the sidewalks, chat, flee from
// gunfire and speeding cars and bikes, and sometimes drive the traffic
// vehicles. In Dockside they are hi-vis dockworkers, hauling crates
// between the container yards.

import { WORLD_W, WORLD_H, PED_NAMES, PED_COLORS, DOCK_COLORS, clamp, mulberry32, pick, randRange } from './config.js';
import { randomWalkPoint, pointInBuilding, inDockside } from './city.js';

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomWalkPoint(rng, city);
    const dockworker = inDockside(p.x, p.y);
    peds.push({
      name: pick(rng, PED_NAMES),
      color: dockworker ? pick(rng, DOCK_COLORS) : pick(rng, PED_COLORS),
      x: p.x, y: p.y, r: 11,
      angle: randRange(rng, 0, Math.PI * 2),
      speed: randRange(rng, 28, 52),
      target: randomWalkPoint(rng, city),
      state: 'walk', // walk | flee | down
      fleeT: 0, walkPhase: randRange(rng, 0, 6),
      hp: 30, scared: false, dockworker,
    });
  }
  return peds;
}

export function updatePeds(peds, city, player, bullets, cars, dt, rng) {
  for (const p of peds) {
    if (p.state === 'down') continue;
    // Flee from nearby gunfire or a fast vehicle (car or bike).
    let threat = null;
    if (bullets.length > 0) {
      for (const b of bullets) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < 190) { threat = b; break; }
      }
    }
    if (!threat) {
      for (const c of cars) {
        const fast = c.bike ? Math.abs(c.speed) > 100 : Math.abs(c.speed) > 120;
        if (!c.dead && fast && Math.hypot(c.x - p.x, c.y - p.y) < 130) { threat = c; break; }
      }
    }
    if (threat) { p.state = 'flee'; p.fleeT = 2.5; }
    if (p.state === 'flee') {
      p.fleeT -= dt;
      const tx = threat ? threat.x : player.x, ty = threat ? threat.y : player.y;
      const away = Math.atan2(p.y - ty, p.x - tx);
      p.angle = away;
      p.x += Math.cos(away) * 150 * dt;
      p.y += Math.sin(away) * 150 * dt;
      p.walkPhase += dt * 16;
      if (p.fleeT <= 0) { p.state = 'walk'; p.target = randomWalkPoint(rng, city); }
    } else {
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 16) { p.target = randomWalkPoint(rng, city); continue; }
      p.angle = Math.atan2(dy, dx);
      p.x += (dx / d) * p.speed * dt;
      p.y += (dy / d) * p.speed * dt;
      p.walkPhase += dt * 8;
    }
    if (pointInBuilding(city, p.x, p.y)) {
      p.x -= Math.cos(p.angle) * 30 * dt * 10;
      p.y -= Math.sin(p.angle) * 30 * dt * 10;
      p.target = randomWalkPoint(rng, city);
    }
    p.x = clamp(p.x, 20, WORLD_W - 20);
    p.y = clamp(p.y, 20, WORLD_H - 20);
  }
}

// A pedestrian hit by a bullet or a vehicle.
export function hitPed(p, amount) {
  p.hp -= amount;
  if (p.hp <= 0) p.state = 'down';
  else { p.state = 'flee'; p.fleeT = 3; }
}
