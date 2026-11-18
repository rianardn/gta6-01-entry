// NEON HARBOR — the player on foot: Rae Calloway. Movement, sprint,
// aiming with the mouse, shooting, health, and getting in/out of cars.

import { WORLD_W, WORLD_H, clamp, angleLerp } from './config.js';
import { collideBuildings } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, r: 14, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
    speed: 0, health: 100, maxHealth: 100,
    ammo: 24, maxAmmo: 24, reloadT: 0,
    inCar: null, // vehicle object when driving
    alive: true, sprinting: false,
    walkPhase: 0, muzzleT: 0, hurtT: 0,
  };
}

export function updatePlayerOnFoot(p, input, city, dt, fx) {
  let mx = 0, my = 0;
  if (input.is('up')) my -= 1;
  if (input.is('down')) my += 1;
  if (input.is('left')) mx -= 1;
  if (input.is('right')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  p.sprinting = input.is('sprint') && moving;
  const speed = p.sprinting ? 235 : 150;
  if (moving) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
    p.angle = Math.atan2(my, mx);
    p.walkPhase += dt * (p.sprinting ? 14 : 9);
  }
  // Aim follows the mouse (world space set by main).
  p.aimAngle = Math.atan2(input.mouse.wy - p.y, input.mouse.wx - p.x);
  const pos = collideBuildings(city, p.x, p.y, p.r);
  p.x = pos.x; p.y = pos.y;
  p.x = clamp(p.x, p.r, WORLD_W - p.r);
  p.y = clamp(p.y, p.r, WORLD_H - p.r);
  if (p.reloadT > 0) p.reloadT -= dt;
  if (p.muzzleT > 0) p.muzzleT -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (fx) fx.playerMoving = moving;
}

export function playerShoot(p, fx, audio) {
  if (p.reloadT > 0 || p.ammo <= 0) {
    if (p.ammo <= 0 && p.reloadT <= 0) {
      p.reloadT = 1.1; // auto reload
      audio && audio.pickup();
    }
    return null;
  }
  p.ammo -= 1;
  p.muzzleT = 0.07;
  if (p.reloadT <= 0 && p.ammo === 0) p.reloadT = 1.1;
  audio && audio.shoot();
  const bx = p.x + Math.cos(p.aimAngle) * 22;
  const by = p.y + Math.sin(p.aimAngle) * 22;
  return { x: bx, y: by, angle: p.aimAngle, speed: 900, fromPlayer: true, life: 0.7 };
}

export function hurtPlayer(p, amount, fx) {
  if (!p.alive) return;
  p.health -= amount;
  p.hurtT = 0.35;
  if (fx) fx.spawnBlood(p.x, p.y);
  if (p.health <= 0) { p.health = 0; p.alive = false; }
}
