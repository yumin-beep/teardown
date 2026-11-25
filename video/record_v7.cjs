// v7 = v5 with the same story, narration and timing; the practice step (scenes 8 and 9) is played in Berlin, where the
// North Sea fulmar sits beside the bins: the pointer first sets "I sort in" to Berlin, then answers by the rule (right,
// wrong: the crust into the paper bin with the lid, right).
// v5 = v4 with the same story, narration and timing, recorded again after the streets and the collector were added:
// each city's street, drawn from the figure that city publishes, stands behind its bins (scenes 4 to 7, 10, 11; the pointer
// rests on Seoul's street bar in scene 4), and the practice step has the collector whose bulb lights on a right first try (8, 9).
// v4 = v3 with the same story, narration and timing, recorded again after the city figures and the phone's way onward were added:
// the city card now carries the city's own count (scenes 6 and 7), the phone's verdict names who offers reuse (11),
// and the findings sheet has two more sections, so scene 13 finds the "So what" heading by its text.
// Renders the demo frame by frame from the real app (deterministic, smooth even on a software GPU).
// v3 = the v2 story with the atlas: the four cities on the globe (scene 3), the flight down to the visitor's city (6)
// and the route from the city where the habits were learned (7). The narration is the v2 narration, unchanged.
// Output 1920x1080 @ 30 fps: a 1536x864 page at device scale 1.25, so the interface reads at video size.
// The app runs with ?rec=1: it draws only when asked, and its animations advance by exactly 1/FPS per frame.
// Scene lengths follow narration_v2/nNN.wav when present (otherwise an estimate from the word count).
// Lines 8, 9, 12 and 13 were rewritten after the independent review; their audio is nNNb.wav.
// Frames go to /tmp/tdvid7/f/, scene start times to /tmp/tdvid7/scenes.json (encode with OUT=/tmp/tdvid7 node mux_v2.cjs).
//   node record_v7.cjs            all scenes        node record_v7.cjs 1,2,3   only these (others are fast-forwarded)
//   PREVIEW=1                     one frame per second, for checking the choreography
// Before running: python3 -m http.server 8766 (from the teardown folder).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const FPS = +(process.env.FPS || 30), OUT = process.env.OUT || '/tmp/tdvid7', KO = process.env.LANG2 === 'ko', NARR = path.join(__dirname, KO ? 'narration_v2_ko' : 'narration_v2'), PREVIEW = !!process.env.PREVIEW;
const lines = {};
for (const m of fs.readFileSync(path.join(__dirname, KO ? 'narration_script_v2_ko.md' : 'narration_script_v2.md'), 'utf8').matchAll(/^(\d+)\. \(([^)]*)\) (.*)$/gm)) lines[+m[1]] = m[3];
const REDONE = KO ? [] : [8, 9, 12, 13];
const wavName = n => `n${String(n).padStart(2, '0')}${REDONE.includes(n) ? 'b' : ''}.wav`, wav = n => path.join(NARR, wavName(n));
// the Korean lines run longer than the English ones: they are played 1.1x faster (mux_v2 applies the same factor) to stay under three minutes
const TEMPO = KO ? 1.1 : 1;
const dur = n => fs.existsSync(wav(n)) ? 1 / TEMPO * parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${wav(n)}"`).toString()) : lines[n].split(/\s+/).length / 2.75 + 0.6;
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;

(async () => {
  if (!process.env.KEEP) fs.rmSync(OUT + '/f', { recursive: true, force: true }); fs.mkdirSync(OUT + '/f', { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25, locale: 'en-US' });
  p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('http://localhost:8766/?o=coffee_cup&c=sf&rec=1'); await p.waitForTimeout(2500);
  await p.addStyleTag({ content: `
    * { transition: none !important }
    body { height: calc(100% - 62px) !important } #panel { bottom: 74px } #findings { bottom: 62px }
    #__cap { position: fixed; left: 0; right: 0; bottom: 0; height: 62px; display: grid; place-items: center; background: #04070b; border-top: 1px solid #1b2b3a; color: #eef4fa; font: 500 21px/1.3 Inter, system-ui, sans-serif; padding: 0 40px; text-align: center; z-index: 80 }
    #__cur { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 90; pointer-events: none; filter: drop-shadow(0 1px 3px rgba(0,0,0,.8)) }
    #__cur.down::after { content: ""; position: absolute; left: -14px; top: -14px; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #6fc3ff; opacity: .9 }
    #__end { position: fixed; inset: 0 0 62px 0; z-index: 70; display: flex; flex-direction: column; justify-content: center; padding: 0 120px; background: linear-gradient(90deg, rgba(7,11,16,.96) 0%, rgba(7,11,16,.86) 48%, rgba(7,11,16,0) 78%); font-family: Inter, system-ui, sans-serif }
    #__end small { font-size: 15px; letter-spacing: .32em; color: #6fc3ff; font-weight: 700 } #__end b { font-size: 58px; line-height: 1.1; letter-spacing: -.015em; margin: 10px 0 14px } #__end span { font-size: 22px; color: #a9bccd; line-height: 1.5 } #__end em { font-style: normal; color: #6fc3ff }
    .move.hot { border-color: var(--accent); background: #0f1a25 } .find li.hot b, .sowhat li.hot b { color: #6fc3ff } .find li.dim, .sowhat li.dim { opacity: .4 }
    #play { visibility: hidden }` });
  await p.evaluate(() => {
    const c = document.createElement('div'); c.id = '__cap'; document.body.appendChild(c);
    const k = document.createElement('div'); k.id = '__cur'; k.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22"><path d="M2 1 L2 17 L6.5 13 L9.5 20 L12.5 18.7 L9.5 12 L16 12 Z" fill="#fff" stroke="#04121d" stroke-width="1.3"/></svg>'; k.style.transform = 'translate(1300px, 760px)'; document.body.appendChild(k);
    window.dispatchEvent(new Event('resize'));
  });

  let fno = 0, skip = false, live = true, sub = null; const scenes = [];
  const ev = (fn, a) => p.evaluate(fn, a);
  // one frame: advance the app by 1/FPS, draw, save. Skipped scenes only advance.
  const shot = async () => {
    if (sub) { const t = (fno - sub.f0) / FPS - 0.3; const cur = sub.parts.find(x => t >= x.a && t < x.b); const text = cur ? cur.text : ''; if (text !== sub.shown) { sub.shown = text; await ev(t => { document.getElementById('__cap').textContent = t; }, text); } }
    const draw = !skip && (!PREVIEW || fno % FPS === 0);
    await ev(([dt, draw, live]) => { window.teardown.advance(dt); if (draw && live) window.teardown.render(); }, [1 / FPS, draw, live]);
    if (draw) await p.screenshot({ path: `${OUT}/f/${String(fno).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    fno++;
  };
  const hold = async s => { for (let i = 0, n = Math.round(s * FPS); i < n; i++) await shot(); };
  // scene n: run the body, then hold until the narration line has finished
  const scene = async (n, body) => {
    const f0 = fno, len = dur(n); scenes.push({ n, t: fno / FPS, f: wavName(n) }); skip = !!only && !only.includes(n);
    // subtitles: the line, sentence by sentence, timed by length
    const sents = lines[n].match(/[^.?!]+[.?!]+/g).map(s => s.trim().replace('three dot j s', 'three.js').replace('쓰리 제이에스', 'three.js')), total = sents.reduce((a, s) => a + s.length, 0); let a = 0;
    sub = { f0, shown: null, parts: sents.map(s => { const x = { a, b: a + len * s.length / total, text: s }; a = x.b; return x; }) };
    await body();
    const left = (len + (KO ? 0.8 : 0.9)) - (fno - f0) / FPS; if (left > 0) await hold(left);
    console.log('scene', n, 'at', (f0 / FPS).toFixed(1), 'len', ((fno - f0) / FPS).toFixed(1), 'narration', len.toFixed(1));
  };
  const lerp = (a, b, u) => a + (b - a) * u, smooth = u => u * u * (3 - 2 * u);
  const orbit = (a, d) => ev(([a, d]) => window.teardown.orbit(a, d), [a, d]);
  const sweep = async (s, a0, a1) => { for (let i = 0, n = Math.round(s * FPS); i < n; i++) { await orbit(lerp(a0, a1, smooth(i / (n - 1)))); await shot(); } };
  // fake cursor: glide to an element (or a point), then click it
  let cur = [1300, 760];
  const point = sel => ev(sel => { const el = typeof sel === 'string' ? document.querySelector(sel) : null; if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + Math.min(r.width * 0.5, 150), r.top + r.height * 0.55]; }, sel);
  const glide = async (to, s = 0.55) => { const from = cur; for (let i = 1, n = Math.round(s * FPS); i <= n; i++) { const u = smooth(i / n); cur = [lerp(from[0], to[0], u), lerp(from[1], to[1], u)]; await ev(c => { document.getElementById('__cur').style.transform = `translate(${c[0]}px, ${c[1]}px)`; }, cur); await shot(); } };
  const press = async fn => { await ev(() => document.getElementById('__cur').classList.add('down')); await hold(0.12); await fn(); await ev(() => document.getElementById('__cur').classList.remove('down')); };
  const click = async (sel, s) => { const pt = await point(sel); if (!pt) throw new Error('no element ' + sel); await glide(pt, s); await press(() => ev(sel => document.querySelector(sel).click(), sel)); };
  const binPoint = id => ev(id => { const v = window.teardown.views[0], t = v.binTags.find(x => x.b.id === id).d.getBoundingClientRect(); return [t.left + t.width / 2, t.top - 46]; }, id);

  // 1 the question
  await scene(1, async () => { await sweep(dur(1) + 0.9, -0.55, 0); });
  // 2 look inside
  await scene(2, async () => { await click('#next'); await hold(3.2); await sweep(dur(2) - 3.2, 0, 0.12); });
  // 3 take it apart, then the four places on the globe
  await scene(3, async () => { await orbit(0); await click('#next', 0.3); await hold(1.9); await ev(() => window.teardown.atlas.establish(null, 0.4)); await hold(4.4); });
  // 4 four cities sort it: four answers
  await scene(4, async () => { await click('#next', 0.2); await ev(() => window.teardown.animateT(1, 3.7)); await hold(3.3); await glide(await point('.cell .own .sbar'), 0.7); await sweep(dur(4) - 4.4 + 0.9, 0, 0.14); });
  // 5 the city's own sentence
  await scene(5, async () => { const pt = await ev(() => { const v = window.teardown.views[0], r = v.cell.getBoundingClientRect(), t = v.binTags[0].d.getBoundingClientRect(); return [t.left + t.width / 2, t.top - 120]; }); await glide(pt, 0.6); await press(() => ev(() => window.teardown.showPart('cup'))); });
  // 6 your city: the rules become moves
  await scene(6, async () => {
    await ev(() => { document.getElementById('panel').hidden = true; });
    // the flight down to the city, then its moves
    await glide(await point('#summary .cta .primary'), 0.6);
    await press(() => ev(() => window.teardown.atlas.flyIn('sf', () => window.teardown.setMode('city', true), { hold: 0.6 })));
    await hold(5.7);
    for (const i of [0, 1]) { const pt = await point(`.moves .move:nth-child(${i + 1}) .mv`); await glide(pt, 0.5); await ev(i => { document.querySelectorAll('.moves .move').forEach((li, j) => { li.classList.toggle('hot', i === j); if (i === j) li.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); }); }, i); await hold(i ? 2.2 : 2.6); }
  });
  // 7 habits that change: "learned in" at the top right
  await scene(7, async () => {
    await ev(() => { document.querySelectorAll('.moves .move').forEach(li => li.classList.remove('hot')); document.getElementById('side').dispatchEvent(new PointerEvent('pointerleave')); });
    await glide(await point('#learned'), 0.7);
    // the move from Tokyo is drawn on the globe while the side card lists what changes
    await press(() => ev(() => { const s = document.getElementById('learned'); s.value = 'tokyo'; s.dispatchEvent(new Event('change', { bubbles: true })); window.teardown.atlas.flyIn('sf', null, { from: 'tokyo', route: true, hold: 1.3 }); }));
    await hold(5.0); await glide(await point('.changes li .now'), 0.8);
  });
  // answers the part being asked with the bin the rule names
  const answerRight = () => ev(() => { const t = window.teardown, q = t.quiz; t.answer(t.logic.rule(t.cityId, t.objectId, q.list[q.i]).bin); });
  // 8 guess first: a pizza box the page has not shown yet. One right answer, one wrong one corrected by the rule.
  await scene(8, async () => {
    await ev(() => { window.teardown.log.clear(); });
    await glide(await point('#city'), 0.5); await press(() => ev(() => { const s = document.getElementById('city'); s.value = 'berlin'; s.dispatchEvent(new Event('change', { bubbles: true })); })); await hold(0.5);
    await click('#tabs button[data-o="pizza_box"]', 0.5); await hold(1.2);
    await click('#cap .guess', 0.6); await hold(1.9);
    const right = () => ev(() => { const t = window.teardown, q = t.quiz; return t.logic.rule(t.cityId, t.objectId, q.list[q.i]).bin; });
    const first = await right();
    await glide(await binPoint(first), 0.6); await press(() => ev(b => window.teardown.answer(b), first)); await hold(2.2);
    await click('#nextPart', 0.4); await hold(0.9);
    await glide(await binPoint(first), 0.6); await press(() => ev(b => window.teardown.answer(b), first)); await hold(3.0);   // the crust into the lid's bin: wrong
    await click('#nextPart', 0.4); await hold(0.5);
    const last = await right();
    await glide(await binPoint(last), 0.5); await press(() => ev(b => window.teardown.answer(b), last));
  });
  // 9 the baseline score, the city's moves, a second run: both scores side by side
  await scene(9, async () => {
    await click('#nextPart', 0.35); await hold(2.1);
    await click('#side .cta .primary', 0.5); await hold(3.3);
    await click('#side > .cta .primary', 0.5); await hold(0.5);
    for (let i = 0; i < 3; i++) { await press(answerRight); await hold(0.5); await ev(() => window.teardown.nextPart()); await hold(0.15); }
    const pt = await point('.runs'); if (pt) await glide([pt[0] + 80, pt[1] + 30], 0.5);
  });
  // 10 the bottle: label off in Seoul, one move in Berlin
  await scene(10, async () => {
    await ev(() => { window.teardown.setObject('pet_bottle'); window.teardown.setMode('compare'); window.teardown.setT(0.3); document.getElementById('t').value = 0.3; });
    await orbit(0); await ev(() => window.teardown.animateT(1, 5.5)); await hold(6); await sweep(dur(10) - 6 + 0.9, 0, 0.1);
  });
  // 11 the phone: one answer
  await scene(11, async () => {
    await ev(() => { window.teardown.setObject('smartphone'); window.teardown.setT(0.02); });
    await orbit(0); await ev(() => window.teardown.animateT(1, 5.2)); await hold(dur(11) + 0.9);
  });
  // 12 what we found
  await scene(12, async () => {
    await click('#findBtn', 0.5); live = false;
    const each = (dur(12) - 3.6) / 3; await ev(() => document.querySelectorAll('.find li').forEach(li => li.classList.add('dim'))); await hold(3.1);
    for (const i of [0, 1, 2]) { await ev(i => document.querySelectorAll('.find li').forEach((li, j) => { li.classList.toggle('hot', i === j); li.classList.toggle('dim', i !== j); }), i); await hold(each); }
  });
  // 13 so what: who gets what
  await scene(13, async () => {
    await ev(() => { document.querySelectorAll('.find li').forEach(li => li.classList.remove('hot', 'dim')); const sh = document.querySelector('.sheet'); sh.scrollTop = [...sh.querySelectorAll('h3')].find(h => h.textContent === 'So what').offsetTop - 24; document.querySelectorAll('.sowhat li').forEach(li => li.classList.add('dim')); });
    const each = (dur(13) + 0.6) / 4;
    for (const i of [0, 1, 3, 4]) { await ev(i => document.querySelectorAll('.sowhat li').forEach((li, j) => { li.classList.toggle('hot', i === j); li.classList.toggle('dim', i !== j); }), i); await glide(await point(`.sowhat li:nth-child(${i + 1}) b`), 0.5); await hold(each - 0.5); }
  });
  // 14 how it is built: another object opening up
  await scene(14, async () => {
    live = true; await ev(() => { document.getElementById('findings').hidden = true; window.teardown.setObject('pet_bottle'); window.teardown.setT(0); });
    await glide([1500, 700], 0.3); await orbit(-0.3); await ev(d => window.teardown.animateT(0.46, d), dur(14));
    await sweep(dur(14) + 0.9, -0.3, 0.2);
  });
  // 15 end
  await scene(15, async () => {
    await ev(KO => { window.teardown.setObject('coffee_cup'); window.teardown.setT(0); const e = document.createElement('div'); e.id = '__end'; e.innerHTML = '<small>TEARDOWN</small>' + (KO ? '<b>무엇으로 만들어졌는지 보고,<br>사는 곳의 규칙대로 버립니다.</b><span>물건 넷 · 도시 넷 · 모든 규칙에 출처<br>' : '<b>See what it&rsquo;s made of.<br>Sort it where you are.</b><span>Four objects · four cities · every rule with its source<br>') + '<em>github.com/yumin-beep/teardown</em></span>'; document.body.appendChild(e); document.getElementById('cap').style.visibility = 'hidden'; }, KO);
    await sweep(dur(15) + 1.6, 0.25, 0.6);
  });
  fs.writeFileSync(OUT + '/scenes.json', JSON.stringify(scenes));
  console.log('frames', fno, 'seconds', (fno / FPS).toFixed(1));
  await b.close();
})();
