// NEON HARBOR — the story: six missions with Marisol Vega, plus
// repeatable courier drops for cash. Each mission has stages with a
// waypoint, an objective line, and a reward. The finale is the vault
// run; the epilogue settles the score with Dario Kess at the docks.

import { LANDMARKS } from './city.js';
import { CAST } from './config.js';

// Mission states live in game state; this file only describes them.
export const MISSIONS = [
  {
    id: 'm1', title: 'First Fare', giver: CAST.fixer,
    brief: 'Marisol needs a courier. Drive the Dart to Marina Point. Keep it clean — the cops are already watching the harbour.',
    stages: [
      { type: 'enterCar', text: 'Get in a car (walk up and press E)' },
      { type: 'goto', at: LANDMARKS.marina, radius: 90, text: 'Drive to Marina Point' },
    ],
    reward: 300, rep: 10,
  },
  {
    id: 'm2', title: 'Hot Wheels', giver: CAST.fixer,
    brief: 'Dario Kess left his Kestrel GT by the plaza. Take it. If anyone sees you lift it, the heat is on you, not me.',
    stages: [
      { type: 'steal', carModel: 2, at: LANDMARKS.plaza, radius: 120, text: 'Steal the Kestrel GT at Harbor Lights Plaza' },
      { type: 'goto', at: LANDMARKS.garage, radius: 100, text: 'Deliver the Kestrel to Vega\u2019s Garage' },
    ],
    reward: 650, rep: 15,
  },
  {
    id: 'm3', title: 'Street Heat', giver: CAST.fixer,
    brief: 'The Tide\u2019s crew is shaking down Foundry Row. Clear them out — on foot, loud if you have to. Marisol will smooth it over.',
    stages: [
      { type: 'goto', at: LANDMARKS.foundry, radius: 110, text: 'Reach Foundry Row' },
      { type: 'combat', at: LANDMARKS.foundry, count: 4, text: 'Take down the Tide crew (4 left)' },
    ],
    reward: 900, rep: 20,
    unlock: 'scattergun',
  },
  {
    id: 'm4', title: 'The Drop', giver: CAST.fixer,
    brief: 'A package for the East Pier, and the clock is running. Two minutes. Cops will be thick on the bridge road — drive like you mean it.',
    stages: [
      { type: 'goto', at: LANDMARKS.pier, radius: 100, text: 'Deliver the package to the East Pier', timer: 120 },
    ],
    reward: 1200, rep: 25,
  },
  {
    id: 'm5', title: 'Harbor Heist', giver: CAST.fixer,
    brief: 'The Vault Runner is parked at the Meridian Vault. Take it, and the whole city will come after you. Lose the cops, then bring it home.',
    stages: [
      { type: 'steal', carModel: 7, at: LANDMARKS.bank, radius: 130, text: 'Steal the Vault Runner at the Meridian Vault' },
      { type: 'escape', text: 'Lose the wanted level, then reach the Hideout', at: LANDMARKS.hideout, radius: 110 },
    ],
    reward: 2500, rep: 40,
  },
  {
    id: 'm6', title: 'The Tide Turns', giver: CAST.fixer,
    brief: 'Kess is loading the last of the vault cash onto a freighter at the East Pier. The Tide\u2019s crew is dug in among the containers — and Kess himself is there. End it, then vanish before the PD arrives.',
    stages: [
      { type: 'goto', at: LANDMARKS.dockside, radius: 120, text: 'Reach the Dockside container yards' },
      { type: 'combat', at: LANDMARKS.pier, count: 6, boss: true, text: 'Take down the Tide crew — Dario Kess is with them (6 left)' },
      { type: 'escape', text: 'Lose the wanted level, then reach the Hideout', at: LANDMARKS.hideout, radius: 110 },
    ],
    reward: 3500, rep: 50,
  },
];

export function missionById(id) {
  return MISSIONS.find(m => m.id === id) || null;
}

export function nextMissionId(doneIds) {
  for (const m of MISSIONS) if (!doneIds.includes(m.id)) return m.id;
  return null;
}

// Repeatable side job: pick up a parcel, deliver it, get paid.
export function makeCourierJob(rng) {
  const spots = [LANDMARKS.marina, LANDMARKS.plaza, LANDMARKS.pier, LANDMARKS.beach, LANDMARKS.foundry, LANDMARKS.garage, LANDMARKS.dockside];
  const a = spots[Math.floor(rng() * spots.length)];
  let b = spots[Math.floor(rng() * spots.length)];
  if (b === a) b = spots[(spots.indexOf(a) + 3) % spots.length];
  return { pickup: a, dropoff: b, pay: 180 + Math.floor(rng() * 220), stage: 'pickup' };
}
