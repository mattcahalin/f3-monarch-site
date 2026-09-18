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
    md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');   // Slack escapes these
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

  // Thang formats. Each fills the minutes it is given (never more) and returns
  // its plan text, the exercises it used, and a few names that fit it.
  const reps = x => x.unit === 'reps' || x.unit === 'ic';
  const FORMATS = [
    { name: 'AMRAP', build(r, ex, budget) {
        const mins = budget, picks = ex(5);
        return { mins, picks, text: `AMRAP ${mins} minutes — as many rounds as possible. Mosey 50 yds between rounds.`,
          items: picks.map(x => dose(x)),
          names: [(a, b, m) => `The ${a} ${m} That Would Not Die`, (a) => `The Undying ${a}-Hound`, (a, b) => `The Tireless ${a}-${b} Brute`] };
      } },
    { name: 'Dora 1-2-3', build(r, ex, budget) {
        const mins = budget, picks = ex(3, reps);
        return { mins, picks, text: `Dora 1-2-3 (${mins} min cap). Partner up: P1 works while P2 runs 75 yds and back, then flapjack. Chip away at the team totals.`,
          items: picks.map((x, i) => `${[100, 200, 300][i]} ${x.name}`),
          names: [(a, b) => `The Two-Headed ${a}-${b} Beast`, (a, b, m) => `The 600-Rep ${a} ${m}`, (a) => `The Conjoined ${a} Twins`] };
      } },
    { name: '11s', build(r, ex, budget) {
        const mins = budget, picks = ex(2, x => x.unit === 'reps');
        return { mins, picks, text: `11s (${mins} min cap). Two cones ~40 yds apart. 10 of the first at cone A, 1 of the second at cone B, then 9 and 2, and so on down to 1 and 10. Mosey between cones. Finish early? Swap the cones and go again.`,
          items: [`Cone A: ${picks[0].name}`, `Cone B: ${picks[1].name}`],
          names: [(a, b) => `Half-${a}, Half-${b}`, (a, b, m) => `The Eleven-Legged ${a} ${m}`, (a, b) => `The ${a}-${b} Centipede`] };
      } },
    { name: 'EMOM', build(r, ex, budget) {
        const mins = budget, picks = ex(between(r, 4, 6), x => x.unit !== 'yds');
        return { mins, picks, text: `EMOM ${mins} — every minute on the minute, do the next exercise on the list, cycling back to the top until time is up. Rest whatever is left of the minute.`,
          items: picks.map(x => dose(x, 0.8)),
          names: [(a, b, m) => `The Clockwork ${a} ${m}`, (a) => `The ${a}-Croc That Swallowed the Clock`, (a, b) => `The Tick-Tock ${a}-${b} Mutant`] };
      } },
    { name: 'Four Corners', build(r, ex, budget) {
        const mins = budget, picks = ex(4, reps);
        return { mins, picks, text: `Four Corners (${mins} min cap). Mark a square ~40 yds per side. Run to each corner, do its exercise and every exercise from the corners before it. Travel between corners changes each lap: bear crawl, lunge walk, sprint, karaoke.`,
          items: picks.map((x, i) => `Corner ${i + 1}: ${dose(x)}`),
          names: [(a, b) => `The Four-Legged ${a}-${b} Thing`, (a, b, m) => `The Caged ${a} ${m}`, (a) => `The ${a}-Beast of the Four Pens`] };
      } },
    { name: 'Tabata', build(r, ex, budget) {
        // 4 min per exercise; the breather between exercises stretches (30-90 sec) to fill the time.
        const n = Math.max(2, Math.floor((budget * 60 + 30) / 270));
        const picks = ex(n, reps), k = picks.length;
        const rest = Math.max(30, Math.min(90, Math.floor(((budget - 4 * k) * 60) / (k - 1) / 15) * 15));
        const mins = Math.round(4 * k + ((k - 1) * rest) / 60);
        return { mins, picks, text: `Tabata — 4 minutes per exercise: 8 rounds of 20 sec all-out, 10 sec rest. ${rest}-second breather between exercises.`,
          items: picks.map(x => x.name),
          names: [(a, b, m) => `The Frenzied ${a} ${m}`, (a) => `The Rabid ${a}-Jackal`, (a, b) => `The ${a}-${b} Berserker`] };
      } },
    { name: 'Stations', build(r, ex, budget) {
        const laps = 4, work = Math.max(45, Math.min(90, Math.floor(((budget * 60) / laps / 5 - 15) / 5) * 5));
        const picks = ex(5), mins = Math.floor((laps * 5 * (work + 15)) / 60);
        return { mins, picks, text: `String of Pearls — 5 stations in a loop. ${laps} laps, ${work} sec work at each station, mosey to the next.`,
          items: picks.map((x, i) => `Station ${i + 1}: ${x.unit === 'yds' ? dose(x) : `${x.name} (${work} sec)`}`),
          names: [(a, b) => `The Five-Headed ${a} Hydra`, (a, b, m) => `The ${a}-${b} ${m} of Many Parts`, (a) => `The Stitched-Together ${a} Serpent`] };
      } },
  ];

  // No named format: a string of moves the way most real Thangs are written.
  const PLACES = ['the pavilion', 'the far cones', 'the parking lot lights', 'the bottom of the hill', 'the playground', 'the benches', 'the flagpole', 'the ball field'];
  const FREESTYLE = { name: 'Freestyle', build(r, ex, budget) {
    const lines = [], picks = [];
    const grab = (n, f) => { const g = ex(n, f); picks.push(...g); return g; };
    const notTravel = x => x.unit !== 'yds';
    const travel = () => { const t = grab(1, x => x.unit === 'yds')[0]; return t ? `, ${dose(t)} on the way` : ''; };
    let left = budget - 1;                                   // save a minute for the mosey back
    lines.push(`Mosey to ${pick(r, PLACES)}${travel()}.`); left -= 2;
    const blocks = [
      () => {                                                // rounds of a few exercises (~1 min each)
        const k = between(r, 3, 4), rounds = Math.min(between(r, 2, 4), Math.floor((left - 1) / k));
        if (rounds < 1) return 0;
        lines.push(`${rounds === 1 ? 'Once through' : rounds + ' rounds'}: ${grab(k, notTravel).map(x => dose(x)).join(', ')}.`);
        return rounds * k + 1;
      },
      () => {                                                // run a lap with stops
        const [x] = grab(1, x => x.unit === 'reps');
        if (!x || left < 5) return 0;
        lines.push(`Run a lap; every 50 yds stop for 5 ${x.name}.`);
        return 5;
      },
      () => {                                                // partner work
        const [a, b] = grab(2, notTravel), mins = Math.min(between(r, 4, 6), left);
        if (!b || mins < 4) return 0;
        lines.push(`Partner up for ${mins} min: P1 does ${a.name} while P2 does ${b.name}; flapjack at the whistle.`);
        return mins;
      },
      () => {                                                // move to a new spot (never twice in a row)
        if (/^Mosey/.test(lines[lines.length - 1])) return 0;
        lines.push(`Mosey to ${pick(r, PLACES)}${travel()}.`);
        return 2;
      },
    ];
    for (let tries = 0; left >= 4 && tries < 12; tries++) left -= pick(r, blocks)();
    if (left >= 2) {                                         // burn off whatever time is left
      const [x] = grab(1, notTravel);
      if (x) { lines.push(`Burnout: ${left} min of ${x.name}, OYO.`); left = 0; }
    }
    lines.push(left === 1 ? 'Long mosey back to the flag.' : 'Mosey back to the flag.');
    if (left === 1) left = 0;
    return { mins: budget - Math.max(0, left), picks, text: 'No set format: work through these in order.', items: lines,
      names: [(a, b) => `The Stray ${a}-${b} Mongrel`, (a, b, m) => `The Untamed ${a} ${m}`, (a) => `The Feral ${a}-Beast`] };
  } };

  // The Thang is a beast spliced together from its exercises, Dr. Moreau style.
  const MONSTERS = ['Behemoth', 'Chimera', 'Hydra', 'Manticore', 'Minotaur', 'Gorgon', 'Wendigo', 'Leviathan', 'Kraken', 'Abomination', 'Brute', 'Mutant'];
  const ANIMALS = ['Hyena', 'Swine', 'Leopard', 'Ape', 'Ox', 'Wolf', 'Bear', 'Boar', 'Jackal', 'Rhino', 'Puma', 'Bull', 'Sloth', 'Badger', 'Gorilla'];
  // (a, b) are the two exercises, m a monster, z an animal.
  const BEAST_NAMES = [
    (a, b, m, z) => `The ${a}-${z}`,
    (a) => `The Were-${a}`,
    (a, b, m) => `The ${a} ${m}`,
    (a, b, m, z) => `The ${a}-${b} ${z}-Man`,
    (a, b, m) => `The ${a} ${m} of Moreau's Island`,
    (a, b, m, z) => `The ${z}-Headed ${a}`,
  ];
  // Word mash-ups only read right on one-word names ("Burpeesaurus", not "Bent Over Rowsaurus").
  const MASHUPS = [(a) => `${a}${/[aeiou]$/i.test(a) ? 's' : 'as'}aurus`, (a) => `The ${a}taur`];

  // "Hand Release Merkins" -> "Hand Release Merkin", "Freddie Mercurys" -> "Freddie Mercury"
  const singular = name => name.replace(/^Coupon /, '').replace(/\s*\(.*\)$/, '').replace(/(\w+)$/, w =>
    /ies$/i.test(w) ? w.slice(0, -3) + 'y' : /(sh|ch|x)es$/i.test(w) ? w.slice(0, -2) : /[^s]s$/i.test(w) ? w.slice(0, -1) : w);

  function thangName(r, plan) {
    const [x, y] = plan.picks.length > 1 ? [...plan.picks].sort(() => r() - 0.5) : [plan.picks[0], plan.picks[0]];
    const a = singular(x.name), b = singular(y.name);
    const pool = [...plan.names, ...plan.names, ...BEAST_NAMES, ...(/[\s-]/.test(a) ? [] : MASHUPS)];
    return pick(r, pool)(a, b, pick(r, MONSTERS), pick(r, ANIMALS));
  }

  const CREATURE = ['Hyena-Swine', 'Leopard-Man', 'Ape-Man', 'Ox-Man', 'Dog-Man', 'Satyr-Man', 'Sloth Thing', 'Bull-Man', 'Wolf-Bear', 'Mare-Rhino'];

  // Warmup 6-8 min + Mary 5-7; the Thang gets the rest so the total lands at 38-40.
  function moreau(entries, pools, r) {
    const used = new Set();
    const take = (sec, n, filter) => {
      const cands = pools[sec].filter(x => !used.has(x.name) && (!filter || filter(x)));
      const got = weightedSample(r, cands, n);
      got.forEach(x => used.add(x.name));
      return got;
    };
    const warm = take('warmup', between(r, 6, 8));
    const mary = take('mary', between(r, 5, 7));
    const warmMins = warm.length, maryMins = mary.length;
    // Most real Thangs follow no named format, so Freestyle gets about 30%; the 7 formats share the rest.
    const fmt = r() < 0.3 ? FREESTYLE : pick(r, FORMATS);
    const plan = fmt.build(r, (n, f) => take('thang', n, f), between(r, 38, 40) - warmMins - maryMins);
    const total = warmMins + plan.mins + maryMins;

    const parts = [...warm, ...plan.picks, ...mary];
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
      minutes: { warmup: warmMins, thang: plan.mins, mary: maryMins, total },
      warmup: { items: warm.map(x => dose(x)), note: 'Circle up.' },
      thang: { name: thangName(r, plan), note: plan.text, items: plan.items },
      mary: { items: mary.map(x => dose(x)) },
      sources: [...src].map(([i, names]) => ({ title: entries[i].title, names })),
    };
  }

  // ---------- Time estimates for written-out sections ----------
  // Rough seconds for one written item: a set of reps, a hold, a run, or a lap.
  const SLOW_REPS = /burpee|blockee|man ?maker|thruster|squat thrust|star jump|box jump|broad jump|pull[- ]?up|murder bunn/i;
  function itemSeconds(item, kind) {
    const s = item.toLowerCase();
    let m;
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:mi|miles?)\b/))) return +m[1] * 600;
    if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:-\s*)?(?:min|mins|minutes?)\b/))) return Math.min(+m[1], 30) * 60;
    if ((m = s.match(/(\d+)\s*(?:-\s*)?(?:s|sec|secs|seconds?)\b/))) return Math.min(+m[1], 300);
    if ((m = s.match(/(\d+)\s*(?:-\s*)?(?:yds?|yards?|m|meters?)\b/))) return Math.min(+m[1], 1600) * 0.35;
    if ((m = s.match(/(\d+)?\s*laps?\b/))) return (+(m[1] || 1)) * 90;
    if (/\bmosey|\bjog\b|\brun\b|\bsprint/.test(s) && !/\d/.test(s)) return 90;
    if ((m = s.match(/(?:x\s*)?(\d{1,3})(?!\d)/))) {
      const n = Math.min(+m[1], 300);
      const per = /\bic\b|in cadence/.test(s) ? 3 : SLOW_REPS.test(s) ? 4.5 : 2.5;
      return Math.max(20, n * per);
    }
    return { warmup: 40, thang: 50, mary: 50 }[kind];
  }

  // "3 rounds", "x3 rounds", "repeat 2x", "rinse and repeat"
  function roundsIn(text) {
    const s = text.toLowerCase();
    let m = s.match(/(\d+)\s*(?:x\s*)?(?:rounds?|sets?|times)\b/) || s.match(/\b(?:rounds?|sets?)\s*(?:x|of)?\s*(\d+)\b/) || s.match(/repeat(?:ed)?\s*(?:x\s*)?(\d+)/);
    if (m) return Math.min(+m[1], 10);
    return /rinse (?:and|&) repeat|repeat/.test(s) ? 2 : 1;
  }

  // A stated time block like "AMRAP 20", "EMOM 12 min", "20 minute cap".
  function statedMinutes(text) {
    const re = /\b(?:amrap|emom|tabata|time cap|cap(?:ped)?(?: at)?|for)\s*(?:of\s*)?(\d{1,2})\s*(?:min|mins|minutes)?\b|\b(\d{1,2})\s*(?:-\s*)?(?:min|mins|minute)s?\s*(?:amrap|emom|cap|of|block|round)/gi;
    let total = 0, m;
    while ((m = re.exec(text))) total += +(m[1] || m[2]);
    return total;
  }

  // Each written item also costs time to explain, demo, count off, and move on.
  const OVERHEAD = { warmup: 25, thang: 25, mary: 20 };
  const LIMITS = { warmup: [4, 12], thang: [12, 45], mary: [3, 12] };
  const TYPICAL_THANG = 30;

  function estimateMinutes(md, kind) {
    if (!md) return 0;
    const [lo, hi] = LIMITS[kind];
    let secs = 0, carry = 1, measured = 0;
    for (const block of md.split(/\n\s*\n/)) {
      const lines = block.split('\n').map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()).filter(Boolean);
      const items = lines.flatMap(l => (/\d/.test(l) && !/,\s*\d/.test(l) ? [l] : l.split(/\s*[,;]\s*/)))
        .filter(x => /[a-z]/i.test(x) && x.split(/\s+/).length <= 14);   // long sentences are story, not items
      const mult = roundsIn(block);
      // A lone "3 rounds of:" line sets the count for the list that follows it.
      if (items.length <= 1 && mult > 1 && lines.join(' ').length < 40) { carry = mult; continue; }
      measured += items.filter(it => /\d/.test(it)).length;
      secs += items.reduce((t, it) => t + Math.max(itemSeconds(it, kind), 25) + OVERHEAD[kind], 0) * Math.max(mult, carry);
      carry = 1;
    }
    let mins = secs / 60 + (kind === 'thang' ? 0 : 1);         // circling up / getting set
    if (kind === 'thang') {
      const stated = statedMinutes(md);
      if (stated >= 8) mins = stated + 3;                    // "AMRAP 20" plus setup and moseys
      else if (measured >= 4) mins = mins + 4;               // a real list: add setup and moseys
      else mins = TYPICAL_THANG;                             // written as a story: assume a normal Thang
    }
    return Math.round(Math.max(lo, Math.min(hi, mins)));
  }

  function withMinutes(w) {
    const mins = { warmup: estimateMinutes(w.warmup.md, 'warmup'), thang: estimateMinutes(w.thang.md, 'thang'), mary: estimateMinutes(w.mary.md, 'mary') };
    w.minutes = { ...mins, total: mins.warmup + mins.thang + mins.mary, estimated: true };
    return w;
  }

  function previous(state, r) {
    const e = pick(r, state.full.length ? state.full : state.entries);
    return withMinutes({ mode: 'previous', title: e.title, warmup: { md: e.warmup }, thang: { md: e.thang }, mary: { md: e.mary } });
  }

  // ---------- Mix & Match Thang names ----------
  const titleWords = t => t.replace(/&amp;/g, '&').replace(/(?<!\w):[a-z0-9_+-]+:(?!\w)/g, ' ')
    .replace(/[^\p{L}\p{N}'’&\- ]+/gu, ' ').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w));
  const realTitle = t => !/^(?:backblast|beatdown)$/i.test(t.trim()) && titleWords(t).length > 0;

  // A name can join on "Enjoying the | Gloom", but a half can't end on "did not" or start on "the".
  const JOINERS = /^(?:the|a|an|of|in|on|at|for|with|to|over|under|and|&|from|into|by)$/i;
  const FILLER = /^(?:the|a|an|of|in|on|at|for|with|to|and|or|but|&|is|was|are|it|it's|it’s|its|not|did|do|does|doesn't|doesn’t|be|we|you|your|our|my|that|this|as|by|from|get|got|lets|let's|let’s|who|what|so)$/i;

  function headOf(title) {
    const w = titleWords(title).slice(0, 6);
    const h = w.slice(0, Math.min(3, Math.max(1, Math.ceil(w.length / 2))));
    while (h.length > 1 && FILLER.test(h[h.length - 1]) && !JOINERS.test(h[h.length - 1])) h.pop();
    return h;
  }
  function tailOf(title) {
    const w = titleWords(title).slice(-6);
    let t = w.slice(-Math.min(3, Math.max(1, Math.floor(w.length / 2))));
    while (t.length > 1 && FILLER.test(t[0])) t = t.slice(1);
    return t.some(x => /\p{L}/u.test(x)) && !FILLER.test(t[0]) ? t : [];
  }
  const joinWords = words => words.filter((x, i) => i === 0 || x.toLowerCase() !== words[i - 1].toLowerCase()).join(' ');

  // Front of one title + back of another: "Turkey Hunt" + "Friday Eve Grind" -> "Turkey Eve Grind".
  function mashTitles(a, b) {
    const head = headOf(a), tail = tailOf(b);
    const name = joinWords([...head, ...(tail.length ? tail : titleWords(b).slice(-1))]);
    const same = s => s.trim().toLowerCase() === name.toLowerCase();
    return same(a) || same(b) ? `${a.trim()} Meets ${b.trim()}` : name;
  }

  const BLENDER_NAMES = [
    (a, b) => `The ${a} Gauntlet`, (a, b) => `${a} & ${b} Showdown`, (a) => `Operation ${a}`, (a) => `The ${a} Grinder`,
    (a) => `${a} Madness`, (a) => `Return of the ${a}`, (a, b) => `The ${a}-${b} Express`, (a, b) => `${a}-${b} Smoothie`,
  ];
  const BLENDER_FALLBACK = ['The Blender Special', 'Smoothie of Suffering', 'Leftover Stew', 'The Kitchen Sink'];

  const thangExercises = text => VOCAB.thang.filter(([, re]) => new RegExp(re.source, 'i').test(text)).map(([name]) => singular(name));

  // Made up from the exercises when the source beatdowns had no real titles.
  function exerciseTitle(r, text) {
    const found = thangExercises(text);
    if (!found.length) return pick(r, BLENDER_FALLBACK);
    const [a, b] = [pick(r, found), pick(r, found)];
    return pick(r, a === b ? BLENDER_NAMES.filter(f => f.length < 2) : BLENDER_NAMES)(a, b);
  }

  function mixName(r, t, w, m) {
    const titles = [t.title, w.title, m.title].filter(realTitle);
    if (titles.length >= 2) {
      const [a, b] = t.title === titles[0] && r() < 0.5 ? [titles[0], pick(r, titles.slice(1))] : [pick(r, titles.slice(1)), titles[0]];
      return mashTitles(a, b);
    }
    const found = thangExercises(t.thang);
    if (titles.length === 1 && found.length) return joinWords([...headOf(titles[0]), pick(r, found)]);
    return exerciseTitle(r, t.thang);
  }

  function mix(state, r) {
    const w = pick(r, state.withWarmup), t = pick(r, state.withThang), m = pick(r, state.withMary);
    return withMinutes({
      mode: 'mix', title: 'Mix & Match',
      warmup: { md: w.warmup, from: w.title },
      thang: { name: mixName(r, t, w, m), md: t.thang, from: t.title },
      mary: { md: m.mary, from: m.title },
    });
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

  const api = { load, generate, parse, buildPools, usable, estimateMinutes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BeatdownGen = api;
})(this);
