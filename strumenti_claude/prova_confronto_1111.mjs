// prova_confronto_1111.mjs: confronto con l'esame precedente (coregistrazione con rotazione e sincronizzazione)
// uso: node prova_confronto_1111.mjs caso-tcia-064 → foto a 3 livelli in _viste/confr_<caso>_<n>.png
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const caso = process.argv[2] || 'caso-tcia-064';
const PORTA = +process.env.PORTA_PROVA || (19400 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
try {
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro(`/Volumes/Caloggero/piattaforma-quiz/casi-free/${caso}/serie`);
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 180000 }); await c.waitForTimeout(2500);
  const D = (f, x) => c.evaluate(f, x);
  const n0 = await D(() => ({ n: window.__dbg.V.n, s: window.__dbg.V.pannelli.slice(0, window.__dbg.V.n).map((p) => p.sIdx), hp: localStorage.getItem('rq-hp-attivo') }));
  ok('1 all\'apertura un solo riquadro', n0.n === 1, n0);
  // serie più lunga dell'esame più recente nel riquadro A
  await D(() => { const V = window.__dbg.V; let m = -1, i0 = 0; V.serie.forEach((s, i) => { if (s.files.length > m && /Attuale|Esame/.test(document.querySelector(`#lista-serie .s[data-i="${i}"]`)?.dataset.studio ? 'Attuale' : 'Esame')) { m = s.files.length; i0 = i; } }); });
  const t0 = Date.now(); await c.click('#btn-confronta');
  await c.waitForFunction(() => window.__dbg.V.n === 2 && document.querySelector('#caricamento').hidden && window.__dbg.V.pannelli[1].piano === 'riallineato' && window.__dbg.V.pannelli[1].img, null, { timeout: 240000 }); await c.waitForTimeout(1500);
  const st = await D(() => { const V = window.__dbg.V; const o = Object.entries(V.offset).map(([k, T]) => ({ R: T.R.map((x) => Math.round(x * 1000) / 1000), t: T.t.map((x) => Math.round(x)), ruotato: !!T.ruotato })); return { o, A: V.serie[V.pannelli[0].sIdx].descrizione, B: V.serie[V.pannelli[1].sIdx].descrizione, nA: V.pannelli[0].frames.length, nB: V.pannelli[1].frames.length }; });
  console.log('coregistrazione in', ((Date.now() - t0) / 1000).toFixed(0), 's', JSON.stringify(st));
  // tre livelli: 25%, 50%, 75% di A; B deve seguire
  const cv = await D(() => { const r = document.querySelector('#canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  for (const [n, f] of [[1, 0.3], [2, 0.5], [3, 0.7]]) {
    await D((f) => { const V = window.__dbg.V; V.attivo = 0; return window.__dbg.mostraDi ? window.__dbg.mostraDi(0, Math.round(V.pannelli[0].frames.length * f)) : null; }, f);
    if (!(await D(() => !!window.__dbg.mostraDi))) { await c.mouse.move(cv.x + cv.w / 4, cv.y + cv.h / 2); await c.mouse.wheel(0, 100 * n); }
    await c.waitForTimeout(1500);
    const r = await D(() => { const V = window.__dbg.V; return [V.pannelli[0].idx, V.pannelli[1].idx]; });
    console.log('livello', n, 'A/B', r);
    await c.screenshot({ path: `/Volumes/Caloggero/_viste/confr_${caso}_${n}.png`, clip: { x: cv.x, y: cv.y, width: cv.w, height: cv.h } });
  }
  ok('2 precedente ricostruito sul piano dell\'attuale', await D(() => window.__dbg.V.pannelli[1].piano === 'riallineato'));
  await c.click('#btn-riallinea'); await c.waitForTimeout(2500);
  ok('3 ⇄: di nuovo le immagini originali del precedente', await D(() => !window.__dbg.V.pannelli[1].piano && !!window.__dbg.V.pannelli[1].img));
  ok('4 nessun errore JavaScript', !errori.length, errori.slice(0, 4));
} catch (e) { console.log('KO eccezione', e.message); ko++; }
finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTI OK'); }
