// NEON HARBOR — combat and effects: bullets, muzzle flashes, blood,
// sparks, smoke, explosions, and the cash / health pickups scattered
// around Port Meridian. Also the armed gang members missions spawn.

import { clamp, randRange } from './config.js';

export function createFx() {
  return {
    particles: [],
    bullets: [],
    pickups: [],
    floaters: [],
    playerMoving: false,
    spawnBlood(x, y) {
      for (let i = 0; i < 8; i++) {
        this.particles.push({ kind: 'blood', x, y, vx: randRange(Math.random, -90, 90), vy: randRange(Math.random, -90, 90), life: 0.5, max: 0.5, r: 3 });
      }
    },
    sparks(x, y) {
      for (let i = 0; i < 6; i++) {
        this.particles.push({ kind: 'spark', x, y, vx: randRange(Math.random, -160, 160), vy: randRange(Math.random, -160, 160), life: 0.35, max: 0.35, r: 2 });
      }
    },
    smoke(x, y) {
      this.particles.push({ kind: 'smoke', x, y, vx: randRange(Math.random, -12, 12), vy: randRange(Math.random, -30, -8), life: 1.4, max: 1.4, r: 10 });
    },
    explode(x, y, color) {
      for (let i = 0; i < 26; i++) {
        const a = randRange(Math.random, 0, Math.PI * 2), s = randRange(Math.random, 60, 320);
        this.particles.push({ kind: 'fire', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: randRange(Math.random, 0.4, 0.9), max: 0.9, r: randRange(Math.random, 4, 9) });
      }
      for (let i = 0; i < 10; i++) {
        this.particles.push({ kind: 'smoke', x: x + randRange(Math.random, -20, 20), y: y + randRange(Math.random, -20, 20), vx: randRange(Math.random, -20, 20), vy: randRange(Math.random, -40, -10), life: 1.8, max: 1.8, r: 14 });
      }
      this.floaters.push({ x, y: y - 20, text: 'BOOM', life: 0.9, max: 0.9, color: '#ffb347' });
    },
    floater(x, y, text, color) {
      this.floaters.push({ x, y, text, life: 1.2, max: 1.2, color: color || '#ffffff' });
    },
    update(dt) {
      for (const p of this.particles) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= Math.pow(0.3, dt); p.vy *= Math.pow(0.3, dt);
        p.life -= dt;
      }
      this.particles = this.particles.filter(p => p.life > 0);
      for (const f of this.floaters) { f.y -= 26 * dt; f.life -= dt; }
      this.floaters = this.floaters.filter(f => f.life > 0);
      for (const b of this.bullets) {
        b.x += Math.cos(b.angle) * b.speed * dt;
        b.y += Math.sin(b.angle) * b.speed * dt;
        b.life -= dt;
      }
      this.bullets = this.bullets.filter(b => b.life > 0);
    },
  };
}

export function spawnPickups(fx, city, rng) {
  fx.pickups = [];
  const spots = [
    { x: 700, y: 700, kind: 'cash', amount: 150 },
    { x: 1700, y: 700, kind: 'health', amount: 40 },
    { x: 2700, y: 1700, kind: 'cash', amount: 250 },
    { x: 700, y: 2380, kind: 'ammo', amount: 24 },
    { x: 2380, y: 2380, kind: 'cash', amount: 200 },
    { x: 1700, y: 3060, kind: 'health', amount: 40 },
    { x: 3060, y: 700, kind: 'ammo', amount: 24 },
    { x: 1020, y: 1700, kind: 'cash', amount: 150 },
  ];
  for (const s of spots) fx.pickups.push({ ...s, bob: rng() * 6 });
}

// Gang members: armed enemies for combat missions.
export function spawnGang(x, y, count, rng) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: x + randRange(rng, -70, 70), y: y + randRange(rng, -70, 70),
      r: 12, angle: 0, hp: 50, speed: 120,
      shootT: randRange(rng, 0.5, 1.5), state: 'fight', walkPhase: 0,
      color: '#3a3a4a', shirt: '#c23a3a',
    });
  }
  return out;
}

export function updateGang(gang, player, dt, fx, audio) {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  for (const g of gang) {
    if (g.hp <= 0) continue;
    const dx = px - g.x, dy = py - g.y;
    const d = Math.hypot(dx, dy) || 1;
    g.angle = Math.atan2(dy, dx);
    if (d > 260) {
      g.x += (dx / d) * g.speed * dt;
      g.y += (dy / d) * g.speed * dt;
      g.walkPhase += dt * 9;
    } else if (d > 120) {
      // Strafe sideways while closing.
      g.x += Math.cos(g.angle + Math.PI / 2) * 50 * dt;
      g.y += Math.sin(g.angle + Math.PI / 2) * 50 * dt;
    }
    g.shootT -= dt;
    if (g.shootT <= 0 && d < 420) {
      g.shootT = randRange(Math.random, 0.9, 1.7);
      const spread = randRange(Math.random, -0.12, 0.12);
      fx.bullets.push({ x: g.x + Math.cos(g.angle) * 20, y: g.y + Math.sin(g.angle) * 20, angle: g.angle + spread, speed: 620, fromPlayer: false, life: 0.8 });
      audio && audio.shoot();
    }
  }
  return gang.filter(g => g.hp > 0);
}
