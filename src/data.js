/* Static game data and constants. No logic, no DOM. */

export const GROWTH = 1.15;
export const MILESTONES = [10, 25, 50, 100, 150, 200];
export const OFFLINE_CAP = 8 * 3600;
export const OFFLINE_RATE = 0.5;
export const PRESTIGE_BASE = 1e6;
export const FRENZY_MULT = 7;
export const FRENZY_MAX_MS = 120000;
export const ACH_BONUS = 0.01;
export const SURVEY_BONUS = 0.1;
export const MAX_BUY = 1000;

export const GENS = [
  { id: 'drone', name: 'Mining Drone', desc: 'A small bot that chews rock all day.', base: 15, rate: 0.1 },
  { id: 'laser', name: 'Laser Rig', desc: 'Cuts clean seams out of the surface.', base: 100, rate: 1 },
  { id: 'tug', name: 'Tug Crew', desc: 'Hauls loose chunks back to the hold.', base: 1100, rate: 8 },
  { id: 'barge', name: 'Ore Barge', desc: 'Moves tonnes of ore per trip.', base: 12000, rate: 47 },
  { id: 'refinery', name: 'Refinery Ship', desc: 'Smelts on site and wastes nothing.', base: 130000, rate: 260 },
  { id: 'foundry', name: 'Orbital Foundry', desc: 'Casts ingots in zero gravity.', base: 1400000, rate: 1400 },
  { id: 'collector', name: 'Stellar Collector', desc: 'Harvests whole asteroids at once.', base: 20000000, rate: 7800 },
];

export const UPS = [
  { id: 'bits', name: 'Carbide Bits', desc: 'Every tap mines twice as much.', cost: 100, tap: 2 },
  { id: 'tune1', name: 'Fleet Tuning I', desc: 'All vessels work 25% faster.', cost: 2500, prod: 1.25 },
  { id: 'uplink', name: 'Drone Uplink', desc: 'Each tap also mines 5% of your ore per second.', cost: 8000, link: 0.05 },
  { id: 'plasma', name: 'Plasma Tips', desc: 'Every tap mines twice as much.', cost: 40000, tap: 2 },
  { id: 'tune2', name: 'Fleet Tuning II', desc: 'All vessels work 50% faster.', cost: 600000, prod: 1.5 },
  { id: 'hammer', name: 'Resonance Hammer', desc: 'Every tap mines three times as much.', cost: 8e6, tap: 3 },
  { id: 'uplink2', name: 'Swarm Uplink', desc: 'Each tap also mines another 10% of your ore per second.', cost: 5e7, link: 0.1 },
  { id: 'tune3', name: 'Fleet Tuning III', desc: 'All vessels work twice as fast.', cost: 3e8, prod: 2 },
  { id: 'pulse', name: 'Gravity Pulse', desc: 'Every tap mines five times as much.', cost: 5e9, tap: 5 },
];

export const MISSION_TYPES = ['tap', 'mine', 'buy', 'comet'];
export const TAP_TARGETS = [150, 250, 400];

/*
 * Commendations. `stat` names a value computed by logic.js (statValue).
 * stat: taps | allTime | fleet | kinds | upgrades | runs | comets | missions | best | rate
 */
export const ACHS = [
  { id: 't1', name: 'First Strikes', desc: 'Tap the asteroid 100 times.', t: 100, stat: 'taps' },
  { id: 't2', name: 'Steady Hands', desc: 'Tap 1,000 times.', t: 1e3, stat: 'taps' },
  { id: 't3', name: 'Jackhammer', desc: 'Tap 10,000 times.', t: 1e4, stat: 'taps' },
  { id: 't4', name: 'Rock Breaker', desc: 'Tap 100,000 times.', t: 1e5, stat: 'taps' },
  { id: 'o1', name: 'First Haul', desc: 'Mine 1,000 t in total.', t: 1e3, stat: 'allTime' },
  { id: 'o2', name: 'Cargo Run', desc: 'Mine 1 million t in total.', t: 1e6, stat: 'allTime' },
  { id: 'o3', name: 'Heavy Freight', desc: 'Mine 1 billion t in total.', t: 1e9, stat: 'allTime' },
  { id: 'o4', name: 'Belt Baron', desc: 'Mine 1 trillion t in total.', t: 1e12, stat: 'allTime' },
  { id: 'f1', name: 'Small Crew', desc: 'Own 10 vessels at once.', t: 10, stat: 'fleet' },
  { id: 'f2', name: 'Proper Fleet', desc: 'Own 50 vessels at once.', t: 50, stat: 'fleet' },
  { id: 'f3', name: 'Armada', desc: 'Own 150 vessels at once.', t: 150, stat: 'fleet' },
  { id: 'f4', name: 'Swarm', desc: 'Own 400 vessels at once.', t: 400, stat: 'fleet' },
  { id: 'k1', name: 'Mixed Fleet', desc: 'Own 3 kinds of vessel.', t: 3, stat: 'kinds' },
  { id: 'k2', name: 'Full Roster', desc: 'Own 5 kinds of vessel.', t: 5, stat: 'kinds' },
  { id: 'k3', name: 'One of Each', desc: 'Own all 7 kinds of vessel.', t: GENS.length, stat: 'kinds' },
  { id: 'u1', name: 'Tooled Up', desc: 'Install 3 upgrades in one run.', t: 3, stat: 'upgrades' },
  { id: 'u2', name: 'Fully Fitted', desc: 'Install every upgrade in one run.', t: UPS.length, stat: 'upgrades' },
  { id: 'r1', name: 'New Horizons', desc: 'Relocate to a new belt.', t: 1, stat: 'runs' },
  { id: 'r2', name: 'Belt Hopper', desc: 'Relocate 5 times.', t: 5, stat: 'runs' },
  { id: 'r3', name: 'Survey Veteran', desc: 'Relocate 10 times.', t: 10, stat: 'runs' },
  { id: 'c1', name: 'Sky Watcher', desc: 'Catch a comet.', t: 1, stat: 'comets' },
  { id: 'c2', name: 'Comet Hunter', desc: 'Catch 25 comets.', t: 25, stat: 'comets' },
  { id: 'c3', name: 'Vein Chaser', desc: 'Catch 100 comets.', t: 100, stat: 'comets' },
  { id: 'm1', name: 'Clocking In', desc: 'Complete 3 daily missions.', t: 3, stat: 'missions' },
  { id: 'm2', name: 'Regular', desc: 'Complete 30 daily missions.', t: 30, stat: 'missions' },
  { id: 'm3', name: 'Lifer', desc: 'Complete 100 daily missions.', t: 100, stat: 'missions' },
  { id: 's1', name: 'Back Again', desc: 'Reach a 3-day supply streak.', t: 3, stat: 'best' },
  { id: 's2', name: 'Week Out', desc: 'Reach a 7-day supply streak.', t: 7, stat: 'best' },
  { id: 's3', name: 'Long Haul', desc: 'Reach a 30-day supply streak.', t: 30, stat: 'best' },
  { id: 'p1', name: 'Humming', desc: 'Reach 100 t/s.', t: 100, stat: 'rate' },
  { id: 'p2', name: 'Roaring', desc: 'Reach 10,000 t/s.', t: 1e4, stat: 'rate' },
  { id: 'p3', name: 'Unstoppable', desc: 'Reach 1 million t/s.', t: 1e6, stat: 'rate' },
];

/*
 * Shop. `id` is the product ID to create in Play Console (one-time products).
 * kind 'pack' is repeatable (consumed after it is granted); kind 'once' is bought a single time and restorable.
 * Ore rewards are hours of the player's current no-frenzy output, with a floor so early players still get something.
 * No random rewards: everything is shown before purchase.
 */
export const BOOST_MULT = 1.25;
export const PRODUCTS = [
  { id: 'remove_ads', kind: 'once', name: 'Remove ads', desc: 'Removes the banner ad. The ad bonuses (double offline earnings, cargo pod) become free.' },
  { id: 'starter_bundle', kind: 'once', name: 'Starter bundle', desc: '3 hours of ore and output x7 for 2 minutes. One time only.', hours: 3, floor: 10000, frenzy: 120 },
  { id: 'boost_25', kind: 'once', name: 'Prospector boost', desc: 'Permanent +25% to all output and taps. Stays through relocations.' },
  { id: 'ore_small', kind: 'pack', name: 'Small ore pack', desc: '1 hour of your current output.', hours: 1, floor: 2000 },
  { id: 'ore_medium', kind: 'pack', name: 'Medium ore pack', desc: '6 hours of your current output.', hours: 6, floor: 15000 },
  { id: 'ore_large', kind: 'pack', name: 'Large ore pack', desc: '24 hours of your current output.', hours: 24, floor: 80000 },
];
export const GRANTED_KEEP = 50;
