// NEON HARBOR — the player on foot: Rae Calloway. Movement, sprint,
// aiming with the mouse, shooting with her current weapon, health,
// and getting in/out of cars and bikes.

import { WORLD_W, WORLD_H, WEAPONS, clamp, angleLerp } from './config.js';
import { collideBuildings } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, r: 14, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
    speed: 0, health: 100, maxHealth: 100,
    // Weapons: the pistol is hers from the start; the scattergun is
    // earned in mission 3 and carried from then on. Ammo is per weapon.
    weapon: 'pistol', ownedWeapons: ['pistol'],
    ammoByWeapon: { pistol: WEAPONS.pistol.ammo, scattergun: 0 },
    ammo: WEAPONS.pistol.ammo, maxAmmo: WEAPONS.pistol.ammo,
    shotRate: WEAPONS.pistol.rate, reloadT: 0,
    inCar: null, // vehicle object when driving
    alive: true, sprinting: false,
    walkPhase: 0, muzzleT: 0, hurtT: 0,
  };
}

export function currentWeapon(p) { return WEAPONS[p.weapon]; }

// Switch to a weapon Rae owns (keys 1 / 2). Returns true on a switch.
export function switchWeapon(p, key) {
  if (!p.ownedWeapons.includes(key)) return false;
  if (p.weapon === key) return false;
  p.weapon = key;
  p.ammo = p.ammoByWeapon[key];
  p.maxAmmo = WEAPONS[key].ammo;
  p.shotRate = WEAPONS[key].rate;
  p.reloadT = 0;
  return true;
}

// Give Rae a weapon she did not have (mission reward / pickup).
// Returns true when it is new.
export function giveWeapon(p, key) {
  if (p.ownedWeapons.includes(key)) {
    p.ammoByWeapon[key] = WEAPONS[key].ammo;
    if (p.weapon === key) { p.ammo = p.ammoByWeapon[key]; p.maxAmmo = WEAPONS[key].ammo; }
    return false;
  }
  p.ownedWeapons.push(key);
  p.ammoByWeapon[key] = WEAPONS[key].ammo;
  return true;
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

// Fire the current weapon. Returns an array of bullets (one for the
// pistol, a spread of five for the scattergun), or an empty array
// when reloading or out of ammo. Each bullet carries its damage.
export function playerShoot(p, fx, audio) {
  const w = currentWeapon(p);
  if (p.reloadT > 0) return [];
  if (p.ammo <= 0) {
    p.reloadT = 1.1; // auto reload
    audio && audio.pickup();
    return [];
  }
  p.ammo -= 1;
  p.ammoByWeapon[p.weapon] = p.ammo;
  p.muzzleT = 0.07;
  if (p.ammo === 0) p.reloadT = 1.1;
  p.shotRate = w.rate;
  if (p.weapon === 'scattergun') audio && audio.boom();
  else audio && audio.shoot();
  const bullets = [];
  for (let i = 0; i < w.pellets; i++) {
    const spread = w.pellets === 1 ? 0 : (i / (w.pellets - 1) - 0.5) * w.spread * 2;
    const angle = p.aimAngle + spread + (w.pellets === 1 ? 0 : (Math.random() - 0.5) * 0.04);
    const bx = p.x + Math.cos(angle) * 22;
    const by = p.y + Math.sin(angle) * 22;
    bullets.push({ x: bx, y: by, angle, speed: 900, fromPlayer: true, life: w.range, damage: w.damage });
  }
  return bullets;
}

// Refill the current weapon's ammo (ammo pickup).
export function refillAmmo(p) {
  const w = currentWeapon(p);
  p.ammoByWeapon[p.weapon] = w.ammo;
  p.ammo = w.ammo;
  p.maxAmmo = w.ammo;
}

export function hurtPlayer(p, amount, fx) {
  if (!p.alive) return;
  p.health -= amount;
  p.hurtT = 0.35;
  if (fx) fx.spawnBlood(p.x, p.y);
  if (p.health <= 0) { p.health = 0; p.alive = false; }
}
