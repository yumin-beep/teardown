// Teardown: see what an object is made of, then sort it where you are.
// Steps: look inside → take it apart → four cities → your city → your turn.
// Every bin, quote and number on screen comes from data/cities.json (see src/logic.js).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OBJECTS, MATERIALS } from './models.js';
import { makeLogic, FATES, log, seen } from './logic.js';
import { makeAtlas, km } from './globe.js';
import { makeStreet, STREET_COLORS } from './street.js';
import { makeAnimal, FRIENDS } from './friends.js';

const [cities, geo] = await Promise.all(['data/cities.json', 'data/geo.json'].map(async u => (await fetch(u)).json()));
const CITY_IDS = ['seoul', 'berlin', 'sf', 'tokyo'];
const atlas = makeAtlas(geo, cities, CITY_IDS); // the globe: coastlines, city footprints, roads (Natural Earth)
const L = makeLogic(cities, OBJECTS, CITY_IDS);
const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// where the visitor sorts: asked for in the URL, remembered, or guessed from the browser language
const guessCity = () => ({ ko: 'seoul', de: 'berlin', ja: 'tokyo' }[(navigator.language || 'en').slice(0, 2)] || 'sf');
let objectId = OBJECTS[params.get('o')] ? params.get('o') : 'coffee_cup';
let cityId = [params.get('c'), store.get('teardown.city')].find(c => cities[c]) || guessCity();
let fromCity = cities[store.get('teardown.from')] ? store.get('teardown.from') : '';
let mode = 'compare'; // compare (four cities on a timeline) | city (your city's moves) | practice (your turn)

const BIN_Y = -1.25;
const REC = params.has('rec'), ZOOM = +(params.get('z') || 1), TY = +(params.get('ty') || 0.25); // ?rec: the video recorder drives time and rendering
const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 9); // keeps z <= constant; swept in for the cross-section
const HERO_END = 0.16, EX0 = 0.18, EX1 = 0.46, SORT0 = 0.5;

// ---------- materials: x-ray look (translucent body, fresnel rim, glowing edges)
function xray(color, { thin = false } = {}) {
  const c = new THREE.Color(color);
  const m = new THREE.MeshPhysicalMaterial({
    color: c.clone().multiplyScalar(0.55), emissive: c, emissiveIntensity: 0.05, roughness: 0.35, metalness: 0,
    transparent: true, opacity: thin ? 0.32 : 0.5, side: THREE.DoubleSide, depthWrite: !thin, clearcoat: 0.4, clippingPlanes: [cut],
  });
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = { value: c };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);
        totalEmissiveRadiance += rimColor * fres * 0.6;`);
  };
  return m;
}
const edgeMat = color => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55, clippingPlanes: [cut] });

function partObject(p) {
  const matInfo = MATERIALS[OBJECTS[objectId].parts[p.id].material];
  const g = new THREE.Group();
  g.add(new THREE.Mesh(p.geo, xray(matInfo.color, { thin: p.thin })));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(p.geo, p.edgeAngle || 25), edgeMat(matInfo.color)));
  // sparse wireframe for the measured, technical look
  if (p.thin) g.add(new THREE.Mesh(p.geo, new THREE.MeshBasicMaterial({ color: matInfo.color, wireframe: true, transparent: true, opacity: 0.05, clippingPlanes: [cut] })));
  for (const e of p.extra || []) g.add(new THREE.Mesh(e, xray(matInfo.color)));
  g.traverse(o => { if (o.material) o.material.userData.base = o.material.opacity; });
  return g;
}

function binObject(color) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.62, 0.72, 0.56); geo.translate(0, 0.36, 0);
  const c = new THREE.Color(color), hsl = c.getHSL({});
  if (hsl.l < 0.4) c.setHSL(hsl.h, hsl.s, 0.4); // black and grey bins still have to read against the dark floor
  const body = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: c.clone().multiplyScalar(0.35), emissive: c, emissiveIntensity: 0.12, transparent: true, opacity: 0.55, roughness: 0.4 }));
  g.add(body);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: c })));
  const lid = new THREE.BoxGeometry(0.68, 0.05, 0.62); lid.translate(0, 0.745, 0);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(lid), new THREE.LineBasicMaterial({ color: c })));
  g.add(new THREE.Mesh(lid, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35 })));
  g.userData.body = body;
  return g;
}

// where a part with no rule is set down: an outline on the floor, no bin
function emptySpot() {
  const g = new THREE.Group();
  const pts = [[-0.31, -0.28], [0.31, -0.28], [0.31, 0.28], [-0.31, 0.28], [-0.31, -0.28]].map(([x, z]) => new THREE.Vector3(x, 0.01, z));
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x9aa7b3, dashSize: 0.07, gapSize: 0.05 }));
  line.computeLineDistances(); g.add(line);
  return g;
}

// ---------- one view per city: own canvas, renderer, bloom
const grid = $('grid'), view = $('view');
const sharedCam = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
const HOME = new THREE.Vector3(2.2, 2.6, 6.6);
sharedCam.position.copy(HOME);
let controls;
const views = [];

// three.js links shaders in the background where the browser allows it and leaves an object out until its shader is ready.
// A picture that is drawn once (the street stills, the animal's face) and the frame-stepped recorder cannot wait for that,
// so their renderers link each shader at first use.
const linkNow = r => { const has = r.extensions.has.bind(r.extensions); r.extensions.has = n => n !== 'KHR_parallel_shader_compile' && has(n); return r; };
function makeView(cid, allBins) {
  const city = cities[cid];
  const rules = city.rules[objectId] || {};
  const cell = document.createElement('div'); cell.className = 'cell'; cell.dataset.city = cid;
  const canvas = document.createElement('canvas'); cell.appendChild(canvas);
  const hud = document.createElement('div'); hud.className = 'hud'; cell.appendChild(hud);
  grid.appendChild(cell);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }); if (REC) linkNow(renderer);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b10);
  scene.fog = new THREE.Fog(0x070b10, 9, 18);
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x10141a, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(3, 5, 4); scene.add(key);
  const back = new THREE.DirectionalLight(0x66aaff, 1.4); back.position.set(-4, 2, -3); scene.add(back);
  const floor = new THREE.GridHelper(12, 48, 0x1d3a52, 0x0f2030); floor.position.y = BIN_Y; scene.add(floor);

  // compare and "your city" show the bins this object needs; practice shows every bin the city has
  const shown = city.bins.filter(b => b.id !== 'none' && (allBins || Object.values(rules).some(r => r.bin === b.id)));
  const spacing = shown.length > 5 ? 0.8 : 0.9;
  const bins = {};
  const orphans = L.skipped(cid, objectId).length > 0; // parts with no rule get a marked empty spot beside the bins
  const row = shown.length + (orphans ? 1 : 0);
  shown.forEach((b, i) => {
    const m = binObject(b.color); m.position.set((i - (row - 1) / 2) * spacing, BIN_Y, 0.2);
    scene.add(m); bins[b.id] = { ...b, mesh: m, x0: m.position.x, top: 0.8 };
  });
  if (orphans) {
    const m = emptySpot(); m.position.set((row - 1) / 2 * spacing, BIN_Y, 0.2); scene.add(m);
    bins.none = { id: 'none', short: 'No rule', color: '#9aa7b3', mesh: m, x0: m.position.x, top: 0.03, empty: true };
  }
  // behind the bins: the city's street, drawn from the number the city publishes about itself.
  // In practice the city's animal sits at the end of the row and answers each throw (FRIENDS has why that animal).
  const st = L.street(cid), street = st ? makeStreet(scene, cid, st, row * spacing, BIN_Y, HOME.x / HOME.z) : null;
  const post = { x: -(row - 1) / 2 * spacing - 1.04, z: 0.62 };
  const friend = allBins && FRIENDS[cid] ? makeAnimal(scene, FRIENDS[cid].kind, { ...post, y: BIN_Y, size: 2.1, face: Math.atan2(HOME.x - post.x, HOME.z - post.z) * 0.8, tween }) : null;
  const sc = OBJECTS[objectId].scale || 1;
  const parts = OBJECTS[objectId].build().map(p => {
    if (sc !== 1) { p.geo.scale(sc, sc, sc); (p.extra || []).forEach(e => e.scale(sc, sc, sc)); p.explode.multiplyScalar(sc); }
    const obj = partObject(p);
    const center = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    obj.children.forEach(c => { c.geometry = c.geometry.clone().translate(-center.x, -center.y, -center.z); });
    center.y += OBJECTS[objectId].lift || 0;
    obj.position.copy(center); scene.add(obj);
    const r = rules[p.id];
    return { ...p, obj, center, rule: r, bin: bins[r && r.basis !== 'not_stated' ? r.bin : 'none'] || null, stackY: 0, up: 0, k: 0, peel: 0, done: false };
  });
  for (const p of parts) { const h = L.hostOf(cid, objectId, p.id); if (h) p.host = parts.find(q => q.id === h); }
  // each pile is stacked on its bin by its real height (a pile = a part plus whatever stays attached to it)
  for (const p of parts) {
    if (p.host) continue;
    const box = new THREE.Box3().setFromObject(p.obj); for (const q of parts) if (q.host === p) box.expandByObject(q.obj);
    p.up = (p.center.y - box.min.y) * 0.5;
    if (p.bin) { p.stackY = p.bin.top; p.bin.top += (box.max.y - box.min.y) * 0.5 + 0.05; }
  }

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, sharedCam));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.45, 0.35)); composer.addPass(new OutputPass());

  // heading: city, bins needed, and what the sort leaves behind
  const t = L.tally(cid, objectId), need = L.binsNeeded(cid, objectId);
  const left = t.residual ? `<span class="bad">${plural(t.residual, 'part')} to residual waste</span>` : t.unknown ? '' : '<span class="good">nothing left for residual waste</span>';
  const rows = L.partsOf(objectId).map(pid => {
    const r = rules[pid], b = L.binOf(cid, objectId, pid);
    return `<li><span>${esc(OBJECTS[objectId].parts[pid].label)}</span><span class="chip${L.hostOf(cid, objectId, pid) ? ' att' : ''}" style="--c:${b ? b.color : '#888'}">${b ? esc(b.short) : '?'}${r && r.basis === 'nearest' ? '<sup>≈</sup>' : ''}</span></li>`;
  }).join('');
  hud.innerHTML = `<div class="city"><button class="loc" data-atlas="${cid}" aria-label="Show ${esc(city.name)} on the map" title="Where is ${esc(city.name)}?"></button><div><b>${esc(city.name)}</b>${city.native && city.native !== city.name ? `<em class="native" lang="${esc(city.lang)}">${esc(city.native)}</em>` : ''}<i hidden></i><span class="count">${mode === 'practice' ? 'every bin the city has' : plural(need, 'bin')}</span></div></div><div class="res"><ul>${rows}</ul><div class="tally">${left}${t.unnamed ? `<span class="unk">${plural(t.unnamed, 'part')} not named in the guide</span>` : ''}</div>${street ? streetNote(cid, false) : ''}</div>`;
  if (street && mode === 'city') cell.insertAdjacentHTML('beforeend', streetNote(cid, true));
  if (street && mode !== 'compare') hud.insertAdjacentHTML('beforeend', streetNote(cid, null));
  const loc = hud.querySelector('.loc'); loc.appendChild(locator(cid, mode === 'compare' ? 44 : 58));
  loc.addEventListener('pointerdown', e => e.stopPropagation()); // or the orbit control would take the press and the click with it
  const binTags = Object.values(bins).map(b => { const d = document.createElement('div'); d.className = 'bintag' + (b.empty ? ' empty' : ''); d.style.setProperty('--c', b.color); d.textContent = b.short; cell.appendChild(d); return { d, b }; });
  const partTags = parts.map(p => { const d = document.createElement('div'); d.className = 'parttag'; const info = OBJECTS[objectId].parts[p.id]; d.innerHTML = `<b>${esc(info.label)}</b><span>${esc(MATERIALS[info.material].name)}</span>`; cell.appendChild(d); const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); return { d, p, line }; });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('leaders'); cell.appendChild(svg);
  partTags.forEach(t => svg.appendChild(t.line));
  const v = { id: cid, city, cell, canvas, renderer, composer, scene, parts, bins, spacing, binTags, partTags, svg, street, friend, current: null, focus: null };
  badge(v);
  return v;
}
// a small picture of the city from straight above, drawn once
const locators = new Map();
function locator(cid, size) { const k = cid + size; if (!locators.has(k)) locators.set(k, atlas.thumb(cid, size, 2)); return locators.get(k); }
// which of the four views is the visitor's city, and which is the city they learned to sort in
function badge(v) {
  const i = v.cell.querySelector('.city i'), t = v.id === cityId ? 'you' : v.id === fromCity ? 'learned' : '';
  i.textContent = t; i.hidden = !t; i.className = t === 'learned' ? 'from' : '';
}

function build() {
  for (const v of views) { v.renderer.dispose(); v.renderer.forceContextLoss(); }
  grid.innerHTML = ''; views.length = 0; if (controls) controls.dispose();
  for (const cid of mode === 'compare' ? CITY_IDS : [cityId]) views.push(makeView(cid, mode === 'practice'));
  sharedCam.position.copy(HOME);
  controls = new OrbitControls(sharedCam, grid);
  controls.target.set(0, TY, 0); controls.enablePan = false; controls.minDistance = 4; controls.maxDistance = 12; controls.enableDamping = true;
  heroOn = null;
  grid.classList.toggle('solo', mode !== 'compare'); grid.dataset.mode = mode;
  $('side').hidden = mode === 'compare';
  resize(); buildVerdict();
}

// ---------- tweens: advanced by the frame loop, or by the recorder in ?rec mode
const tweens = new Set();
let clock = 0;
function tween(dur, fn, done) { const tw = { t: 0, dur: Math.max(dur, 1e-3), fn, done }; tweens.add(tw); return tw; }
function advance(dt) { clock += dt; for (const tw of [...tweens]) { tw.t += dt; const x = Math.min(1, tw.t / tw.dur); tw.fn(x); if (x >= 1) { tweens.delete(tw); if (tw.done) tw.done(); } } }

// ---------- timeline
const slider = $('t');
let T = 0, timeTween = null;
const UP = new THREE.Vector3(0, 1, 0);
function pose() {
  // "your city" goes straight from the whole object to its piles; the other modes open it up first
  const ex = mode === 'city' ? 0 : ease(clamp01((T - EX0) / (EX1 - EX0)));
  for (const v of views) {
    for (const p of v.parts) {
      if (p.host) continue;
      const pos = p.explode.clone().multiplyScalar(ex).add(p.center);
      const k = mode === 'practice' ? p.k : clamp01((T - SORT0 - v.parts.indexOf(p) * 0.05) / 0.33);
      p.sc = 1; p.rot = 0;
      if (p.bin && k > 0) {
        const e = ease(k);
        pos.lerp(p.bin.mesh.position.clone().add(new THREE.Vector3(0, p.stackY + p.up, 0)), e); pos.y += Math.sin(e * Math.PI) * 0.9;
        p.sc = 1 - 0.5 * e; p.rot = e * Math.PI;
      }
      p.obj.position.copy(pos); p.obj.scale.setScalar(p.sc); p.obj.rotation.set(0, p.rot, 0);
    }
    // attached parts ride on their host: they peel away while the object opens, then settle back
    for (const p of v.parts) {
      if (!p.host) continue;
      const h = p.host, peel = mode === 'practice' ? p.peel : Math.sin(Math.PI * ex);
      const off = p.center.clone().sub(h.center).add(p.explode.clone().multiplyScalar(peel)).multiplyScalar(h.sc).applyAxisAngle(UP, h.rot);
      p.obj.position.copy(h.obj.position).add(off); p.obj.scale.setScalar(h.sc); p.obj.rotation.set(0, h.rot, 0);
    }
  }
}
function setT(t) {
  T = t;
  // cross-section: the cut sweeps in from the front, holds, then lifts off before the split
  const c = mode !== 'compare' || t < 0.03 ? 0 : t < 0.1 ? ease((t - 0.03) / 0.07) : t < HERO_END ? 1 : 0;
  const cutTo = OBJECTS[objectId].cutTo ?? 0;
  cut.constant = c === 0 ? 9 : 2.2 - (2.2 - cutTo) * c;
  setHero(mode === 'compare' && t < HERO_END);
  pose();
  $('phase').textContent = t < 0.03 ? 'Whole object' : t < HERO_END ? 'Cross-section' : t < SORT0 ? 'Taking it apart' : t < 0.97 ? 'Sorting by city rules' : 'Sorted';
  $('summary').hidden = mode !== 'compare' || t < 0.985;
  grid.classList.toggle('sorted', mode === 'city' || t >= 0.9);
  const rise = mode === 'practice' ? 1 : clamp01((t - SORT0 - 0.02) / 0.3);
  for (const v of views) if (v.street) v.street.grow(rise);
  grid.classList.toggle('streeton', rise > 0.6);
  // a device that still works has no bin yet: the bin appears when the visitor says it is finished
  if (mode === 'city') { const kept = keptWhole() && t <= SORT0 + 0.004; grid.classList.toggle('kept', kept); for (const v of views) for (const b of Object.values(v.bins)) b.mesh.visible = !kept; } else grid.classList.remove('kept');
  // once the parts start flying to bins the page has shown the rules: a later practice run is no longer a baseline
  if (mode === 'compare' && t >= SORT0 && shownFor !== objectId) { shownFor = objectId; seen.mark(CITY_IDS, objectId); }
  syncSteps();
}
let shownFor = null;
function animateT(to, dur) {
  if (timeTween) tweens.delete(timeTween);
  const from = T; dur ??= Math.min(5, Math.max(0.6, Math.abs(to - from) * 9));
  timeTween = tween(dur, x => { const t = from + (to - from) * x; slider.value = t; setT(t); }, () => { timeTween = null; syncSteps(); });
  syncSteps();
}
slider.addEventListener('input', () => { if (timeTween) { tweens.delete(timeTween); timeTween = null; } setT(+slider.value); });
$('play').addEventListener('click', () => {
  if (timeTween) { tweens.delete(timeTween); timeTween = null; syncSteps(); return; }
  if (T >= 0.99) { slider.value = 0; setT(0); }
  animateT(1, 9 * (1 - T));
});

// Setting a canvas's size clears it, so only the views whose size changed are touched. Returns whether any was.
function resize() {
  let changed = false;
  for (const v of views) {
    const w = v.cell.clientWidth, h = v.cell.clientHeight;
    if (w === v.w && h === v.h) continue;
    v.renderer.setSize(w, h, false); v.composer.setSize(w, h);
    v.w = w; v.h = h; changed = true;
    if (v.fit) v.fit.z = measure(v).z;
  }
  return changed;
}
// a resize that comes from the layout (the window, the side card, the verdict bar) is drawn again at once, so no blank frame shows
const resized = () => { if (resize()) frame(true); };
addEventListener('resize', resized);

const tmp = new THREE.Vector3();
function camFor(v) {
  sharedCam.aspect = v.w / v.h;
  // four views: fit the narrow column; one large view: fit what fitSolo() measured
  sharedCam.zoom = heroOn ? (OBJECTS[objectId].heroZoom || 1.2) : mode === 'compare' || !v.fit ? Math.min(1.05, 0.13 + sharedCam.aspect * 0.8) * ZOOM : v.fit.z * ZOOM;
  // small views (phones): draw the scene lower, so the result list above it stays readable
  if (!heroOn && v.h < 330) sharedCam.setViewOffset(v.w, v.h, 0, -v.h * (mode === 'compare' ? 0.2 : 0.15), v.w, v.h); else sharedCam.clearViewOffset();
  sharedCam.updateProjectionMatrix();
}
function project(obj, v, dy = 0) { obj.getWorldPosition(tmp); tmp.y += dy; tmp.project(sharedCam); return [(tmp.x + 1) / 2 * v.w, (1 - tmp.y) / 2 * v.h]; }
let lastNow = performance.now();
// where the city's name and street line end inside a view, so part labels can stay clear of them
function hudBox(v) {
  if (!v.hb || v.hb.w !== v.w) {
    const c = v.cell.getBoundingClientRect(); let r = 0, b = 0;
    for (const el of v.cell.querySelector('.hud').children) { const q = el.getBoundingClientRect(); if (!q.width) continue; r = Math.max(r, q.left - c.left + Math.max(q.width, el.scrollWidth)); b = Math.max(b, q.bottom - c.top); }
    v.hb = { w: v.w, r, b };
  }
  return v.hb;
}
function frame(redraw) {
  const live = !REC && redraw !== true; // redraw === true: the same moment drawn again after a resize, with no step in time
  const now = performance.now(); if (live) advance(Math.min(0.1, (now - lastNow) / 1000));
  if (A.on && live && !A.lite) { A.slow = now - lastNow > 50 ? A.slow + 1 : 0; if (A.slow > 12) A.lite = true; } // a slow machine gets the map without its glow
  if (redraw !== true) lastNow = now;
  controls.update();
  if (A.on) drawAtlas();
  for (const v of views) {
    if (!v.w || v.cell.offsetParent === null || (A.on && A.show > 0.995)) continue;
    camFor(v);
    if (v.friend) v.friend.update(clock);
    v.composer.render();
    for (const { d, b } of v.binTags) { const [x, y] = project(b.mesh, v, -0.05); d.style.transform = `translate(${x}px, ${y + 4}px) translate(-50%, 0)`; }
    // part labels with leader lines: while the object is open, for the part being asked, or for the move being pointed at
    const hero = heroOn && T > 0.09;
    v.partTags.forEach(({ d, p, line }, i) => {
      const show = mode === 'practice' ? !p.done && (p === v.current || !p.host)
        : mode === 'city' ? (v.focus ? v.focus.includes(p.id) : T >= 1 && !p.host)
          : hero || (T > 0.3 && T < 0.56 && !(p.host && T > 0.42));
      if (!show) { d.style.opacity = 0; line.style.opacity = 0; return; }
      const [x, y] = project(p.obj, v);
      const side = p.labelSide || (x > v.w / 2 ? 1 : -1);
      let lx = x + side * (34 + (i % 2) * 12), ly = y - 26 - (mode === 'city' ? 0 : p.labelDy || 0);
      const tw = d.offsetWidth || 90;
      lx = side > 0 ? Math.min(lx, v.w - tw - 4) : Math.max(lx, tw + 4);
      if (mode !== 'compare') { const hb = hudBox(v); if ((side > 0 ? lx : lx - tw) < hb.r + 10 && ly - 22 < hb.b + 6) ly = hb.b + 30; } // a label never sits on the city's name and street line
      d.style.transform = `translate(${lx}px, ${ly}px) translate(${side > 0 ? 0 : -100}%, -50%)`;
      d.style.opacity = 1; d.classList.toggle('on', p === v.current);
      line.setAttribute('x1', x); line.setAttribute('y1', y); line.setAttribute('x2', lx); line.setAttribute('y2', ly);
      line.style.opacity = 0.8;
    });
  }
  if (live) requestAnimationFrame(frame);
}

// one large view: frame the object as it stands now together with the row of bins
const probe = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
function measure(v) {
  const objs = [...v.parts.map(p => p.obj), ...Object.values(v.bins).map(b => b.mesh)], boxes = objs.map(o => new THREE.Box3().setFromObject(o));
  if (v.friend) boxes.push(v.friend.box());
  const lo = Math.min(...boxes.map(b => b.min.y)), hi = Math.max(...boxes.map(b => b.max.y)), y = (lo + hi) / 2;
  probe.position.copy(HOME); probe.position.y += y - TY; probe.lookAt(0, y, 0); probe.aspect = v.w / v.h; probe.zoom = 1; probe.updateProjectionMatrix(); probe.updateMatrixWorld();
  let m = 0;
  for (const box of boxes) for (const x of [box.min.x, box.max.x]) for (const yy of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) { tmp.set(x, yy, z).project(probe); m = Math.max(m, Math.abs(tmp.x) / 0.88, Math.abs(tmp.y) / (v.h < 330 ? 0.62 : 0.8)); }
  return { y, z: Math.min(1.15, 1 / m) };
}
function fitSolo(smooth) {
  const v = views[0], to = measure(v), from = v.fit && smooth ? { ...v.fit } : null;
  const apply = x => {
    const e = ease(x), y = from ? from.y + (to.y - from.y) * e : to.y;
    v.fit = { y, z: from ? from.z + (to.z - from.z) * e : to.z };
    sharedCam.position.y += y - controls.target.y; controls.target.y = y; controls.update();
  };
  if (from) tween(0.9, apply); else { sharedCam.position.copy(HOME); controls.target.set(0, TY, 0); apply(1); }
}

// dim everything except the parts being talked about
function setFocus(v, ids) {
  v.focus = ids;
  for (const p of v.parts) {
    const on = !ids || ids.includes(p.id);
    p.obj.traverse(o => { const m = o.material; if (!m) return; m.opacity = m.userData.base * (on ? 1 : 0.2); if (m.isMeshPhysicalMaterial) m.emissiveIntensity = ids && on ? 0.28 : 0.05; });
  }
}
// a bin answers a throw: it swells when right, shakes when wrong
function pulse(bin, good) {
  tween(good ? 0.7 : 0.5, x => {
    const m = bin.mesh, body = m.userData.body;
    if (good) { m.scale.setScalar(1 + 0.14 * Math.sin(Math.PI * x)); body.material.emissiveIntensity = 0.12 + 0.9 * Math.sin(Math.PI * x); }
    else m.position.x = bin.x0 + Math.sin(x * Math.PI * 6) * 0.06 * (1 - x);
  });
}

// ---------- picking: a part opens every city's rule for it; in practice a bin takes the answer
const ray = new THREE.Raycaster();
let downAt = null;
grid.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
grid.addEventListener('click', e => {
  if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; // that was a rotate, not a click
  const cell = e.target.closest('.cell'); if (!cell) return;
  const v = views.find(v => v.cell === cell); const b = cell.getBoundingClientRect();
  camFor(v);
  ray.setFromCamera({ x: (e.clientX - b.left) / b.width * 2 - 1, y: -((e.clientY - b.top) / b.height) * 2 + 1 }, sharedCam);
  const under = o => g => { let x = o; while (x) { if (x === g) return true; x = x.parent; } return false; };
  if (mode === 'practice') {
    const hit = ray.intersectObjects(Object.values(v.bins).map(b => b.mesh), true)[0];
    const bin = hit && Object.values(v.bins).find(b => under(hit.object)(b.mesh));
    if (bin) answer(bin.id);
    return;
  }
  const hit = ray.intersectObjects(v.parts.map(p => p.obj), true).find(h => h.object.isMesh);
  if (hit) showPart(v.parts.find(p => under(hit.object)(p.obj)).id);
});

// the official sentence for one part in one city, with its gloss and source
function ruleBlock(c, pid) {
  const r = L.rule(c, objectId, pid); if (!r) return '';
  const note = r.quote && r.quote.startsWith('(');
  return (r.quote ? (note ? `<p class="note">Teardown note: ${esc(r.quote.slice(1, -1))}</p>` : `<blockquote lang="${cities[c].lang}">${esc(r.quote)}</blockquote>`) + (r.quote_en ? `<p class="gloss">${esc(r.quote_en)}</p>` : '') : '') +
    (r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${note ? 'Source of the main part\'s rule: ' : ''}${esc(r.source)}</a>` : '');
}
const hostWords = () => OBJECTS[objectId].host; // "on the cup", "in the phone"
function basisTag(c, pid) {
  const r = L.rule(c, objectId, pid);
  return !r || r.basis === 'not_stated' ? '<span class="tag">no rule found</span>' : r.basis === 'nearest' ? '<span class="tag">≈ nearest listed item</span>' : L.hostOf(c, objectId, pid) ? `<span class="tag">stays ${esc(hostWords())}</span>` : '';
}
function showPart(pid) {
  seen.mark(CITY_IDS, objectId);
  const info = OBJECTS[objectId].parts[pid];
  let html = `<h2>${esc(info.label)}</h2><p class="mat">${esc(MATERIALS[info.material].name)} · ${esc(info.note)}</p>`;
  for (const c of CITY_IDS) {
    const bin = L.binOf(c, objectId, pid);
    html += `<div class="rule${c === cityId ? ' me' : ''}"><div class="rc"><span class="dot" style="background:${bin ? bin.color : '#888'}"></span><b>${esc(cities[c].name)}</b> → ${bin ? esc(bin.name) : 'not stated'} ${basisTag(c, pid)}</div>${ruleBlock(c, pid)}</div>`;
  }
  $('panel').innerHTML = html + '<button class="close" data-close="panel">Close</button>'; $('panel').hidden = false;
}

let heroOn = null;
function setHero(on) {
  if (on === heroOn) return; heroOn = on;
  grid.classList.toggle('hero', on); $('cap').hidden = !on; if (on) renderCap();
  for (const v of views) for (const b of Object.values(v.bins)) b.mesh.visible = !on;
  // frame the whole object in the hero shot, the bins row otherwise
  if (views[0] && controls) {
    const box = new THREE.Box3(); views[0].parts.forEach(p => box.expandByObject(p.obj));
    const cy = on ? box.getCenter(new THREE.Vector3()).y : TY;
    sharedCam.position.y += cy - controls.target.y; controls.target.set(0, cy, 0); controls.update();
  }
  resize();
}

// ---------- atlas: where the four cities are. The globe covers the 3D view (never the side card).
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const AUTO = (!REC || params.has('auto')) && !reduced; // map scenes play by themselves, except for the recorder (which calls them) and for people who asked for less motion
// (the recorder's browser has no graphics card: there the map is drawn in memory, which is far quicker for it)
const inMemory = REC || params.has('cpu') ? { willReadFrequently: true } : undefined;
const atlasEl = $('atlas'), atlasCv = atlasEl.querySelector('canvas'), actx = atlasCv.getContext('2d', inMemory), acap = $('acap'), astreet = $('astreet');
const mapCv = document.createElement('canvas'), mctx = mapCv.getContext('2d', inMemory); // the map itself, redrawn only when the camera moves
const A = { lite: false, slow: 0, on: false, show: 0, cam: null, base: null, state: 'over', focus: null, pinK: {}, arcs: [], capK: 1, labK: 1, seq: null, seen: {}, w: 0, h: 0, labels: {}, chips: [], drag: null };
for (const id of CITY_IDS) { A.pinK[id] = 1; const b = document.createElement('button'); b.className = 'alabel'; b.dataset.atlas = id; $('alabels').appendChild(b); A.labels[id] = b; }
const ramp = (t, a, b) => ease(clamp01((t - a) / (b - a)));
const where = c => `${Math.abs(c.lat).toFixed(2)}°${c.lat >= 0 ? 'N' : 'S'} · ${Math.abs(c.lon).toFixed(2)}°${c.lon >= 0 ? 'E' : 'W'}`;
const far = (a, b) => (Math.round(km(cities[a], cities[b]) / 10) * 10).toLocaleString('en-US') + ' km';
// the map lays itself out by the room it has: beside its caption, tighter, or stacked above it
const atlasSize = () => { A.w = view.clientWidth; A.h = view.clientHeight; A.tier = A.w > 1100 ? 2 : A.w >= 700 ? 1 : 0; atlasEl.classList.toggle('narrow', A.tier === 0); atlasEl.classList.toggle('mid', A.tier === 1); };
// the view that holds all four pins, and the view from above one city
function overCam() {
  const m = atlas.middle(), want = Math.min(A.tier ? 0.8 : 0.64, 0.86 * (A.tier ? A.w * 0.6 : A.w) / A.h), th = Math.atan(want * Math.tan(16 * Math.PI / 180));
  return { lat: m.lat, lon: m.lon, dist: 1 / Math.sin(th) - 1, tilt: 0, head: 0, ox: [0, 0.18, 0.2][A.tier], oy: A.tier ? 0 : -0.13 };
}
// (the pin sits above the street picture at the bottom right, and beside the card at the left)
const cityCam = id => ({ ...atlas.closeUp(id), ox: [0, 0.19, 0.17][A.tier], oy: [-0.24, -0.17, -0.12][A.tier] });
// a link out to the page a sentence or a number was read on
const out = (url, text) => url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)} ↗</a>` : esc(text);
const listNames = ids => ids.map(c => esc(cities[c].name)).join(', ').replace(/, ([^,]*)$/, ' and $1');
// the number a city publishes about itself: shown with its year and what it counts, never side by side as a score
function figureBlock(id) {
  const f = L.figure(id); if (!f) return '';
  return `<div class="fig"><span>${esc(cities[id].name)}'s own count · ${esc(f.period)}</span><p><b>${esc(f.value)}</b><i>${esc(f.what)}</i></p><em>${esc(f.more)}</em><small>${out(f.url, f.by)} · every city counts differently, so this is not a ranking${L.street(id) ? ' · the street on the right is drawn from it' : ''}</small></div>`;
}
// ---------- the city's street: the same figure as a picture. 20 kerb bays, cleared ones planted, the others holding bags.
const streetBar = st => `<span class="sbar" aria-hidden="true">${['clear', 'energy', 'rest'].filter(k => st.n[k]).map(k => `<i style="flex:${st.n[k]};background:${STREET_COLORS[k]}"></i>`).join('')}</span>`;
const streetKey = st => [['clear', st.clearWord], ['energy', st.energyWord], ['rest', st.restWord]].filter(([k]) => st.n[k]).map(([k, w]) => `<li style="--c:${STREET_COLORS[k]}">${esc(w)}<i>${st.n[k]} of ${st.bays}</i></li>`).join('');
const streetBy = cid => { const st = L.street(cid), name = esc(cities[cid].name); return st.computed ? `worked out from ${name}'s own tonnages, ${esc(st.period)}` : `${name}'s own count, ${esc(st.period)}`; };
function streetNote(cid, big) {
  const st = L.street(cid); if (!st) return '';
  if (!big) return `<div class="own${big === null ? ' line' : ''}">${streetBar(st)}<span><b>${esc(st.pct)}</b> ${esc(st.short)} · ${esc(st.period)}${st.computed ? ', worked out' : ''}</span></div>`;
  return `<div class="own big"><small>Street · ${streetBy(cid)}</small><p><b>${esc(st.pct)}</b>${esc(st.what)}</p>${streetBar(st)}<ul>${streetKey(st)}</ul><em>One kerb bay for every 5 %. Cities count differently, so this is not a ranking.</em></div>`;
}
// a still picture of one city's street, for the map and the findings sheet: drawn once per city
const stills = new Map(); let stillGL = null;
// a small picture drawn once and kept: a city's street, or the animal's face
function still(key, w, h, build) {
  if (stills.has(key)) return stills.get(key);
  if (!stillGL) { stillGL = linkNow(new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })); stillGL.setPixelRatio(2); stillGL.toneMapping = THREE.ACESFilmicToneMapping; }
  stillGL.setSize(w, h, false);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070b10);
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x10141a, 1.2)); const key2 = new THREE.DirectionalLight(0xffffff, 2.2); key2.position.set(3, 5, 4); scene.add(key2);
  stillGL.render(scene, build(scene));
  const url = stillGL.domElement.toDataURL('image/jpeg', 0.9); stills.set(key, url);
  scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return url;
}
function streetThumb(cid) {
  const st = L.street(cid); if (!st) return '';
  return still('street:' + cid, 560, 300, scene => {
    scene.fog = new THREE.Fog(0x070b10, 9, 20); scene.add(new THREE.GridHelper(16, 64, 0x1d3a52, 0x0f2030));
    const s = makeStreet(scene, cid, st, 3.0, 0, 0); s.grow(1);
    const cam = new THREE.PerspectiveCamera(20, 560 / 300, 0.1, 60), z0 = s.group.position.z; cam.position.set(1.4, 2.15, z0 + 9.4); cam.lookAt(0, 0.86, z0 + 0.9);
    return cam;
  });
}
// the city's animal as the answer box shows it: glad, worried, or waiting
function friendFace(mood) {
  const kind = FRIENDS[cityId].kind;
  return still('who:' + kind + ':' + mood, 168, 168, scene => {
    scene.background = new THREE.Color(mood === 'glad' ? 0x13241d : mood === 'worry' ? 0x231a1c : 0x0f1a26);
    const a = makeAnimal(scene, kind, { x: 0, y: 0, z: 0, face: 0, size: 1, tween: (d, fn, done) => { fn(1); if (done) done(); } });
    if (mood === 'glad') a.react(true); else if (mood === 'worry') a.react(false);
    a.update(0.5);
    const b = new THREE.Box3().setFromObject(a.group), c = b.getCenter(new THREE.Vector3()), h = b.max.y - b.min.y;
    const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 30); cam.position.set(c.x + 0.3, c.y + h * 0.25, c.z + h * 2.7 + 0.4); cam.lookAt(c.x, c.y + h * 0.03, c.z);
    return cam;
  });
}
// why that animal: the finding from the city's own waters, in the source's words, and what Teardown does not claim
function friendLine() {
  const f = FRIENDS[cityId]; if (!f) return '';
  return `<p class="friend"><b>Why a ${esc(f.name)}?</b> Found on ${esc(f.where)}: <q lang="${f.lang}">${esc(f.quote)}</q>${f.en ? ` <i>${esc(f.en)}</i>` : ''} <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.by)}</a>. A wrong bin here goes to burning or landfill, not to the sea; the plastic in the water comes from litter, drains and fishing gear.</p>`;
}
const who = (mood, alt) => `<img class="cface" src="${friendFace(mood)}" width="84" height="84" alt="${alt}">`;
// words on the map: the pin labels, the caption or the city card, and a number on each line
function atlasText() {
  const o = OBJECTS[objectId], what = (o.tab || o.name).toLowerCase();
  for (const id of CITY_IDS) {
    const c = cities[id], t = L.tally(id, objectId), need = L.binsNeeded(id, objectId);
    A.labels[id].innerHTML = `<b>${esc(c.name)}</b>${c.native && c.native !== c.name ? `<i lang="${esc(c.lang)}">${esc(c.native)}</i>` : ''}${id === cityId ? '<u>you</u>' : id === fromCity ? '<u class="from">learned</u>' : ''}` +
      `<span>${plural(need, 'bin')}${t.residual ? ` · ${t.residual} to residual` : ''}${t.unknown ? ` · ${t.unknown} without a rule` : ''}</span>`;
  }
  if (A.state === 'over') {
    A.arcs = CITY_IDS.filter(id => id !== cityId).map(id => { const n = L.changes(id, cityId, objectId).length; return { a: id, b: cityId, hot: n > 0, calm: n === 0, alpha: fromCity && id !== fromCity ? 0.35 : 1, k: 1, w: 1.6, text: n ? plural(n, 'habit') : 'same habits' }; });
    acap.className = '';
    acap.innerHTML = `<small>Four cities</small><b>Same ${esc(what)}. Four rule books${L.answersMin(objectId) === 1 ? ', one answer' : ''}.</b><span>Each pin is a city whose official sorting guide this page has read. The lines count the habits that change for the ${esc(what)} when someone moves to ${esc(cities[cityId].name)}.</span><em>Pick a city to fly there. Drag to turn the globe.</em>`;
  } else {
    const id = A.focus, c = cities[id], t = L.tally(id, objectId), need = L.binsNeeded(id, objectId), all = L.findings().perCity.find(x => x.city === id), bins = c.bins.filter(b => b.id !== 'none');
    const route = A.route && A.route.b === id ? A.route : null, ch = route ? L.changes(route.a, id, objectId) : null;
    if (!route) A.arcs = [];
    acap.className = 'card';
    acap.innerHTML = `<small>${where(c)}</small><b>${esc(c.name)}${c.native && c.native !== c.name ? `<i lang="${esc(c.lang)}">${esc(c.native)}</i>` : ''}</b>` +
      (route ? `<p class="route"><span>${esc(cities[route.a].name)} to ${esc(c.name)} · ${far(route.a, id)}</span><b>${ch.length ? plural(ch.length, 'habit') + ' to change' : 'Nothing to change'}</b> for the ${esc(what)}</p>` : '') +
      `<p class="by">Rules by ${esc(c.rules_by)}. Read ${esc(c.checked)}.</p>` +
      `<p class="binsline"><span>${plural(bins.length, 'stream')} at the curb</span>${bins.map(b => `<i class="chip" style="--c:${b.color}">${esc(b.short)}</i>`).join('')}</p>` +
      `<p class="st"><b>${esc(o.tab || o.name)} here:</b> ${plural(need, 'bin')}, ${t.recovered} of ${t.total} parts collected for recycling, composting or take-back${t.residual ? `, ${t.residual} to residual waste` : ''}${t.unknown ? `, ${t.unknown} without a rule` : ''}.</p>` +
      `<p class="fine">All four objects in ${esc(c.name)}: ${all.total - all.residual - all.unknown} of ${all.total} parts collected, ${all.residual} to residual waste${all.unnamed ? `, ${all.unnamed} not named in the guide` : ''}.</p>` + figureBlock(id) +
      `<div class="cta"><button class="primary" data-atlas="moves">${id === cityId ? 'Show the moves here ›' : `Sort in ${esc(c.name)} ›`}</button><button data-atlas="over">‹ Four cities</button></div>`;
  }
  const sst = A.state === 'city' ? L.street(A.focus) : null;
  astreet.hidden = !sst;
  if (sst) astreet.innerHTML = `<img src="${streetThumb(A.focus)}" width="560" height="300" alt="A street in ${esc(cities[A.focus].name)} with ${sst.n.clear} of ${sst.bays} kerb bays cleared and planted, and bags in the other ${sst.bays - sst.n.clear}">` +
    `<div><small>${esc(cities[A.focus].name)}'s street, ${sst.computed ? 'worked out from those tonnages' : 'drawn from that count'}</small><p><b>${esc(sst.pct)}</b>${esc(sst.what)}</p>${streetBar(sst)}<ul>${streetKey(sst)}</ul>${sst.computed ? `<em>${esc(sst.computed)}</em>` : ''}</div>`;
  for (const el of A.chips) el.remove();
  A.chips = A.arcs.map(a => { const el = document.createElement('div'); el.className = 'achip' + (a.calm ? ' calm' : ''); el.textContent = a.text || ''; el.hidden = !a.text; $('alabels').appendChild(el); return el; });
}
function atlasShow(state, id) {
  atlasEl.hidden = false; A.on = true; atlasSize(); A.state = state; A.focus = id || null; A.route = null; A.capK = A.labK = 1; A.drag = null;
  for (const c of CITY_IDS) A.pinK[c] = 1;
  A.cam = A.base = state === 'over' ? overCam() : cityCam(id);
  atlasText();
}
function atlasHide() { if (A.seq) { tweens.delete(A.seq.tw); A.seq = null; } A.on = false; A.show = 0; atlasEl.hidden = true; atlasEl.style.opacity = 0; }
// a sequence: one clock drives the camera, the pins, the lines and the fades, so the recorder can step it
function seq(D, at, done) {
  if (A.seq) tweens.delete(A.seq.tw);
  const end = () => { A.seq = null; if (done) done(); };
  const s = { tw: tween(D, x => at(x * D), end), skip: () => { tweens.delete(s.tw); at(D); end(); } };
  A.seq = s; at(0);
}
// step 3 opens with the four places: the globe turns into view, the pins land, the lines are drawn
function establish(done, hold = 1.4) {
  atlasShow('over');
  const to = overCam(), fl = atlas.flight({ ...to, dist: to.dist * 1.55, head: -22, lat: to.lat - 10 }, to), order = [cityId, ...CITY_IDS.filter(c => c !== cityId)], D = 4 + hold;
  seq(D, t => {
    A.show = Math.min(ramp(t, 0, 0.5), 1 - ramp(t, D - 0.45, D));
    A.cam = A.base = fl(1 - (1 - clamp01(t / 3.4)) ** 3);
    order.forEach((id, i) => { A.pinK[id] = clamp01((t - 0.7 - i * 0.32) / 0.55); });
    A.arcs.forEach((a, i) => { a.k = ramp(t, 2.1 + i * 0.22, 3.2 + i * 0.22); });
    A.capK = ramp(t, 0.4, 1.1);
  }, () => { atlasHide(); A.seen.over = true; if (done) done(); });
}
// fly down to one city; from another city the route is drawn on the way, with what changes for a person
function flyIn(id, done, { from = null, route = false, hold = 1.5, stay = false } = {}) {
  const start = A.on && A.cam ? { ...A.cam } : null;
  atlasShow('city', id);
  const a = from ? cityCam(from) : start || overCam(), fl = atlas.flight(a, cityCam(id)), F = from ? 3.6 : 2.7, D = F + hold;
  if (from && route) { A.route = { a: from, b: id }; A.arcs = [{ a: from, b: id, hot: true, k: 0, w: 2.2 }]; atlasText(); }
  let handed = !done || stay;
  seq(D, t => {
    A.show = Math.min(start ? 1 : ramp(t, 0, 0.45), stay ? 1 : 1 - ramp(t, D - 0.45, D));
    A.cam = A.base = fl(ease(clamp01(t / F)));
    if (A.route) A.arcs[0].k = clamp01(t / F * 1.02);
    A.capK = ramp(t, F - 0.9, F - 0.2);
    // what comes next is set up while the map still covers the view, so the map fades straight into it
    if (!handed && t >= D - 0.5) { handed = true; const me = A.seq; A.keep = true; done(); A.keep = false; if (me) { A.seq = me; tweens.add(me.tw); } }
  }, () => { A.seen[id] = true; if (!stay) atlasHide(); if (done && stay) done(); });
}
function flyOut() {
  const from = { ...A.cam }; atlasShow('over'); const fl = atlas.flight(from, overCam());
  seq(2, t => { A.cam = A.base = fl(ease(t / 2)); A.capK = A.labK = ramp(t, 1.2, 1.9); A.arcs.forEach(a => { a.k = ramp(t, 1.1, 2); }); });
}
// opened by hand: it stays until closed
function atlasOpen(id) {
  if (id) return flyIn(id, null, { hold: 0, stay: true });
  atlasShow('over'); tween(0.35, x => { A.show = x; });
}
const atlasClose = () => { if (A.seq) return A.seq.skip(); tween(0.3, x => { A.show = 1 - x; }, atlasHide); };
function drawAtlas() {
  atlasSize(); const w = A.w, h = A.h, dpr = Math.min(devicePixelRatio, 2); if (!w || !h) return;
  const W = Math.round(w * dpr), H = Math.round(h * dpr), c = A.cam;
  if (atlasCv.width !== W || atlasCv.height !== H) { atlasCv.width = mapCv.width = W; atlasCv.height = mapCv.height = H; A.key = ''; }
  atlasEl.style.opacity = A.show;
  // the map is drawn again only when the camera has moved; the pins and routes on top are drawn every frame
  const key = [W, H, A.lite, c.lat, c.lon, c.dist, c.tilt, c.head, c.ox, c.oy].join();
  if (key !== A.key) { A.key = key; mctx.setTransform(dpr, 0, 0, dpr, 0, 0); mctx.clearRect(0, 0, w, h); atlas.draw(mctx, w, h, c, { lite: A.lite }); }
  actx.setTransform(1, 0, 0, 1, 0, 0); actx.clearRect(0, 0, W, H); actx.drawImage(mapCv, 0, 0); actx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pins = CITY_IDS.map((id, i) => ({ id, k: A.pinK[id], you: id === cityId, phase: i * 0.27, big: A.state === 'city' && id === A.focus }));
  atlas.mark(actx, w, h, c, { arcs: A.arcs, pins, time: clock });
  const gx = w * (0.5 + (A.cam.ox || 0));
  for (const pin of pins) {
    const el = A.labels[pin.id], on = pin.at && pin.k > 0.5 && A.state === 'over' && A.labK > 0.02;
    el.style.visibility = on ? 'visible' : 'hidden'; if (!on) continue;
    // the label goes outward from the globe's middle; two pins close together push their labels apart
    const near = pins.filter(q => q !== pin && q.at && Math.hypot(q.at[0] - pin.at[0], q.at[1] - pin.at[1]) < 150).sort((a, b) => Math.hypot(a.at[0] - pin.at[0], a.at[1] - pin.at[1]) - Math.hypot(b.at[0] - pin.at[0], b.at[1] - pin.at[1]))[0];
    const left = near ? pin.at[0] < near.at[0] : pin.at[0] < gx - 4, lw = el.offsetWidth;
    el.style.opacity = A.labK * clamp01((pin.k - 0.5) * 2.5); el.classList.toggle('left', left);
    const x = left ? Math.max(lw + 6, pin.at[0] - 16) : Math.min(w - lw - 6, pin.at[0] + 16);
    el.style.transform = `translate(${x}px, ${pin.at[1]}px) translate(${left ? -100 : 0}%, -50%)`;
  }
  A.arcs.forEach((a, i) => {
    const el = A.chips[i]; if (!el) return; const on = a.mid && (a.k ?? 1) > 0.6 && a.text;
    el.style.visibility = on ? 'visible' : 'hidden'; if (!on) return;
    el.style.opacity = clamp01(((a.k ?? 1) - 0.6) * 3) * (a.alpha ?? 1) * A.labK; el.style.transform = `translate(${a.mid[0]}px, ${a.mid[1]}px) translate(-50%, -50%)`;
  });
  acap.style.opacity = astreet.style.opacity = A.capK; acap.style.transform = astreet.style.transform = `translateY(${(1 - A.capK) * 10}px)`;
}
// turning the globe by hand, and the wheel to come closer
atlasCv.addEventListener('pointerdown', e => { if (A.seq) return A.seq.skip(); A.drag = { x: e.clientX, y: e.clientY, cam: { ...A.cam } }; atlasCv.setPointerCapture(e.pointerId); });
atlasCv.addEventListener('pointermove', e => {
  if (!A.drag) return; const c = A.drag.cam, k = c.dist * 2 * Math.tan(16 * Math.PI / 180) / A.h * 57.3;
  A.cam = A.base = { ...c, lon: c.lon - (e.clientX - A.drag.x) * k / Math.max(0.2, Math.cos(c.lat * Math.PI / 180)), lat: Math.max(-85, Math.min(85, c.lat + (e.clientY - A.drag.y) * k)) };
});
atlasCv.addEventListener('pointerup', () => { A.drag = null; });
atlasCv.addEventListener('wheel', e => { if (A.seq) return; e.preventDefault(); const d = Math.max(0.03, Math.min(4.5, A.cam.dist * Math.exp(e.deltaY * 0.0012))); A.cam = A.base = { ...A.cam, dist: d, tilt: 40 * (1 - clamp01((d - 0.04) / 0.5)) }; }, { passive: false });
function atlasClick(what) {
  if (what === 'open') return A.on ? atlasClose() : atlasOpen();
  if (what === 'close') return atlasClose();
  if (what === 'over') return flyOut();
  if (what === 'moves') { const id = A.focus; atlasHide(); if (id !== cityId) chooseCity(id); A.seen[id] = true; return setMode('city', true); }
  if (cities[what]) return atlasOpen(what);
}

// ---------- steps: one path through the page
const STEPS = [
  { id: 'inside', label: 'Look inside', go: () => { setMode('compare'); if (T > 0.13) setT(0); animateT(0.13, 2.4); } },
  { id: 'apart', label: 'Take it apart', go: () => { setMode('compare'); animateT(EX1, T < EX1 ? 3 : 0.8); } },
  { id: 'cities', label: 'Four cities', go: () => {
    setMode('compare'); const run = () => animateT(1, T < 1 ? Math.max(1.2, (1 - Math.max(T, EX1)) * 9) : 0.1);
    if (AUTO && !A.seen.over && T < 0.9) establish(run); else run(); // the first time, the four places are shown before their rules
  } },
  { id: 'city', label: 'Your city', go: () => enter('city') },
  { id: 'practice', label: 'Your turn', go: () => setMode('practice') },
];
const stepNow = () => mode === 'practice' ? 4 : mode === 'city' ? 3 : T < 0.03 ? -1 : T < HERO_END ? 0 : T < SORT0 ? 1 : 2;
const stepsEl = $('steps');
STEPS.forEach((s, i) => { const b = document.createElement('button'); b.innerHTML = `<i>${i + 1}</i>${s.label}`; b.addEventListener('click', s.go); stepsEl.appendChild(b); });
$('next').addEventListener('click', () => STEPS[Math.min(STEPS.length - 1, stepNow() + 1)].go());
function syncSteps() {
  const n = stepNow();
  [...stepsEl.children].forEach((b, i) => { b.classList.toggle('on', i === n); b.classList.toggle('done', i < n); });
  const nx = STEPS[n + 1];
  $('next').hidden = !nx || !!timeTween && mode === 'compare'; if (nx) $('next').textContent = (n < 0 ? 'Start: ' : 'Next: ') + nx.label + ' ›';
  $('scrub').hidden = mode !== 'compare'; $('play').textContent = timeTween ? '❚❚' : '▶';
}

// "your city" opens with a flight down to it, once per city; with a learned-in city the route is drawn on the way
function enter(m, force) {
  if (m === 'city' && mode !== 'city' && AUTO && !A.seen[cityId]) return flyIn(cityId, () => setMode('city', true), { from: fromCity || null, route: !!fromCity });
  setMode(m, force);
}
// "your city" ends with the parts in their bins, except for a device that still works in a city that names a way
// to pass it on: that one stays whole, above the bin, until the visitor says it is finished
const keptWhole = () => { const a = L.after(cityId, objectId); return !!(a && stillWorks && a.works.named); };
function settle(to, dur) { animateT(to, dur); timeTween.done = () => { timeTween = null; syncSteps(); fitSolo(true); }; }
function setMode(m, force) {
  if (m === mode && !force) return;
  if (A.on && !A.keep) atlasHide();
  mode = m; tweens.clear(); timeTween = null;
  build();
  if (mode === 'city') { seen.mark(cityId, objectId); slider.value = 1; setT(SORT0); fitSolo(); if (!keptWhole()) settle(1, 2.6); renderCity(); }
  else if (mode === 'practice') startRun();
  else setT(+slider.value);
  syncUrl(); syncSteps();
}
const syncUrl = () => { try { history.replaceState(null, '', `?o=${objectId}&c=${cityId}${mode !== 'compare' ? '&m=' + mode : ''}${REC ? '&rec=1' : ''}`); } catch { /* sandboxed frame: the page still works without a shareable address */ } };

// ---------- header: object tabs, the visitor's city, the claim
const tabs = $('tabs');
for (const [id, o] of Object.entries(OBJECTS)) {
  const b = document.createElement('button'); b.textContent = o.tab || o.name; b.title = o.name; b.dataset.o = id;
  b.addEventListener('click', () => setObject(id));
  tabs.appendChild(b);
}
const citySel = $('city');
citySel.innerHTML = CITY_IDS.map(c => `<option value="${c}">${esc(cities[c].name)}</option>`).join('');
citySel.value = cityId;
citySel.addEventListener('change', () => setCity(citySel.value));
const learnedSel = $('learned');
const fillLearned = () => { learnedSel.innerHTML = '<option value="">the same city</option>' + CITY_IDS.filter(c => c !== cityId).map(c => `<option value="${c}">${esc(cities[c].name)}</option>`).join(''); learnedSel.value = fromCity; };
learnedSel.addEventListener('change', () => setFrom(learnedSel.value));
// where the visitor learned to sort: the comparison then answers "what do I have to unlearn here?"
function setFrom(c) {
  fromCity = cities[c] && c !== cityId ? c : ''; store.set('teardown.from', fromCity); learnedSel.value = fromCity;
  if (A.on && !A.seq) atlasText();
  if (mode === 'compare') { views.forEach(badge); buildVerdict(); }
  else if (mode === 'city') { renderCity(); if (fromCity && AUTO) flyIn(cityId, null, { from: fromCity, route: true, hold: 1.8 }); } // the move, drawn on the globe
}
function chooseCity(c) { cityId = c; citySel.value = c; store.set('teardown.city', c); if (fromCity === c) { fromCity = ''; store.set('teardown.from', ''); } fillLearned(); }
function setCity(c) {
  const prev = cityId; chooseCity(c);
  if (mode === 'city' && c !== prev && AUTO) { $('claim').innerHTML = `<b>To ${esc(cities[c].name)}:</b> ${far(prev, c)} from ${esc(cities[prev].name)}.`; return flyIn(c, () => setMode('city', true), { from: prev, hold: 0.7 }); }
  setMode(mode, true);
}
// a new object starts from its question (so it can be guessed first); "next object" inside practice stays in practice
function setObject(id, keep) {
  if (id === objectId) return; objectId = id; slider.value = 0;
  const held = A.on && !A.seq ? { state: A.state, focus: A.focus } : null; // a map opened by hand stays open and follows the object
  setMode(keep ? mode : 'compare', true);
  if (held) { atlasShow(held.state, held.focus); A.show = 1; }
}

// ---------- the verdict after the sort: what four cities did with this object, and what that means for a person
function buildVerdict() {
  const o = OBJECTS[objectId], pids = L.partsOf(objectId), n = L.answersMin(objectId), mv = L.movesChanged(objectId), city = cities[cityId];
  const atLeast = n < L.answers(objectId) ? 'at least ' : '';
  const split = pids.filter(p => new Set(CITY_IDS.map(c => L.fateOf(c, objectId, p)).filter(f => f !== 'unknown')).size > 1).length;
  const head = n === 1 ? 'Four cities, one answer.' : `Four cities, ${atLeast}${WORDS[n]} different answers.`;
  let sub = n === 1 ? `In all four cities the ${WORDS[pids.length]} parts go back together, in one move. Nothing to relearn when you move.`
    : `${split} of ${pids.length} parts meet a different kind of stream depending on where you stand. Move between two of these cities and a habit has to change in ${mv.n} of ${mv.total} cases.`;
  // a guide's silence is not counted as a different answer
  const maybe = L.maybeSame(objectId)[0];
  if (maybe) { const quiet = maybe.find(c => L.skipped(c, objectId).length), other = maybe.find(c => c !== quiet); sub += ` ${esc(cities[quiet].name)}'s guide does not name the ${L.skipped(quiet, objectId).map(p => o.parts[p].label.toLowerCase()).join(' or ')}, so its answer may match ${esc(cities[other].name)}'s.`; }
  // one answer for the finished object does not mean one answer for an object that still works
  const on = L.passOn(objectId);
  if (on && on.named.length && on.silent.length) sub += ` That is the finished ${esc((o.tab || o.name).toLowerCase())}. For one that still works, ${listNames(on.named)} name a way to pass it on; ${listNames(on.silent)} describe collection only.`;
  const ch = fromCity && fromCity !== cityId ? L.changes(fromCity, cityId, objectId) : null;
  const mover = ch ? `<p class="mover">Learned in ${esc(cities[fromCity].name)}, sorting in ${esc(city.name)}: <b>${ch.length ? plural(ch.length, 'habit') + ' to change' : 'nothing to change'}</b> for this object.</p>` : '';
  const h = `<div class="say"><h3>${head}</h3><p>${sub}</p>${mover}</div>` +
    `<div class="cta"><button class="primary" data-go="city">${ch && ch.length ? 'Show me what changes ›' : `How do I throw it in ${esc(city.name)}?`}</button><button data-go="practice">Sort it yourself</button></div>` +
    `<p class="key">dashed = stays attached · ≈ nearest listed item · ? no rule found in the sources read · click any part for the official sentence</p>` +
    `<p class="key">the street behind each city = the recycling figure that city publishes, one kerb bay for every 5 %: planted = recycled, amber bags = burned for energy, red bags = the rest · four different counts, not a ranking</p>`;
  $('summary').innerHTML = h;
  renderCap();
  const what = o.name.toLowerCase();
  $('claim').innerHTML = mode === 'city' ? `<b>In ${esc(city.name)}:</b> ${plural(L.binsNeeded(cityId, objectId), 'move')} for the ${esc(what)}.`
    : mode === 'practice' ? `<b>Your turn:</b> the ${esc(what)}, into every bin ${esc(city.name)} has.`
      : `<b>${esc(o.name)}:</b> ${plural(pids.length, 'part')}, ${n === 1 ? 'one answer in all four cities' : `sorted ${atLeast}${WORDS[n]} different ways in four cities`}.`;
  [...tabs.children].forEach(b => b.classList.toggle('on', b.dataset.o === objectId));
}
// the first screen asks the question, and lets the visitor answer it before the page does
function renderCap() {
  const o = OBJECTS[objectId], city = esc(cities[cityId].name), fresh = !seen.has(cityId, objectId);
  $('cap').innerHTML = `<small>${esc(o.name)}</small><b>${esc(o.question)}</b><span>${esc(o.caption)}</span>` +
    `<div class="cta"><button class="guess" data-go="practice">${fresh ? 'Guess first ›' : 'Sort it yourself ›'}</button><em>${fresh ? `Sort it into ${city}'s bins before the page shows you the rules. That run is your baseline.` : `This page has already shown you ${city}'s rules for it, so a run now counts as "after".`}</em></div>`;
}

// ---------- your city: the exact moves, and what changes if you learned to sort somewhere else
const partLine = (c, pid) => {
  const r = L.rule(c, objectId, pid), o = OBJECTS[objectId], host = L.hostOf(c, objectId, pid);
  const gloss = r.quote && r.quote.startsWith('(') ? '' : r.quote_en || (cities[c].lang === 'en' && r.quote ? `“${r.quote}”` : '');
  return `<li data-part="${pid}"><b>${esc(o.parts[pid].label)}</b>${host ? `<em>stays ${esc(hostWords())}</em>` : ''}${r.basis === 'nearest' ? '<em class="near">≈ nearest listed item</em>' : ''}${gloss ? `<span>${esc(gloss)}</span>` : ''}</li>`;
};
function changeLine(x, from, to) {
  const chip = b => `<span class="chip" style="--c:${b.color}">${esc(b.short)}</span>`;
  const did = a => a.attached ? `leave it ${esc(hostWords())}` : x.kind === 'leave_on' || x.kind === 'take_off' ? 'take it off' : esc(a.bin.name);
  return `<li><b>${esc(OBJECTS[objectId].parts[x.part].label)}</b><div><span>${esc(cities[from].name)}</span><em>${did(x.a)}</em>${chip(x.a.bin)}</div><div class="now"><span>${esc(cities[to].name)}</span><em>${did(x.b)}</em>${chip(x.b.bin)}</div></li>`;
}
// before the bin: a device that still works should not be sorted at all. The visitor says which it is,
// and the card shows the way the city's own pages name, stop by stop (or says that they name none).
let stillWorks = true;
function onwardBlock() {
  const a = L.after(cityId, objectId); if (!a) return '';
  const o = OBJECTS[objectId], what = (o.tab || o.name).toLowerCase(), w = a.works, d = a.done;
  const src = x => x.source ? `<small>${out(x.url, x.source)}${x.url2 ? ' · ' + out(x.url2, x.source2) : ''}</small>` : '';
  const said = x => (x.quote ? `<blockquote lang="${esc(cities[cityId].lang)}">${esc(x.quote)}</blockquote>` : '') + (x.quote_en && cities[cityId].lang !== 'en' ? `<p class="gloss">${esc(x.quote_en)}</p>` : '');
  const stop = (cls, tag, x, places) => `<li class="${cls}"><span>${tag}</span><b>${esc(x.head || '')}</b><p>${esc(x.say)}</p>${places && x.places ? `<ul>${x.places.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}${said(x)}${src(x)}</li>`;
  let stops;
  if (stillWorks && w.named) stops = stop('go', 'Reuse', w, true);
  else stops = (stillWorks ? stop('gap', 'Reuse', w, false) : '') + stop('go', stillWorks ? 'So it goes to' : 'Hand it in', d, true) +
    `<li class="${a.next.quote ? 'go' : 'gap'}"><span>Then</span><p>${esc(a.next.say)}</p>${said(a.next)}${src(a.next)}</li>`;
  const data = stillWorks && w.named && w.data || a.data;
  stops += `<li class="${data.who === 'not_stated' ? 'gap' : 'go'}"><span>Your data</span><p>${esc(data.say)}</p>${said(data)}${src(data)}</li>`;
  return `<section class="onward"><p class="eyebrow">Before you sort · pages read ${esc(a.read)}</p><h3>Does the ${esc(what)} still work?</h3>` +
    `<div class="seg" role="group" aria-label="Does it still work?"><button data-works="1"${stillWorks ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>It still works</button><button data-works="0"${stillWorks ? ' aria-pressed="false"' : ' class="on" aria-pressed="true"'}>It is finished</button></div>` +
    `<ol class="stops">${stops}</ol>${a.count ? `<p class="fine">${esc(a.count.say)} ${out(a.count.url, a.count.source)}</p>` : ''}</section>`;
}
function renderCity() {
  const city = cities[cityId], o = OBJECTS[objectId], gs = L.groups(cityId, objectId), t = L.tally(cityId, objectId), need = L.binsNeeded(cityId, objectId);
  let h = `<p class="eyebrow">Your city · rules read ${esc(city.checked)}</p><h2>${esc(o.name)} in ${esc(city.name)}</h2>` +
    `<p class="lead"><b>${plural(need, 'move')}.</b> ${t.recovered} of ${t.total} parts are collected for recycling, composting or take-back${t.residual ? `, ${t.residual} ${t.residual === 1 ? 'goes' : 'go'} to residual waste` : ''}${t.unknown ? `, and the guide has no rule for ${t.unknown}` : ''}.</p>` +
    onwardBlock() + `<div class="moved"><label for="from">Learned to sort somewhere else?</label><select id="from"><option value="">Choose a city</option>${CITY_IDS.filter(c => c !== cityId).map(c => `<option value="${c}"${c === fromCity ? ' selected' : ''}>${esc(cities[c].name)}</option>`).join('')}</select><div id="diff"></div></div><ol class="moves">`;
  for (const g of gs) {
    h += g.bin
      ? `<li class="move" data-parts="${g.parts.join(',')}"><div class="mv"><span class="chip" style="--c:${g.bin.color}">${esc(g.bin.short)}</span><b>${esc(g.bin.name)}</b><i class="fate" style="--f:${FATES[g.fate].color}">${FATES[g.fate].label}</i></div><ul>${g.parts.map(p => partLine(cityId, p)).join('')}</ul></li>`
      : `<li class="move none" data-parts="${g.parts.join(',')}"><div class="mv"><span class="chip" style="--c:#888">?</span><b>No rule found</b></div><ul>${g.parts.map(p => `<li data-part="${p}"><b>${esc(o.parts[p].label)}</b><span>Not named in the sources read. Ask the city before guessing.</span></li>`).join('')}</ul></li>`;
  }
  h += `</ol><div class="cta"><button class="primary" data-go="practice">Now sort it yourself ›</button></div>`;
  $('side').innerHTML = h;
  renderDiff();
}
function renderDiff() {
  const el = $('diff'); if (!el) return;
  if (!fromCity) { el.innerHTML = ''; return; }
  const ch = L.changes(fromCity, cityId, objectId), un = L.uncompared(fromCity, cityId, objectId), o = OBJECTS[objectId];
  // a part one of the two guides is silent on cannot be compared: say so instead of calling it unchanged
  const by = {}; for (const u of un) (by[u.silent] ||= []).push('the ' + o.parts[u.part].label.toLowerCase());
  const quiet = un.length ? `<p class="fine">Not compared: ${Object.entries(by).map(([c, ps]) => `${esc(ps.join(' and '))} (${esc(cities[c].name)}'s guide has no rule for ${ps.length === 1 ? 'it' : 'them'})`).join('; ')}.</p>` : '';
  el.innerHTML = (ch.length ? `<p><b>${plural(ch.length, 'habit')} to change</b> for this object:</p><ul class="changes">${ch.map(x => changeLine(x, fromCity, cityId)).join('')}</ul>`
    : `<p>For ${un.length ? 'the parts both guides name' : 'this object'}, what you did in ${esc(cities[fromCity].name)} still works here.</p>`) + quiet;
}
$('side').addEventListener('change', e => { if (e.target.id === 'from') setFrom(e.target.value); });
$('side').addEventListener('pointerover', e => { if (mode !== 'city') return; const li = e.target.closest('.move'); if (views[0]) setFocus(views[0], li ? li.dataset.parts.split(',') : null); });
$('side').addEventListener('pointerleave', () => { if (mode === 'city' && views[0]) setFocus(views[0], null); });

// ---------- your turn: sort each part into your city's bins; the first try counts
// A run started before the page has shown this city's rules for the object is the baseline; any later run is "after".
const quiz = { list: [], i: 0, results: [], answered: false, run: 1, baseline: false };
function startRun() {
  const v = views[0], run = log.nextRun(cityId, objectId);
  Object.assign(quiz, { list: L.quizParts(cityId, objectId, run), i: 0, results: [], answered: false, run, baseline: !seen.has(cityId, objectId) });
  for (const p of v.parts) { const none = p.bin && p.bin.empty; p.k = none ? 1 : 0; p.peel = 0; p.done = none; }
  T = EX1; slider.value = T; setT(T); fitSolo(); ask(); if (v.friend) v.friend.enter();
}
function ask() {
  const v = views[0], p = v.parts.find(q => q.id === quiz.list[quiz.i]);
  quiz.answered = false; v.current = p; setFocus(v, [p.id]); if (v.friend && quiz.i) v.friend.rest();
  if (p.host) tween(0.5, x => { p.peel = ease(x); pose(); });
  renderQuiz();
}
function answer(choice) {
  if (mode !== 'practice' || quiz.answered || quiz.i >= quiz.list.length) return;
  const v = views[0], p = v.current, r = p.rule, ok = L.isCorrect(cityId, objectId, p.id, choice);
  const fx = L.effect(cityId, objectId, p.id, choice);
  quiz.answered = true; quiz.results.push({ part: p.id, choice, ok, near: r.basis === 'nearest', fx });
  log.add({ time: new Date().toISOString(), run: quiz.run, seen_rules: quiz.baseline ? 0 : 1, city: cityId, object: objectId, part: p.id, choice, answer: (p.host ? 'attach/' : '') + r.bin + (r.also || []).map(a => '/' + a.bin).join(''), correct: ok ? 1 : 0, basis: r.basis, effect: fx && (fx.kind === 'contaminates' || fx.kind === 'lost') ? fx.kind + ':' + fx.into.id : '' });
  if (v.friend) v.friend.react(ok);
  seen.mark(cityId, objectId); // the feedback shows the rule
  if (choice !== 'attach' && v.bins[choice]) pulse(v.bins[choice], ok);
  p.done = true;
  if (p.host) tween(0.6, x => { p.peel = 1 - ease(x); pose(); });
  else tween(1.0, x => { p.k = x; pose(); }, () => { if (!ok || choice === 'attach') pulse(p.bin, true); });
  renderQuiz({ ok, choice, fx });
}
// what the wrong first try would have done at the kerb, in a sentence
function effectLine(fx, pid) {
  if (!fx || !fx.into) return '';
  const what = esc(MATERIALS[OBJECTS[objectId].parts[pid].material].name.toLowerCase()), chip = b => `<span class="chip" style="--c:${b.color}">${esc(b.short)}</span>`;
  // a part the guide does not name: only what the nearest listed item does is said
  if (fx.soft) return `<p class="fx ${fx.kind === 'lost' ? 'lost' : 'bad'}"><b>At the kerb:</b> ${fx.rides ? `left on, the ${what} goes` : `that puts ${what}`} into ${chip(fx.into)}. The guide does not name this part; the nearest listed item goes to ${chip(fx.right)}.</p>`;
  if (fx.kind === 'contaminates') return `<p class="fx bad"><b>At the kerb:</b> ${fx.rides ? `left on, the ${what} rides` : `that puts ${what}`} into ${chip(fx.into)}, a stream that does not take it here.</p>`;
  if (fx.kind === 'lost') return `<p class="fx lost"><b>At the kerb:</b> ${fx.rides ? 'left on, it goes' : 'that sends it'} to ${chip(fx.into)}, although ${esc(cities[cityId].name)} collects it in ${chip(fx.right)}.</p>`;
  return '';
}
function nextPart() {
  if (!quiz.answered) return;
  quiz.i++;
  if (quiz.i < quiz.list.length) return ask();
  const v = views[0]; v.current = null; setFocus(v, null); if (v.friend) v.friend.cheer(quiz.results.every(r => r.ok)); renderResult();
}
const runName = () => quiz.baseline ? 'baseline run' : 'run ' + quiz.run;
// the run in words: how often the animal cheered, and what the wrong first tries would have done at the kerb
function kerbLine() {
  const n = quiz.results.length, ok = quiz.results.filter(r => r.ok).length, hit = (kind, soft) => quiz.results.filter(r => r.fx && r.fx.kind === kind && !!r.fx.soft === soft).length;
  const dirty = hit('contaminates', false), lost = hit('lost', false), soft = hit('contaminates', true) + hit('lost', true);
  const said = [dirty ? `${plural(dirty, 'part')} would have gone into a stream that does not take ${dirty === 1 ? 'it' : 'them'}` : '', lost ? `${plural(lost, 'collected part')} would have gone to residual waste` : '', soft ? `${plural(soft, 'part')} the guide does not name went another way than the nearest listed item` : ''].filter(Boolean);
  const tail = ok === n ? 'Nothing in the wrong stream.' : said.length ? 'At the kerb: ' + said.join(', ') + '.' : '';
  return `<p class="street">${who(ok === n ? 'glad' : ok ? 'calm' : 'worry', '')}<b>The ${esc(FRIENDS[cityId].name)} cheered ${ok === n ? (n === 1 ? 'on the only throw' : `on all ${n} throws`) : `${ok} of ${n} times`}.</b> ${tail}</p>` + friendLine();
}
function renderQuiz(fb) {
  const city = cities[cityId], o = OBJECTS[objectId], pid = quiz.list[quiz.i], info = o.parts[pid], host = L.hostOf(cityId, objectId, pid), bin = L.binOf(cityId, objectId, pid);
  const opts = city.bins.filter(b => b.id !== 'none').map(b => ({ id: b.id, label: b.name, color: b.color }));
  if (pid !== o.main) opts.push({ id: 'attach', label: `Leave it ${hostWords()}`, color: '#9fb4c8' });
  let h = `<p class="eyebrow">Your turn · ${esc(city.name)} · ${runName()}</p><div class="prog">${quiz.list.map((_, i) => `<i class="${i < quiz.results.length ? (quiz.results[i].ok ? 'ok' : 'no') : i === quiz.i ? 'now' : ''}"></i>`).join('')}</div>` +
    `<h2>${esc(info.quizLabel || info.label)}</h2><p class="mat">${esc(MATERIALS[info.material].name)} · ${esc(info.note)}</p><p class="ask">Where does it go in ${esc(city.name)}?</p>` +
    `<div class="opts${fb ? ' locked' : ''}">${opts.map((x, i) => {
      const right = fb && L.isCorrect(cityId, objectId, pid, x.id), picked = fb && fb.choice === x.id;
      return `<button data-choice="${x.id}" style="--c:${x.color}" class="${right ? 'right' : ''}${picked && !fb.ok ? ' wrong' : ''}"${fb ? ' disabled' : ''}><kbd>${i + 1}</kbd>${esc(x.label)}</button>`;
    }).join('')}</div>`;
  if (fb) {
    const where = host ? `It stays ${esc(hostWords())} and goes to <b>${esc(bin.name)}</b>.` : `It goes to <b>${esc(bin.name)}</b>.`;
    const r = L.rule(cityId, objectId, pid), near = r.basis === 'nearest', also = L.alsoFor(cityId, objectId, pid, fb.choice);
    // a part the guide does not name is scored against the nearest listed item, and says so; where two official sources differ, both count
    const lead = also ? `Right by the ${esc(also.source)}. Official sources differ here, so both answers count. ${esc(r.source)}:` : near ? (fb.ok ? 'Right, by the nearest listed item.' : `${esc(city.name)}'s guide does not name this part. By the nearest listed item:`) : fb.ok ? 'Right.' : `Not in ${esc(city.name)}.`;
    const second = also ? `<p class="also"><b>${esc(also.source)}</b></p><blockquote lang="${city.lang}">${esc(also.quote)}</blockquote>${also.quote_en ? `<p class="gloss">${esc(also.quote_en)}</p>` : ''}` : (r.also || []).length ? `<p class="also">Official sources differ on this one, so ${r.also.map(a => `<b>${esc(city.bins.find(b => b.id === a.bin).name)}</b>`).join(' and ')} also counts (${esc(r.also[0].source)}).</p>` : '';
    h += `<div class="fb ${fb.ok ? 'ok' : 'no'}" aria-live="polite">${who(fb.ok ? 'glad' : 'worry', fb.ok ? 'The animal smiles.' : 'The animal looks worried.')}<p class="verdict">${lead} ${where} ${basisTag(cityId, pid)}</p>${effectLine(fb.fx, pid)}${ruleBlock(cityId, pid)}${second}</div>` +
      `<div class="cta"><button class="primary" id="nextPart">${quiz.i + 1 < quiz.list.length ? 'Next part ›' : 'See my result ›'}</button></div>`;
  } else h += `<p class="fine">Click a bin in the scene or a button. Only your first try is scored. A right first try makes the ${esc(FRIENDS[cityId].name)} beside the bins hop.</p>`;
  $('side').innerHTML = h;
  if (fb) $('nextPart').focus({ preventScroll: true });
}
function renderResult() {
  const city = cities[cityId], o = OBJECTS[objectId], ok = quiz.results.filter(r => r.ok).length, n = quiz.results.length, skipped = L.skipped(cityId, objectId);
  const runs = log.runs(cityId, objectId), others = Object.keys(OBJECTS), nextObj = others[(others.indexOf(objectId) + 1) % others.length];
  const near = quiz.results.filter(r => r.near), named = quiz.results.filter(r => !r.near), right = xs => xs.filter(r => r.ok).length;
  let h = `<p class="eyebrow">Your turn · ${esc(city.name)} · ${runName()}</p><h2>${ok} of ${n} right on the first try</h2>` +
    `<div class="bar"><i style="width:${n ? ok / n * 100 : 0}%"></i></div>` + kerbLine() +
    `<p class="base">${quiz.baseline ? `<b>Baseline.</b> You answered before this page showed you ${esc(city.name)}'s rules for this object.` : `<b>After.</b> This page had already shown you ${esc(city.name)}'s rules for this object.`}</p>` +
    (near.length ? `<p class="split">Rules the guide states: <b>${right(named)} of ${named.length}</b> · nearest listed item (≈): <b>${right(near)} of ${near.length}</b></p>` : '') +
    `<ul class="marks">${quiz.results.map(r => { const b = L.binOf(cityId, objectId, r.part); return `<li class="${r.ok ? 'ok' : 'no'}" data-part="${r.part}"><b>${esc(o.parts[r.part].label)}</b>${L.hostOf(cityId, objectId, r.part) ? `<em>stays ${esc(hostWords())}</em>` : ''}${r.near ? '<em>≈ nearest listed item</em>' : ''}<span class="chip" style="--c:${b.color}">${esc(b.short)}</span></li>`; }).join('')}</ul>`;
  if (skipped.length) h += `<p class="fine">Not scored: ${skipped.map(p => esc(o.parts[p].label)).join(', ')}. ${esc(city.name)}'s guide has no rule for ${skipped.length === 1 ? 'it' : 'them'} in the sources read.</p>`;
  if (runs.length > 1) h += `<div class="runs"><b>Your runs on this object</b>${runs.map(r => `<span><i>${r.baseline ? 'baseline' : 'run ' + r.run}</i>${r.ok}/${r.n}</span>`).join('')}</div>`;
  h += `<div class="cta">${quiz.baseline ? `<button class="primary" data-go="city">See how ${esc(city.name)} sorts it ›</button><button id="again">Run it again</button>` : `<button class="primary" id="again">${ok === n ? 'Run it again' : 'Try again'}</button>`}<button data-object="${nextObj}" data-keep="1">Next: ${esc(OBJECTS[nextObj].name)}</button><button data-open="findings">What we found</button></div>` +
    `<p class="fine">Answers stay in this browser. Each one is marked as given before or after the page showed the rules, so a class or a building can compare first-try accuracy before and after. <a href="#" data-log="csv">Download my log (CSV)</a> · <a href="#" data-log="clear">Clear it</a></p>`;
  $('side').innerHTML = h;
}
addEventListener('keydown', e => {
  if (mode !== 'practice' || e.target.closest('select, input')) return;
  if (e.key === 'Enter' && quiz.answered) { e.preventDefault(); nextPart(); }
  const b = !quiz.answered && /^[1-9]$/.test(e.key) && $('side').querySelectorAll('.opts button')[+e.key - 1];
  if (b) answer(b.dataset.choice);
});

// ---------- what we found: computed from the whole table
// a file download, plus the same text on the page for browsers and frames that block downloads
function download(name, text, after) {
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); } catch { /* the text box below still has it */ }
  let box = after.parentNode.querySelector('textarea.csv');
  if (!box) { box = document.createElement('textarea'); box.className = 'csv'; box.readOnly = true; box.rows = 6; box.setAttribute('aria-label', name); after.parentNode.appendChild(box); }
  box.value = text; box.select();
}
const gapCsv = f => ['city,object,part,what_teardown_used,source', ...f.gaps.map(g => [cities[g.city].name, OBJECTS[g.object].name, OBJECTS[g.object].parts[g.part].label, g.basis === 'nearest' ? 'nearest listed item: ' + g.used : 'no rule found', g.source].map(x => String(x).replace(/,/g, ';')).join(','))].join('\n');
// what each city publishes about itself: four numbers that count four different things
function cityCounts() {
  const rows = CITY_IDS.map(c => ({ c, f: L.figure(c) })).filter(x => x.f); if (!rows.length) return '';
  return `<h3>What the cities themselves count</h3><p class="note2">Each number is the city's own, read on its own page. They count different things in different years, so the streets below show each city against its own count; they cannot be ranked against each other, and Teardown does not rank them. The practice log measures the one thing that is the same everywhere: whether a part lands in the bin the local rule names.</p>` +
    `<div class="streets">${rows.filter(x => L.street(x.c)).map(({ c }) => { const st = L.street(c); return `<figure><img src="${streetThumb(c)}" width="560" height="300" alt="${esc(cities[c].name)}: ${st.n.clear} of ${st.bays} kerb bays cleared"><figcaption><b>${esc(cities[c].name)}</b>${streetBar(st)}<span>${esc(st.pct)} ${esc(st.short)} · ${esc(st.period)}${st.computed ? ', worked out' : ''}</span></figcaption></figure>`; }).join('')}</div>` +
    `<p class="fine key2">Each street is drawn from the city's number: one kerb bay for every 5 %. <i style="--c:${STREET_COLORS.clear}">planted = recycled or recovered, by that city's count</i> <i style="--c:${STREET_COLORS.energy}">amber bags = burned for energy, where the city counts that apart</i> <i style="--c:${STREET_COLORS.rest}">red bags = the rest</i></p>` +
    `<div class="scroll"><table class="own"><thead><tr><th>City</th><th>Figure</th><th>What it counts</th><th>Read on</th></tr></thead><tbody>` +
    rows.map(({ c, f }) => `<tr><td${c === cityId ? ' class="me"' : ''}>${esc(cities[c].name)}</td><td><b>${esc(f.value)}</b><span>${esc(f.period)}</span></td><td>${esc(f.counts)}<span>${esc(f.more)}</span></td><td>${out(f.url, f.by)}</td></tr>`).join('') + `</tbody></table></div>`;
}
// the object that should not be sorted while it still works
function onwardTable() {
  const o = Object.keys(OBJECTS).find(k => L.passOn(k)); if (!o) return '';
  const on = L.passOn(o), what = (OBJECTS[o].tab || OBJECTS[o].name).toLowerCase(), ids = [...on.named, ...on.silent].sort((a, b) => CITY_IDS.indexOf(a) - CITY_IDS.indexOf(b));
  return `<h3>A ${esc(what)} that still works</h3><p class="note2">All four cities agree on the finished ${esc(what)}. They differ on the one that still works: ${listNames(on.named)} name a way to pass it on, ${listNames(on.silent)} describe collection only. Who erases the data differs as well.</p>` +
    `<div class="scroll"><table class="own"><thead><tr><th>City</th><th>Still works</th><th>Finished</th><th>Who erases the data</th></tr></thead><tbody>` +
    ids.map(c => { const a = L.after(c, o); return `<tr><td${c === cityId ? ' class="me"' : ''}>${esc(cities[c].name)}</td><td>${a.works.named ? `<b>${esc(a.works.head)}</b>` : `<span class="unk">${esc(a.works.head)}</span>`}<span>${out(a.works.url, 'source')}</span></td><td>${esc(a.done.head)}<span>${out(a.done.url, 'source')}</span></td><td>${esc(a.data.short)}</td></tr>`; }).join('') +
    `</tbody></table></div><p class="fine"><a href="#" data-object="${o}" data-then="city">Open the ${esc(what)} in ${esc(cities[cityId].name)}</a> for the places and the sentences.</p>`;
}
function renderFindings() {
  const f = L.findings(), s = log.summary(), pct = x => Math.round(x.ok / x.n * 100) + '%';
  const names = xs => xs.map(x => x.name.toLowerCase()).join(', the ').replace(/, the ([^,]*)$/, ' and the $1');
  const top = [...f.perObject].sort((a, b) => b.unnamed - a.unnamed).slice(0, 2);
  const least = x => x.answersMin < x.answers ? 'at least ' : '';
  const most = [...f.perObject].sort((a, b) => b.answersMin - a.answersMin || b.loose - a.loose)[0], whole = f.oneAnswer[0];
  const sofar = s.answers ? `On this device so far: ${s.before.n ? `baseline ${pct(s.before)} right on the first try (${plural(s.before.n, 'answer')})` : 'no baseline run yet'}, ${s.after.n ? `after seeing the rules ${pct(s.after)} (${plural(s.after.n, 'answer')})` : 'no run after seeing the rules yet'}. ` : '';
  let h = `<button class="close" data-close="findings" aria-label="Close">×</button><p class="eyebrow">What ${WORDS[f.perObject.length]} objects in four cities show</p><h2>Sorting fails at the seams.</h2>` +
    `<ol class="find">` +
    `<li><b>Where you stand decides the bin.</b> ${f.manyAnswers.length} of ${f.perObject.length} objects are sorted differently from city to city: ${f.manyAnswers.map(x => `the ${x.name.toLowerCase()} ${least(x)}${WORDS[x.answersMin]} ways`).join(', ')}. For those ${WORDS[f.manyAnswers.length]} objects, ${f.moves.n} of the ${f.moves.total} possible moves between two cities change at least one habit.</li>` +
    `<li><b>Guides go quiet where an object comes apart.</b> Of the ${f.separable} pieces you can separate by hand (${f.separable / CITY_IDS.length} pieces, in each of four cities), ${f.unnamed} have no rule of their own in the official guide: ${f.basis.nearest} had to borrow the nearest listed item and ${f.basis.not_stated} have no rule at all. ${top[0].unnamed + top[1].unnamed} of those ${f.unnamed} are in the ${names(top)}.</li>` +
    `<li><b>Objects that go back whole work everywhere.</b> ${whole ? `The ${names(f.oneAnswer)} is handed in as one piece: one move, the same answer in all four cities, and no piece left unnamed.` : ''} Berlin's deposit bottle is the same idea: one move, back to the shop.</li></ol>` +
    `<div class="scroll"><table><thead><tr><th>Object</th><th class="np">Parts</th><th>Answers</th>${CITY_IDS.map(c => `<th${c === cityId ? ' class="me"' : ''}><span class="l">${esc(cities[c].name)}</span><span class="s">${esc(cities[c].name.split(' (')[0].replace('San Francisco', 'SF'))}</span></th>`).join('')}</tr></thead><tbody>` +
    f.perObject.map(x => `<tr><td>${esc(x.name)}</td><td class="np">${x.parts}</td><td><b>${least(x) ? '≥ ' : ''}${x.answersMin}</b></td>${x.cities.map(c => `<td>${plural(c.bins, 'bin')}${c.residual ? `<span class="bad">${c.residual} residual</span>` : ''}${c.unnamed ? `<span class="unk">${c.unnamed} unnamed</span>` : ''}</td>`).join('')}</tr>`).join('') +
    `<tr class="tot"><td>All ${WORDS[f.perObject.length]}</td><td class="np">${f.perCity[0].total}</td><td></td>${f.perCity.map(c => `<td><span class="${c.residual ? 'bad' : 'good'}">${c.residual} residual</span><span class="unk">${c.unnamed} unnamed</span></td>`).join('')}</tr></tbody></table></div>` +
    cityCounts() + onwardTable() +
    `<h3>So what</h3><ul class="sowhat">` +
    `<li><b>If you sort:</b> take <a href="#" data-go="practice">Your turn</a> once before you look, read <a href="#" data-go="city">Your city</a> for the exact moves, then run it again until every part lands right.</li>` +
    `<li><b>If you moved:</b> set "learned in" at the top right. Teardown then lists only the habits that change, part by part, with the sentence from the new city's guide.</li>` +
    `<li><b>If you run a building, a class or a campaign:</b> every practice answer is logged in this browser and marked as given before or after the page showed the rules. First-try accuracy before and after is the measure. ${sofar}<a href="#" data-log="csv">Download the log (CSV)</a></li>` +
    `<li><b>If you write the guide:</b> these ${f.unnamed} pieces are the ones residents have to guess. <a href="#" data-log="gaps">Download the gap list (CSV)</a></li>` +
    `<li><b>If you design the object:</b> every seam is a decision someone has to get right, and a different one in each city. The ${most.name.toLowerCase()} comes apart into ${WORDS[most.loose]} pieces and gets ${least(most)}${WORDS[most.answersMin]} answers${whole ? `; the ${whole.name.toLowerCase()} goes back whole and gets one` : ''}. Fewer seams, or one way back for the whole thing, leaves nothing to guess.</li></ul>` +
    `<details><summary>The ${f.unnamed} pieces the guides do not name</summary><table class="gaps"><tbody>${f.gaps.map(g => `<tr><td>${esc(cities[g.city].name)}</td><td>${esc(OBJECTS[g.object].name)}</td><td>${esc(OBJECTS[g.object].parts[g.part].label)}</td><td>${g.basis === 'nearest' ? '≈ ' + esc(g.used) : 'no rule found'}</td></tr>`).join('')}</tbody></table></details>` +
    `<p class="fine">Counts are parts, not weight. A piece is "unnamed" when the guide has no rule for it by name; Teardown then shows the nearest listed item and marks it ≈. Where a guide is silent, that silence is not counted as a different answer. "Residual" means the bin for what is not collected separately. Teardown shows which stream a part enters under the city's written rule; it does not measure how much of that stream is finally recycled. The city figures are each city's own published number, with its year and what it counts; they are not Teardown's measurements. ${WORDS[f.perObject.length][0].toUpperCase() + WORDS[f.perObject.length].slice(1)} objects in four cities are a sample, not a survey. Sources and reading dates are in data/SOURCES.md.</p>`;
  $('findings').innerHTML = `<div class="sheet">${h}</div>`; $('findings').hidden = false;
}

// ---------- one click handler for every button that is drawn from data
document.addEventListener('click', e => {
  const t = e.target.closest('[data-atlas],[data-go],[data-open],[data-close],[data-log],[data-choice],[data-object],[data-part],[data-works],#nextPart,#again,#findBtn');
  if (!t) { if (e.target === $('findings')) $('findings').hidden = true; return; }
  if (t.dataset.atlas) return atlasClick(t.dataset.atlas);
  if (t.dataset.close) return void ($(t.dataset.close).hidden = true);
  if (t.id === 'findBtn' || t.dataset.open === 'findings') return renderFindings();
  if (t.dataset.go) { e.preventDefault(); $('findings').hidden = true; return enter(t.dataset.go, t.dataset.go === mode); }
  if (t.dataset.works) { stillWorks = t.dataset.works === '1'; renderCity(); const to = keptWhole() ? SORT0 : 1; if (Math.abs(T - to) > 0.01) settle(to, to === 1 ? 1.9 : 1.0); return; }
  if (t.dataset.then) { e.preventDefault(); $('findings').hidden = true; if (t.dataset.object !== objectId) setObject(t.dataset.object, false); return enter(t.dataset.then, true); }
  if (t.dataset.choice) return answer(t.dataset.choice);
  if (t.id === 'nextPart') return nextPart();
  if (t.id === 'again') return setMode('practice', true);
  if (t.dataset.object) return setObject(t.dataset.object, !!t.dataset.keep);
  if (t.dataset.log) {
    e.preventDefault();
    if (t.dataset.log === 'csv') download('teardown_practice_log.csv', log.csv(), t);
    else if (t.dataset.log === 'gaps') download('teardown_guide_gaps.csv', gapCsv(L.findings()), t);
    else { log.clear(); t.textContent = 'Cleared'; }
    return;
  }
  if (t.dataset.part && t.closest('#side') && mode !== 'practice') return showPart(t.dataset.part);
  if (t.dataset.part && t.closest('.marks')) return showPart(t.dataset.part);
});
addEventListener('keydown', e => { if (e.key === 'Escape') { $('panel').hidden = true; $('findings').hidden = true; if (A.on) atlasClose(); } });

// ---------- start
const m0 = params.get('m');
if (params.has('t')) slider.value = params.get('t');
mode = m0 === 'city' || m0 === 'practice' ? m0 : 'compare';
if (fromCity === cityId) fromCity = '';
fillLearned();
new ResizeObserver(resized).observe(grid); // the views also change size when the side card or the verdict bar does
setMode(mode, true);
frame();
// orbit the shared camera: azimuth (radians, 0 = default view) and distance factor
const orbit = (az, dist = 1) => { const t = controls.target, r = new THREE.Vector3(HOME.x, HOME.y - 0.25, HOME.z).multiplyScalar(dist).applyAxisAngle(new THREE.Vector3(0, 1, 0), az); sharedCam.position.set(r.x, t.y + r.y, r.z); controls.update(); };
window.teardown = { atlas: { establish, flyIn, flyOut, open: atlasOpen, close: atlasClose, hide: atlasHide, state: A }, render: frame, advance, setT, animateT, showPart, setObject, setCity, setFrom, setMode, answer, nextPart, renderFindings, orbit, views, logic: L, log, seen, quiz, cam: sharedCam, get mode() { return mode; }, get objectId() { return objectId; }, get cityId() { return cityId; }, get T() { return T; }, get controls() { return controls; } };
