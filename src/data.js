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
  // Late game: six more boosts that start where the first nine leave off, so the tab has something to offer deep into a run.
  { id: 'tune4', name: 'Fleet Tuning IV', desc: 'All vessels work twice as fast.', cost: 2e11, prod: 2 },
  { id: 'uplink3', name: 'Quantum Uplink', desc: 'Each tap also mines another 25% of your ore per second.', cost: 2e12, link: 0.25 },
  { id: 'tune5', name: 'Fleet Tuning V', desc: 'All vessels work two and a half times as fast.', cost: 5e13, prod: 2.5 },
  { id: 'singular', name: 'Singularity Drill', desc: 'Every tap mines ten times as much.', cost: 2e14, tap: 10 },
  { id: 'tune6', name: 'Fleet Tuning VI', desc: 'All vessels work three times as fast.', cost: 1e16, prod: 3 },
  { id: 'tune7', name: 'Fleet Tuning VII', desc: 'All vessels work four times as fast.', cost: 3e18, prod: 4 },
];

export const MISSION_TYPES = ['tap', 'mine', 'buy', 'comet'];
export const TAP_TARGETS = [150, 250, 400];

/*
 * Commendations. `stat` names a value computed by logic.js (statValue).
 * stat: taps | tapPower | night | allTime | heldOre | rate | fleet | kinds | maxVessel | upgrades | runs | bare | points |
 *       comets | ships | cometsOnly | bestRun | overdrive | missions | chests | best | drops | capped | achs
 * group: the category shown in the Goals tab. tier: 1 Bronze, 2 Silver, 3 Gold, 4 and up Platinum.
 * bonus: permanent output and tap bonus; the original 32 give +1%, newer ones +0.5%. secret: hidden until earned.
 */
export const ACH_BONUS_NEW = 0.005;
export const ACH_GROUPS = ['Taps', 'Ore', 'Output', 'Fleet', 'Upgrades', 'Belts', 'Survey', 'Flyers', 'Missions', 'Supply', 'Collection'];
export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'];
/** One-time ore gift when a commendation is earned, by tier: [minutes of current output, minimum tonnes]. */
export const ACH_GIFT = { 1: [3, 250], 2: [8, 600], 3: [20, 1500], 4: [45, 4000] };
/** Rank titles by number of commendations earned. */
export const RANKS = [
  { min: 0, name: 'Rookie' }, { min: 5, name: 'Prospector' }, { min: 12, name: 'Miner' }, { min: 20, name: 'Foreman' },
  { min: 32, name: 'Baron' }, { min: 45, name: 'Tycoon' }, { min: 58, name: 'Legend' },
];

const NEW = { bonus: ACH_BONUS_NEW };
const ach = (id, group, tier, name, desc, t, stat, extra = {}) => ({ id, group, tier, name, desc, t, stat, ...extra });

export const ACHS = [
  // Taps
  ach('t1', 'Taps', 1, 'First Strikes', 'Tap the asteroid 100 times.', 100, 'taps'),
  ach('t2', 'Taps', 2, 'Steady Hands', 'Tap 1,000 times.', 1e3, 'taps'),
  ach('t3', 'Taps', 3, 'Jackhammer', 'Tap 10,000 times.', 1e4, 'taps'),
  ach('t4', 'Taps', 4, 'Rock Breaker', 'Tap 100,000 times.', 1e5, 'taps'),
  ach('tp1', 'Taps', 1, 'Heavy Hand', 'Make a single tap worth 100 t.', 100, 'tapPower', NEW),
  ach('tp2', 'Taps', 2, 'Piledriver', 'Make a single tap worth 10,000 t.', 1e4, 'tapPower', NEW),
  ach('tp3', 'Taps', 3, 'World Breaker', 'Make a single tap worth 1 million t.', 1e6, 'tapPower', NEW),
  ach('n1', 'Taps', 2, 'Night Owl', 'Tap 50 times between 2 and 4 in the morning.', 50, 'night', { ...NEW, secret: true }),
  // Ore
  ach('o1', 'Ore', 1, 'First Haul', 'Mine 1,000 t in total.', 1e3, 'allTime'),
  ach('o2', 'Ore', 2, 'Cargo Run', 'Mine 1 million t in total.', 1e6, 'allTime'),
  ach('o3', 'Ore', 3, 'Heavy Freight', 'Mine 1 billion t in total.', 1e9, 'allTime'),
  ach('o4', 'Ore', 4, 'Belt Baron', 'Mine 1 trillion t in total.', 1e12, 'allTime'),
  ach('o5', 'Ore', 5, 'Galactic Magnate', 'Mine 1 quadrillion t in total.', 1e15, 'allTime', NEW),
  ach('h1', 'Ore', 3, 'Dragon Hoard', 'Hold 1 billion t at once.', 1e9, 'heldOre', { ...NEW, secret: true }),
  // Output
  ach('p1', 'Output', 1, 'Humming', 'Reach 100 t/s.', 100, 'rate'),
  ach('p2', 'Output', 2, 'Roaring', 'Reach 10,000 t/s.', 1e4, 'rate'),
  ach('p3', 'Output', 3, 'Unstoppable', 'Reach 1 million t/s.', 1e6, 'rate'),
  ach('p4', 'Output', 4, 'Relentless', 'Reach 100 million t/s.', 1e8, 'rate', NEW),
  ach('z1', 'Output', 2, 'Sleeping Giant', 'Return after the 8 hour offline limit.', 1, 'capped', { ...NEW, secret: true }),
  // Fleet
  ach('f1', 'Fleet', 1, 'Small Crew', 'Own 10 vessels at once.', 10, 'fleet'),
  ach('f2', 'Fleet', 2, 'Proper Fleet', 'Own 50 vessels at once.', 50, 'fleet'),
  ach('f3', 'Fleet', 3, 'Armada', 'Own 150 vessels at once.', 150, 'fleet'),
  ach('f4', 'Fleet', 4, 'Swarm', 'Own 400 vessels at once.', 400, 'fleet'),
  ach('f5', 'Fleet', 5, 'Legion', 'Own 1,000 vessels at once.', 1000, 'fleet', NEW),
  ach('k1', 'Fleet', 1, 'Mixed Fleet', 'Own 3 kinds of vessel.', 3, 'kinds'),
  ach('k2', 'Fleet', 2, 'Full Roster', 'Own 5 kinds of vessel.', 5, 'kinds'),
  ach('k3', 'Fleet', 3, 'One of Each', 'Own all 7 kinds of vessel.', GENS.length, 'kinds'),
  ach('v1', 'Fleet', 1, 'Specialist', 'Own 50 of one kind of vessel.', 50, 'maxVessel', NEW),
  ach('v2', 'Fleet', 2, 'Monoculture', 'Own 100 of one kind of vessel.', 100, 'maxVessel', NEW),
  ach('v3', 'Fleet', 3, 'Mass Production', 'Own 200 of one kind of vessel.', 200, 'maxVessel', NEW),
  // Upgrades
  ach('u1', 'Upgrades', 1, 'Tooled Up', 'Install 3 upgrades in one run.', 3, 'upgrades'),
  // The tiers are spread across the whole upgrade list: 20%, 40%, about two thirds, and all of them.
  ach('u2', 'Upgrades', 2, 'Well Equipped', 'Install 6 upgrades in one run.', 6, 'upgrades'),
  ach('u3', 'Upgrades', 3, 'Master Fitter', 'Install 10 upgrades in one run.', 10, 'upgrades', NEW),
  ach('u4', 'Upgrades', 4, 'Fully Fitted', 'Install all ' + UPS.length + ' upgrades in one run.', UPS.length, 'upgrades', NEW),
  // Belts
  ach('r1', 'Belts', 1, 'New Horizons', 'Relocate to a new belt.', 1, 'runs'),
  ach('r2', 'Belts', 2, 'Belt Hopper', 'Relocate 5 times.', 5, 'runs'),
  ach('r3', 'Belts', 3, 'Survey Veteran', 'Relocate 10 times.', 10, 'runs'),
  ach('r4', 'Belts', 4, 'Grand Tour', 'Relocate 20 times.', 20, 'runs', NEW),
  // The first belt with a ring is the 2nd relocation (see belts.js); belt number 7 is the last of the 8 colour schemes.
  ach('rb1', 'Belts', 2, 'Ringed World', 'Reach a belt with a ring.', 2, 'runs', { ...NEW, secret: true }),
  ach('rb2', 'Belts', 3, 'Full Spectrum', 'Visit all 8 kinds of belt.', 7, 'runs', { ...NEW, secret: true }),
  ach('br1', 'Belts', 2, 'Bare Hands', 'Relocate without installing a single upgrade.', 1, 'bare', { ...NEW, secret: true }),
  // Survey points
  ach('sv1', 'Survey', 1, 'Surveyor', 'Hold 10 survey points.', 10, 'points', NEW),
  ach('sv2', 'Survey', 2, 'Cartographer', 'Hold 50 survey points.', 50, 'points', NEW),
  ach('sv3', 'Survey', 3, 'Cosmographer', 'Hold 200 survey points.', 200, 'points', NEW),
  ach('sv4', 'Survey', 4, 'Belt Whisperer', 'Hold 1,000 survey points.', 1000, 'points', NEW),
  // Flyers
  ach('c1', 'Flyers', 1, 'Sky Watcher', 'Catch a comet or supply ship.', 1, 'comets'),
  ach('c2', 'Flyers', 2, 'Comet Hunter', 'Catch 25 comets or supply ships.', 25, 'comets'),
  ach('c3', 'Flyers', 3, 'Vein Chaser', 'Catch 100 comets or supply ships.', 100, 'comets'),
  ach('sh1', 'Flyers', 1, 'Dock Hand', 'Catch 10 supply ships.', 10, 'ships', NEW),
  ach('sh2', 'Flyers', 2, 'Quartermaster', 'Catch 50 supply ships.', 50, 'ships', NEW),
  ach('sh3', 'Flyers', 3, 'Fleet Provisioner', 'Catch 200 supply ships.', 200, 'ships', NEW),
  ach('cm1', 'Flyers', 1, 'Tail Chaser', 'Catch 10 comets.', 10, 'cometsOnly', NEW),
  ach('cm2', 'Flyers', 2, 'Meteor Magnet', 'Catch 50 comets.', 50, 'cometsOnly', NEW),
  ach('cm3', 'Flyers', 3, 'Cosmic Angler', 'Catch 200 comets.', 200, 'cometsOnly', NEW),
  ach('er1', 'Flyers', 3, 'Eagle Eye', 'Catch 5 comets or supply ships in a row without missing one.', 5, 'bestRun', { ...NEW, secret: true }),
  ach('ov1', 'Flyers', 3, 'Overdrive', 'Stack supply ships until the x7 boost has over 100 seconds left.', 1, 'overdrive', { ...NEW, secret: true }),
  // Missions
  ach('m1', 'Missions', 1, 'Clocking In', 'Complete 3 daily missions.', 3, 'missions'),
  ach('m2', 'Missions', 2, 'Regular', 'Complete 30 daily missions.', 30, 'missions'),
  ach('m3', 'Missions', 3, 'Lifer', 'Complete 100 daily missions.', 100, 'missions'),
  ach('ch1', 'Missions', 1, 'Cache Cracker', 'Open a daily cache.', 1, 'chests', NEW),
  ach('ch2', 'Missions', 2, 'Daily Habit', 'Open 7 daily caches.', 7, 'chests', NEW),
  ach('ch3', 'Missions', 3, 'Vault Keeper', 'Open 30 daily caches.', 30, 'chests', NEW),
  // Supply drops
  ach('s1', 'Supply', 1, 'Back Again', 'Reach a 3-day supply streak.', 3, 'best'),
  ach('s2', 'Supply', 2, 'Week Out', 'Reach a 7-day supply streak.', 7, 'best'),
  ach('s3', 'Supply', 3, 'Long Haul', 'Reach a 30-day supply streak.', 30, 'best'),
  ach('d1', 'Supply', 1, 'Regular Supplier', 'Collect 10 supply drops.', 10, 'drops', NEW),
  ach('d2', 'Supply', 2, 'Supply Chain', 'Collect 50 supply drops.', 50, 'drops', NEW),
  ach('d3', 'Supply', 3, 'Loyal Customer', 'Collect 150 supply drops.', 150, 'drops', NEW),
  // Collection
  ach('a1', 'Collection', 1, 'Collector', 'Earn 10 commendations.', 10, 'achs', NEW),
  ach('a2', 'Collection', 2, 'Curator', 'Earn 25 commendations.', 25, 'achs', NEW),
  ach('a3', 'Collection', 3, 'Archivist', 'Earn 45 commendations.', 45, 'achs', NEW),
];

/*
 * Chains: commendations that are tiers of one goal (Bronze, Silver, Gold...) are shown as a single tile.
 * Each tier is still its own commendation with its own bonus and gift; only the display is grouped.
 * Secret commendations are single-tier chains. Order here is the order tiles appear within a group.
 */
export const CHAIN_IDS = {
  taps: ['t1', 't2', 't3', 't4'],
  tapPower: ['tp1', 'tp2', 'tp3'],
  nightowl: ['n1'],
  ore: ['o1', 'o2', 'o3', 'o4', 'o5'],
  hoard: ['h1'],
  output: ['p1', 'p2', 'p3', 'p4'],
  sleeper: ['z1'],
  fleet: ['f1', 'f2', 'f3', 'f4', 'f5'],
  kinds: ['k1', 'k2', 'k3'],
  specialist: ['v1', 'v2', 'v3'],
  upgrades: ['u1', 'u2', 'u3', 'u4'],
  relocations: ['r1', 'r2', 'r3', 'r4'],
  ringed: ['rb1'],
  spectrum: ['rb2'],
  barehands: ['br1'],
  survey: ['sv1', 'sv2', 'sv3', 'sv4'],
  flyers: ['c1', 'c2', 'c3'],
  ships: ['sh1', 'sh2', 'sh3'],
  comets: ['cm1', 'cm2', 'cm3'],
  eagleeye: ['er1'],
  overdrive: ['ov1'],
  missions: ['m1', 'm2', 'm3'],
  caches: ['ch1', 'ch2', 'ch3'],
  streak: ['s1', 's2', 's3'],
  drops: ['d1', 'd2', 'd3'],
  collection: ['a1', 'a2', 'a3'],
};
export const CHAIN_TITLES = {
  taps: 'Tapping', tapPower: 'Tap power', ore: 'Lifetime ore', hoard: 'Hoard', output: 'Output rate', sleeper: 'Time away',
  fleet: 'Fleet size', kinds: 'Vessel kinds', specialist: 'One kind', upgrades: 'Upgrades', relocations: 'Relocations',
  ringed: 'Rings', spectrum: 'Spectrum', survey: 'Survey points', flyers: 'Flyers caught', ships: 'Supply ships',
  comets: 'Comets', nightowl: 'Night owl', barehands: 'Bare hands', eagleeye: 'Eagle eye', overdrive: 'Overdrive', missions: 'Missions', caches: 'Daily caches', streak: 'Supply streak', drops: 'Supply drops', collection: 'Collection',
};
for (const [chain, ids] of Object.entries(CHAIN_IDS)) {
  for (const id of ids) ACHS.find((a) => a.id === id).chain = chain;
}

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


/*
 * The Captain's journal: a story told in chapters that unlock with lifetime progress.
 * Several chapters quietly hint at the secret commendations. They never name them.
 * stat/t: the chapter unlocks when statValue(stat) >= t. req: shown while the chapter is locked.
 */
export const JOURNAL = [
  {
    id: 'j1', title: 'The Claim', stat: 'allTime', t: 0, req: '',
    text: [
      "The company called it a claim. You called it home: one grey rock, a rented drill and a hold that echoed when you spoke. Nobody else wanted this corner of the Drift, which is exactly why it was cheap.",
      "The first strike of the pick rang through the hull like a bell. Ore, at last. Thirty years of debt looked a little smaller that morning.",
    ],
  },
  {
    id: 'j2', title: 'Hired Hands', stat: 'allTime', t: 1e3, req: 'Mine 1,000 t in total.',
    text: [
      "A thousand tonnes in the hold and the first drone rattled off the dock, all elbows and optimism. It mined badly and never complained.",
      "The crew grew from there: a laser rig, then tugs to haul what the lasers cut. The old hands swear the asteroid hums loudest in the small hours, when the station sleeps and nobody is counting. Maybe they are right. Maybe it only hums for those still awake to hear it.",
    ],
  },
  {
    id: 'j3', title: 'A Light in the Sky', stat: 'comets', t: 1, req: 'Catch a comet or a supply ship.',
    text: [
      "Something bright crossed the sky today. First a comet, shedding rock like a dropped sack of coins, then a supply ship with its lamps blazing, hauling crates for anyone quick enough to wave it down.",
      "Catch what passes. The Drift rewards the miner who keeps looking up. They tell of a pilot who snagged five lights in a row and never let a single one slip by him. Nobody has ever proved it.",
    ],
  },
  {
    id: 'j4', title: 'The First Million', stat: 'allTime', t: 1e6, req: 'Mine 1 million t in total.',
    text: [
      "A million tonnes. The company sent a letter, then a bigger letter, then a man in a clean coat who counted your fleet twice and left looking worried.",
      "The foremen on the dock say the real trick is knowing when to stop and start over. A good survey is worth more than a full hold. You are beginning to believe them.",
    ],
  },
  {
    id: 'j5', title: 'Leaving the Claim', stat: 'runs', t: 1, req: 'Relocate once.',
    text: [
      "You sold the fleet, stripped the rock and left. It felt like betrayal and tasted like rocket fuel.",
      "On the dock they still tell the story of a miner who left every tool behind and made the crossing with nothing at all in his hands. He arrived lighter than the rest of them, and prouder, and the Drift remembered.",
    ],
  },
  {
    id: 'j6', title: 'The Second Crossing', stat: 'runs', t: 2, req: 'Relocate twice.',
    text: [
      "Past the second crossing the Drift opens up. Rocks the colour of rust, of ice, of old bruises. And somewhere out there is a world that wears a ring like a crown, if the charts can be trusted.",
      "The charts, naturally, cannot.",
    ],
  },
  {
    id: 'j7', title: 'What the Dock Remembers', stat: 'allTime', t: 1e8, req: 'Mine 100 million t in total.',
    text: [
      "On quiet nights you read the old logs aloud. The fleet works while you sleep; it always has. Leave it alone long enough that it nods off on the job, eight hours and a breath, and the hold is not so much full as astonished.",
      "One foreman swore the lamps of a supply ship once burned two whole minutes without dimming, crate stacked on crate, as if the sky itself owed him a favour.",
    ],
  },
  {
    id: 'j8', title: 'The Hoard', stat: 'allTime', t: 1e9, req: 'Mine 1 billion t in total.',
    text: [
      "Every belt has its legend, and this one has a dragon. They say it sleeps on a billion tonnes and has never spent a gram, and that it counts the pile every night by the light of its own scales.",
      "You are not a dragon. You spend. But on the quiet nights you wonder what that much ore would look like in one place.",
    ],
  },
  {
    id: 'j9', title: 'The Colours of the Drift', stat: 'runs', t: 5, req: 'Relocate 5 times.',
    text: [
      "Eight colours hang in the Drift, and no two belts are alike. Whoever has stood under every one of them is owed a story, and a drink, and probably an apology from the company.",
      "You have started keeping a pocket of dust from each. The jar is getting heavy.",
    ],
  },
  {
    id: 'j10', title: 'Belt Baron', stat: 'allTime', t: 1e12, req: 'Mine 1 trillion t in total.',
    text: [
      "They call you a baron now, which is only 'miner' with better lighting. The company's letters have turned polite. Every hull in the fleet hums a different note, and together they almost make a tune.",
      "There is no last chapter. There is always another belt, another crossing, another light in the sky. Keep the drill warm.",
    ],
  },
];
