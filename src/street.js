// The scenery behind the bins.
// makeStreet: a street drawn from the number the city publishes about itself (see logic.js street()).
// The houses are scenery; only the kerb bays, and the windows above them, carry the figure.
import * as THREE from 'three';

const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const out3 = x => 1 - (1 - x) ** 3;
const seeded = seed => i => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };

// many small pieces, one draw call: positions (and normals) laid end to end
function merge(geos) {
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g), n = parts.reduce((a, g) => a + g.attributes.position.count, 0);
  const withN = parts.every(g => g.attributes.normal), pos = new Float32Array(n * 3), nor = withN ? new Float32Array(n * 3) : null;
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array, o); if (nor) nor.set(g.attributes.normal.array, o); o += g.attributes.position.count * 3; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); if (nor) m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return m;
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const edges = (g, a = 1) => new THREE.EdgesGeometry(g, a);

const LINE = 0x3d7dab, GREEN = 0x5fd38a, AMBER = 0xffb454, RED = 0xff7a6b, WARM = 0xffcf8f, OFF = 0x13283a, DIM = 0x24415a;
export const STREET_COLORS = { clear: '#5fd38a', energy: '#ffb454', rest: '#ff7a6b' };
// how the houses are drawn in each city: a flavour of the place, not a measurement
const LOOK = {
  seoul: { w: 1.12, h: [1.4, 2.2], roof: 'flat', tank: 0.7, sign: 0.55 },
  berlin: { w: 1.3, h: [1.8, 1.92], roof: 'mansard' },
  sf: { w: 0.94, h: [1.25, 1.58], roof: 'gable', bay: true, step: 0.045 },
  tokyo: { w: 0.98, h: [1.2, 2.4], roof: 'flat', sign: 0.9, poles: true },
};
const SIGNS = [0x6fc3ff, 0xff8fb1, 0xffcf8f, 0x7be0c3];

// a roof with a ridge from front to back, so the gable faces the street
function gable(w, h, d) {
  const a = w / 2, z = d / 2, v = [[-a, 0, z], [a, 0, z], [0, h, z], [-a, 0, -z], [a, 0, -z], [0, h, -z]];
  const f = [[0, 1, 2], [4, 3, 5], [0, 2, 5], [0, 5, 3], [1, 4, 5], [1, 5, 2]], g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(f.flat().flatMap(i => v[i])), 3)); g.computeVertexNormals();
  return g;
}
// a steep roof that leans back from the eaves
function mansard(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setZ(i, p.getZ(i) * 0.42 - d * 0.1); p.setX(i, p.getX(i) * 0.96); }
  g.computeVertexNormals(); return g;
}

// It stands well behind the bins, where the camera sees the kerb over their lids; `lean` (camera x ÷ camera z) keeps it centred in that view.
export function makeStreet(scene, cid, st, span, y0, lean = 0) {
  const Z = -4.3, g = new THREE.Group(); g.position.set(Z * lean, y0, Z);
  const look = LOOK[cid] || LOOK.seoul, W = Math.max(span + 1.7, 4.7), n = Math.max(4, Math.round(W / look.w)), w = W / n, rnd = seeded(n + cid.length * 3);
  const frac = st.n.clear / st.bays;
  const solid = [], lines = [], lit = [], dim = [], off = [], signs = SIGNS.map(() => []), hot = [];
  let top = 0;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * w, bw = w * 0.9, h = look.h[0] + rnd(i) * (look.h[1] - look.h[0]), by = (look.step || 0) * i, D = 0.9;
    const bright = (i + 0.5) / n <= frac + 1e-6; // the houses above the cleared kerb are the ones with their lights on
    if (by) { const plinth = box(bw, by, D, x, by / 2, 0); solid.push(plinth); lines.push(edges(plinth)); }
    const body = box(bw, h, D, x, by + h / 2, 0); solid.push(body); lines.push(edges(body));
    let roofTop = by + h;
    if (look.roof === 'gable') { const rh = bw * 0.44, r = gable(bw + 0.06, rh, D + 0.06).translate(x, by + h, 0); solid.push(r); lines.push(edges(r)); roofTop += rh; }
    else if (look.roof === 'mansard') {
      const rh = 0.42, r = mansard(bw + 0.04, rh, D).translate(x, by + h + rh / 2, 0); solid.push(r); lines.push(edges(r)); roofTop += rh;
      for (const s of [-1, 1]) { const d = box(0.17, 0.2, 0.2, x + s * bw * 0.24, by + h + 0.17, D * 0.27); solid.push(d); lines.push(edges(d)); (bright && rnd(i * 5 + s) > 0.4 ? lit : off).push(new THREE.PlaneGeometry(0.09, 0.11).translate(x + s * bw * 0.24, by + h + 0.17, D * 0.27 + 0.101)); }
      lines.push(edges(box(bw + 0.08, 0.04, D + 0.06, x, by + h + 0.02, 0)));
    } else {
      lines.push(edges(box(bw + 0.06, 0.05, D + 0.06, x, by + h + 0.025, 0)));
      if (rnd(i + 40) < (look.tank || 0)) { const tx = x + (rnd(i + 9) - 0.5) * bw * 0.45; lines.push(edges(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 10).translate(tx, by + h + 0.21, -0.12), 30), edges(box(0.2, 0.06, 0.2, tx, by + h + 0.08, -0.12))); roofTop += 0.32; }
      else if (rnd(i + 41) > 0.35) { lines.push(edges(box(0.3, 0.2, 0.3, x + (rnd(i + 9) - 0.5) * bw * 0.5, by + h + 0.15, -0.1))); roofTop += 0.25; }
    }
    top = Math.max(top, roofTop);
    // the line of the shopfront, a door, and the windows on the street side
    lines.push(edges(box(bw, 0.02, D + 0.02, x, by + 0.42, 0)));
    lines.push(edges(new THREE.PlaneGeometry(0.2, 0.3).translate(x - bw * 0.22, by + 0.15, D / 2 + 0.005)));
    (bright ? dim : off).push(new THREE.PlaneGeometry(bw * 0.36, 0.2).translate(x + bw * 0.16, by + 0.2, D / 2 + 0.005));
    const cols = bw > 1.05 ? 4 : 3, rows = Math.max(2, Math.floor((h - 0.62) / 0.4));
    const bay = look.bay ? box(bw * 0.5, Math.min(h - 0.62, 0.78), 0.16, x, by + h - 0.16 - Math.min(h - 0.62, 0.78) / 2, D / 2 + 0.08) : null;
    if (bay) { solid.push(bay); lines.push(edges(bay)); }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const wx = x + (c - (cols - 1) / 2) * (bw / (cols + 0.6)), wy = by + h - 0.3 - r * 0.4, inBay = bay && Math.abs(wx - x) < bw * 0.25 && r < 2;
      const pane = new THREE.PlaneGeometry(0.15, 0.2).translate(wx, wy, D / 2 + (inBay ? 0.165 : 0.005));
      (bright ? (rnd(i * 31 + r * 7 + c) > 0.3 ? lit : dim) : rnd(i * 13 + r * 5 + c) > 0.9 ? dim : off).push(pane);
    }
    if (rnd(i + 70) < (look.sign || 0)) { // a sign that hangs out over the pavement
      const sh = 0.36 + rnd(i + 71) * 0.34, sgn = box(0.08, sh, 0.2, x + bw / 2 - 0.05, by + 0.62 + sh / 2 + rnd(i + 72) * 0.25, D / 2 + 0.11);
      lines.push(edges(sgn)); (bright ? signs[Math.floor(rnd(i + 73) * SIGNS.length)] : hot).push(sgn);
    }
  }
  // pavement and kerb
  const pave = box(W + 0.5, 0.06, 1.8, 0, 0.03, 1.2);
  g.add(new THREE.Mesh(pave, new THREE.MeshBasicMaterial({ color: 0x0b1825, transparent: true, opacity: 0.94 })));
  lines.push(edges(pave));
  for (let i = 1; i < 12; i++) { const x = (i / 12 - 0.5) * (W + 0.5); lines.push(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0.062, 0.48), new THREE.Vector3(x, 0.062, 0.86)])); }
  if (look.poles) { // utility poles and their wires along the house fronts
    const px = [-W * 0.31, W * 0.27];
    for (const x of px) {
      lines.push(edges(new THREE.CylinderGeometry(0.022, 0.03, 2.2, 6).translate(x, 1.16, 0.62), 30), edges(box(0.5, 0.03, 0.03, x, 1.95, 0.62)), edges(box(0.34, 0.03, 0.03, x, 1.77, 0.62)), edges(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 8).translate(x + 0.11, 1.5, 0.62), 30));
    }
    const wire = (x0, x1, y, dz) => { const pts = []; for (let k = 0; k < 10; k++) for (const u of [k / 10, (k + 1) / 10]) pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y - Math.sin(Math.PI * u) * 0.11, 0.62 + dz)); return new THREE.BufferGeometry().setFromPoints(pts); };
    for (const [a, b] of [[-W / 2 - 0.3, px[0]], [px[0], px[1]], [px[1], W / 2 + 0.3]]) for (const dz of [-0.22, 0, 0.22]) lines.push(wire(a, b, 1.95, dz), wire(a, b, 1.77, dz * 0.7));
    top = Math.max(top, 2.3);
  }

  // the kerb: 20 bays, cleared ones first. A cleared bay is planted; the others hold what was not recycled.
  const rows = W < 6 ? 2 : 1, cols = st.bays / rows, bw = (W - 0.24) / cols, kinds = [...Array(st.n.clear).fill('clear'), ...Array(st.n.energy).fill('energy'), ...Array(st.n.rest).fill('rest')];
  const tiles = { clear: [], energy: [], rest: [] }, tileLines = { clear: [], energy: [], rest: [] }, leaf = [], leafLines = [], wood = [], bag = { energy: [], rest: [] }, bagLines = { energy: [], rest: [] };
  const lump = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
  const SACK = [[0, 0], [0.62, 0.03], [0.96, 0.3], [1, 0.62], [0.86, 0.98], [0.52, 1.28], [0.17, 1.44], [0.13, 1.52], [0.3, 1.7], [0.36, 1.74]].map(([a, b]) => new THREE.Vector2(a, b));
  const sack = (r, turn, sx, sz) => new THREE.LatheGeometry(SACK, 7).scale(r * sx, r * 0.98, r * sz).rotateY(turn);
  kinds.forEach((kind, i) => {
    const col = Math.floor(i / rows), row = i % rows, x = (col - (cols - 1) / 2) * bw, z = rows === 2 ? (row ? 1.83 : 1.33) : 1.66, deep = rows === 2 ? 0.44 : 0.5;
    const tile = box(bw * 0.9, 0.016, deep, x, 0.068, z); tiles[kind].push(tile); tileLines[kind].push(edges(tile));
    if (kind === 'clear') {
      const tree = rows === 2 ? row === 0 && col % 2 === 0 : i % 3 === 0;
      if (tree) {
        const r = Math.min(0.25, bw * 0.56) * (0.92 + rnd(i + 200) * 0.16), th = 0.5 + rnd(i + 201) * 0.14;
        wood.push(new THREE.CylinderGeometry(0.02, 0.028, th, 6).translate(x, 0.07 + th / 2, z));
        const crown = lump(r).scale(1, 1.12, 1).translate(x, 0.07 + th + r * 0.72, z); leaf.push(crown); leafLines.push(edges(crown));
        const low = lump(r * 0.62).translate(x + r * 0.5, 0.07 + th + r * 0.25, z + r * 0.2); leaf.push(low); leafLines.push(edges(low));
      } else {
        const planter = box(bw * 0.72, 0.1, deep * 0.62, x, 0.126, z); wood.push(planter); leafLines.push(edges(planter));
        const r = Math.min(0.15, bw * 0.3);
        for (const s of [-1, 1]) { const b = lump(r * (0.9 + rnd(i * 3 + s) * 0.25)).scale(1.1, 0.82, 1).translate(x + s * bw * 0.17, 0.2 + r * 0.55, z + s * 0.03); leaf.push(b); leafLines.push(edges(b)); }
      }
    } else {
      const r = Math.min(0.17, bw * 0.36) * (0.9 + rnd(i + 300) * 0.2), dx = (rnd(i + 301) - 0.5) * bw * 0.14, turn = rnd(i + 302) * 3;
      const main = sack(r, turn, 1, 0.9 + rnd(i + 305) * 0.2).translate(x + dx, 0.076, z); bag[kind].push(main); bagLines[kind].push(edges(main));
      if (rnd(i + 303) > 0.3) { const r2 = r * 0.68, s = rnd(i + 304) > 0.5 ? 1 : -1, b2 = sack(r2, turn * 2, 1.05, 0.95).translate(x + dx + s * r * 1.15, 0.076, z + 0.09); bag[kind].push(b2); bagLines[kind].push(edges(b2)); }
    }
  });

  // one mesh per look
  const fill = (geos, color, opacity = 1, extra = {}) => geos.length && g.add(new THREE.Mesh(merge(geos), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, ...extra })));
  const stroke = (geos, color, opacity) => geos.length && g.add(new THREE.LineSegments(merge(geos), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
  const glowing = (geos, color, k, opacity = 0.9) => { if (!geos.length) return; const c = new THREE.Color(color); g.add(new THREE.Mesh(merge(geos), new THREE.MeshStandardMaterial({ color: c.clone().multiplyScalar(0.4), emissive: c, emissiveIntensity: k, roughness: 0.6, transparent: opacity < 1, opacity, flatShading: true }))); };
  fill(solid, 0x091420, 0.92); stroke(lines, LINE, 0.4);
  fill(off, OFF); fill(dim, DIM); fill(lit, WARM); fill(hot, 0x1b3145, 0.9);
  signs.forEach((s, i) => fill(s, new THREE.Color(SIGNS[i]).multiplyScalar(0.62), 0.92));
  const tint = { clear: GREEN, energy: AMBER, rest: RED };
  for (const k of ['clear', 'energy', 'rest']) { fill(tiles[k], tint[k], k === 'clear' ? 0.2 : 0.1); stroke(tileLines[k], tint[k], k === 'clear' ? 0.75 : 0.38); }
  glowing(leaf, GREEN, 0.34, 0.88); stroke(leafLines, GREEN, 0.7); fill(wood, 0x16382b, 0.95);
  for (const k of ['energy', 'rest']) { glowing(bag[k], tint[k], 0.16, 0.86); stroke(bagLines[k], tint[k], 0.95); }
  // street lamps at both ends
  for (const sd of [-1, 1]) {
    const x = sd * (W / 2 + 0.08), mat = new THREE.MeshBasicMaterial({ color: LINE, transparent: true, opacity: 0.7 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.5, 6).translate(x, 0.81, 2.0), mat), new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6).rotateZ(Math.PI / 2).translate(x - sd * 0.15, 1.56, 2.0), mat));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8).translate(x - sd * 0.3, 1.53, 2.0), new THREE.MeshBasicMaterial({ color: 0xffe2a8 })));
  }
  scene.add(g);
  let shown = -1;
  return {
    W, top, group: g, rows,
    // rises out of the ground while the parts fly to their bins
    grow(k) { if (k === shown) return; shown = k; g.visible = k > 0.001; g.scale.y = Math.max(0.001, out3(clamp01(k))); },
  };
}
