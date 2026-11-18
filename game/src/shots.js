// NEON HARBOR — screenshot staging: ?shot=start|drive|chase|mission
// puts a deterministic scene on screen so screenshots are real renders
// of the game. Each scene paints the same way the live game does.
// The drive shot rides the Harbor Hawk; the mission shot stages the
// m6 finale at the East Pier.

import { SCREEN } from './render.js';
import { LANDMARKS } from './city.js';
import { makeCar, spawnTraffic } from './traffic.js';
import { spawnGang } from './combat.js';
import { addHeat } from './police.js';
import { giveWeapon } from './player.js';

export function stageShot(name, state, hooks) {
  const { startMission, audio } = hooks;
  const p = state.player;

  if (name === 'start') {
    state.screen = SCREEN.TITLE;
    state.clock = 210; // dusk behind the title
    return SCREEN.TITLE;
  }

  state.screen = SCREEN.PLAY;
  // Clear the default traffic/peds and stage a busy street instead.
  state.cars = state.cars.filter(c => c.parked);
  if (name === 'drive') {
    state.clock = 100; // bright midday
    // Rae on the Harbor Hawk, leaning through Downtown traffic.
    const bike = makeCar(8, 1700, 1020, 0, { driver: 'player' });
    bike.lean = 0.35; bike.speed = 240;
    p.inCar = bike; p.x = bike.x; p.y = bike.y;
    state.cars.push(bike);
    state.cars.push(...spawnTraffic(state.city, state.rng, 10));
    state.missionTitle = 'First Fare';
    state.objective = 'Ride the Harbor Hawk to Marina Point';
    state.waypoint = { x: LANDMARKS.marina.x, y: LANDMARKS.marina.y };
    state.cash = 1250; state.rep = 25;
    state.cam.x = bike.x; state.cam.y = bike.y; state.cam.zoom = 0.8;
    return SCREEN.PLAY;
  }

  if (name === 'chase') {
    state.clock = 235; // night
    const car = makeCar(7, 1700, 1700, -Math.PI / 2, { driver: 'player' });
    car.missionCar = true;
    p.inCar = car; p.x = car.x; p.y = car.y;
    car.speed = 260;
    state.cars.push(car);
    state.cars.push(...spawnTraffic(state.city, state.rng, 8));
    addHeat(state.wanted, 65, 'vault heist');
    // Stage three cruisers right behind the player.
    for (let i = 0; i < 3; i++) {
      const cop = makeCar(6, 1700, 1700 + 160 + i * 90, -Math.PI / 2, { police: true, driver: 'cop' });
      cop.speed = 280;
      state.cars.push(cop);
      state.wanted.cops.push({ x: cop.x, y: cop.y, angle: -Math.PI / 2, speed: 280, onFoot: false, hp: 60, car: cop });
    }
    state.missionTitle = 'Harbor Heist';
    state.objective = 'Lose the cops, then reach the Hideout';
    state.waypoint = { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y };
    state.cash = 4800; state.rep = 70;
    state.cam.x = car.x; state.cam.y = car.y; state.cam.zoom = 0.6;
    return SCREEN.PLAY;
  }

  if (name === 'mission') {
    state.clock = 90; // late afternoon
    p.inCar = null;
    p.x = LANDMARKS.pier.x - 260; p.y = LANDMARKS.pier.y + 60;
    p.aimAngle = 0.15;
    // The m6 finale: Kess and his crew dug in among the containers.
    giveWeapon(p, 'scattergun');
    p.weapon = 'scattergun';
    p.ammo = 12; p.maxAmmo = 12;
    state.gang = spawnGang(LANDMARKS.pier.x - 60, LANDMARKS.pier.y - 40, 6, state.rng, { boss: true });
    state.fx.bullets.push({ x: p.x + 40, y: p.y - 10, angle: 0.3, speed: 900, fromPlayer: true, life: 0.4, damage: 16 });
    state.fx.spawnBlood(LANDMARKS.pier.x - 40, LANDMARKS.pier.y - 20);
    addHeat(state.wanted, 22, 'the tide turns');
    state.missionTitle = 'The Tide Turns';
    state.objective = 'Take down the Tide crew — Dario Kess is with them (6 left)';
    state.waypoint = { x: LANDMARKS.pier.x, y: LANDMARKS.pier.y };
    state.cash = 5600; state.rep = 95;
    state.cam.x = p.x + 140; state.cam.y = p.y; state.cam.zoom = 0.8;
    return SCREEN.PLAY;
  }

  return SCREEN.TITLE;
}

export function shotList() {
  return ['start', 'drive', 'chase', 'mission'];
}
