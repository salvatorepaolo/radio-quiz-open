// prova_v233.mjs: dati dell'esame e del paziente nell'etichetta della serie (sesso, età, studio, parametri tecnici), senza dati identificativi
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19350 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const a = await (await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
  const errori = []; a.on('pageerror', (e) => errori.push(e.message));
  const righe = async (id) => { await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/caso/' + id); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, id, { timeout: 60000 }); await a.waitForTimeout(2500);
    return a.evaluate(() => { const d = window.__dbg, out = []; const orig = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...r) { out.push(String(t)); return orig.call(this, t, ...r); }; d.disegna?.(); CanvasRenderingContext2D.prototype.fillText = orig; return out; }); };
  const r1 = await righe('caso-tcia-014');
  ok('1 RX: sesso dall\'anamnesi e descrizione dello studio sotto il nome della serie', r1.some((t) => /^F · XR CHEST AP PORTABLE/.test(t)), r1.slice(0, 8));
  ok('2 RX: kV e mAs', r1.some((t) => /95 kV · 8,0 mAs/.test(t)));
  ok('3 TC: kV, mAs e mezzo di contrasto', r1.some((t) => /140 kV · 245 mAs · con mdc/.test(t)));
  const r2 = await righe('caso-tcia-022');
  ok('4 RM: tesla, TR, TE, flip', r2.some((t) => /3,0 T · TR 2200 · TE \d+ · 110°/.test(t)), r2.slice(0, 8));
  ok('5 RM prostata: sesso M', r2.some((t) => /^M · MR PROSTATE/.test(t)));
  ok('6 l\'età non si ripete (già nel nome della serie)', !r1.some((t) => /^F · 22 anni/.test(t)));
  ok('7 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
