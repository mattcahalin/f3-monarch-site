/* F3 Beatdown Generator — builds workouts from data/backblasts.md.
   Runs in the browser (window.BeatdownGen) and in Node (module.exports) for testing. */
(function (root) {
  'use strict';

  // ---------- Random numbers (seeded, so a workout can be shared by link) ----------
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  function weightedSample(r, items, n) {
    const pool = items.slice(), out = [];
    while (out.length < n && pool.length) {
      const total = pool.reduce((s, x) => s + Math.sqrt(x.count), 0);
      let x = r() * total, i = 0;
      for (; i < pool.length - 1; i++) { x -= Math.sqrt(pool[i].count); if (x <= 0) break; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  // ---------- Parse the markdown ----------
  function parse(md) {
    const entries = [];
    for (const chunk of md.split(/\n## /).slice(1)) {
      const nl = chunk.indexOf('\n');
      const e = { title: chunk.slice(0, nl).trim(), warmup: '', thang: '', mary: '' };
      for (const sec of chunk.slice(nl).split(/\n### /).slice(1)) {
        const k = sec.slice(0, sec.indexOf('\n')).trim().toLowerCase();
        const body = sec.slice(sec.indexOf('\n')).replace(/\n---\s*$/, '').trim();
        if (k in e) e[k] = body;
      }
      if (e.thang) entries.push(e);
    }
    return entries;
  }

  // A section that is really "we skipped it"
  const JUNK = /^(?:none|n\/?a|no(?:pe)?|not today|no time|skipped|ran out of time|see above|recover[\s,!-]*recover|cor[\s/]*nor|pax choice|[-.\s]*)[.!\s]*$/i;
  const usable = s => !!s && s.replace(/\s+/g, ' ').length >= 12 && !JUNK.test(s.trim());

  // ---------- Exercise vocabulary for Dr. Moreau mode ----------
  // [name, pattern, unit, amount]  unit: ic = in cadence, reps, sec = hold, yds = travel
  const VOCAB = {
    warmup: [
      ['Side Straddle Hops', /\bssh|side straddle/, 'ic', 20],
      ['Grass Grabbers', /grass\s*grab/, 'ic', 10],
      ['Learning to Phelps', /phelps/, 'ic', 10],
      ['Goofballs', /goof\s*balls?/, 'ic', 10],
      ['Piano Tappers', /piano tap/, 'ic', 10],
      ['Willie Mays Hayes', /will(?:ie|y) ma[iy]?e?s[\s-]*ha[iy]e?s|\bwmh\b/, 'ic', 10],
      ['Little Baby Arm Circles', /arm circles|\blbacs?\b/, 'ic', 10],
      ['Bat Wings', /bat\s*wings/, 'ic', 10],
      ['Abe Vigodas', /abe vigo/, 'ic', 10],
      ['Monkey Humpers', /monkey hump/, 'ic', 15],
      ['High Knees', /high knees/, 'ic', 15],
      ['Imperial Walkers', /imperial walk/, 'ic', 15],
      ['Seal Claps', /seal claps/, 'ic', 15],
      ['Open the Gates', /open the gates?/, 'ic', 10],
      ['Hairy Flamingos', /ha[i]?rr?y flamingo/, 'ic', 10],
      ['Copperhead Squats', /copperhead/, 'ic', 10],
      ['Grady Corn', /grady corn/, 'ic', 10],
      ['Butt Kickers', /butt kick/, 'ic', 15],
      ['Overhead Claps', /overhead claps/, 'ic', 15],
      ['Prisoner Good Mornings', /good mornings/, 'ic', 10],
      ['Toe Touches', /toe touch/, 'ic', 10],
      ['Hillbillies', /hillbill/, 'ic', 10],
      ['Mountain Climbers', /mountain climb/, 'ic', 15],
      ['Tappy Taps', /tappy tap/, 'ic', 10],
      ['Cotton Pickers', /cotton pick/, 'ic', 10],
      ['Windmills', /windmill/, 'ic', 10],
      ['Motivators (5 to 1)', /motivators/, 'reps', 1],
      ["Old Man Stretch", /old man stretch/, 'sec', 30],
      ['Downward Dog', /downward dog/, 'sec', 30],
      ['Pretzels', /pretzel/, 'sec', 30],
      ["World's Greatest Stretch", /world'?s greatest/, 'sec', 30],
      ['Learning to Fly', /learning to fly/, 'ic', 10],
    ],
    thang: [
      ['Merkins', /(?<!diamond |hand[- ]release |decline |incline |ranger |wide )merkins?\b/, 'reps', 15],
      ['Burpees', /burpees?\b/, 'reps', 10],
      ['Coupon Curls', /\bcurls\b/, 'reps', 15],
      ['Thrusters', /thrusters?/, 'reps', 10],
      ['Overhead Press', /overhead press|\boh press/, 'reps', 15],
      ['Coupon Squats', /coupon squats?/, 'reps', 15],
      ['Blockees', /blockees?/, 'reps', 5],
      ['Air Squats', /air squats?/, 'reps', 20],
      ['Bent Over Rows', /bent[\s-]*over rows?/, 'reps', 15],
      ['Skull Crushers', /skull ?crushers?/, 'reps', 15],
      ['Mountain Climbers', /mountain climb/, 'ic', 15],
      ['Taint Scrapers', /taint scrap/, 'reps', 10],
      ['Goblet Squats', /goblet squats?/, 'reps', 15],
      ['Dips', /\bdips\b/, 'reps', 15],
      ['CPRs', /\bcprs?\b|curl[\s,-]*press[\s,-]*r(?:ow|aise)/, 'reps', 10],
      ['Chest Press', /chest press/, 'reps', 15],
      ['Bonnie Blairs', /bonnie blair/, 'reps', 10],
      ['Lunges', /\blunges\b/, 'reps', 20],
      ['Plank Jacks', /plank jacks?/, 'reps', 15],
      ['Big Boy Sit-Ups', /big boy sit|\bbbsus?\b/, 'reps', 15],
      ['Jump Squats', /jump squats?|squat jumps?/, 'reps', 10],
      ['Carolina Dry Docks', /carolina dry|\bcdds?\b/, 'reps', 10],
      ['Hand Release Merkins', /hand[- ]release/, 'reps', 10],
      ['Bobby Hurleys', /bobby hurley/, 'reps', 10],
      ['Lawn Mowers', /lawn ?mowers?/, 'reps', 10],
      ['Step Ups', /step[- ]?ups?/, 'reps', 15],
      ['Calf Raises', /calf raises?/, 'reps', 25],
      ['Diamond Merkins', /diamond merkins?/, 'reps', 10],
      ['Shoulder Taps', /shoulder taps?/, 'ic', 15],
      ['V-Ups', /\bv[- ]?ups?\b/, 'reps', 15],
      ['Derkins', /derkins?|decline merkins?/, 'reps', 10],
      ['Smurf Jacks', /smurf jacks?/, 'reps', 15],
      ['Upright Rows', /upright rows?/, 'reps', 15],
      ['Incline Merkins', /incline merkins?/, 'reps', 15],
      ['Werkins', /werkins?|wide merkins?/, 'reps', 10],
      ['Peter Parkers', /peter parker/, 'reps', 10],
      ['Groiners', /groiners?/, 'reps', 10],
      ['Squat Thrusts', /squat thrusts?/, 'reps', 10],
      ['Tricep Extensions', /tricep extensions?/, 'reps', 15],
      ['American Hammers', /american hammers?/, 'ic', 15],
      ['Box Jumps', /box jumps?/, 'reps', 10],
      ['Al Gore', /al gores?|wall sits?/, 'sec', 45],
      ['Bear Crawl', /bear crawl/, 'yds', 25],
      ['Crab Walk', /crab walk/, 'yds', 25],
      ['Rifle Carry', /rifle carry/, 'yds', 50],
      ['Murder Bunnies', /murder bunn/, 'yds', 20],
      ['Broad Jumps', /broad jumps?/, 'yds', 25],
      ['Walking Lunges', /walking lunges?|lunge walk/, 'yds', 25],
      ['Karaoke', /karaoke|carioca/, 'yds', 50],
    ],
    mary: [
      ['Flutter Kicks', /flutter ?kicks?/, 'ic', 20],
      ['American Hammers', /american hammers?/, 'ic', 20],
      ['LBCs', /\blbc'?s?\b|little baby crunch/, 'reps', 25],
      ['Penguin Tappers', /penguin tap/, 'reps', 20],
      ['Mountain Climbers', /mountain climb/, 'ic', 20],
      ['Plank', /(?<!side |high |low |king kong )plank\b(?! jack)/, 'sec', 60],
      ['Plank Jacks', /plank jacks?/, 'reps', 15],
      ['Freddie Mercurys', /fredd(?:ie|y) mercur/, 'ic', 20],
      ['Big Boy Sit-Ups', /big boy sit|\bbbsus?\b/, 'reps', 15],
      ['Heels to Heaven', /heels to heaven/, 'reps', 15],
      ['Boats and Canoes', /boats? (?:and |& |n )?canoes?/, 'sec', 60],
      ['Rosalitas', /rosalita/, 'ic', 15],
      ['Imperial Walkers', /imperial walk/, 'ic', 15],
      ['High-Low Planks', /high[\s/-]*low planks?/, 'sec', 60],
      ['Dying Cockroaches', /dying cockroach/, 'ic', 15],
      ['Hello Dollies', /hello doll/, 'ic', 15],
      ['V-Ups', /\bv[- ]?ups?\b/, 'reps', 15],
      ['Lemon Squeezers', /lemon squeez/, 'reps', 15],
      ['Leg Lifts', /leg (?:lifts|raises)/, 'reps', 15],
      ['Crab Cakes', /crab cakes?/, 'reps', 15],
      ['Oblique Crunches', /oblique crunch/, 'reps', 15],
      ['Box Cutters', /box cutters?/, 'reps', 15],
      ['Guantanamo', /guantanamo/, 'sec', 60],
      ['Protractor', /protractor/, 'sec', 60],
      ['Russian Twists', /russian twists?/, 'ic', 20],
      ['Side Plank', /side planks?/, 'sec', 30],
      ['Supermans', /superman/, 'sec', 30],
      ['Pickle Pointers', /pickle point/, 'reps', 15],
      ['King Kong Planks', /king kong/, 'sec', 45],
      ['Low Slow Flutters', /low slow flutter/, 'ic', 15],
    ],
  };

  // Count how many backblasts use each exercise in each section, and remember where.
  function buildPools(entries) {
    const pools = {};
    for (const sec of ['warmup', 'thang', 'mary']) {
      pools[sec] = VOCAB[sec].map(([name, re, unit, amount]) => {
        const rx = new RegExp(re.source, 'i');
        const sources = [];
        entries.forEach((e, i) => { if (e[sec] && rx.test(e[sec])) sources.push(i); });
        return { name, unit, amount, sources, count: sources.length };
      }).filter(x => x.count >= 3);
    }
    return pools;
  }

  function dose(x, scale) {
    const n = Math.max(1, Math.round((x.amount * (scale || 1)) / 5) * 5 || x.amount);
    if (x.unit === 'ic') return `${x.name} x${n} IC`;
    if (x.unit === 'sec') return `${x.name} — ${n} sec`;
    if (x.unit === 'yds') return `${x.name} ${n} yds`;
    if (x.amount === 1) return x.name;
    return `${n} ${x.name}`;
  }

  // Thang formats. Each returns the plan text and its time in minutes.
  const FORMATS = [
    { name: 'AMRAP', build(r, ex) {
        const mins = between(r, 16, 20), picks = ex(5);
        return { mins, text: `AMRAP ${mins} minutes — as many rounds as possible. Mosey 50 yds between rounds.`,
          items: picks.map(x => dose(x)) };
      } },
    { name: 'Dora 1-2-3', build(r, ex) {
        const mins = 18, picks = ex(3, x => x.unit === 'reps' || x.unit === 'ic');
        return { mins, text: `Dora 1-2-3 (${mins} min cap). Partner up: P1 works while P2 runs 75 yds and back, then flapjack. Chip away at the team totals.`,
          items: picks.map((x, i) => `${[100, 200, 300][i]} ${x.name}`) };
      } },
    { name: '11s', build(r, ex) {
        const mins = 16, picks = ex(2, x => x.unit === 'reps');
        return { mins, text: `11s (${mins} min cap). Two cones ~40 yds apart. 10 of the first at cone A, 1 of the second at cone B, then 9 and 2, and so on down to 1 and 10. Mosey between cones.`,
          items: [`Cone A: ${picks[0].name}`, `Cone B: ${picks[1].name}`] };
      } },
    { name: 'EMOM', build(r, ex) {
        const mins = 20, picks = ex(4, x => x.unit !== 'yds');
        return { mins, text: `EMOM ${mins} — every minute on the minute, rotate through the list (5 rounds). Rest whatever is left of the minute.`,
          items: picks.map(x => dose(x, 0.8)) };
      } },
    { name: 'Four Corners', build(r, ex) {
        const mins = 20, picks = ex(4, x => x.unit === 'reps' || x.unit === 'ic');
        return { mins, text: `Four Corners (${mins} min cap). Mark a square ~40 yds per side. Run to each corner, do its exercise and every exercise from the corners before it. Travel between corners changes each lap: bear crawl, lunge walk, sprint, karaoke.`,
          items: picks.map((x, i) => `Corner ${i + 1}: ${dose(x)}`) };
      } },
    { name: 'Tabata', build(r, ex) {
        const picks = ex(5, x => x.unit === 'reps' || x.unit === 'ic'), mins = picks.length * 4;
        return { mins, text: `Tabata — 4 minutes per exercise: 8 rounds of 20 sec all-out, 10 sec rest. 30-second breather between exercises.`,
          items: picks.map(x => x.name) };
      } },
    { name: 'Stations', build(r, ex) {
        const picks = ex(5), mins = 18;
        return { mins, text: `String of Pearls — 5 stations in a loop. 3 laps, 60 sec work at each station, mosey to the next.`,
          items: picks.map((x, i) => `Station ${i + 1}: ${x.unit === 'yds' ? dose(x) : x.name + ' (60 sec)'}`) };
      } },
  ];

  const CREATURE = ['Hyena-Swine', 'Leopard-Man', 'Ape-Man', 'Ox-Man', 'Dog-Man', 'Satyr-Man', 'Sloth Thing', 'Bull-Man', 'Wolf-Bear', 'Mare-Rhino'];

  // Warmup 7-9 min + moseys 3 + Thang 16-20 + Mary 5-7 — always 40 min or less.
  function moreau(entries, pools, r) {
    const used = new Set();
    const take = (sec, n, filter) => {
      const cands = pools[sec].filter(x => !used.has(x.name) && (!filter || filter(x)));
      const got = weightedSample(r, cands, n);
      got.forEach(x => used.add(x.name));
      return got;
    };
    const warm = take('warmup', between(r, 6, 8));
    const fmt = pick(r, FORMATS);
    const thangPicks = [];
    const plan = fmt.build(r, (n, f) => { const g = take('thang', n, f); thangPicks.push(...g); return g; });
    const mary = take('mary', between(r, 5, 7));

    const warmMins = warm.length, maryMins = mary.length, moseyMins = 3;
    const total = warmMins + moseyMins + plan.mins + maryMins;

    const parts = [...warm, ...thangPicks, ...mary];
    const src = new Map();
    for (const x of parts) {
      const titled = x.sources.filter(i => !/^backblast$/i.test(entries[i].title));
      const i = pick(r, titled.length ? titled : x.sources);
      if (!src.has(i)) src.set(i, []);
      src.get(i).push(x.name);
    }
    return {
      mode: 'moreau',
      title: `Specimen #${String(between(r, 1, 9999)).padStart(4, '0')}: The ${pick(r, CREATURE)}`,
      format: fmt.name,
      minutes: { warmup: warmMins, mosey: moseyMins, thang: plan.mins, mary: maryMins, total },
      warmup: { items: warm.map(x => dose(x)), note: 'Circle up. Mosey a lap first to wake up the blood.' },
      thang: { note: plan.text, items: plan.items },
      mary: { items: mary.map(x => dose(x)) },
      sources: [...src].map(([i, names]) => ({ title: entries[i].title, names })),
    };
  }

  function previous(state, r) {
    const e = pick(r, state.full.length ? state.full : state.entries);
    return { mode: 'previous', title: e.title, warmup: { md: e.warmup }, thang: { md: e.thang }, mary: { md: e.mary } };
  }

  function mix(state, r) {
    const w = pick(r, state.withWarmup), t = pick(r, state.withThang), m = pick(r, state.withMary);
    return {
      mode: 'mix', title: 'Mix & Match',
      warmup: { md: w.warmup, from: w.title }, thang: { md: t.thang, from: t.title }, mary: { md: m.mary, from: m.title },
    };
  }

  function generate(state, mode, seed) {
    const r = rng(seed);
    if (mode === 'previous') return previous(state, r);
    if (mode === 'mix') return mix(state, r);
    return moreau(state.entries, state.pools, r);
  }

  function load(md) {
    const entries = parse(md);
    return {
      entries,
      pools: buildPools(entries),
      full: entries.filter(e => usable(e.warmup) && usable(e.mary)),
      withWarmup: entries.filter(e => usable(e.warmup)),
      withThang: entries.filter(e => usable(e.thang)),
      withMary: entries.filter(e => usable(e.mary)),
    };
  }

  const api = { load, generate, parse, buildPools, usable };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BeatdownGen = api;
})(this);
