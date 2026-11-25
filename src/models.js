// Procedural, measured-looking 3D models of everyday objects (three.js primitives only, so no licence questions).
// Units: 1 = 6 cm. Each part has an id that the city rule tables refer to.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, segs = 128) => new THREE.LatheGeometry(pts.map(([x, y]) => V2(x, y)), segs);

// Closed wall profile with real thickness: the line, then the same line offset inward along its normals, back.
function shell(line, t) {
  const n = line.length, inner = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = line[Math.max(0, i - 1)], [bx, by] = line[Math.min(n - 1, i + 1)];
    let dx = bx - ax, dy = by - ay; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    inner.push([Math.max(0, line[i][0] - dy * t), line[i][1] + dx * t]);
  }
  return [...line, ...inner.reverse(), line[0]];
}

// Cup wall: straight taper from r0 at y0 to r1 at y1
const cupR = y => 0.5 + (0.66 - 0.5) * (y / 1.5);

export const MATERIALS = {
  paper: { name: 'Paperboard', color: 0xf1e6cf },
  pe: { name: 'Polyethylene film', color: 0x6fc3ff },
  cardboard: { name: 'Corrugated board', color: 0xc8904f },
  ps: { name: 'Plastic (PS or PP)', color: 0xe8f0ff },
  wood: { name: 'Wood', color: 0xe0b36e },
  pet: { name: 'PET', color: 0x8fe3ff },
  pp: { name: 'Polypropylene', color: 0xff9f43 },
  film: { name: 'Printed plastic film', color: 0xff6b9a },
  hdpe: { name: 'Plastic (PE or PP)', color: 0x7cf0a8 },
  greasy: { name: 'Board soaked with grease', color: 0xd4813a },
  glass: { name: 'Glass', color: 0xa8d8ff },
  alu: { name: 'Aluminium', color: 0xc9d3dd },
  liion: { name: 'Lithium-ion cell', color: 0xff5a5a },
  pcb: { name: 'Circuit board', color: 0x4cd98a },
  food: { name: 'Food scraps', color: 0xf0c060 },
};

export const OBJECTS = {
  coffee_cup: {
    name: 'Takeaway coffee cup', tab: 'Coffee cup',
    main: 'cup', host: 'on the cup',
    question: 'Paper, plastic or trash?',
    caption: 'A single-use hot cup: paperboard with a plastic film bonded inside, a corrugated sleeve, a plastic lid and a wooden stirrer.',
    parts: {
      cup: { label: 'Paper cup', material: 'paper', note: 'Paperboard wall with a crimped, recessed base and a rolled rim.' },
      lining: { label: 'Plastic lining', material: 'pe', bondedTo: 'cup', note: 'A thin polyethylene film bonded to the inside so the paper holds hot liquid. It cannot be peeled off at home.' },
      sleeve: { label: 'Sleeve', material: 'cardboard', note: 'Single-face corrugated board: a fluted layer glued to a flat liner.' },
      lid: { label: 'Lid', material: 'ps', note: 'Thermoformed plastic with a snap-on skirt, drink-through well, sip slot and vent hole.' },
      stirrer: { label: 'Stirrer', material: 'wood', note: 'Flat wooden stick with rounded ends.' },
    },
    build() {
      const parts = [];

      // --- cup wall: tapered shell with a rolled rim bead and a recessed, crimped base
      const N = 24, wall = [];
      for (let i = 0; i <= N; i++) { const y = 0.02 + (1.5 - 0.02) * i / N; wall.push([cupR(y), y]); }
      const wallGeo = lathe(shell(wall, 0.014));
      const rim = new THREE.TorusGeometry(cupR(1.5) + 0.006, 0.026, 18, 160).rotateX(Math.PI / 2).translate(0, 1.515, 0);
      // base: disc set 0.07 up, skirt folded around it (crimp ring)
      const baseGeo = lathe([[0, 0.075], [0.47, 0.075], [0.49, 0.06], [0.49, 0.0], [0.5, 0.0]]);
      const crimp = new THREE.TorusGeometry(0.493, 0.012, 10, 160).rotateX(Math.PI / 2).translate(0, 0.012, 0);
      // side seam: overlap strip
      const seamShape = new THREE.Shape(); seamShape.moveTo(-0.03, 0); seamShape.lineTo(0.03, 0); seamShape.lineTo(0.035, 1.5); seamShape.lineTo(-0.035, 1.5);
      const seam = new THREE.ExtrudeGeometry(seamShape, { depth: 0.006, bevelEnabled: false });
      seam.translate(0, 0.02, 0);
      const seamM = new THREE.Matrix4().makeRotationX(-Math.atan2(0.16, 1.48));
      seam.applyMatrix4(seamM); seam.translate(0, 0, 0.5 + 0.004);
      parts.push({ id: 'cup', geo: mergeGeometries([wallGeo, rim, baseGeo, crimp].map(g => g.index ? g.toNonIndexed() : g).map(g => { g.deleteAttribute('uv'); return g; })), extra: [seam], explode: new THREE.Vector3(0, 0, 0), labelSide: -1, labelDy: -70 });

      // --- PE lining: a skin just inside the wall and over the base
      const lin = [];
      for (let i = 0; i <= N; i++) { const y = 0.085 + (1.49 - 0.085) * i / N; lin.push([cupR(y) - 0.02, y]); }
      parts.push({ id: 'lining', geo: lathe([[0, 0.085], ...lin]), explode: new THREE.Vector3(-1.05, 0.2, 0), bondedTo: 'cup', thin: true, edgeAngle: 70, labelSide: -1, labelDy: 10 });

      // --- sleeve: fluted corrugation (radial waves) + flat inner liner
      const s0 = 0.38, s1 = 1.12, seg = 360, rows = 16, flutes = 90;
      const pos = [], idx = [];
      for (let j = 0; j <= rows; j++) {
        const y = s0 + (s1 - s0) * j / rows;
        for (let i = 0; i <= seg; i++) {
          const a = i / seg * Math.PI * 2;
          const r = cupR(y) + 0.032 + 0.009 * Math.abs(Math.sin(a * flutes / 2));
          pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
        }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) {
        const a = j * (seg + 1) + i, b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const flute = new THREE.BufferGeometry();
      flute.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); flute.setIndex(idx); flute.computeVertexNormals();
      const liner = lathe([[cupR(s0) + 0.022, s0], [cupR(s1) + 0.022, s1]], 128);
      parts.push({ id: 'sleeve', geo: mergeGeometries([flute.toNonIndexed(), liner.toNonIndexed()].map(g => { g.deleteAttribute('uv'); return g; })), explode: new THREE.Vector3(1.15, -0.1, 0), edgeAngle: 70, labelSide: 1, labelDy: -40 });

      // --- lid: skirt that snaps over the rim, a channel, raised dome with drink-through well
      const R = cupR(1.5);
      const lidProfile = [
        [R + 0.07, 1.47], [R + 0.075, 1.53], [R + 0.06, 1.585], [R + 0.03, 1.6],  // skirt
        [R - 0.02, 1.6], [R - 0.05, 1.56], [R - 0.08, 1.56], [R - 0.1, 1.62],      // channel
        [R - 0.14, 1.7], [0.35, 1.73], [0.12, 1.735], [0, 1.735],                   // dome
      ];
      const lidGeo = lathe(shell(lidProfile, -0.012), 160);
      // drink-through well: raised spout ring near the edge
      const spout = new THREE.TorusGeometry(0.11, 0.025, 14, 60).rotateX(Math.PI / 2).translate(0, 1.76, 0.42);
      const slot = new THREE.CapsuleGeometry(0.025, 0.09, 6, 16).rotateZ(Math.PI / 2).translate(0, 1.79, 0.42);
      const vent = new THREE.CylinderGeometry(0.012, 0.012, 0.02, 12).translate(0, 1.745, -0.3);
      parts.push({ id: 'lid', geo: mergeGeometries([lidGeo, spout, slot, vent].map(g => (g.index ? g.toNonIndexed() : g)).map(g => { g.deleteAttribute('uv'); return g; })), explode: new THREE.Vector3(0, 0.95, 0) });

      // --- wooden stirrer: flat stick with rounded ends, leaning in the cup
      const st = new THREE.Shape(); const w = 0.035, L = 1.0;
      st.moveTo(-w, -L); st.lineTo(-w, L); st.absarc(0, L, w, Math.PI, 0, true); st.lineTo(w, -L); st.absarc(0, -L, w, 0, Math.PI, true);
      const stick = new THREE.ExtrudeGeometry(st, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 16 });
      stick.translate(0, 0, -0.006).rotateZ(-0.16).translate(0.25, 1.3, 0.18);
      parts.push({ id: 'stirrer', geo: stick, explode: new THREE.Vector3(0.75, 0.9, 0.4) });
      return parts;
    },
  },

  pet_bottle: {
    name: 'Plastic water bottle', tab: 'Water bottle',
    main: 'bottle', host: 'on the bottle',
    question: 'Cap on or off? Label on or off?',
    scale: 0.66,
    heroZoom: 1.15,
    caption: 'A clear PET bottle with a screw cap, a tamper ring left on the neck and a wrap-around label.',
    parts: {
      bottle: { label: 'Bottle', material: 'pet', note: 'Clear PET, blow-moulded, with a petaloid base.' },
      cap: { label: 'Cap', material: 'hdpe', note: 'Screw cap, a different plastic from the bottle.' },
      ring: { label: 'Tamper ring', material: 'hdpe', note: 'Stays on the neck after opening.', bondedTo: 'bottle' },
      label: { label: 'Label', material: 'film', note: 'Printed plastic film wrapped around the body.' },
    },
    build() {
      const prof = [[0.0, 0.02], [0.22, 0.0], [0.36, 0.05], [0.42, 0.16], [0.43, 0.3], [0.43, 1.2], [0.41, 1.3], [0.43, 1.4], [0.43, 1.75], [0.38, 1.95], [0.24, 2.15], [0.15, 2.3], [0.14, 2.42]];
      const body = lathe(shell(prof, 0.01), 128);
      // grip ribs
      const ribs = [1.25, 1.33].map(y => new THREE.TorusGeometry(0.415, 0.012, 8, 128).rotateX(Math.PI / 2).translate(0, y, 0));
      // petaloid feet
      const feet = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; feet.push(new THREE.SphereGeometry(0.12, 20, 14).scale(1, 0.5, 1).translate(Math.sin(a) * 0.24, 0.04, Math.cos(a) * 0.24)); }
      const neck = new THREE.CylinderGeometry(0.145, 0.145, 0.16, 48, 1, true).translate(0, 2.5, 0);
      const flange = new THREE.TorusGeometry(0.17, 0.018, 10, 64).rotateX(Math.PI / 2).translate(0, 2.42, 0);
      const parts = [];
      parts.push({ id: 'bottle', geo: mergeGeometries([body, ...ribs, ...feet, neck, flange].map(g => (g.index ? g.toNonIndexed() : g)).map(g => { g.deleteAttribute('uv'); return g; })), explode: new THREE.Vector3(0, 0, 0), labelSide: -1, labelDy: -60 });
      const ring = new THREE.TorusGeometry(0.165, 0.03, 12, 64).rotateX(Math.PI / 2).translate(0, 2.47, 0);
      parts.push({ id: 'ring', geo: ring, explode: new THREE.Vector3(-0.7, 0.35, 0), bondedTo: 'bottle', labelSide: -1 });
      // cap with knurled skirt
      const capOuter = new THREE.CylinderGeometry(0.19, 0.19, 0.22, 72, 1, true).translate(0, 2.66, 0);
      const capTop = new THREE.CylinderGeometry(0.19, 0.19, 0.02, 72).translate(0, 2.77, 0);
      const knurl = []; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; knurl.push(new THREE.BoxGeometry(0.012, 0.18, 0.012).translate(Math.sin(a) * 0.195, 2.66, Math.cos(a) * 0.195)); }
      parts.push({ id: 'cap', geo: mergeGeometries([capOuter, capTop, ...knurl].map(g => (g.index ? g.toNonIndexed() : g)).map(g => { g.deleteAttribute('uv'); return g; })), explode: new THREE.Vector3(0.2, 0.75, 0), labelSide: 1 });
      const label = new THREE.CylinderGeometry(0.438, 0.438, 0.5, 128, 1, true).translate(0, 1.6, 0);
      parts.push({ id: 'label', geo: label, explode: new THREE.Vector3(1.05, -0.2, 0), labelSide: 1, thin: true });
      return parts;
    },
  },
  pizza_box: {
    name: 'Pizza box', tab: 'Pizza box',
    main: 'base', host: 'on the box',
    question: 'Is a greasy box still paper?',
    scale: 0.62,
    heroZoom: 2.5,
    lift: 0.1,
    caption: 'A corrugated pizza box: the lid usually stays clean, the base soaks up grease.',
    parts: {
      lid: { label: 'Clean lid', material: 'cardboard', note: 'Corrugated board with no food contact.' },
      base: { label: 'Greasy base', material: 'greasy', note: 'The part under the pizza, soaked with oil and cheese.' },
      crust: { label: 'Leftover crust', material: 'food', note: 'Food scraps.' },
    },
    build() {
      const W = 1.8, H = 0.22, t = 0.03;
      const tray = (h, flip) => {
        const g = [];
        g.push(new THREE.BoxGeometry(W, t, W).translate(0, 0, 0));
        for (const [x, z, w, d] of [[0, W / 2, W, t], [0, -W / 2, W, t], [W / 2, 0, t, W], [-W / 2, 0, t, W]]) g.push(new THREE.BoxGeometry(w, h, d).translate(x, h / 2 * (flip ? -1 : 1), z));
        // corrugation flutes visible on the edges
        for (let i = -20; i <= 20; i++) g.push(new THREE.CylinderGeometry(0.008, 0.008, W, 6).rotateX(Math.PI / 2).translate(i * W / 42, t * (flip ? -0.5 : 0.5), 0));
        return mergeGeometries(g.map(x => (x.index ? x.toNonIndexed() : x)).map(x => { x.deleteAttribute('uv'); return x; }));
      };
      const base = tray(H, false); base.translate(0, 0, 0);
      const lid = tray(H * 0.9, true); lid.translate(0, H + t, 0);
      // grease stain: a darker disc on the base
      const stain = new THREE.CircleGeometry(0.72, 64).rotateX(-Math.PI / 2).translate(0, t / 2 + 0.002, 0);
      const crust = new THREE.TorusGeometry(0.62, 0.06, 12, 64, Math.PI * 0.45).rotateX(Math.PI / 2).rotateY(0.6).translate(0, 0.08, 0);
      return [
        { id: 'base', geo: mergeGeometries([base, stain.toNonIndexed()].map(g => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; })), explode: new THREE.Vector3(0, -0.2, 0), labelSide: -1, edgeAngle: 50 },
        { id: 'lid', geo: lid, explode: new THREE.Vector3(0, 1.1, -0.2), labelSide: 1, edgeAngle: 50 },
        { id: 'crust', geo: crust, explode: new THREE.Vector3(1.0, 0.55, 0.4), labelSide: 1 },
      ];
    },
  },
  smartphone: {
    name: 'Smartphone', tab: 'Phone',
    main: 'frame', host: 'in the phone',
    question: 'Which bin takes a phone?',
    lift: 0.45,
    scale: 0.72,
    cutTo: 0.08, // the cut takes the glass off and shows the board and battery
    caption: 'Sealed: glass, aluminium frame, circuit board and a glued-in lithium-ion battery. It does not come apart at home.',
    parts: {
      glass: { label: 'Screen glass', material: 'glass', bondedTo: 'frame', quiz: false, note: 'Display stack under cover glass, glued to the frame.' },
      frame: { label: 'Frame', quizLabel: 'The phone itself', material: 'alu', note: 'Aluminium frame with buttons. Everything else is glued or screwed into it.' },
      board: { label: 'Circuit board', material: 'pcb', bondedTo: 'frame', quiz: false, note: 'Logic board with chips and camera modules.' },
      battery: { label: 'Battery', material: 'liion', bondedTo: 'frame', note: 'Lithium-ion pouch cell, glued in. SF Environment warns that uncovered lithium batteries can cause fires.' },
    },
    build() {
      const rr = (w, h, r, d) => { const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 3, curveSegments: 16 }); };
      const W = 1.2, H = 2.5;
      const glass = rr(W, H, 0.16, 0.02); glass.translate(0, 0, 0.13);
      const frameOuter = rr(W, H, 0.16, 0.12);
      const buttons = [new THREE.BoxGeometry(0.03, 0.3, 0.05).translate(W / 2 + 0.01, 0.5, 0.06), new THREE.BoxGeometry(0.03, 0.18, 0.05).translate(-W / 2 - 0.01, 0.7, 0.06)];
      const camBump = rr(0.45, 0.45, 0.1, 0.03); camBump.translate(-0.28, 0.9, -0.04);
      const lens = [0, 1].map(i => new THREE.CylinderGeometry(0.08, 0.08, 0.05, 32).rotateX(Math.PI / 2).translate(-0.36 + i * 0.16, 0.95 - i * 0.1, -0.05));
      const frame = mergeGeometries([frameOuter, ...buttons, camBump, ...lens].map(g => (g.index ? g.toNonIndexed() : g)).map(g => { g.deleteAttribute('uv'); return g; }));
      const board = mergeGeometries([new THREE.BoxGeometry(0.9, 0.9, 0.02).translate(0, 0.65, 0.06), ...[[0.15, 0.7, 0.25], [-0.2, 0.5, 0.18], [0.25, 0.35, 0.12], [-0.25, 0.85, 0.1]].map(([x, y, s]) => new THREE.BoxGeometry(s, s, 0.03).translate(x, y, 0.08))].map(g => (g.index ? g.toNonIndexed() : g)).map(g => { g.deleteAttribute('uv'); return g; }));
      const battery = rr(0.9, 1.25, 0.06, 0.05); battery.translate(0, -0.45, 0.04);
      return [
        { id: 'frame', geo: frame, explode: new THREE.Vector3(0, 0, 0), labelSide: -1, labelDy: 70 },
        { id: 'board', geo: board, explode: new THREE.Vector3(0.9, 0.35, 0.2), labelSide: 1, bondedTo: 'frame' },
        { id: 'battery', geo: battery, explode: new THREE.Vector3(-0.95, -0.15, 0.3), labelSide: -1, bondedTo: 'frame' },
        { id: 'glass', geo: glass, explode: new THREE.Vector3(0, 0.25, 0.9), labelSide: 1, labelDy: -40, thin: true, bondedTo: 'frame' },
      ];
    },
  },
};
