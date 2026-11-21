// prova_v245.mjs: richieste del 9/11 — ✕ in alto a destra, testo delle misure spostabile, layout 2×1, Multischermo,
// referto senza «Rimetti nella pagina»; MPR in disposizione Esaote, zoom con la rotellina premuta, freccia con «scorri»,
// testo delle misure spostabile, clic che sposta il centro delle linee di riferimento, sposta nel 3D
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19800 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
try {
  // ---------------- 2D nel visualizzatore scaricabile
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/serie');
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await c.waitForTimeout(1500);
  const D = (f, x) => c.evaluate(f, x);
  const cv = await D(() => { const r = document.querySelector('#canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  // testo della distanza spostabile
  await D(() => document.querySelector('#barra-2d [data-tool="misura"]').click());
  const cx = cv.x + cv.w / 2, cy = cv.y + cv.h / 2;
  await c.mouse.move(cx - 50, cy); await c.mouse.down(); await c.mouse.move(cx + 30, cy, { steps: 6 }); await c.mouse.up(); await c.waitForTimeout(300);
  const et = await D(() => { const e = window.__dbg.ETICHETTE.find((x) => x.m.tipo === 'linea'); return e && { x: e.x, y: e.y, w: e.w, h: e.h, a: { ...e.m.a }, b: { ...e.m.b } }; });
  ok('1 etichetta della distanza registrata', !!et, et);
  if (et) {
    const ex = cv.x + et.x + et.w / 2, ey = cv.y + et.y + et.h / 2;
    await c.mouse.move(ex, ey); await c.mouse.down(); await c.mouse.move(ex + 60, ey + 40, { steps: 8 }); await c.mouse.up(); await c.waitForTimeout(300);
    const dopo = await D(() => { const m = Object.values(window.__dbg.V.misure).flat().find((x) => x.tipo === 'linea'); return { dt: m.dt, a: m.a, b: m.b, n: Object.values(window.__dbg.V.misure).flat().length }; });
    ok('2 trascinando il testo si sposta solo il testo (la misura resta)', dopo.dt && Math.abs(dopo.dt.x - 60) < 3 && Math.abs(dopo.dt.y - 40) < 3 && dopo.a.x === et.a.x && dopo.b.x === et.b.x && dopo.n === 1, dopo);
  }
  // ROI: anche il suo testo
  await D(() => document.querySelector('#barra-2d [data-tool="roi"]').click());
  await c.mouse.move(cx - 100, cy + 60); await c.mouse.down(); await c.mouse.move(cx - 60, cy + 100, { steps: 6 }); await c.mouse.up(); await c.waitForTimeout(300);
  const etR = await D(() => { const e = window.__dbg.ETICHETTE.find((x) => x.m.tipo === 'roi'); return e && { x: e.x, y: e.y, w: e.w, h: e.h }; });
  if (etR) { const ex = cv.x + etR.x + 10, ey = cv.y + etR.y + etR.h / 2; await c.mouse.move(ex, ey); await c.mouse.down(); await c.mouse.move(ex + 30, ey - 50, { steps: 6 }); await c.mouse.up(); await c.waitForTimeout(300); }
  const roi = await D(() => Object.values(window.__dbg.V.misure).flat().find((x) => x.tipo === 'roi')?.dt);
  ok('3 testo della ROI spostabile', roi && Math.abs(roi.x - 30) < 3 && Math.abs(roi.y + 50) < 3, { roi, etR, n: await D(() => [Object.values(window.__dbg.V.misure).flat().map((x) => x.tipo), window.__dbg.ETICHETTE.map((e) => e.m.tipo)]) });
  console.log('DBG', JSON.stringify(await D(() => { const d = window.__dbg; d.disegna(); const m = Object.values(d.V.misure).flat().find((x) => x.tipo === 'roi'); let st; try { st = d.statisticheROI(d.vistaDi(d.P(0)), m); } catch (e) { st = 'ERR ' + e.message; } return { st, m, et: d.ETICHETTE.map((e) => [e.m.tipo, e.k]), keys: Object.keys(d.V.misure), att: d.V.attivo, n: d.V.n }; })));
} catch (e) { console.log('ERRORE', e); } finally { await b.close(); sim.kill(); process.exit(0); }
