// NEON HARBOR — vehicles: car physics, traffic AI that follows the
// street grid, parked cars, and car damage / explosions.

import { WORLD_W, WORLD_H, BLOCK, ROAD_W, CAR_MODELS, clamp, angleLerp, dist2, mulberry32, pick, randRange } from './config.js';
import { streetCenters, randomRoadPoint, pointInBuilding } from './city.js';

let nextCarId = 1;

export function makeCar(modelIdx, x, y, angle, opts = {}) {
  const m = CAR_MODELS[modelIdx];
  return {
    id: nextCarId++, model: modelIdx, name: m.name, color: opts.color || m.color,
    x, y, angle, speed: 0, topSpeed: m.top, accel: m.accel,
    len: m.len, w: m.w, hp: 100, maxHp: 100,
    traffic: !!opts.traffic, police: !!opts.police, parked: !!opts.parked,
    driver: opts.driver || null, // 'player' | 'ped' | null
    route: opts.route || null, routeIdx: 0, stuckT: 0,
    smokeT: 0, dead: false, brakeLight: false,
  };
}

// Build a route along the street grid: pick a sequence of intersections.
export function randomRoute(rng, fromX, fromY) {
  const { xs, ys } = streetCenters();
  const pts = [{ x: fromX, y: fromY }];
  let cx = xs.reduce((a, b) => Math.abs(b - fromX) < Math.abs(a - fromX) ? b : a);
  let cy = ys.reduce((a, b) => Math.abs(b - fromY) < Math.abs(a - fromY) ? b : a);
  for (let i = 0; i < 6; i++) {
    if (rng() < 0.5) cx = pick(rng, xs); else cy = pick(rng, ys);
    pts.push({ x: cx, y: cy });
  }
  return pts;
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng);
    const modelIdx = Math.floor(rng() * 6); // never police / vault runner in traffic
    const angle = rng() < 0.5 ? 0 : Math.PI / 2;
    const car = makeCar(modelIdx, p.x, p.y, angle, { traffic: true, driver: 'ped' });
    car.route = randomRoute(rng, p.x, p.y);
    car.speed = randRange(rng, 60, 120);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, rng, count) {
  const cars = [];
  const { xs, ys } = streetCenters();
  for (let i = 0; i < count; i++) {
    const along = rng() < 0.5;
    const cx = pick(rng, xs), cy = pick(rng, ys);
    const x = along ? cx + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 14) : randRange(rng, 300, WORLD_W - 300);
    const y = along ? randRange(rng, 300, WORLD_H - 400) : cy + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 14);
    if (pointInBuilding(city, x, y)) continue;
    const modelIdx = Math.floor(rng() * 6);
    cars.push(makeCar(modelIdx, x, y, along ? Math.PI / 2 : 0, { parked: true }));
  }
  return cars;
}

// Player driving: arcade handling with drift on the handbrake.
export function driveCar(car, input, dt, city) {
  const accelIn = input.is('up') ? 1 : input.is('down') ? -0.7 : 0;
  const steerIn = input.is('left') ? -1 : input.is('right') ? 1 : 0;
  const braking = input.is('brake');
  if (accelIn > 0) car.speed += car.accel * dt;
  else if (accelIn < 0) car.speed -= car.accel * 0.8 * dt;
  else car.speed *= Math.pow(0.4, dt); // coast
  if (braking) car.speed *= Math.pow(0.02, dt);
  car.speed = clamp(car.speed, -car.topSpeed * 0.45, car.topSpeed);
  const steerAuthority = clamp(Math.abs(car.speed) / 90, 0, 1) * (car.speed >= 0 ? 1 : -1);
  const grip = braking ? 0.55 : 1;
  car.angle += steerIn * 2.1 * steerAuthority * dt * grip;
  car.brakeLight = braking || accelIn < 0;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  // Buildings stop the car (with a scrape, not a full halt).
  const r = car.len * 0.42;
  let hitWall = false;
  for (const b of city.buildings) {
    const cx = clamp(nx, b.x, b.x + b.w), cy = clamp(ny, b.y, b.y + b.h);
    if (dist2(nx, ny, cx, cy) < r * r) { hitWall = true; break; }
  }
  if (!hitWall && nx > 20 && nx < WORLD_W - 20 && ny > 20 && ny < WORLD_H - 20) {
    car.x = nx; car.y = ny;
  } else {
    car.speed *= 0.35;
    car.hp -= Math.abs(car.speed) * 0.012 + 0.4;
    if (hitWall) car.hp -= 0.4;
  }
  return hitWall;
}

// Traffic AI: follow the route, slow for the car ahead, re-route when done.
export function updateTrafficCar(car, cars, dt, rng) {
  if (car.dead || !car.route) return;
  const target = car.route[car.routeIdx];
  if (!target) return;
  const dx = target.x - car.x, dy = target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) {
    car.routeIdx += 1;
    if (car.routeIdx >= car.route.length) {
      car.route = randomRoute(rng, car.x, car.y);
      car.routeIdx = 1;
    }
    return;
  }
  const want = Math.atan2(dy, dx);
  car.angle = angleLerp(car.angle, want, clamp(dt * 3.2, 0, 1));
  // Slow down if another car is close ahead.
  let blocked = false;
  for (const o of cars) {
    if (o === car || o.dead) continue;
    const od = dist2(car.x, car.y, o.x, o.y);
    if (od < 90 * 90) {
      const ahead = Math.cos(car.angle) * (o.x - car.x) + Math.sin(car.angle) * (o.y - car.y);
      if (ahead > 0) { blocked = true; break; }
    }
  }
  const cruise = blocked ? 0 : 110;
  car.speed = lerp(car.speed, cruise, clamp(dt * 1.5, 0, 1));
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

export function lerp(a, b, t) { return a + (b - a) * t; }

// Simple circle collision between cars; returns true if a bump happened.
export function collideCars(cars, audio) {
  let bumped = false;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.dead || b.dead) continue;
      const rr = (a.len + b.len) * 0.42;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 < rr * rr && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (rr - d) / 2;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 60) {
          a.hp -= impact * 0.02; b.hp -= impact * 0.02;
          a.speed *= 0.6; b.speed *= 0.6;
          bumped = true;
        }
      }
    }
  }
  return bumped;
}

export function damageCar(car, amount, fx) {
  car.hp -= amount;
  if (car.hp <= 0 && !car.dead) {
    car.dead = true; car.hp = 0;
    if (fx) fx.explode(car.x, car.y, car.color);
  }
}
