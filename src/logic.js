// Everything Teardown concludes is computed here from data/cities.json, so the numbers on screen
// can never drift from the rule table. No three.js in this file.

export const FATES = {
  recycle: { label: 'Recycling', color: '#4db8ff' },
  organic: { label: 'Organics', color: '#5fd38a' },
  return: { label: 'Take-back', color: '#b98cff' },
  residual: { label: 'Residual waste', color: '#ff7a6b' },
  unknown: { label: 'No rule found', color: '#9aa7b3' },
};
export const RECOVERY = ['recycle', 'organic', 'return'];

export function makeLogic(cities, OBJECTS, CITY_IDS) {
  const partsOf = o => Object.keys(OBJECTS[o].parts);
  const rule = (c, o, p) => cities[c].rules[o]?.[p];
  const known = r => r && r.basis !== 'not_stated';
  const binOf = (c, o, p) => { const r = rule(c, o, p); return known(r) ? cities[c].bins.find(b => b.id === r.bin) : null; };
  // a part stays on its host if it cannot be separated (model), or if this city's rule says to leave it on
  const hostOf = (c, o, p) => {
    const r = rule(c, o, p), main = OBJECTS[o].main;
    return OBJECTS[o].parts[p].bondedTo || (r && (r.basis === 'bonded' || r.keep_on) && p !== main ? main : null);
  };
  const fateOf = (c, o, p) => binOf(c, o, p)?.fate || 'unknown';
  const label = (o, p) => OBJECTS[o].parts[p].label;

  // the piles you have to make in one city, main part first
  function groups(c, o) {
    const order = [OBJECTS[o].main, ...partsOf(o).filter(p => p !== OBJECTS[o].main)];
    const out = [];
    for (const p of order) {
      const b = binOf(c, o, p), id = b ? b.id : 'none';
      let g = out.find(g => g.id === id);
      if (!g) out.push(g = { id, bin: b, fate: b ? b.fate : 'unknown', parts: [] });
      g.parts.push(p);
    }
    return out.sort((a, b) => (a.id === 'none') - (b.id === 'none'));
  }
  // two cities give "the same answer" if they make the same piles and each pile meets the same kind of stream
  const signature = (c, o) => groups(c, o).map(g => g.fate + ':' + [...g.parts].sort().join('+')).sort().join('|');
  const answers = o => new Set(CITY_IDS.map(c => signature(c, o))).size;
  // A guide that is silent on a part cannot be said to differ because of that part: two cities are
  // compared only on the parts both have a rule for. answersMin is the number of answers that are certain.
  const sigOn = (c, o, keep) => groups(c, o).filter(g => g.fate !== 'unknown').map(g => g.fate + ':' + g.parts.filter(p => keep.has(p)).sort().join('+')).filter(x => !x.endsWith(':')).sort().join('|');
  const sameAnswer = (a, b, o) => { const keep = new Set(partsOf(o).filter(p => known(rule(a, o, p)) && known(rule(b, o, p)))); return sigOn(a, o, keep) === sigOn(b, o, keep); };
  function answerClasses(o) {
    const classes = [], silent = c => partsOf(o).filter(p => !known(rule(c, o, p))).length;
    for (const c of [...CITY_IDS].sort((a, b) => silent(a) - silent(b))) { const k = classes.find(k => k.every(x => sameAnswer(x, c, o))); if (k) k.push(c); else classes.push([c]); }
    return classes;
  }
  const answersMin = o => answerClasses(o).length;
  // pairs of cities whose answers differ only because one guide is silent on a part
  const maybeSame = o => answerClasses(o).filter(k => k.length > 1).flatMap(k => k.flatMap((a, i) => k.slice(i + 1).filter(b => signature(a, o) !== signature(b, o)).map(b => [a, b])));
  // pieces you can separate by hand: everything except layers bonded to another part
  const separable = (o, p) => !OBJECTS[o].parts[p].bondedTo;
  const binsNeeded = (c, o) => groups(c, o).filter(g => g.id !== 'none').length;
  const tally = (c, o) => {
    const t = { recycle: 0, organic: 0, return: 0, residual: 0, unknown: 0, total: 0, unnamed: 0 };
    for (const p of partsOf(o)) { t[fateOf(c, o, p)]++; t.total++; const r = rule(c, o, p); if (!r || r.basis === 'nearest' || r.basis === 'not_stated') t.unnamed++; }
    t.recovered = t.recycle + t.organic + t.return;
    return t;
  };
  const basisCount = () => {
    const n = { stated: 0, bonded: 0, nearest: 0, not_stated: 0, total: 0, separable: 0 };
    for (const c of CITY_IDS) for (const o of Object.keys(OBJECTS)) for (const p of partsOf(o)) { const r = rule(c, o, p); n[r ? r.basis : 'not_stated']++; n.total++; if (separable(o, p)) n.separable++; }
    return n;
  };
  // parts the official guide never names: we used the nearest listed item, or found nothing
  const gaps = () => {
    const out = [];
    for (const c of CITY_IDS) for (const o of Object.keys(OBJECTS)) for (const p of partsOf(o)) {
      const r = rule(c, o, p);
      if (!r || r.basis === 'nearest' || r.basis === 'not_stated') out.push({ city: c, object: o, part: p, basis: r ? r.basis : 'not_stated', used: binOf(c, o, p)?.name || '', source: r?.source || '', url: r?.url || '' });
    }
    return out;
  };

  // what a person does with one part in one city
  function action(c, o, p) {
    const r = rule(c, o, p), b = binOf(c, o, p), host = hostOf(c, o, p);
    return { known: known(r), attached: !!host, host, bin: b, fate: b ? b.fate : 'unknown', basis: r ? r.basis : 'not_stated' };
  }
  // Habits travel with people. For someone who learned to sort in `from` and now lives in `to`:
  // which bin would the old habit reach for here, and is that still right?
  const LIKE = {
    paper: ['paper', 'mixed'], plastic: ['plastic', 'packaging', 'mixed'], packaging: ['packaging', 'plastic', 'mixed'],
    pet: ['pet', 'plastic', 'packaging', 'mixed'], film: ['film', 'plastic', 'packaging', 'mixed'],
    organic: ['organic'], residual: ['residual'], deposit: ['deposit'], takeback: ['takeback'], mixed: [],
  };
  const habitBin = (to, stream) => { for (const s of LIKE[stream] || []) { const b = cities[to].bins.find(x => x.stream === s); if (b) return b; } return null; };
  function changes(from, to, o) {
    const out = [];
    for (const p of partsOf(o)) {
      const a = action(from, o, p), b = action(to, o, p);
      if (!a.known || !b.known) continue;
      // a part that stays attached in both places just follows its host: the host is reported instead
      if (a.attached && b.attached) continue;
      if (a.attached !== b.attached) { out.push({ part: p, kind: b.attached ? 'leave_on' : 'take_off', a, b }); continue; }
      const habit = habitBin(to, a.bin.stream);
      if (!habit || habit.id !== b.bin.id) out.push({ part: p, kind: a.bin.stream === 'mixed' ? 'split' : 'bin', a, b, habit });
    }
    return out;
  }
  // parts left out of that comparison because one of the two guides has no rule for them
  const uncompared = (from, to, o) => partsOf(o).filter(p => !action(from, o, p).known || !action(to, o, p).known).map(p => ({ part: p, silent: !action(to, o, p).known ? to : from }));
  // of the 12 moves between two of the four cities, how many change at least one habit for this object
  const movesChanged = o => { let n = 0, total = 0; for (const a of CITY_IDS) for (const b of CITY_IDS) if (a !== b) { total++; if (changes(a, b, o).length) n++; } return { n, total }; };

  // practice: parts that have a rule, attached ones first (the hidden layer is the first question)
  // From the second run on the order is shuffled (the same shuffle for the same run number), so a better
  // score is not just the remembered order.
  function quizParts(c, o, run = 1) {
    const ps = partsOf(o).filter(p => OBJECTS[o].parts[p].quiz !== false && known(rule(c, o, p)));
    const on = ps.filter(p => hostOf(c, o, p)), off = ps.filter(p => !hostOf(c, o, p));
    if (run < 2) return [...on, ...off];
    let x = (run * 2654435761) >>> 0; const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
    const mix = list => { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
    return [...mix(on), ...mix(off)]; // attached layers are still asked while their host is in the hand
  }
  const skipped = (c, o) => partsOf(o).filter(p => !known(rule(c, o, p)));
  // where official sources disagree, the rule lists the other accepted bin under `also`
  const alsoFor = (c, o, p, choice) => (rule(c, o, p).also || []).find(a => a.bin === choice) || null;
  const isCorrect = (c, o, p, choice) => choice === 'attach' ? !!hostOf(c, o, p) : choice === rule(c, o, p).bin || !!alsoFor(c, o, p, choice);

  // What a wrong first try would do at the kerb, read from the streams of the two bins. A classification from the
  // rule table, not a measurement: 'contaminates' = the part lands in a collection stream that does not take it,
  // 'lost' = a part the city collects goes to residual waste, 'bonded' = a layer that cannot be peeled off by hand.
  function effect(c, o, p, choice) {
    if (isCorrect(c, o, p, choice)) return null;
    if (hostOf(c, o, p)) return { kind: 'bonded' };
    const right = binOf(c, o, p), into = choice === 'attach' ? binOf(c, o, OBJECTS[o].main) : cities[c].bins.find(b => b.id === choice);
    const collected = b => b && ['recycle', 'organic', 'return'].includes(b.fate);
    if (!into || !right) return { kind: 'other' };
    // soft: the guide does not name this part, so the right bin is the nearest listed item's, and the sentence says so
    const soft = rule(c, o, p).basis === 'nearest';
    if (collected(into) && into.id !== right.id) return { kind: 'contaminates', into, right, soft, rides: choice === 'attach' };
    if (into.fate === 'residual' && collected(right)) return { kind: 'lost', into, right, soft, rides: choice === 'attach' };
    return { kind: 'other', into, right };
  }

  function findings() {
    const objs = Object.keys(OBJECTS), n = basisCount(), g = gaps();
    const perObject = objs.map(o => ({
      id: o, name: OBJECTS[o].name, parts: partsOf(o).length, loose: partsOf(o).filter(p => separable(o, p)).length, answers: answers(o), answersMin: answersMin(o), moves: movesChanged(o),
      cities: CITY_IDS.map(c => ({ city: c, bins: binsNeeded(c, o), ...tally(c, o) })),
      unnamed: g.filter(x => x.object === o).length,
    }));
    const perCity = CITY_IDS.map(c => {
      const t = { city: c, residual: 0, unknown: 0, unnamed: 0, total: 0 };
      for (const o of objs) { const x = tally(c, o); t.residual += x.residual; t.unknown += x.unknown; t.unnamed += x.unnamed; t.total += x.total; }
      return t;
    });
    const many = perObject.filter(x => x.answersMin > 1);
    return { basis: n, unnamed: n.nearest + n.not_stated, separable: n.separable, perObject, perCity, gaps: g, oneAnswer: perObject.filter(x => x.answersMin === 1), manyAnswers: many,
      moves: { n: many.reduce((a, x) => a + x.moves.n, 0), total: many.reduce((a, x) => a + x.moves.total, 0) } };
  }

  // ---------- beyond the bin: the number each city publishes about itself, and where a whole device can go
  // (read from the cities' own pages; the figures are not comparable with each other)
  const figure = c => cities[c].figure || null;
  // the city's street is drawn from that figure: 20 kerb bays, one for every 5 % of the waste the city counted.
  // Largest remainders, so the bays always add up to 20. `clear` = the share the city reports as recycled or recovered,
  // `energy` = burned for energy where the city counts that apart, `rest` = everything else.
  const BAYS = 20;
  const street = c => {
    const f = figure(c), s = f && f.street; if (!s) return null;
    const parts = [['clear', s.clear], ['energy', s.energy || 0]]; parts.push(['rest', Math.max(0, 1 - parts[0][1] - parts[1][1])]);
    const xs = parts.map(([k, v]) => ({ k, v, n: Math.floor(v * BAYS + 1e-9), r: v * BAYS - Math.floor(v * BAYS + 1e-9) }));
    let left = BAYS - xs.reduce((a, x) => a + x.n, 0);
    for (const x of [...xs].sort((a, b) => b.r - a.r)) if (left-- > 0) x.n++;
    const n = Object.fromEntries(xs.map(x => [x.k, x.n]));
    return { ...s, bays: BAYS, n, period: f.period, computed: s.computed || '' };
  };
  const after = (c, o) => (cities[c].after || {})[o] || null;
  // which cities name a way to pass a working object on, and which describe collection only
  const passOn = o => {
    const has = CITY_IDS.filter(c => after(c, o));
    return has.length ? { named: has.filter(c => after(c, o).works.named), silent: has.filter(c => !after(c, o).works.named) } : null;
  };

  return { partsOf, rule, binOf, hostOf, fateOf, label, groups, signature, answers, answersMin, maybeSame, separable, binsNeeded, tally, basisCount, gaps, action, changes, uncompared, movesChanged, quizParts, skipped, alsoFor, isCorrect, effect, findings, figure, street, after, passOn };
}

// ---------- practice log: stays in this browser, exportable so a pilot can be measured
// Each answer records whether the page had already shown this city's rules for the object (seen_rules).
// A run with seen_rules = 0 is a baseline: what the person knew before Teardown told them anything.
const KEY = 'teardown.log.v1', SEEN = 'teardown.seen.v1';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || d); } catch { return JSON.parse(d); } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: keep going without storage */ } };
export const seen = {
  has: (city, object) => read(SEEN, '[]').includes(city + '|' + object),
  mark(cities, object) { const a = read(SEEN, '[]'); let ch = false; for (const c of [].concat(cities)) if (!a.includes(c + '|' + object)) { a.push(c + '|' + object); ch = true; } if (ch) write(SEEN, a); },
};
export const log = {
  all: () => read(KEY, '[]'),
  add(e) { const a = log.all(); a.push(e); write(KEY, a); },
  clear() { try { localStorage.removeItem(KEY); localStorage.removeItem(SEEN); } catch { /* nothing stored */ } },
  nextRun(city, object) { return Math.max(0, ...log.all().filter(e => e.city === city && e.object === object).map(e => e.run)) + 1; },
  // first-try accuracy per run for one city + object
  runs(city, object) {
    const by = {};
    for (const e of log.all()) if (e.city === city && e.object === object) { (by[e.run] ||= { run: e.run, n: 0, ok: 0, baseline: e.seen_rules === 0 }); by[e.run].n++; by[e.run].ok += e.correct; }
    return Object.values(by).sort((a, b) => a.run - b.run);
  },
  // across everything: answers given before the rules were shown against answers given after
  summary() {
    const s = { before: { n: 0, ok: 0 }, after: { n: 0, ok: 0 }, answers: 0 };
    for (const e of log.all()) { const k = e.seen_rules === 0 ? 'before' : 'after'; s[k].n++; s[k].ok += e.correct; s.answers++; }
    return s;
  },
  csv() {
    const cols = ['time', 'run', 'seen_rules', 'city', 'object', 'part', 'choice', 'answer', 'correct', 'basis', 'effect'];
    return [cols.join(','), ...log.all().map(e => cols.map(k => String(e[k] ?? '').replace(/,/g, ';')).join(','))].join('\n');
  },
};
