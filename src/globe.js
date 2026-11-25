// Teardown atlas: the Earth drawn from Natural Earth shapes (data/geo.json), from space down to each city.
// A plain 2D canvas with its own perspective camera, so coastlines stay sharp at every distance and the
// video recorder can step it frame by frame. Nothing here is a picture: every line is a coordinate.

const RAD = Math.PI / 180;
export const vec = (lat, lon) => { const p = lat * RAD, l = lon * RAD, c = Math.cos(p); return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const angle = (a, b) => Math.acos(clamp(dot(a, b), -1, 1));
export const km = (a, b) => angle(vec(a.lat, a.lon), vec(b.lat, b.lon)) * 6371;

// a shape in the file is: lon, lat of the first point, then steps, in units of 10^-nd degrees
function decode(list, nd, box, closed) {
  const k = 10 ** -nd, pts = [];
  let lon = 0, lat = 0;
  for (let i = 0; i < list.length; i += 2) { lon += list[i]; lat += list[i + 1]; pts.push([lon * k, lat * k, 0]); }
  if (box) {
    // points on the border of the level's box come from clipping, not from a coast: they are filled but never stroked.
    // Along the border extra points are added, so the ring follows the curved edge exactly as the box itself does.
    const e = 2.5 * k, flag = ([x, y]) => (Math.abs(x - box[0]) < e ? 1 : 0) | (Math.abs(x - box[2]) < e ? 2 : 0) | (Math.abs(y - box[1]) < e ? 4 : 0) | (Math.abs(y - box[3]) < e ? 8 : 0);
    for (const p of pts) p[2] = flag(p);
    if (closed) {
      const out = [], step = Math.max(box[2] - box[0], box[3] - box[1]) / 96;
      pts.forEach((p, i) => {
        out.push(p); const q = pts[(i + 1) % pts.length], same = p[2] & q[2];
        if (!same) return;
        const n = Math.floor(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / step);
        for (let j = 1; j <= n; j++) out.push([p[0] + (q[0] - p[0]) * j / (n + 1), p[1] + (q[1] - p[1]) * j / (n + 1), same]);
      });
      pts.length = 0; pts.push(...out);
    }
  }
  const n = pts.length, xyz = new Float32Array(n * 3), edge = box ? new Uint8Array(n) : null, m = [0, 0, 0];
  for (let i = 0; i < n; i++) { const v = vec(pts[i][1], pts[i][0]); xyz[3 * i] = v[0]; xyz[3 * i + 1] = v[1]; xyz[3 * i + 2] = v[2]; m[0] += v[0]; m[1] += v[1]; m[2] += v[2]; if (edge) edge[i] = pts[i][2]; }
  const c = unit(m); let lo = 1;
  for (let i = 0; i < n; i++) lo = Math.min(lo, xyz[3 * i] * c[0] + xyz[3 * i + 1] * c[1] + xyz[3 * i + 2] * c[2]);
  return { xyz, n, edge, m: c, r: Math.acos(clamp(lo, -1, 1)) };
}
const fromPoints = pts => { const flat = []; let px = 0, py = 0; for (const [lon, lat] of pts) { const x = Math.round(lon * 1e4), y = Math.round(lat * 1e4); flat.push(x - px, y - py); px = x; py = y; } return decode(flat, 4, null); };
const boxRing = b => { const pts = [], n = 96; for (let i = 0; i < n; i++) pts.push([b[0] + (b[2] - b[0]) * i / n, b[1]]); for (let i = 0; i < n; i++) pts.push([b[2], b[1] + (b[3] - b[1]) * i / n]); for (let i = 0; i < n; i++) pts.push([b[2] - (b[2] - b[0]) * i / n, b[3]]); for (let i = 0; i < n; i++) pts.push([b[0], b[3] - (b[3] - b[1]) * i / n]); return fromPoints(pts); };

export const LOOK = {
  space: '#070b10', sea: '#081521', land: '#14304a', coast: '111,195,255', grid: '111,195,255',
  light: '255,205,140', urban: '255,190,115', lit: '150,200,255', river: '70,150,210', road: '255,226,180', rail: '170,196,220', air: '111,195,255',
};

export function makeAtlas(geo, cities, ids) {
  const world = { land: geo.world.land.map(s => decode(s, geo.world.nd)), lakes: geo.world.lakes.map(s => decode(s, geo.world.nd)) };
  // seen from far away the coast needs fewer points: a second, coarser set (islands under about 40 km across are left out)
  const coarse = (list, nd, tol, minArea) => {
    const k = 10 ** -nd, pts = []; let lon = 0, lat = 0;
    for (let i = 0; i < list.length; i += 2) { lon += list[i]; lat += list[i + 1]; pts.push([lon * k, lat * k]); }
    let area = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (Math.abs(area) / 2 < minArea) return null;
    const keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]]; keep[0] = keep[pts.length - 1] = 1;
    while (stack.length) {
      const [a, b] = stack.pop(); if (b - a < 2) continue;
      const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay, d2 = dx * dx + dy * dy; let best = -1, bi = -1;
      for (let i = a + 1; i < b; i++) { const px = pts[i][0] - ax, py = pts[i][1] - ay, t = d2 ? clamp((px * dx + py * dy) / d2, 0, 1) : 0, d = Math.hypot(px - t * dx, py - t * dy); if (d > best) { best = d; bi = i; } }
      if (best > tol) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
    }
    const out = pts.filter((p, i) => keep[i]); return out.length > 2 ? fromPoints(out) : null;
  };
  world.far = geo.world.land.map(s => coarse(s, geo.world.nd, 0.16, 0.12)).filter(Boolean);
  const lights = geo.world.lights.map(([lon, lat, size]) => ({ v: vec(lat, lon), size }));
  const local = {};
  for (const id of ids) {
    const g = geo.cities[id], out = { v: vec(cities[id].lat, cities[id].lon) };
    for (const lv of ['region', 'metro']) {
      const L = g[lv], o = { box: boxRing(L.box) };
      for (const k of ['land', 'lakes', 'urban']) o[k] = L[k].map(s => decode(s, L.nd, L.box, true));
      for (const k of ['rivers', 'roads', 'roads2', 'rail']) o[k] = (L[k] || []).map(s => decode(s, L.nd));
      o.places = (L.places || []).map(([name, lon, lat]) => ({ name, v: vec(lat, lon) }));
      out[lv] = o;
    }
    local[id] = out;
  }
  // graticule: meridians and parallels at four spacings, drawn finer as the camera comes down
  const graticule = step => {
    const out = [], fine = step / 6;
    for (let lon = -180; lon < 180; lon += step) { const pts = []; for (let lat = -84; lat <= 84.001; lat += fine) pts.push([lon, lat]); out.push(fromPoints(pts)); }
    for (let lat = -90 + step; lat < 90; lat += step) { if (Math.abs(lat) > 84) continue; const pts = []; for (let lon = -180; lon <= 180.001; lon += fine) pts.push([lon, lat]); out.push(fromPoints(pts)); }
    return out;
  };
  const grat30 = graticule(30), grat10 = graticule(10);
  const localGrid = (lat0, lon0, step, span) => {
    const out = [], fine = step / 4, a = Math.floor((lon0 - span) / step) * step, b = Math.floor((lat0 - span) / step) * step;
    for (let lon = a; lon <= lon0 + span; lon += step) { const pts = []; for (let lat = lat0 - span; lat <= lat0 + span; lat += fine) pts.push([lon, clamp(lat, -89, 89)]); out.push(fromPoints(pts)); }
    for (let lat = b; lat <= lat0 + span; lat += step) { if (Math.abs(lat) > 88) continue; const pts = []; for (let lon = lon0 - span; lon <= lon0 + span; lon += fine) pts.push([lon, lat]); out.push(fromPoints(pts)); }
    return out;
  };
  for (const id of ids) { const c = cities[id]; local[id].grid2 = localGrid(c.lat, c.lon, 2, 16); local[id].grid05 = localGrid(c.lat, c.lon, 0.5, 3); }

  // ----- camera: looks at a point on the ground from `dist` Earth radii away, tilted toward the horizon
  const S = { C: [0, 0, 3], R: [1, 0, 0], U: [0, 1, 0], D: [0, 0, -1], ch: [0, 0, 1], a: 0.33, b: 0.94, cap: 1.2, f: 800, cx: 0, cy: 0, zn: 0.01, w: 0, h: 0 };
  const FOV = 32;
  function aim(cam, w, h) {
    const p = cam.lat * RAD, l = cam.lon * RAD, T = vec(cam.lat, cam.lon);
    const N = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)], E = [-Math.sin(l), Math.cos(l), 0];
    const hd = (cam.head || 0) * RAD, tl = (cam.tilt || 0) * RAD, ch = Math.cos(hd), sh = Math.sin(hd), ct = Math.cos(tl), st = Math.sin(tl);
    const F = [N[0] * ch + E[0] * sh, N[1] * ch + E[1] * sh, N[2] * ch + E[2] * sh];
    S.R = [E[0] * ch - N[0] * sh, E[1] * ch - N[1] * sh, E[2] * ch - N[2] * sh];
    S.C = [0, 1, 2].map(i => T[i] + cam.dist * (T[i] * ct - F[i] * st));
    S.D = [0, 1, 2].map(i => -T[i] * ct + F[i] * st);
    S.U = [0, 1, 2].map(i => T[i] * st + F[i] * ct);
    const len = Math.hypot(S.C[0], S.C[1], S.C[2]);
    S.ch = [S.C[0] / len, S.C[1] / len, S.C[2] / len]; S.a = 1 / len; S.b = Math.sqrt(Math.max(0, 1 - S.a * S.a)); S.cap = Math.acos(S.a);
    S.w = w; S.h = h; S.f = (h / 2) / Math.tan(FOV / 2 * RAD);
    S.cx = w * (0.5 + (cam.ox || 0)); S.cy = h * (0.5 + (cam.oy || 0)); S.zn = cam.dist * 0.04;
  }
  // a point above the ground (lift in Earth radii) to the screen; false when the Earth hides it or it is behind the camera
  function project(v, lift = 0) {
    const s = 1 + lift, P = [v[0] * s, v[1] * s, v[2] * s], C = S.C;
    const q = [P[0] - C[0], P[1] - C[1], P[2] - C[2]], z = dot(q, S.D);
    if (z <= S.zn) return null;
    if (lift <= 0) { if (dot(v, C) <= 1) return null; }
    else { const a2 = dot(q, q), b2 = 2 * dot(C, q), c2 = dot(C, C) - 1, disc = b2 * b2 - 4 * a2 * c2; if (disc > 0) { const t = (-b2 - Math.sqrt(disc)) / (2 * a2); if (t > 0 && t < 0.999) return null; } }
    return [S.cx + S.f * dot(q, S.R) / z, S.cy - S.f * dot(q, S.U) / z, z];
  }

  let vx = new Float64Array(4096), vy = new Float64Array(4096), vz = new Float64Array(4096);
  const room = n => { if (n > vx.length) { vx = new Float64Array(n * 2); vy = new Float64Array(n * 2); vz = new Float64Array(n * 2); } };
  const inView = g => Math.acos(clamp(g.m[0] * S.ch[0] + g.m[1] * S.ch[1] + g.m[2] * S.ch[2], -1, 1)) < S.cap + g.r;
  const BIG = 1e5;
  // a filled ring: points beyond the horizon slide onto the horizon, points behind the camera are clipped away
  function fillRing(ctx, g) {
    if (!inView(g)) return;
    const { xyz, n } = g, C = S.C, c = S.ch, R = S.R, U = S.U, D = S.D; room(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      let x = xyz[3 * i], y = xyz[3 * i + 1], z = xyz[3 * i + 2];
      if (x * C[0] + y * C[1] + z * C[2] > 1) any = true;
      else {
        const k = x * c[0] + y * c[1] + z * c[2]; let tx = x - k * c[0], ty = y - k * c[1], tz = z - k * c[2]; const l = Math.hypot(tx, ty, tz) || 1;
        x = S.a * c[0] + S.b * tx / l; y = S.a * c[1] + S.b * ty / l; z = S.a * c[2] + S.b * tz / l;
      }
      x -= C[0]; y -= C[1]; z -= C[2];
      vx[i] = x * R[0] + y * R[1] + z * R[2]; vy[i] = x * U[0] + y * U[1] + z * U[2]; vz[i] = x * D[0] + y * D[1] + z * D[2];
    }
    if (!any) return;
    const zn = S.zn, f = S.f, cx = S.cx, cy = S.cy; let started = false;
    const add = (x, y, z) => { const sx = clamp(cx + f * x / z, -BIG, BIG), sy = clamp(cy - f * y / z, -BIG, BIG); if (started) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); started = true; } };
    let px = vx[n - 1], py = vy[n - 1], pz = vz[n - 1], pin = pz > zn;
    for (let i = 0; i < n; i++) {
      const x = vx[i], y = vy[i], z = vz[i], inn = z > zn;
      if (inn !== pin) { const t = (zn - pz) / (z - pz); add(px + (x - px) * t, py + (y - py) * t, zn); }
      if (inn) add(x, y, z);
      px = x; py = y; pz = z; pin = inn;
    }
    if (started) ctx.closePath();
  }
  // a stroked line: only the parts in front of the horizon; `closed` joins the end to the start
  function strokeLine(ctx, g, closed) {
    if (!inView(g)) return;
    const { xyz, n, edge } = g, C = S.C, R = S.R, U = S.U, D = S.D, zn = S.zn, f = S.f, cx = S.cx, cy = S.cy, m = closed ? n + 1 : n;
    let pen = false, pe = 0;
    for (let j = 0; j < m; j++) {
      const i = j % n; let x = xyz[3 * i], y = xyz[3 * i + 1], z = xyz[3 * i + 2];
      const e = edge ? edge[i] : 0;
      if (x * C[0] + y * C[1] + z * C[2] <= 1.00002) { pen = false; pe = e; continue; }
      x -= C[0]; y -= C[1]; z -= C[2];
      const zz = x * D[0] + y * D[1] + z * D[2];
      if (zz <= zn) { pen = false; pe = e; continue; }
      const sx = cx + f * (x * R[0] + y * R[1] + z * R[2]) / zz, sy = cy - f * (x * U[0] + y * U[1] + z * U[2]) / zz;
      if (pen && !(e & pe)) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
      pen = true; pe = e;
    }
  }
  const limb = (() => { const n = 180, xyz = new Float32Array(n * 3); return { xyz, n, m: [0, 0, 1], r: Math.PI }; })();
  function limbPath(ctx, grow = 1) {
    // the horizon as seen from the camera: a circle on the sphere around the point under the camera
    const c = S.ch, any = Math.abs(c[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = unit([c[1] * any[2] - c[2] * any[1], c[2] * any[0] - c[0] * any[2], c[0] * any[1] - c[1] * any[0]]), w = [c[1] * u[2] - c[2] * u[1], c[2] * u[0] - c[0] * u[2], c[0] * u[1] - c[1] * u[0]];
    const n = limb.n, C = S.C, R = S.R, U = S.U, D = S.D; room(n);
    for (let i = 0; i < n; i++) {
      const t = i / n * Math.PI * 2, ct = Math.cos(t) * S.b * grow, st = Math.sin(t) * S.b * grow;
      const x = S.a * c[0] + ct * u[0] + st * w[0] - C[0], y = S.a * c[1] + ct * u[1] + st * w[1] - C[1], z = S.a * c[2] + ct * u[2] + st * w[2] - C[2];
      vx[i] = x * R[0] + y * R[1] + z * R[2]; vy[i] = x * U[0] + y * U[1] + z * U[2]; vz[i] = x * D[0] + y * D[1] + z * D[2];
    }
    const zn = S.zn, f = S.f, cx = S.cx, cy = S.cy; let started = false;
    const add = (x, y, z) => { const sx = clamp(cx + f * x / z, -BIG, BIG), sy = clamp(cy - f * y / z, -BIG, BIG); if (started) ctx.lineTo(sx, sy); else { ctx.moveTo(sx, sy); started = true; } };
    let px = vx[n - 1], py = vy[n - 1], pz = vz[n - 1], pin = pz > zn;
    for (let i = 0; i < n; i++) {
      const x = vx[i], y = vy[i], z = vz[i], inn = z > zn;
      if (inn !== pin) { const t = (zn - pz) / (z - pz); add(px + (x - px) * t, py + (y - py) * t, zn); }
      if (inn) add(x, y, z);
      px = x; py = y; pz = z; pin = inn;
    }
    if (started) ctx.closePath();
  }
  const nearest = cam => { const t = vec(cam.lat, cam.lon); let best = ids[0], d = 9; for (const id of ids) { const a = angle(t, local[id].v); if (a < d) { d = a; best = id; } } return { id: best, d }; };

  // ----- one frame. opts: { arcs: [{ a, b, k, hot, lift }], bare (thumbnail: no glow, no haze), time }
  function draw(ctx, w, h, cam, opts = {}) {
    aim(cam, w, h);
    const d = cam.dist, bare = !!opts.bare, plain = !!opts.plain, lite = !!opts.lite, px = opts.px || 1, land = d >= 2.2 ? world.far : world.land; // px: line weight for small pictures
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // the air around the Earth, then the sea
    // (drawn as a stack of ever wider, ever fainter strokes along the horizon: a blur filter would cost far more)
    const air = (widths, alpha) => { ctx.beginPath(); limbPath(ctx); for (const [wd, a] of widths) { ctx.strokeStyle = `rgba(${LOOK.air},${a * alpha})`; ctx.lineWidth = wd; ctx.stroke(); } };
    if (!bare) air(lite ? [[40, 0.05], [18, 0.09], [5, 0.2]] : [[64, 0.022], [48, 0.03], [34, 0.04], [22, 0.055], [13, 0.08], [7, 0.12], [3, 0.2]], 1);
    ctx.beginPath(); limbPath(ctx); ctx.fillStyle = LOOK.sea; ctx.fill();
    ctx.save(); ctx.beginPath(); limbPath(ctx); ctx.clip();

    const near = nearest(cam), kR = near.d < 0.5 ? 1 - smooth(d, 0.3, 0.7) : 0, kM = near.d < 0.2 ? 1 - smooth(d, 0.045, 0.085) : 0, loc = local[near.id];
    // graticule
    const line = (list, style, width, closed) => { ctx.beginPath(); for (const g of list) strokeLine(ctx, g, closed); ctx.strokeStyle = style; ctx.lineWidth = width * px; ctx.stroke(); };
    line(grat30, `rgba(${LOOK.grid},${0.1 - 0.05 * kR})`, 1);
    const k10 = 1 - smooth(d, 0.9, 2.2); if (k10 > 0.01) line(grat10, `rgba(${LOOK.grid},${0.06 * k10})`, 1);
    // the whole world
    ctx.beginPath(); for (const g of land) fillRing(ctx, g); ctx.fillStyle = LOOK.land; ctx.fill('evenodd');
    ctx.beginPath(); for (const g of world.lakes) fillRing(ctx, g); ctx.fillStyle = LOOK.sea; ctx.fill('evenodd');
    if (!bare && !lite) line(land, `rgba(${LOOK.coast},.12)`, 5, true);
    line(land, `rgba(${LOOK.coast},.6)`, 1, true);
    // city lights: every urban area of the world as a point, until the real footprints take over
    const kL = smooth(d, 0.12, 0.5);
    if (kL > 0.01) {
      // all of them in two paths (glow, core): thousands of separate fills would stall the frame
      const s = clamp(S.f * 0.0016 / d, 0.5, 3.2), seen = [];
      for (const lt of lights) { const p = project(lt.v); if (p && p[0] > -9 && p[0] < w + 9 && p[1] > -9 && p[1] < h + 9) seen.push(p[0], p[1], clamp(lt.size * 2.2, 0.35, 1.5) * s); }
      const dots = (k, style) => { ctx.beginPath(); for (let i = 0; i < seen.length; i += 3) { ctx.moveTo(seen[i] + seen[i + 2] * k, seen[i + 1]); ctx.arc(seen[i], seen[i + 1], seen[i + 2] * k, 0, 7); } ctx.fillStyle = style; ctx.fill(); };
      if (d > 1) dots(2.4, `rgba(${LOOK.light},${0.1 * kL})`);
      dots(0.75, `rgba(${LOOK.light},${0.6 * kL})`);
    }
    // the region and then the metro area of the nearest city, in finer shapes. A level fades in only once
    // its box reaches past most of the view, so its border never reads as a rectangle on the map.
    const level = (L, k, big) => {
      if (k <= 0.01) return;
      ctx.save(); ctx.globalAlpha = k;
      ctx.beginPath(); fillRing(ctx, L.box); ctx.fillStyle = LOOK.sea; ctx.fill();
      ctx.beginPath(); for (const g of L.land) fillRing(ctx, g); ctx.fillStyle = plain ? '#1b3f5e' : LOOK.land; ctx.fill('evenodd');
      ctx.beginPath(); for (const g of L.lakes) fillRing(ctx, g); ctx.fillStyle = LOOK.sea; ctx.fill('evenodd');
      if (plain) {
        ctx.beginPath(); for (const g of L.urban) fillRing(ctx, g); ctx.fillStyle = `rgba(${LOOK.urban},.5)`; ctx.fill('evenodd');
        line(L.rivers, `rgba(${LOOK.river},.95)`, 1.5); line(L.roads, `rgba(${LOOK.road},.5)`, 0.8); line(L.land, `rgba(${LOOK.coast},.95)`, 1.2, true);
      } else {
        // built-up land: a translucent body with a lit edge, like the parts in the 3D view
        ctx.beginPath(); for (const g of L.urban) fillRing(ctx, g); ctx.fillStyle = `rgba(${LOOK.lit},${big ? 0.13 : 0.2})`; ctx.fill('evenodd');
        if (big && !bare && !lite) line(L.urban, `rgba(${LOOK.urban},.14)`, 4.5, true);
        line(L.urban, `rgba(${LOOK.urban},${big ? 0.7 : 0.55})`, big ? 1 : 0.7, true);
        line(L.rivers, `rgba(${LOOK.river},${big ? 0.8 : 0.55})`, big ? 1.6 : 1);
        if (big) {
          line(L.rail, `rgba(${LOOK.rail},.2)`, 0.8);
          line(L.roads2, `rgba(${LOOK.road},.22)`, 0.9);
          if (!bare && !lite) line(L.roads, `rgba(${LOOK.road},.12)`, 4.5);
          line(L.roads, `rgba(${LOOK.road},.66)`, 1.3);
        } else line(L.roads, `rgba(${LOOK.road},.14)`, 0.8);
        if (!bare && !lite) line(L.land, `rgba(${LOOK.coast},.14)`, 5, true);
        line(L.land, `rgba(${LOOK.coast},.75)`, big ? 1.3 : 1, true);
      }
      ctx.restore();
    };
    if (kR > 0.01) { line(loc.grid2, `rgba(${LOOK.grid},${0.06 * kR * (1 - kM)})`, 1); level(loc.region, kR, false); }
    if (kM > 0.01) { level(loc.metro, kM, true); if (!plain) line(loc.grid05, `rgba(${LOOK.grid},${0.07 * kM})`, 1); }
    // names of neighbouring towns on the close-up
    if (kM > 0.5 && !bare) {
      ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(200,220,240,${0.75 * kM})`;
      for (const pl of loc.metro.places) { const p = project(pl.v); if (!p) continue; ctx.beginPath(); ctx.arc(p[0], p[1], 2.2, 0, 7); ctx.fill(); ctx.fillText(pl.name.toUpperCase().split('').join('\u200a'), p[0], p[1] - 9); }
    }
    // haze: the air seen edge-on, thickest at the horizon
    if (!bare) {
      air(lite ? [[90, 0.04], [36, 0.07], [2.5, 0.35]] : [[150, 0.02], [110, 0.025], [78, 0.03], [52, 0.04], [32, 0.05], [18, 0.07], [8, 0.1], [2.5, 0.35]], 1);
      // the globe as a ball: darker toward the edge, a little light from the upper left
      const kB = smooth(d, 0.5, 2);
      if (kB > 0.01) {
        const o = [-S.C[0], -S.C[1], -S.C[2]], z = dot(o, S.D), gx = S.cx + S.f * dot(o, S.R) / z, gy = S.cy - S.f * dot(o, S.U) / z, r = S.f * Math.tan(Math.asin(S.a));
        const g = ctx.createRadialGradient(gx - r * 0.3, gy - r * 0.35, r * 0.1, gx, gy, r * 1.02);
        g.addColorStop(0, `rgba(140,200,255,${0.07 * kB})`); g.addColorStop(0.55, 'rgba(7,11,16,0)'); g.addColorStop(1, `rgba(4,7,11,${0.62 * kB})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }
    ctx.restore();
    ctx.restore();
    if (opts.arcs || opts.pins) mark(ctx, w, h, cam, opts);
    return { near: near.id, kR, kM };
  }
  // what moves on top of the map: the routes and the city pins. Kept apart so a still map is not redrawn for a pulse.
  function mark(ctx, w, h, cam, opts) {
    aim(cam, w, h);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // routes between cities: great circles lifted off the ground, drawn up to k (0..1)
    for (const arc of opts.arcs || []) {
      arc.mid = null; if ((arc.k ?? 1) <= 0) continue;
      const A = local[arc.a].v, B = local[arc.b].v, om = angle(A, B), n = 72, lift = arc.lift ?? 0.05 + om * 0.09, upto = clamp(arc.k ?? 1, 0, 1);
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n; if (t > upto + 1e-6) break;
        const s0 = Math.sin((1 - t) * om) / Math.sin(om), s1 = Math.sin(t * om) / Math.sin(om);
        pts.push(project([A[0] * s0 + B[0] * s1, A[1] * s0 + B[1] * s1, A[2] * s0 + B[2] * s1], lift * Math.sin(Math.PI * t)));
      }
      const path = () => { ctx.beginPath(); let pen = false; for (const p of pts) { if (!p) { pen = false; continue; } if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); pen = true; } };
      const col = arc.hot ? '255,170,120' : arc.calm ? '95,211,138' : LOOK.coast, a = arc.alpha ?? 1;
      path(); ctx.strokeStyle = `rgba(${col},${0.16 * a})`; ctx.lineWidth = (arc.w || 2) * 3.4; ctx.stroke();
      path(); ctx.strokeStyle = `rgba(${col},${0.95 * a})`; ctx.lineWidth = arc.w || 2; ctx.stroke();
      const head = pts[pts.length - 1];
      if (head && upto < 1) { ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(head[0], head[1], 3.2, 0, 7); ctx.fill(); }
      // where the route's number goes: a third of the way from the city left behind; beside the line when the route is short
      const at = Math.round(n * (om < 0.35 ? 0.5 : 0.36)), mid = pts[at]; arc.mid = null;
      if (pts.length > at && mid) {
        const o = [-S.C[0], -S.C[1], -S.C[2]], z = dot(o, S.D), dx = mid[0] - (S.cx + S.f * dot(o, S.R) / z), dy = mid[1] - (S.cy - S.f * dot(o, S.U) / z), l = Math.hypot(dx, dy) || 1, off = om < 0.35 ? 44 : 17;
        arc.mid = [mid[0] + dx / l * off, mid[1] + dy / l * off];
      }
    }
    // the cities: a ring that lands, a slow pulse, a core
    for (const pin of opts.pins || []) {
      const p = project(local[pin.id].v); pin.at = p ? [p[0], p[1]] : null;
      const k = clamp(pin.k ?? 1, 0, 1); if (!p || k <= 0) continue;
      const e = 1 - (1 - k) ** 3, col = pin.you ? LOOK.coast : '255,255,255', ph = (((opts.time || 0) / 2.6 + (pin.phase || 0)) % 1 + 1) % 1, big = pin.big ? 1.5 : 1;
      ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(${col},${0.55 * (1 - ph) * e})`; ctx.beginPath(); ctx.arc(p[0], p[1], (7 + 20 * ph) * big, 0, 7); ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = `rgba(${col},${e})`; ctx.beginPath(); ctx.arc(p[0], p[1], (7 + 26 * (1 - e)) * big, 0, 7); ctx.stroke();
      ctx.fillStyle = `rgba(7,11,16,${0.55 * e})`; ctx.beginPath(); ctx.arc(p[0], p[1], 6 * big, 0, 7); ctx.fill();
      ctx.fillStyle = pin.you ? `rgba(${LOOK.coast},${e})` : `rgba(255,255,255,${e})`; ctx.beginPath(); ctx.arc(p[0], p[1], 3.1 * big, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  // ----- flights: pan along the great circle while the altitude rises and falls, at an even speed on screen
  function flight(A, B) {
    const a = vec(A.lat, A.lon), b = vec(B.lat, B.lon), om = angle(a, b), N = 80;
    const top = Math.max(A.dist, B.dist, Math.min(3.2, 0.35 + om * 1.25)), la = Math.log(A.dist), lb = Math.log(B.dist);
    const bump = Math.max(0, Math.log(top) - Math.max(la, lb)) * (om > 0.01 ? 1 : 0);
    const distAt = x => Math.exp(la + (lb - la) * x + bump * Math.sin(Math.PI * x) ** 1.4);
    const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + distAt((i - 0.5) / N));
    const pan = x => { const f = clamp(x, 0, 1) * N, i = Math.min(N - 1, Math.floor(f)); return (cum[i] + (cum[i + 1] - cum[i]) * (f - i)) / cum[N]; };
    const dh = ((((B.head || 0) - (A.head || 0)) % 360) + 540) % 360 - 180;
    return x => {
      const p = pan(x); let v;
      if (om < 1e-6) v = a; else { const s0 = Math.sin((1 - p) * om) / Math.sin(om), s1 = Math.sin(p * om) / Math.sin(om); v = [a[0] * s0 + b[0] * s1, a[1] * s0 + b[1] * s1, a[2] * s0 + b[2] * s1]; }
      const mix = (k, e = x) => (A[k] || 0) + ((B[k] || 0) - (A[k] || 0)) * e;
      return { lat: Math.asin(clamp(v[2], -1, 1)) / RAD, lon: Math.atan2(v[1], v[0]) / RAD, dist: distAt(x), tilt: mix('tilt', x * x * (3 - 2 * x)), head: (A.head || 0) + dh * x, ox: mix('ox'), oy: mix('oy') };
    };
  }
  // the view that holds every city: aimed at the middle of them
  const middle = () => {
    let m = unit(ids.reduce((s, id) => [s[0] + local[id].v[0], s[1] + local[id].v[1], s[2] + local[id].v[2]], [0, 0, 0]));
    // step toward the farthest city, in ever smaller steps: the centre of the smallest circle around all of them
    for (let i = 0; i < 400; i++) { const far = ids.map(id => local[id].v).sort((a, b) => angle(m, b) - angle(m, a))[0], k = 0.25 / (i + 2); m = unit([m[0] + (far[0] - m[0]) * k, m[1] + (far[1] - m[1]) * k, m[2] + (far[2] - m[2]) * k]); }
    return { lat: Math.asin(m[2]) / RAD, lon: Math.atan2(m[1], m[0]) / RAD, spread: Math.max(...ids.map(id => angle(m, local[id].v))) };
  };
  const closeUp = id => ({ lat: cities[id].lat, lon: cities[id].lon, dist: 0.034, tilt: 36, head: 0 });
  // a still picture of one city from straight above, for the headings
  function thumb(id, size, dpr = 2, dist = 0.062) {
    const c = document.createElement('canvas'); c.width = c.height = Math.round(size * dpr); c.style.width = c.style.height = size + 'px';
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, 7); ctx.clip();
    draw(ctx, size, size, { lat: cities[id].lat, lon: cities[id].lon, dist, tilt: 0, head: 0 }, { bare: true, plain: true, px: 1 });
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size / 2); g.addColorStop(0, 'rgba(7,11,16,0)'); g.addColorStop(1, 'rgba(7,11,16,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(7,11,16,.6)'; ctx.beginPath(); ctx.arc(size / 2, size / 2, 5.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(size / 2, size / 2, 5, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(size / 2, size / 2, 2, 0, 7); ctx.fill();
    return c;
  }
  return { draw, mark, project, flight, middle, closeUp, thumb, nearest, local, pos: id => local[id].v, places: id => local[id].metro.places };
}
