// NEON HARBOR — boot and the one loop. Owns the game state, the
// mission state machine, carjacking, shooting, pickups, the camera,
// saving, and the ?shot= staging hook used for screenshots.

import { WORLD_W, WORLD_H, STEP, SAVE_KEY, clamp, lerp, dist2, mulberry32, randRange } from './config.js';
import { buildCity, randomRoadPoint, randomWalkPoint, LANDMARKS, pointInBuilding } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, playerShoot, hurtPlayer } from './player.js';
import { makeCar, spawnTraffic, spawnParked, driveCar, updateTrafficCar, collideCars, damageCar, randomRoute } from './traffic.js';
import { spawnPeds, updatePeds, hitPed } from './pedestrians.js';
import { createWanted, addHeat, updateWanted } from './police.js';
import { createFx, spawnPickups, spawnGang, updateGang } from './combat.js';
import { MISSIONS, missionById, nextMissionId, makeCourierJob } from './missions.js';
import { saveGame, loadGame, hasSave, readBest, saveBest } from './save.js';
import { createRenderer, SCREEN, dayFactor } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261118;
const selftest = params.get('selftest') === '1';

export function createGameState(seedValue) {
  const rng = mulberry32(seedValue);
  const city = buildCity(seedValue);
  const player = createPlayer(LANDMARKS.hideout.x, LANDMARKS.hideout.y);
  const fx = createFx();
  spawnPickups(fx, city, rng);
  const state = {
    seed: seedValue, rng, city, player, fx,
    cars: [...spawnTraffic(city, rng, 14), ...spawnParked(city, rng, 10)],
    peds: spawnPeds(city, rng, 26),
    gang: [],
    wanted: createWanted(),
    cash: 250, rep: 0,
    doneMissions: [],
    mission: null, // {id, stageIdx, timer, spawned}
    courier: null,
    clock: 60, playTime: 0,
    screen: SCREEN.TITLE,
    overReason: null, overT: 0,
    waypoint: null, objective: null, missionTitle: null, missionTimer: null,
    toast: null, toastT: 0,
    hasSave: hasSave(),
    cam: { x: player.x, y: player.y, zoom: 0.85 },
    fireT: 0, saveFlash: 0,
  };
  return state;
}

function showToast(state, text, dur) {
  state.toast = text; state.toastT = dur || 3.2;
}

function startMission(state, missionId, audio) {
  const m = missionById(missionId);
  if (!m) return;
  state.mission = { id: m.id, stageIdx: 0, timer: null, spawned: false };
  state.missionTitle = m.title;
  showToast(state, `${m.giver}: ${m.brief}`, 6);
  audio && audio.missionStart();
  applyStage(state);
}

function applyStage(state) {
  const m = missionById(state.mission.id);
  const stage = m.stages[state.mission.stageIdx];
  state.objective = stage.text;
  state.missionTimer = stage.timer ?? null;
  state.mission.timer = stage.timer ?? null;
  state.mission.spawned = false;
  if (stage.at) state.waypoint = { x: stage.at.x, y: stage.at.y };
  else if (stage.type === 'escape') state.waypoint = { x: LANDMARKS.hideout.x, y: LANDMARKS.hideout.y };
  else state.waypoint = null;
  // Mission cars are placed at their stage location.
  if (stage.type === 'steal') {
    let car = state.cars.find(c => c.model === stage.carModel && !c.dead && c.missionCar);
    if (!car) {
      car = makeCar(stage.carModel, stage.at.x + 30, stage.at.y, Math.PI / 2, { parked: true });
      car.missionCar = true;
      state.cars.push(car);
    }
    state.waypoint = { x: car.x, y: car.y };
  }
  if (stage.type === 'combat' && !state.mission.spawned) {
    state.gang = spawnGang(stage.at.x, stage.at.y, stage.count, state.rng);
    state.mission.spawned = true;
  }
}

function completeStage(state, audio) {
  const m = missionById(state.mission.id);
  state.mission.stageIdx += 1;
  if (state.mission.stageIdx >= m.stages.length) {
    // Mission complete.
    state.cash += m.reward;
    state.rep += m.rep;
    state.doneMissions.push(m.id);
    state.fx.floater(state.player.x, state.player.y - 30, `+$${m.reward}`, '#7dff9a');
    showToast(state, `Mission complete: ${m.title} — +$${m.reward}, +${m.rep} REP`, 5);
    audio && audio.missionDone();
    state.mission = null;
    state.objective = null;
    state.missionTitle = null;
    state.missionTimer = null;
    state.waypoint = null;
    saveGame(state);
    saveBest(Math.max(readBest(), state.cash));
    const next = nextMissionId(state.doneMissions);
    if (next) {
      setTimeout(() => { if (state.screen === SCREEN.PLAY) startMission(state, next, audio); }, 2500);
    } else {
      showToast(state, 'STORY COMPLETE — Port Meridian is yours. Free roam, courier jobs, and the streets are open.', 8);
    }
    // Chain a courier job for cash.
    if (!state.courier) state.courier = makeCourierJob(state.rng);
  } else {
    applyStage(state);
    audio && audio.pickup();
  }
}

function playerPos(state) {
  const p = state.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

function updateMission(state, dt, audio) {
  if (!state.mission) {
    // Courier job progression (free-roam side activity).
    if (state.courier) {
      const job = state.courier;
      const pos = playerPos(state);
      if (job.stage === 'pickup') {
        state.waypoint = { x: job.pickup.x, y: job.pickup.y };
        state.objective = `Courier job: pick up the parcel at ${job.pickup.label}`;
        if (dist2(pos.x, pos.y, job.pickup.x, job.pickup.y) < 90 * 90) {
          job.stage = 'dropoff';
          showToast(state, 'Parcel collected — deliver it!', 3);
          audio && audio.pickup();
        }
      } else {
        state.waypoint = { x: job.dropoff.x, y: job.dropoff.y };
        state.objective = `Courier job: deliver to ${job.dropoff.label} ($${job.pay})`;
        if (dist2(pos.x, pos.y, job.dropoff.x, job.dropoff.y) < 90 * 90) {
          state.cash += job.pay;
          state.fx.floater(pos.x, pos.y - 30, `+$${job.pay}`, '#7dff9a');
          showToast(state, `Delivery done — +$${job.pay}`, 3);
          audio && audio.cash();
          state.courier = makeCourierJob(state.rng);
          state.waypoint = null; state.objective = null;
        }
      }
    }
    return;
  }
  const m = missionById(state.mission.id);
  const stage = m.stages[state.mission.stageIdx];
  const pos = playerPos(state);
  if (stage.timer != null) {
    state.mission.timer -= dt;
    state.missionTimer = state.mission.timer;
    if (state.mission.timer <= 0) {
      showToast(state, `Too slow — ${m.title} failed. Talk to Marisol to retry.`, 4);
      audio && audio.fail();
      state.mission = null; state.objective = null; state.missionTitle = null;
      state.missionTimer = null; state.waypoint = null;
      state.gang = [];
      return;
    }
  }
  if (stage.type === 'enterCar') {
    if (state.player.inCar) completeStage(state, audio);
  } else if (stage.type === 'goto') {
    if (dist2(pos.x, pos.y, stage.at.x, stage.at.y) < stage.radius * stage.radius) completeStage(state, audio);
  } else if (stage.type === 'steal') {
    const car = state.player.inCar;
    if (car && car.missionCar) {
      addHeat(state.wanted, state.mission.id === 'm5' ? 45 : 18, 'theft');
      completeStage(state, audio);
    }
  } else if (stage.type === 'combat') {
    const left = state.gang.filter(g => g.hp > 0).length;
    state.objective = `Take down the Tide crew (${left} left)`;
    if (left === 0) completeStage(state, audio);
  } else if (stage.type === 'escape') {
    if (state.wanted.stars === 0 && dist2(pos.x, pos.y, LANDMARKS.hideout.x, LANDMARKS.hideout.y) < stage.radius * stage.radius) {
      completeStage(state, audio);
    } else {
      state.objective = state.wanted.stars > 0
        ? 'Lose the cops, then reach the Hideout'
        : 'Cops lost — get to the Hideout';
    }
  }
}

function tryEnterCar(state, audio) {
  const p = state.player;
  if (p.inCar) {
    // Exit: step out beside the car.
    const car = p.inCar;
    car.speed = 0; car.driver = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    p.inCar = null;
    audio && audio.stopEngine();
    return;
  }
  let best = null, bestD = 80 * 80;
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = dist2(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  if (best.police) addHeat(state.wanted, 25, 'stole a cruiser');
  else if (best.traffic && best.driver === 'ped') {
    addHeat(state.wanted, 12, 'carjacking');
    showToast(state, 'Carjacked! A witness called it in.', 3);
    // The driver bails and runs.
    const dp = { x: best.x, y: best.y, r: 11, angle: 0, speed: 0, target: randomWalkPoint(state.rng, state.city), state: 'flee', fleeT: 4, walkPhase: 0, hp: 30, name: 'Driver', color: '#e8b04b' };
    state.peds.push(dp);
  }
  best.traffic = false; best.parked = false; best.driver = 'player';
  p.inCar = best;
  p.x = best.x; p.y = best.y;
  audio && audio.enterCar();
  audio && audio.startEngine();
}

function updateBullets(state, dt, audio) {
  const fx = state.fx;
  const p = state.player;
  for (const b of [...fx.bullets]) {
    if (pointInBuilding(state.city, b.x, b.y)) {
      fx.sparks(b.x, b.y);
      b.life = 0;
      continue;
    }
    if (b.fromPlayer) {
      // Gang.
      for (const g of state.gang) {
        if (g.hp > 0 && dist2(b.x, b.y, g.x, g.y) < 18 * 18) {
          g.hp -= 25; b.life = 0;
          fx.spawnBlood(g.x, g.y);
          audio && audio.hit();
          if (g.hp <= 0) fx.floater(g.x, g.y - 20, 'DOWN', '#ff6a5a');
          break;
        }
      }
      if (b.life <= 0) continue;
      // Peds (a crime — witnesses react).
      for (const pd of state.peds) {
        if (pd.state !== 'down' && dist2(b.x, b.y, pd.x, pd.y) < 16 * 16) {
          hitPed(pd, 30); b.life = 0;
          fx.spawnBlood(pd.x, pd.y);
          addHeat(state.wanted, 10, 'shot a pedestrian');
          break;
        }
      }
      if (b.life <= 0) continue;
      // Cops on foot.
      for (const c of state.wanted.cops) {
        if (c.onFoot && c.hp > 0 && dist2(b.x, b.y, c.x, c.y) < 16 * 16) {
          c.hp -= 25; b.life = 0;
          fx.spawnBlood(c.x, c.y);
          addHeat(state.wanted, 8, 'shot a cop');
          break;
        }
      }
      if (b.life <= 0) continue;
      // Cars.
      for (const car of state.cars) {
        if (!car.dead && dist2(b.x, b.y, car.x, car.y) < (car.len * 0.45) * (car.len * 0.45)) {
          damageCar(car, 12, fx);
          b.life = 0;
          fx.sparks(b.x, b.y);
          if (car.police) addHeat(state.wanted, 6, 'shot a cruiser');
          break;
        }
      }
    } else {
      // Enemy bullet: hits the player, or their car.
      const px = p.inCar ? p.inCar.x : p.x;
      const py = p.inCar ? p.inCar.y : p.y;
      if (dist2(b.x, b.y, px, py) < 20 * 20) {
        b.life = 0;
        if (p.inCar) damageCar(p.inCar, 8, fx);
        else hurtPlayer(p, 9, fx);
        audio && audio.hit();
      }
    }
  }
  fx.bullets = fx.bullets.filter(b => b.life > 0);
}

function updatePickups(state, audio) {
  const p = state.player;
  const pos = playerPos(state);
  for (const pk of state.fx.pickups) {
    if (dist2(pos.x, pos.y, pk.x, pk.y) < 34 * 34) {
      if (pk.kind === 'cash') { state.cash += pk.amount; state.fx.floater(pk.x, pk.y - 20, `+$${pk.amount}`, '#7dff9a'); audio && audio.cash(); }
      else if (pk.kind === 'health') { p.health = clamp(p.health + pk.amount, 0, p.maxHealth); state.fx.floater(pk.x, pk.y - 20, `+${pk.amount} HP`, '#7dff9a'); audio && audio.pickup(); }
      else { p.ammo = p.maxAmmo; state.fx.floater(pk.x, pk.y - 20, 'AMMO FULL', '#ffd23a'); audio && audio.pickup(); }
      // Respawn elsewhere later.
      pk.x = -9999; pk.y = -9999;
      setTimeout(() => {
        const spot = randomRoadPoint(state.rng);
        pk.x = spot.x; pk.y = spot.y;
      }, 45000);
    }
  }
}

function updateCarPedHits(state) {
  const p = state.player;
  if (!p.inCar || Math.abs(p.inCar.speed) < 90) return;
  const car = p.inCar;
  for (const pd of state.peds) {
    if (pd.state === 'down') continue;
    if (dist2(car.x, car.y, pd.x, pd.y) < 30 * 30) {
      hitPed(pd, 100);
      addHeat(state.wanted, 10, 'hit a pedestrian');
      state.fx.spawnBlood(pd.x, pd.y);
    }
  }
}

function respawnPlayer(state) {
  const p = state.player;
  p.alive = true; p.busted = false;
  p.health = p.maxHealth; p.ammo = p.maxAmmo;
  p.inCar = null;
  p.x = LANDMARKS.hideout.x; p.y = LANDMARKS.hideout.y;
  state.wanted = createWanted();
  state.gang = [];
  if (state.mission) {
    // Restart the current mission from its first stage.
    const id = state.mission.id;
    state.mission = null;
    startMission(state, id, null);
  }
  state.screen = SCREEN.PLAY;
  showToast(state, 'Back on your feet. Marisol covered for you — this time.', 4);
}

// ---- boot ----
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
const state = createGameState(seed);

function announce(msg) { statusEl.textContent = msg; }

function startNewGame() {
  const fresh = createGameState(seed);
  Object.assign(state, fresh);
  state.screen = SCREEN.PLAY;
  startMission(state, 'm1', audio);
  audio.unlock(); audio.startMusic();
  announce('Playing Neon Harbor. First mission: First Fare.');
}

function continueGame() {
  const data = loadGame();
  if (!data) { startNewGame(); return; }
  state.cash = data.cash; state.rep = data.rep;
  state.doneMissions = data.doneMissions || [];
  state.player.x = data.x; state.player.y = data.y;
  state.player.health = data.health; state.player.ammo = data.ammo;
  state.clock = data.clock || 60;
  state.screen = SCREEN.PLAY;
  const next = nextMissionId(state.doneMissions);
  if (next) startMission(state, next, audio);
  audio.unlock(); audio.startMusic();
  showToast(state, 'Save loaded. Welcome back to Port Meridian.', 4);
}

function update(dt) {
  const p = state.player;
  state.clock += dt;
  state.playTime += dt;
  if (state.toastT > 0) state.toastT -= dt;
  // Mouse world position for aiming.
  const cam = state.cam;
  input.mouse.wx = cam.x + (input.mouse.x - renderer.w / 2) / cam.zoom;
  input.mouse.wy = cam.y + (input.mouse.y - renderer.h / 2) / cam.zoom;

  if (p.inCar) {
    const hitWall = driveCar(p.inCar, input, dt, state.city);
    if (hitWall) audio && audio.crash();
    audio.setEngine(Math.abs(p.inCar.speed) / p.inCar.topSpeed);
    if (p.inCar.hp <= 0 && !p.inCar.dead) {
      damageCar(p.inCar, 0, state.fx);
      audio.explosion();
      hurtPlayer(p, 30, state.fx);
      p.inCar = null;
      audio.stopEngine();
    }
    p.x = p.inCar ? p.inCar.x : p.x;
    p.y = p.inCar ? p.inCar.y : p.y;
  } else {
    updatePlayerOnFoot(p, input, state.city, dt, state.fx);
    // Shooting (hold to fire, rate-limited).
    state.fireT -= dt;
    if ((input.mouse.down || input.mouse.clicked) && state.fireT <= 0 && p.alive) {
      const b = playerShoot(p, state.fx, audio);
      if (b) { state.fx.bullets.push(b); state.fireT = 0.18; }
    }
  }
  if (input.wasPressed('enter')) tryEnterCar(state, audio);

  // Traffic + peds + gang + cops.
  for (const car of state.cars) {
    if (car.traffic && !car.dead) updateTrafficCar(car, state.cars, dt, state.rng);
    if (car.hp < 45 && !car.dead && Math.random() < dt * 2) state.fx.smoke(car.x, car.y - 10);
  }
  if (collideCars(state.cars, audio)) audio.crash();
  state.cars = state.cars.filter(c => !c.dead || c === p.inCar || c.missionCar);
  updatePeds(state.peds, state.city, p, state.fx.bullets, state.cars, dt, state.rng);
  state.gang = updateGang(state.gang, p, dt, state.fx, audio);
  updateWanted(state.wanted, p, state.cars, dt, state.rng, state.fx, audio);
  state.fx.update(dt);
  updateBullets(state, dt, audio);
  updatePickups(state, audio);
  updateCarPedHits(state);
  updateMission(state, dt, audio);

  // Camera follows the player (or car), zooming out with speed.
  const target = playerPos(state);
  const speed01 = p.inCar ? Math.abs(p.inCar.speed) / p.inCar.topSpeed : 0;
  const targetZoom = p.inCar ? lerp(0.72, 0.55, speed01) : 0.85;
  state.cam.x = lerp(state.cam.x, target.x, clamp(dt * 5, 0, 1));
  state.cam.y = lerp(state.cam.y, target.y, clamp(dt * 5, 0, 1));
  state.cam.zoom = lerp(state.cam.zoom, targetZoom, clamp(dt * 2, 0, 1));

  if (!p.alive) {
    state.overT += dt;
    if (state.overT > 1.2) {
      state.screen = SCREEN.OVER;
      state.overReason = p.busted ? 'busted' : 'wasted';
      audio.stopEngine(); audio.stopSiren(); audio.busted();
      if (p.busted) state.cash = Math.floor(state.cash * 0.9);
      saveBest(Math.max(readBest(), state.cash));
    }
  }
}

function draw() {
  if (state.screen === SCREEN.TITLE) {
    renderer.drawTitle(state, readBest());
  } else if (state.screen === SCREEN.PAUSE) {
    renderer.drawWorld(state, state.cam);
    renderer.drawHud(state);
    renderer.drawPause(state);
  } else if (state.screen === SCREEN.OVER) {
    renderer.drawWorld(state, state.cam);
    renderer.drawOver(state, state.overReason);
  } else {
    renderer.drawWorld(state, state.cam);
    renderer.drawHud(state);
  }
}

function runShot(name) {
  const staged = stageShot(name, state, { startMission, audio });
  state.screen = staged;
  let painted = 0;
  function paint() {
    draw();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runSelfTest() {
  const results = [];
  function check(name, ok) { results.push({ name, ok: !!ok }); }
  check('city has buildings', state.city.buildings.length > 30);
  check('city has parks', state.city.parks.length > 0);
  check('traffic spawns', state.cars.length >= 20);
  check('peds spawn', state.peds.length >= 20);
  check('five missions defined', MISSIONS.length === 5);
  check('mission stages exist', MISSIONS.every(m => m.stages.length > 0));
  check('player starts alive', state.player.alive && state.player.health === 100);
  // Simulate: enter a car, drive, steal-check, wanted heat.
  const car = state.cars.find(c => c.parked && !c.dead);
  check('parked car exists', !!car);
  state.player.x = car.x; state.player.y = car.y;
  tryEnterCar(state, audio);
  check('enter car works', state.player.inCar === car);
  addHeat(state.wanted, 40, 'test');
  check('wanted rises', state.wanted.stars >= 2);
  updateWanted(state.wanted, state.player, state.cars, 0.5, state.rng, state.fx, audio);
  check('cops spawn', state.wanted.cops.length > 0);
  // Mission flow: start m1, teleport to waypoint, complete.
  startMission(state, 'm1', audio);
  check('mission starts', state.mission && state.mission.id === 'm1');
  state.player.inCar.x = LANDMARKS.marina.x; state.player.inCar.y = LANDMARKS.marina.y;
  updateMission(state, 0.1, audio); // completes the enterCar stage
  updateMission(state, 0.1, audio); // completes the drive-to-Marina stage
  check('mission m1 completes', state.doneMissions.includes('m1'));
  // Combat: spawn gang, shoot one.
  state.gang = spawnGang(LANDMARKS.foundry.x, LANDMARKS.foundry.y, 2, state.rng);
  const g = state.gang[0];
  state.fx.bullets.push({ x: g.x, y: g.y, angle: 0, speed: 0, fromPlayer: true, life: 0.5 });
  updateBullets(state, 0.05, audio);
  check('bullet damages gang', g.hp < 50);
  // Save round-trip.
  state.cash = 1234;
  check('save works', saveGame(state) === true);
  const loaded = loadGame();
  check('load works', loaded && loaded.cash === 1234);
  // Render one frame without throwing.
  try { draw(); check('render draws', true); } catch (e) { check('render draws', false); }
  const failed = results.filter(r => !r.ok);
  window.__testResult = JSON.stringify({ passed: results.length - failed.length, total: results.length, failed: failed.map(f => f.name), results });
  window.__shotReady = true;
}

// ---- frame loop ----
let last = performance.now();
let acc = 0;
function frame(now) {
  const dtMs = Math.min(250, now - last);
  last = now;
  if (state.screen === SCREEN.PLAY) {
    acc += dtMs / 1000;
    let steps = 0;
    while (acc >= STEP && steps < 5) { update(STEP); acc -= STEP; steps += 1; }
    if (steps === 5) acc = 0;
  }
  if (input.wasPressed('mute')) {
    const m = audio.toggleMute();
    showToast(state, m ? 'Sound off' : 'Sound on', 1.5);
  }
  if (input.wasPressed('pause')) {
    if (state.screen === SCREEN.PLAY) { state.screen = SCREEN.PAUSE; audio.stopEngine(); }
    else if (state.screen === SCREEN.PAUSE) state.screen = SCREEN.PLAY;
  }
  if (state.screen === SCREEN.TITLE && input.wasPressed('confirm')) {
    if (state.hasSave) continueGame(); else startNewGame();
  }
  if (state.screen === SCREEN.OVER && input.wasPressed('confirm')) {
    state.overT = 0;
    respawnPlayer(state);
  }
  if (state.screen === SCREEN.PAUSE) {
    if (input.wasPressed('confirm')) state.screen = SCREEN.PLAY;
    // S / R / Q handled via keydown on window (see below).
  }
  draw();
  input.endFrame();
  requestAnimationFrame(frame);
}

// Pause-menu keys (S save, R restart, Q quit) — read directly so the
// pause screen does not need the action map to grow.
window.addEventListener('keydown', (e) => {
  if (state.screen !== SCREEN.PAUSE) return;
  if (e.code === 'KeyS') { saveGame(state); showToast(state, 'Game saved.', 2); }
  if (e.code === 'KeyR') { startNewGame(); }
  if (e.code === 'KeyQ') { state.screen = SCREEN.TITLE; state.hasSave = hasSave(); }
});

window.__game = state;
window.__dayFactor = dayFactor;

if (selftest) {
  state.screen = SCREEN.PLAY;
  runSelfTest();
} else if (shotName) {
  runShot(shotName);
} else {
  requestAnimationFrame(frame);
}
