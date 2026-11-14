/* Animated stick-figure demos for PAX Library glossary exercises.
   ExerciseAnim.has(termId) -> bool
   ExerciseAnim.mount(container, termId) -> stop()   (appends a looping SVG)
   Poses are keyframes: the hip position, torso angle, and where the hands and feet go.
   Elbows and knees are solved each frame (two-bone IK) so limbs keep their length. */
(function (root) {
  'use strict';

  const G = 100;                                   // ground line
  const L = { torso: 30, neck: 10, head: 7, ua: 16, fa: 16, th: 22, sh: 22 };
  const LEG = L.th + L.sh, ARM = L.ua + L.fa;
  const rad = (d) => (d * Math.PI) / 180;
  const NAVY = '#1a3a5c', FAR = '#8fb3d4', PROP = '#a8c8e8';

  // ---------- pose helpers (side view, facing right) ----------
  // Straight body (plank) with toes at x=fx on the ground and shoulders at height sy.
  function plank(fx, sy, fy) {
    fy = fy == null ? G : fy;
    const ang = Math.asin((fy - sy) / (LEG + L.torso));            // body angle above horizontal
    const hip = [fx + LEG * Math.cos(ang), fy - LEG * Math.sin(ang)];
    const sh = [hip[0] + L.torso * Math.cos(ang), hip[1] - L.torso * Math.sin(ang)];
    return { hip, t: (-ang * 180) / Math.PI, sh };
  }
  const STAND = { hip: [80, 56], t: -90, hands: [[83, 88], [79, 88]], feet: [[82, G], [78, G]] };
  const stand = (o) => Object.assign({}, STAND, o);

  // Push-up family: up and down positions built from plank().
  function pushup(hy, fx, fy, downSy) {
    const up = plank(fx, hy - ARM + 0.3, fy), dn = plank(fx, downSy, fy);
    const hx = up.sh[0] + 1, hands = [[hx, hy], [hx + 3, hy]], feet = [[fx, fy], [fx - 2, fy]];
    return {
      up: { hip: up.hip, t: up.t, hands, feet, ab: [1, 1], lb: [1, 1] },
      down: { hip: dn.hip, t: dn.t, hands, feet, ab: [1, 1], lb: [1, 1] },
    };
  }
  const P = pushup(G, 26, G, 91);

  // Lying on the back, head to the left.
  const LIE = { hip: [78, 96], t: 180, hands: [[80, 97], [79, 97]], feet: [[121, 96], [120, 97]], ab: [1, 1], lb: [-1, -1], ht: 0 };
  const lie = (o) => Object.assign({}, LIE, o);
  // Point at distance len from p in direction deg (0 = right, -90 = up).
  const at = (p, deg, len) => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))];

  // Front view (facing the viewer).
  const FSTAND = { hip: [80, 56], t: -90, hands: [[70, 86], [90, 86]], feet: [[75, G], [85, G]], ab: [1, -1], lb: [-1, 1] };
  const fstand = (o) => Object.assign({}, FSTAND, o);

  // Hand placement seen from above, drawn as a small inset next to push-up variants.
  const HANDS = {
    standard: { label: 'standard', pts: [[-11, 0], [11, 0]] },
    wide: { label: 'wide', pts: [[-20, 0], [20, 0]] },
    diamond: { label: 'diamond', pts: [[-3, 2], [3, 2]], diamond: true },
    ranger: { label: 'elbows tucked', pts: [[-9, 9], [9, 9]] },
  };

  const box = (x, y, w, h) => ({ box: [x, y, w, h] });

  // ---------- exercises ----------
  // frames: [pose, ms to move into it, ms to hold]; the loop returns to frame 0.
  const F = (p, d, h, label) => ({ p, d: d || 500, h: h || 0, label });

  const EX = {
    merkin: { view: 'side', inset: 'standard', frames: [F(P.up, 600, 250), F(P.down, 700, 150)] },
    'diamond-merkin': { view: 'side', inset: 'diamond', frames: [F(P.up, 600, 250), F(P.down, 700, 150)] },
    werkin: { view: 'side', inset: 'wide', frames: [F(P.up, 600, 250), F(P.down, 700, 150)] },
    'ranger-merkin': { view: 'side', inset: 'ranger', frames: [
      F(Object.assign({}, P.up, { hands: [[P.up.hands[0][0] - 4, G], [P.up.hands[0][0] - 1, G]] }), 600, 250),
      F(Object.assign({}, P.down, { hands: [[P.up.hands[0][0] - 4, G], [P.up.hands[0][0] - 1, G]] }), 700, 150)] },
    'hand-release-merkin': (() => {
      const flat = plank(26, 96);
      const down = { hip: flat.hip, t: flat.t, hands: P.up.hands, feet: P.up.feet, ab: [1, 1], lb: [1, 1] };
      const lift = Object.assign({}, down, { hands: [[P.up.hands[0][0] + 14, 90], [P.up.hands[0][0] + 16, 90]] });
      return { view: 'side', frames: [F(P.up, 600, 250), F(down, 800, 100), F(lift, 300, 300, 'hands off'), F(down, 300, 100)] };
    })(),
    'incline-merkin': (() => {
      const top = 78, p = pushup(top, 22, G, 68);
      return { view: 'side', props: [box(p.up.hands[0][0] - 12, top, 30, G - top)], frames: [F(p.up, 600, 250), F(p.down, 700, 150)] };
    })(),
    derkin: (() => {
      const top = 80, p = pushup(G, 30, top, 92);
      return { view: 'side', props: [box(14, top, 30, G - top)], frames: [F(p.up, 600, 250), F(p.down, 700, 150)] };
    })(),
    'carolina-dry-dock': (() => {
      const hands = [[104, G], [107, G]], feet = [[48, G], [46, G]];
      const up = { hip: [70, 61], t: 52, hands, feet, ab: [-1, -1], lb: [1, 1], ht: 15 };
      const down = { hip: [72, 64], t: 30, hands, feet, ab: [-1, -1], lb: [1, 1], ht: 40 };
      return { view: 'side', frames: [F(up, 600, 250), F(down, 700, 200, 'head toward ground')] };
    })(),
    'peter-parker': (() => {
      const knee = Object.assign({}, P.up, { feet: [[82, 86], [P.up.feet[1][0], G]], lb: [-1, 1] });
      const knee2 = Object.assign({}, P.up, { feet: [P.up.feet[0], [84, 86]], lb: [1, -1] });
      return { view: 'side', frames: [F(P.up, 400, 150), F(knee, 450, 250, 'knee to elbow'), F(P.up, 450, 150), F(knee2, 450, 250, 'other side')] };
    })(),

    'american-hammer': (() => {
      const base = { hip: [62, 98], t: -118, feet: [[97, 80], [95, 81]], lb: [-1, -1], ab: [1, 1] };
      const mid = Object.assign({}, base, { hands: [[74, 76], [76, 76]] });
      const left = Object.assign({}, base, { t: -112, hands: [[50, 99], [53, 98]] });
      const right = Object.assign({}, base, { t: -112, hands: [[72, 99], [70, 98]], ab: [-1, -1] });
      return { view: 'side', caption: 'lean back, feet off the ground', frames: [F(mid, 400, 60), F(left, 450, 150, 'touch one side'), F(mid, 400, 60), F(right, 450, 150, 'then the other')] };
    })(),
    'big-boys': (() => {
      const feet = [[104, G], [102, G]];
      const down = lie({ hip: [76, 97], hands: [[16, 98], [19, 98]], feet, lb: [-1, -1], ab: [-1, -1] });
      const up = { hip: [76, 97], t: -58, hands: [[106, 96], [104, 96]], feet, lb: [-1, -1], ab: [1, 1] };
      return { view: 'side', frames: [F(down, 700, 200), F(up, 800, 250, 'touch your feet')] };
    })(),
    'flutter-kicks': (() => {
      const a = lie({ feet: [[121, 84], [122, 91]] }), b = lie({ feet: [[122, 91], [121, 84]] });
      return { view: 'side', frames: [F(a, 260), F(b, 260)] };
    })(),
    'freddy-mercury': (() => {
      const up = { hip: [80, 96], t: -162, ht: 0, hands: [[44, 79], [46, 79]], ab: [-1, -1] };
      const a = Object.assign({}, up, { feet: [[90, 78], [122, 88]], lb: [-1, -1] });
      const b = Object.assign({}, up, { feet: [[122, 88], [90, 78]], lb: [-1, -1] });
      return { view: 'side', caption: 'shoulders off the ground', frames: [F(a, 450, 120, 'elbow to opposite knee'), F(b, 450, 120, 'switch')] };
    })(),
    'hello-dolly': (() => {
      const closed = fstand({ hands: [[70, 86], [90, 86]], feet: [[77, G], [83, G]] });
      const open = fstand({ hands: [[70, 86], [90, 86]], feet: [[58, 96], [102, 96]] });
      return { view: 'front', caption: 'seen from above: on your back, legs 6" up', frames: [F(closed, 450, 100), F(open, 450, 100)] };
    })(),
    lbc: (() => {
      const legs = { feet: [[100, 74], [99, 75]], lb: [-1, -1] };
      const down = lie(Object.assign({ hands: [[56, 88], [58, 88]], ab: [1, 1] }, legs));
      const up = Object.assign({}, down, { t: -152, hands: [[64, 74], [66, 74]] });
      return { view: 'side', frames: [F(down, 250, 80), F(up, 250, 80)] };
    })(),
    plankama: (() => {
      const tap = Object.assign({}, P.up, { hands: [[P.up.hands[0][0] - 4, 74], P.up.hands[1]], ab: [-1, 1] });
      const tap2 = Object.assign({}, P.up, { hands: [P.up.hands[0], [P.up.hands[0][0] - 2, 74]], ab: [1, -1] });
      return { view: 'side', frames: [F(P.up, 350, 250), F(tap, 350, 250, 'shoulder tap'), F(P.up, 350, 150), F(tap2, 350, 250)] };
    })(),
    protractor: (() => {
      const leg = (deg) => lie({ feet: [at([78, 96], -deg, LEG - 0.5), at([78, 96], -deg, LEG - 1)], lb: [1, 1] });
      return { view: 'side', frames: [F(leg(15), 700, 900, '15°'), F(leg(45), 700, 900, '45°'), F(leg(90), 800, 900, '90°'), F(leg(4), 900, 300)] };
    })(),
    rosalita: (() => {
      const leg = (a, b) => lie({ feet: [at([78, 96], -a, LEG - 0.5), at([78, 96], -b, LEG - 0.5)], lb: [1, 1] });
      return { view: 'side', frames: [F(leg(4, 4), 600, 200), F(leg(90, 90), 800, 250, 'legs up'),
        F(leg(80, 112), 450, 300, 'open wide'), F(leg(90, 90), 450, 250, 'together')] };
    })(),

    'air-squats': (() => {
      const down = { hip: [64, 78], t: -58, hands: [[112, 58], [110, 60]], feet: STAND.feet, ab: [1, 1], lb: [1, 1] };
      return { view: 'side', frames: [F(stand({ ab: [1, 1], lb: [1, 1] }), 650, 200), F(down, 700, 150)] };
    })(),
    'al-gore': (() => {
      const hold = { hip: [62, 76], t: -72, hands: [[112, 52], [110, 54]], feet: STAND.feet, ab: [1, 1], lb: [1, 1] };
      const hold2 = Object.assign({}, hold, { hip: [62, 77] });
      return { view: 'side', frames: [F(stand({ ab: [1, 1], lb: [1, 1] }), 600, 300), F(hold, 700, 600, 'hold it'), F(hold2, 600, 600, 'hold it'), F(hold, 600, 600, 'hold it')] };
    })(),
    'bobby-hurley': (() => {
      const sq = { hip: [64, 76], t: -50, hands: [[96, G], [92, 70]], feet: STAND.feet, ab: [1, 1], lb: [1, 1] };
      const jump = { hip: [80, 46], t: -90, hands: [[90, 74], [86, -15]], feet: [[82, 88], [78, 88]], ab: [1, 1], lb: [1, 1] };
      return { view: 'side', frames: [F(stand({ ab: [1, 1], lb: [1, 1] }), 500, 150), F(sq, 550, 150, 'touch the ground'), F(jump, 300, 120, 'explode up'), F(stand({ ab: [1, 1], lb: [1, 1] }), 300, 150)] };
    })(),
    'bonnie-blair': (() => {
      const lunge = (front, back) => ({ hip: [80, 72], t: -88, hands: [[86, 92], [76, 92]], ab: [1, 1], lb: [1, 1], feet: front === 0 ? [[96, G], [56, 99]] : [[56, 99], [96, G]] });
      const air = { hip: [80, 56], t: -90, hands: [[84, 84], [78, 84]], feet: [[86, 92], [74, 92]], ab: [1, 1], lb: [1, 1] };
      return { view: 'side', frames: [F(lunge(0), 450, 200), F(air, 280, 60, 'jump & switch'), F(lunge(1), 280, 200), F(air, 280, 60)] };
    })(),
    hillbilly: (() => {
      const head = [[76, 12], [84, 12]];
      const base = fstand({ hands: head, ab: [-1, 1] });
      const l = fstand({ hip: [80, 57], t: -97, hands: head, ab: [-1, 1], feet: [[80, 70], [85, G]], lb: [1, 1] });
      const r = fstand({ hip: [80, 57], t: -83, hands: head, ab: [-1, 1], feet: [[75, G], [80, 70]], lb: [-1, -1] });
      return { view: 'front', caption: 'hands behind head', frames: [F(base, 300, 60), F(l, 340, 160, 'knee to elbow'), F(base, 300, 60), F(r, 340, 160, 'other side')] };
    })(),
    'imperial-stormtrooper': (() => {
      const kick = { hip: [76, 56], t: -100, feet: [[118, 47], [77, G]], hands: [[62, 76], [116, 47]], ab: [1, 1], lb: [1, 1] };
      const kick2 = { hip: [76, 56], t: -100, feet: [[77, G], [118, 47]], hands: [[116, 47], [62, 76]], ab: [1, 1], lb: [1, 1] };
      return { view: 'side', frames: [F(stand({ ab: [1, 1], lb: [1, 1] }), 350, 100), F(kick, 400, 150, 'hand to toe'), F(stand({ ab: [1, 1], lb: [1, 1] }), 350, 100), F(kick2, 400, 150)] };
    })(),
    'monkey-humpers': (() => {
      const feet = [[92, G], [88, G]], hands = [[91, 95], [87, 95]];
      const down = { hip: [60, 74], t: 20, hands, feet, ab: [1, 1], lb: [1, 1], ht: -10 };
      const up = { hip: [63, 66], t: 32, hands, feet, ab: [1, 1], lb: [1, 1], ht: -10 };
      return { view: 'side', caption: 'wide stance, hold your ankles', frames: [F(down, 330, 60), F(up, 330, 60)] };
    })(),

    burpee: (() => {
      const st = stand({ ab: [1, 1], lb: [1, 1] });
      const squat = { hip: [70, 80], t: -40, hands: [[96, G], [99, G]], feet: STAND.feet, ab: [1, 1], lb: [1, 1] };
      const jump = { hip: [80, 48], t: -90, hands: [[84, -13], [81, -13]], feet: [[82, 90], [78, 90]], ab: [1, 1], lb: [1, 1] };
      return { view: 'side', frames: [F(st, 400, 150), F(squat, 400, 50, 'squat'), F(P.up, 350, 100, 'kick back'), F(P.down, 400, 100, 'push-up'),
        F(P.up, 400, 50), F(squat, 350, 50, 'feet in'), F(jump, 330, 150, 'jump!')] };
    })(),
    groiner: (() => {
      const inn = { hip: [72, 80], t: -30, hands: P.up.hands, feet: [[P.up.hands[0][0] - 10, G], [P.up.hands[0][0] - 12, G]], ab: [1, 1], lb: [1, 1] };
      return { view: 'side', caption: 'feet land wide, outside your hands', frames: [F(P.up, 350, 200), F(inn, 320, 200, 'jump in'), F(P.up, 320, 100, 'jump back')] };
    })(),
    'side-straddle-hop': (() => {
      const shut = fstand({ hip: [80, 56] });
      const open = fstand({ hip: [80, 58], hands: [[56, -2], [104, -2]], feet: [[60, G], [100, G]], ab: [-1, 1] });
      return { view: 'front', frames: [F(shut, 300, 60), F(open, 300, 60)] };
    })(),
    'smurf-jacks': (() => {
      const shut = fstand({ hip: [80, 72], feet: [[73, G], [87, G]], lb: [1, -1], hands: [[68, 92], [92, 92]] });
      const open = fstand({ hip: [80, 74], feet: [[56, G], [104, G]], lb: [1, -1], hands: [[56, 14], [104, 14]], ab: [-1, 1] });
      return { view: 'front', caption: 'stay low the whole time', frames: [F(shut, 300, 60), F(open, 300, 60)] };
    })(),
    'bear-crawl': (() => {
      const pose = (nh, fh, nf, ff) => ({ hip: [64, 72], t: -12, hands: [[nh, nh === 104 ? 96 : G], [fh, fh === 104 ? 96 : G]],
        feet: [[nf, nf === 52 ? 96 : G], [ff, ff === 52 ? 96 : G]], ab: [-1, -1], lb: [1, 1] });
      const a = pose(104, 94, 40, 52), b = pose(94, 104, 52, 40);
      return { view: 'side', caption: 'knees just off the ground', frames: [F(a, 380, 40), F(b, 380, 40)] };
    })(),
  };

  // ---------- solving a pose into joint positions ----------
  function ik(A, T, l1, l2, s) {
    const dx = T[0] - A[0], dy = T[1] - A[1];
    const d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(Math.hypot(dx, dy) || 0.01, l1 + l2 - 0.01));
    const c = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
    const a = Math.atan2(dy, dx) + s * Math.acos(c);
    const J = [A[0] + l1 * Math.cos(a), A[1] + l1 * Math.sin(a)];
    const b = Math.atan2(T[1] - J[1], T[0] - J[0]);
    return [J, [J[0] + l2 * Math.cos(b), J[1] + l2 * Math.sin(b)]];
  }

  function solve(p, view) {
    const ab = p.ab || [1, 1], lb = p.lb || [1, 1];
    const tr = rad(p.t), neck = [p.hip[0] + L.torso * Math.cos(tr), p.hip[1] + L.torso * Math.sin(tr)];
    const hr = rad(p.t + (p.ht || 0)), head = [neck[0] + L.neck * Math.cos(hr), neck[1] + L.neck * Math.sin(hr)];
    let sh = [neck, neck], hp = [p.hip, p.hip];
    if (view === 'front') {
      const px = Math.cos(tr + Math.PI / 2), py = Math.sin(tr + Math.PI / 2);   // across the body
      sh = [[neck[0] + 9 * px, neck[1] + 9 * py], [neck[0] - 9 * px, neck[1] - 9 * py]];
      hp = [[p.hip[0] + 5 * px, p.hip[1] + 5 * py], [p.hip[0] - 5 * px, p.hip[1] - 5 * py]];
      if (sh[0][0] > sh[1][0]) { sh.reverse(); hp.reverse(); }             // index 0 is screen-left
    }
    const arms = [0, 1].map((i) => [sh[i], ...ik(sh[i], p.hands[i], L.ua, L.fa, ab[i])]);
    const legs = [0, 1].map((i) => [hp[i], ...ik(hp[i], p.feet[i], L.th, L.sh, lb[i])]);
    return { neck, head, hip: p.hip, sh, hp, arms, legs };
  }

  // ---------- interpolation ----------
  const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);
  function lerp(a, b, k) {
    if (typeof a === 'number') return a + (b - a) * k;
    if (Array.isArray(a)) return a.map((v, i) => lerp(v, b[i], k));
    return a;
  }
  function blend(a, b, k) {
    const out = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = a[key] != null ? a[key] : defaults[key], vb = b[key] != null ? b[key] : defaults[key];
      out[key] = lerp(va, vb, k);
    }
    return out;
  }
  const defaults = { ab: [1, 1], lb: [1, 1], ht: 0 };

  // ---------- drawing ----------
  const NS = 'http://www.w3.org/2000/svg';
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const line = (n, a, b) => { n.setAttribute('x1', a[0].toFixed(1)); n.setAttribute('y1', a[1].toFixed(1)); n.setAttribute('x2', b[0].toFixed(1)); n.setAttribute('y2', b[1].toFixed(1)); };
  const poly = (n, pts) => n.setAttribute('points', pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));

  function build(svg, def) {
    el('line', { x1: 4, y1: G + 2.5, x2: 156, y2: G + 2.5, stroke: PROP, 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
    (def.props || []).forEach((pr) => {
      const [x, y, w, h] = pr.box;
      el('rect', { x, y: y + 2.5, width: w, height: h, rx: 2, fill: '#e8f4f8', stroke: PROP, 'stroke-width': 2 }, svg);
    });
    const side = def.view === 'side';
    const limb = (color) => el('polyline', { fill: 'none', stroke: color, 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
    const parts = {
      farArm: limb(side ? FAR : NAVY), farLeg: limb(side ? FAR : NAVY),
      torso: el('line', { stroke: NAVY, 'stroke-width': 5, 'stroke-linecap': 'round' }, svg),
      bar: el('polyline', { fill: 'none', stroke: NAVY, 'stroke-width': 4.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg),
      hipBar: el('line', { stroke: NAVY, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, svg),
      nearLeg: limb(NAVY), nearArm: limb(NAVY),
      head: el('circle', { r: L.head, fill: NAVY }, svg),
      label: el('text', { x: 156, y: -6, 'text-anchor': 'end', 'font-size': 10, 'font-weight': 700, fill: '#d96c3b', 'font-family': 'Inter, system-ui, sans-serif' }, svg),
    };
    if (def.caption) el('text', { x: 80, y: 112, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#5b8db8', 'font-family': 'Inter, system-ui, sans-serif' }, svg).textContent = def.caption;
    if (side) { parts.bar.style.display = 'none'; parts.hipBar.style.display = 'none'; }
    if (def.inset) {
      const h = HANDS[def.inset], g = el('g', { transform: 'translate(24 8)' }, svg);
      el('rect', { x: -22, y: -16, width: 44, height: 36, rx: 6, fill: '#ffffff', stroke: PROP, 'stroke-width': 1 }, g);
      el('line', { x1: -12, y1: -4, x2: 12, y2: -4, stroke: NAVY, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);   // shoulders from above
      el('circle', { cx: 0, cy: -9, r: 3.5, fill: NAVY }, g);
      h.pts.forEach(([x, y]) => el('ellipse', { cx: x * 0.85, cy: y * 0.8 + 3, rx: 2.6, ry: 3.4, fill: '#d96c3b' }, g));
      if (h.diamond) el('polygon', { points: '-2.5,4 0,1 2.5,4 0,7', fill: 'none', stroke: '#d96c3b', 'stroke-width': 1 }, g);
      const t = el('text', { x: 0, y: 30, 'text-anchor': 'middle', 'font-size': 7, fill: '#5b8db8', 'font-family': 'Inter, system-ui, sans-serif' }, g);
      t.textContent = h.label;
    }
    return parts;
  }

  function draw(parts, s, view) {
    const near = 0, far = 1;
    poly(parts.nearArm, s.arms[near]); poly(parts.farArm, s.arms[far]);
    poly(parts.nearLeg, s.legs[near]); poly(parts.farLeg, s.legs[far]);
    line(parts.torso, s.hip, s.neck);
    if (view === 'front') { poly(parts.bar, [s.sh[0], s.sh[1]]); line(parts.hipBar, s.hp[0], s.hp[1]); }
    parts.head.setAttribute('cx', s.head[0].toFixed(1)); parts.head.setAttribute('cy', s.head[1].toFixed(1));
  }

  function mount(container, term) {
    const def = EX[term];
    if (!def) return () => {};
    const svg = el('svg', { viewBox: '0 -18 160 132', class: 'ex-anim', role: 'img', 'aria-label': 'Animated demo' });
    container.appendChild(svg);
    const parts = build(svg, def);
    const frames = def.frames, total = frames.reduce((t, f) => t + f.d + f.h, 0);
    const still = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, t0 = performance.now(), stopped = false;
    function at(ms) {
      ms %= total;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i], prev = frames[(i - 1 + frames.length) % frames.length];
        if (ms < f.d) return { pose: blend(prev.p, f.p, ease(ms / f.d)), label: f.label && ms > f.d * 0.6 ? f.label : (prev.label && ms < f.d * 0.3 ? prev.label : '') };
        ms -= f.d;
        if (ms < f.h) return { pose: f.p, label: f.label || '' };
        ms -= f.h;
      }
      return { pose: frames[0].p, label: '' };
    }
    function tick(now) {
      if (stopped) return;
      const { pose, label } = at(now - t0);
      draw(parts, solve(pose, def.view), def.view);
      if (parts.label.textContent !== label) parts.label.textContent = label;
      if (!still) raf = requestAnimationFrame(tick);
    }
    tick(t0 + (still ? frames[0].d : 0));
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }

  // A single keyframe, drawn still (used for previews and tests).
  function frame(container, term, i) {
    const def = EX[term], f = def.frames[i];
    const svg = el('svg', { viewBox: '0 -18 160 132', class: 'ex-anim' });
    container.appendChild(svg);
    const parts = build(svg, def);
    draw(parts, solve(f.p, def.view), def.view);
    parts.label.textContent = f.label || '';
    return svg;
  }

  const api = { has: (term) => !!EX[term], mount, frame, terms: Object.keys(EX), _solve: solve, _defs: EX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ExerciseAnim = api;
})(typeof window !== 'undefined' ? window : globalThis);
