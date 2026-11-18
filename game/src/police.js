// NEON HARBOR — the wanted system and the Meridian PD. Stars rise when
// the player steals a vehicle in front of witnesses, shoots, or rams
// police. Cops chase on foot and in cruisers, ram the player, and bust
// them when they get close on foot. At four stars and up, the PD sends
// out its motorcycle interceptors — faster than any cruiser, and they
// cut corners the cars cannot. Stars fade when the player stays out
// of sight.

import { CAR_MODELS, clamp, lerp, angleLerp, dist2, randRange } from './config.js';
import { makeCar, randomRoute } from './traffic.js';
import { randomRoadPoint } from './city.js';

export function createWanted() {
  return {
    stars: 0, heat: 0, // heat 0..100 feeds the star level
    seenT: 0, hiddenT: 0, bustT: 0,
    cops: [], // {x,y,angle,speed,onFoot,hp,car?}
    spawnT: 0, sirenOn: false,
  };
}

export function addHeat(w, amount, reason) {
  w.heat = clamp(w.heat + amount, 0, 100);
  const next = w.heat < 12 ? 0 : w.heat < 30 ? 1 : w.heat < 50 ? 2 : w.heat < 72 ? 3 : w.heat < 90 ? 4 : 5;
  if (next > w.stars) w.stars = next;
  w.seenT = 0;
  return reason;
}

export function wantedFor(stars) {
  return stars === 0 ? 'Clean' : stars === 1 ? 'Petty' : stars === 2 ? 'Wanted' : stars === 3 ? 'Dangerous' : stars === 4 ? 'Most Wanted' : 'Citywide Manhunt';
}

function spawnCop(w, player, rng, inCar) {
  // Spawn a little way off, on a road near the player.
  const ang = randRange(rng, 0, Math.PI * 2);
  const x = clamp(player.x + Math.cos(ang) * randRange(rng, 500, 800), 100, 3300);
  const y = clamp(player.y + Math.sin(ang) * randRange(rng, 500, 800), 100, 3300);
  if (inCar) {
    // At four stars the PD rolls out a motorcycle interceptor instead
    // of a cruiser: same chase brain, a faster, narrower ride.
    const onBike = w.stars >= 4 && rng() < 0.5;
    const car = makeCar(onBike ? 8 : 6, x, y, 0, { police: true, driver: 'cop' });
    if (onBike) { car.color = '#22304a'; car.topSpeed = 330; }
    car.route = randomRoute(rng, x, y);
    w.cops.push({ x, y, angle: 0, speed: 0, onFoot: false, hp: 60, car });
    return car;
  }
  w.cops.push({ x, y, angle: 0, speed: 0, onFoot: true, hp: 60, car: null });
  return null;
}

export function updateWanted(w, player, cars, dt, rng, fx, audio) {
  const targetCops = w.stars === 0 ? 0 : w.stars === 1 ? 2 : w.stars === 2 ? 3 : w.stars === 3 ? 5 : w.stars === 4 ? 7 : 9;
  w.spawnT -= dt;
  if (w.cops.length < targetCops && w.spawnT <= 0) {
    w.spawnT = w.stars >= 3 ? 1.2 : 2.2;
    const inCar = w.stars >= 2 || rng() < 0.4;
    const car = spawnCop(w, player, rng, inCar);
    if (car) cars.push(car);
  }
  // Heat decays when no cop can see the player.
  let seen = false;
  for (const c of w.cops) {
    if (dist2(c.x, c.y, player.x, player.y) < 520 * 520) { seen = true; break; }
  }
  if (w.stars > 0) {
    if (seen) { w.seenT += dt; w.hiddenT = 0; }
    else {
      w.hiddenT += dt;
      if (w.hiddenT > 6) {
        w.heat = Math.max(0, w.heat - dt * 3.2);
        const next = w.heat < 12 ? 0 : w.heat < 30 ? 1 : w.heat < 50 ? 2 : w.heat < 72 ? 3 : w.heat < 90 ? 4 : 5;
        if (next < w.stars) w.stars = next;
        if (w.stars === 0) {
          // Stand down.
          for (const c of w.cops) if (c.car) c.car.dead = true;
          w.cops = [];
        }
      }
    }
  }
  // Siren follows the wanted level.
  const wantSiren = w.stars >= 1;
  if (wantSiren && !w.sirenOn) { audio && audio.startSiren(); w.sirenOn = true; }
  if (!wantSiren && w.sirenOn) { audio && audio.stopSiren(); w.sirenOn = false; }

  // Cop AI: chase the player, ram in cars, tackle on foot.
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  for (const c of w.cops) {
    if (c.hp <= 0) continue;
    if (c.onFoot) {
      const dx = px - c.x, dy = py - c.y;
      const d = Math.hypot(dx, dy) || 1;
      c.angle = Math.atan2(dy, dx);
      const sp = 165;
      c.x += (dx / d) * sp * dt;
      c.y += (dy / d) * sp * dt;
      c.speed = sp;
      if (!player.inCar && d < 26) {
        // Busted.
        w.bustT += dt;
        if (w.bustT > 0.8) { player.alive = false; player.busted = true; }
      } else if (player.inCar && d < 40) {
        // Cop yanks at the door: slow the car.
        player.inCar.speed *= Math.pow(0.5, dt);
      }
    } else if (c.car && !c.car.dead) {
      const car = c.car;
      const dx = px - car.x, dy = py - car.y;
      const d = Math.hypot(dx, dy) || 1;
      const want = Math.atan2(dy, dx);
      // Bike interceptors turn sharper than cruisers.
      const turnRate = car.bike ? 3.4 : 2.6;
      car.angle = angleLerp(car.angle, want, clamp(dt * turnRate, 0, 1));
      const cruise = car.bike ? (d > 700 ? 350 : 330) : (d > 700 ? 330 : 300);
      car.speed = lerp(car.speed, cruise, clamp(dt * 1.2, 0, 1));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      c.x = car.x; c.y = car.y; c.angle = car.angle; c.speed = car.speed;
      // Ram the player's vehicle.
      if (player.inCar && d < (car.len + player.inCar.len) * 0.42) {
        player.inCar.hp -= 14 * dt * 10 * 0.1;
        player.inCar.speed *= 0.94;
        if (fx && Math.random() < 0.1) fx.sparks(car.x, car.y);
      }
      if (d > 1400) { car.dead = true; c.hp = 0; } // lost the trail, despawn
    }
  }
  w.cops = w.cops.filter(c => c.hp > 0 && !(c.car && c.car.dead && c.onFoot === false && w.stars === 0));
  return w;
}
