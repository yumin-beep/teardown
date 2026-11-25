// The character of the practice step: one animal per city, the kind that has been found with plastic in it in that city's own waters.
// FRIENDS has the source for each. It hops and smiles on a right first try and droops on a wrong one.
// Drawn like the bins and the street (glowing facets, edge lines), each in its own natural colours.
import * as THREE from 'three';

const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const out3 = x => 1 - (1 - x) ** 3;
const bump = x => Math.sin(Math.PI * clamp01(x));

// Why each animal stands there. The quotes are word for word from the source named; data/SOURCES.md has the dates.
export const FRIENDS = {
  seoul: { kind: 'turtle', name: 'sea turtle', where: "Korea's coast", by: 'KIOST, reported by The Better Future, 2022', lang: 'ko',
    quote: '국내 연안에서 발견된 바다거북 폐사체 34마리 중 28마리(약 82.3%)에서 총 1280개(118g) 플라스틱 쓰레기가 발견됐다.', en: "Of 34 dead sea turtles found on Korea's coasts, 28 (about 82.3 %) held 1,280 pieces (118 g) of plastic waste.", url: 'https://futurechosun.com/archives/66145' },
  tokyo: { kind: 'anchovy', name: 'Tokyo Bay anchovy', where: 'Tokyo Bay', by: 'Tanaka & Takada 2016, Scientific Reports', lang: 'en',
    quote: 'Plastic was detected in 49 out of 64 fish (77%), with 2.3 pieces on average and up to 15 pieces per individual.', url: 'https://doi.org/10.1038/srep34351' },
  sf: { kind: 'bayfish', name: 'Bay fish', where: 'San Francisco Bay', by: 'San Francisco Estuary Institute, 2021', lang: 'en',
    quote: 'We found microplastics and other anthropogenic microdebris ("microdebris") in all sample types.', en: 'Fish were one of the sample types; fibres were the commonest kind in them.', url: 'https://sfei.org/node/7688' },
  berlin: { kind: 'fulmar', name: 'North Sea fulmar', where: "Germany's North Sea coast", by: 'Umweltbundesamt, 2025', lang: 'de',
    quote: 'Im aktuellen 5-Jahres-Zeitraum (2019–2023) hatten 89 % der 93 untersuchten Eissturmvögel in Deutschland Plastik im Magen', en: 'In 2019–2023, 89 % of the 93 fulmars examined in Germany had plastic in their stomachs.', url: 'https://www.umweltbundesamt.de/indikator-plastikmuell-in-der-nordsee' },
};

// Drawn the way the bins and the street are: a dim, slightly see-through fill that glows in its own colour, flat facets, and the edges as lines.
const mat = (color, o = {}) => { const c = new THREE.Color(color), { line = 0.7, fill = 0.9, ...rest } = o; const m = new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.42), emissive: c, emissiveIntensity: 0.3, roughness: 0.6, metalness: 0, flatShading: true, transparent: true, opacity: fill, ...rest }); if (line) m.userData.line = new THREE.LineBasicMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.25), transparent: true, opacity: line }); return m; };
const flat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const put = (parent, geo, m, p, r, s) => { const mesh = new THREE.Mesh(geo, m); if (m.userData.line) mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 12), m.userData.line)); if (p) mesh.position.set(p[0], p[1], p[2]); if (r) mesh.rotation.set(r[0], r[1], r[2]); if (s) mesh.scale.set(s[0], s[1], s[2]); parent.add(mesh); return mesh; };
const ball = (r, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h);
const INK = flat(0x0b2236);

// A face kept as plain as the rest of the page: two small dark facets for eyes, nothing else.
// Glad narrows them, worry lets them sink a little; the body does the rest. Positions are given in head radii.
function makeFace(head, R, { ex = 0.36, ey = 0.04, es = 1 } = {}) {
  const eyes = [-1, 1].map(sd => {
    const rr = R + 0.002, x = sd * ex * R, y = ey * R, z = Math.sqrt(Math.max(0, rr * rr - x * x - y * y));
    const e = new THREE.Mesh(new THREE.OctahedronGeometry(0.17 * R * es, 0), INK); e.position.set(x, y, z); e.rotation.y = Math.atan2(x, z); head.add(e); return e;
  });
  let mood = 'calm';
  return {
    set(m) { mood = m; for (const e of eyes) e.position.y = (ey - (m === 'worry' ? 0.07 : 0)) * R; },
    blink(t) { const shut = (t % 3.4) < 0.11; for (const e of eyes) e.scale.set(1, shut ? 0.12 : mood === 'glad' ? 0.45 : 1.15, 0.5); },
    get mood() { return mood; },
  };
}

// one action at a time: a new one takes over from whatever was still playing
function player(tween, reset) {
  let act = null;
  return (dur, fn, done) => { if (act) act.dead = true; const me = act = { dead: false }; reset(); tween(dur, k => { if (!me.dead) fn(k); }, () => { if (!me.dead && done) done(); }); };
}
// a hop with a crouch before it and a soft landing after: returns [height, squash] for k in 0..1
const hopArc = (k, h) => { const up = bump((k - 0.16) / 0.52); return [up * h, k < 0.16 ? -bump(k / 0.16) * 0.1 : k > 0.68 ? -bump((k - 0.68) / 0.22) * 0.08 : up * 0.06]; };

// ---------- the animals: small, round, and glad when the part lands where the city asks
// a fish seen from the side, leaping nose-up: long body, forked tail, back fin.
// The two bay fish differ in build and colour.
function fish(root, c1, c2, c3, [sx, sy, sz]) {
  const BACK = mat(c1, { emissiveIntensity: 0.45, line: 0.3, fill: 0.97 }), PALE = mat(c2, { emissiveIntensity: 0.35, line: 0 }), FIN = mat(c3, { emissiveIntensity: 0.45 });
  const body = new THREE.Group(); body.position.y = 0.26; body.scale.setScalar(0.7); root.add(body);
  const r = 0.17, L = r * sx, H = r * sy, W = r * sz;
  put(body, ball(r, 12, 8), BACK, null, null, [sx, sy, sz]);
  put(body, ball(r, 12, 8), PALE, [0.01, -H * 0.3, 0], null, [sx * 0.86, sy * 0.72, sz * 1.04]);
  put(body, new THREE.ConeGeometry(H * 0.5, H * 0.9, 4), FIN, [-L * 0.05, H * 1.05, 0], [0, 0, 0.5], [1.5, 1, 0.2]);                    // back fin
  const tail = new THREE.Group(); tail.position.set(-L * 0.9, 0, 0); body.add(tail);
  for (const sd of [-1, 1]) put(tail, new THREE.ConeGeometry(H * 0.5, L * 0.6, 4), FIN, [-L * 0.2, sd * H * 0.42, 0], [0, 0, -Math.PI / 2 - sd * 0.6], [1, 1, 0.2]);
  const fins = [-1, 1].map(sd => { const f = new THREE.Group(); f.position.set(L * 0.25, -H * 0.3, sd * W * 0.85); body.add(f); put(f, new THREE.ConeGeometry(H * 0.3, H * 0.8, 4), FIN, [-H * 0.3, -H * 0.2, 0], [0, 0, -1.1], [1, 1, 0.2]); return { f, sd }; });
  const hx = 0.6, head = new THREE.Group(); head.position.set(L * hx, H * 0.12, 0); head.rotation.y = Math.PI / 2; body.add(head);
  return { head, R: W * Math.sqrt(1 - hx * hx), face: { ex: 0.96, ey: 0, es: 1.5 }, top: 0.62, move(t, S) { fins.forEach(({ f, sd }) => f.rotation.x = sd * (0.3 + S.flap * (0.7 + 0.4 * Math.sin(t * 16)) - S.slump * 0.2)); tail.rotation.y = Math.sin(t * (3 + S.joy * 9)) * (0.3 + S.joy * 0.3); body.rotation.z = 0.5 - S.slump * 0.8 + Math.sin(t * 2.2) * 0.05; } };
}
const BUILD = {
  // a young sea turtle sitting up: pale belly to the front, the shell behind it, flippers that clap
  turtle(root) {
    const SHELL = mat(0x8a6a3c, { emissiveIntensity: 0.3 }), BELLY = mat(0xf6e7b8, { emissiveIntensity: 0.4 }), SKINM = mat(0x7fd08f, { emissiveIntensity: 0.5, line: 0.22, fill: 0.97 });
    put(root, ball(0.21), SHELL, [0, 0.25, -0.07], [-0.2, 0, 0], [1.05, 1.08, 0.62]);
    put(root, new THREE.TorusGeometry(0.2, 0.022, 4, 10), SHELL, [0, 0.25, -0.04], [-0.2, 0, 0], [1.05, 1.08, 1]);
    put(root, ball(0.17), BELLY, [0, 0.245, 0.0], [-0.2, 0, 0], [0.95, 1.05, 0.42]);
    const head = new THREE.Group(); head.position.set(0, 0.53, 0.02); root.add(head); put(head, ball(0.14), SKINM);
    const flips = [[-1, 0.33, 0.02, 0.085], [1, 0.33, 0.02, 0.085], [-1, 0.06, 0.06, 0.065], [1, 0.06, 0.06, 0.065]].map(([sd, yy, zz, r]) => { const f = new THREE.Group(); f.position.set(sd * (yy > 0.2 ? 0.19 : 0.12), yy, zz); root.add(f); put(f, ball(r), SKINM, [sd * r * 0.7, -r * 0.2, 0], [0, 0, sd * 0.5], [1.4, 0.45, 0.75]); return { f, sd }; });
    return { head, R: 0.14, face: { ex: 0.4, ey: 0.06, es: 1.15, my: -0.32, cheekY: -0.24 }, top: 0.7, move(t, S) { flips.forEach(({ f, sd }, i) => f.rotation.z = sd * ((i < 2 ? -0.2 : 0) + S.flap * (i < 2 ? 1.1 : 0.2) * (0.6 + 0.4 * Math.sin(t * 14)) - S.slump * 0.35)); } };
  },
  // a northern fulmar: white body, grey wings with darker tips, yellow bill, pale pink feet
  fulmar(root) {
    const BODY = mat(0xeaf4ff, { emissiveIntensity: 0.2, line: 0.3, fill: 0.95 }), GREY = mat(0x9fb2c8, { emissiveIntensity: 0.3 }), TIP = mat(0x62748c, { emissiveIntensity: 0.3 }), BILL = mat(0xffd35a, { emissiveIntensity: 0.5 }), LEG = mat(0xe8b4a6, { emissiveIntensity: 0.4 }), SPOT = flat(0x2b3a4a);
    for (const sd of [-1, 1]) { put(root, new THREE.CylinderGeometry(0.012, 0.012, 0.15, 6), LEG, [sd * 0.06, 0.09, 0]); put(root, ball(0.045), LEG, [sd * 0.06, 0.012, 0.03], null, [0.9, 0.22, 1.3]); }
    put(root, ball(0.175), BODY, [0, 0.3, -0.02], [-0.25, 0, 0], [0.95, 0.92, 1.25]);
    put(root, new THREE.ConeGeometry(0.07, 0.17, 6), GREY, [0, 0.27, -0.27], [-1.75, 0, 0], [1, 1, 0.4]);
    put(root, new THREE.ConeGeometry(0.035, 0.08, 6), TIP, [0, 0.262, -0.35], [-1.75, 0, 0], [1, 1, 0.4]);
    const head = new THREE.Group(); head.position.set(0, 0.52, 0.1); root.add(head); put(head, ball(0.12), BODY);
    put(head, new THREE.ConeGeometry(0.036, 0.13, 6), BILL, [0, -0.02, 0.155], [Math.PI / 2 + 0.1, 0, 0], [1, 1, 0.75]);
    const jaw = new THREE.Group(); jaw.position.set(0, -0.034, 0.1); head.add(jaw); put(jaw, new THREE.ConeGeometry(0.028, 0.1, 6), BILL, [0, -0.008, 0.045], [Math.PI / 2 + 0.1, 0, 0], [1, 1, 0.45]); put(jaw, ball(0.011), SPOT, [0, -0.012, 0.075]);
    const wings = [-1, 1].map(sd => { const w = new THREE.Group(); w.position.set(sd * 0.15, 0.37, -0.02); root.add(w); put(w, ball(0.1), GREY, [sd * 0.025, -0.07, -0.05], [-0.3, 0, 0], [0.32, 0.9, 1.5]); put(w, ball(0.05), TIP, [sd * 0.03, -0.11, -0.19], [-0.3, 0, 0], [0.3, 0.7, 1.3]); return { w, sd }; });
    return { head, R: 0.12, face: { ex: 0.44, ey: 0.12, es: 1.1, mouth: false, cheekY: -0.1, cheekX: 0.68 }, top: 0.68, move(t, S) { wings.forEach(({ w, sd }) => w.rotation.z = sd * (S.flap * (1.2 + 0.5 * Math.sin(t * 16)) - S.slump * 0.08)); jaw.rotation.x = S.joy * 0.4; } };
  },
  anchovy: root => fish(root, 0x5b8fd6, 0xe6eef7, 0x9fc6ee, [1.75, 0.5, 0.42]),
  bayfish: root => fish(root, 0x7fa86a, 0xf3e6bf, 0xf2a45c, [1.5, 0.78, 0.5]),
};

export function makeAnimal(scene, kind, { x, y, z, face, tween, size = 1.25 }) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = face; g.scale.setScalar(size); scene.add(g);
  const all = new THREE.Group(); g.add(all);
  const a = BUILD[kind](all), look = makeFace(a.head, a.R, a.face);
  for (const m of a.ground || []) g.add(m); // what stays on the ground while the animal hops
  const S = { hop: 0, sq: 0, flap: 0, slump: 0, joy: 0, grow: 1, spin: 0, shake: 0 };
  const play = player(tween, () => { S.hop = 0; S.sq = 0; S.spin = 0; S.shake = 0; });
  look.set('calm');
  return {
    group: g, kind,
    box: () => new THREE.Box3(new THREE.Vector3(x - 0.34 * size, y, z - 0.3), new THREE.Vector3(x + 0.34 * size, y + (a.top + 0.3) * size, z + 0.4)),
    enter() { S.grow = 0; tween(0.7, k => { S.grow = clamp01((k - 0.45) / 0.55); S.grow = S.grow ? 1 + 0.18 * Math.sin(Math.PI * S.grow) * (1 - S.grow) - (1 - S.grow) ** 2 : 0; }, () => { S.grow = 1; }); },
    rest() { look.set('calm'); const f = S.flap, sl = S.slump, j = S.joy; play(0.4, k => { const e = ease(k); S.flap = f * (1 - e); S.slump = sl * (1 - e); S.joy = j * (1 - e); }); },
    react(ok) {
      if (ok) { look.set('glad'); play(1.1, k => { const h = k < 0.55 ? hopArc(clamp01((k - 0.12) / 0.43), 0.2) : hopArc((k - 0.55) / 0.45, 0.1); S.hop = h[0]; S.sq = h[1]; S.flap = bump(k / 0.9) * 0.9 + 0.12; S.joy = ease(clamp01(k / 0.3)); S.slump = 0; }, () => { S.hop = 0; S.sq = 0; S.flap = 0.12; }); }
      else { look.set('worry'); const f = S.flap, j = S.joy; play(0.9, k => { S.slump = ease(clamp01(k / 0.4)); S.flap = f * (1 - clamp01(k / 0.2)); S.joy = j * (1 - clamp01(k / 0.2)); S.shake = Math.sin(k * Math.PI * 4) * 0.12 * (1 - k); }, () => { S.shake = 0; }); }
    },
    cheer(all2) {
      if (!all2) return this.rest();
      look.set('glad');
      play(1.7, k => { const h = hopArc((k * 3) % 1, 0.2 * (1 - k * 0.3)); S.hop = h[0]; S.sq = h[1]; S.spin = Math.PI * 2 * ease(clamp01((k - 0.3) / 0.4)); S.flap = 1; S.joy = 1; S.slump = 0; }, () => { S.hop = 0; S.sq = 0; S.spin = 0; S.flap = 0.12; });
    },
    update(t) {
      const sway = Math.sin(t * 2.4 + 1) * (0.015 + 0.04 * S.joy);
      g.visible = S.grow > 0.001; g.scale.setScalar(size * Math.max(0.001, S.grow));
      all.position.y = S.hop - S.slump * 0.02; all.rotation.set(S.slump * 0.1, S.spin + S.shake, sway);
      const breath = Math.sin(t * 2.6) * 0.012;
      all.scale.set(1 - S.sq * 0.6 + S.slump * 0.03, 1 + S.sq * 1.2 + breath - S.slump * 0.07, 1 - S.sq * 0.6 + S.slump * 0.03);
      a.head.rotation.z = sway * 0.6; a.head.rotation.x = S.slump * 0.3 - S.joy * 0.08;
      a.move(t, S); look.blink(t);
    },
    get mood() { return look.mood; },
  };
}
