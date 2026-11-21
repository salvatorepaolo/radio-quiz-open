// prova_neuro_1111.mjs: RM encefalo con precedente (caso 064): encefalo raddrizzato in automatico, confronto fino a 4
// esami (qui 2) ricostruiti sul piano di A, punto collegato affinato, lesioni SM (stima), 1×1 all'apertura
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const caso = process.argv[2] || 'caso-tcia-064';
const PORTA = +process.env.PORTA_PROVA || (19200 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
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
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 180000 });
  const D = (f, x) => c.evaluate(f, x);
  await c.waitForFunction(() => window.__dbg.V.pannelli[0].piano === 'obliqua' && window.__dbg.V.img, null, { timeout: 90000 }).catch(() => {});
  const r0 = await D(() => ({ n: window.__dbg.V.n, piano: window.__dbg.V.pannelli[0].piano, msg: document.querySelector('.avviso-breve')?.textContent }));
  ok('1 1×1 e encefalo raddrizzato in automatico', r0.n === 1 && r0.piano === 'obliqua', r0);
  await c.screenshot({ path: `/Volumes/Caloggero/_viste/neuro_dritto.png` });
  ok('2 pulsanti neuro visibili', await D(() => !document.querySelector('#btn-raddrizza').hidden && !document.querySelector('#btn-confronta-tutti').hidden));
  await c.click('#btn-confronta-tutti');
  await c.waitForFunction(() => window.__dbg.V.n >= 2 && document.querySelector('#caricamento').hidden && window.__dbg.V.pannelli[1].piano === 'riallineato' && window.__dbg.V.pannelli[1].img, null, { timeout: 240000 });
  await c.waitForTimeout(1200);
  const r1 = await D(() => ({ n: window.__dbg.V.n, a: window.__dbg.V.pannelli[0].piano, b: window.__dbg.V.pannelli[1].piano }));
  ok('3 confronto: A raddrizzato resta, B ricostruito sul piano di A', r1.a === 'obliqua' && r1.b === 'riallineato', r1);
  await c.screenshot({ path: `/Volumes/Caloggero/_viste/neuro_confronto.png` });
  // punto collegato: nei riquadri originali (⇄) per provare l'affinamento locale
  await c.click('#btn-riallinea'); await c.waitForTimeout(2000);
  await D(() => window.__dbg.selezionaSerie(window.__dbg.V.pannelli[0].sIdx, 0)); await c.waitForTimeout(1500);
  await D(() => { const p = window.__dbg.V.pannelli[0]; return window.__dbg.collegaPunto(0, { x: p.img.cols * 0.42, y: p.img.rows * 0.45 }); }); await c.waitForTimeout(4000);
  const r2 = await D(() => ({ qPer: [...(window.__dbg.COLL.qPer || new Map()).keys()], q: window.__dbg.COLL.q?.map((x) => Math.round(x)) }));
  ok('4 punto collegato: affinato nell\'altro esame', r2.qPer.length >= 1, r2);
  await c.screenshot({ path: `/Volumes/Caloggero/_viste/neuro_target.png` });
  ok('5 nessun errore JavaScript', !errori.length, errori.slice(0, 4));
} catch (e) { console.log('KO eccezione', e.message); ko++; }
finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTI OK'); }
