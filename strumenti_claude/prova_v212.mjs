// prova_v212.mjs: il referto nella finestra separata del client ha gli stili (anche con il service worker) e una foto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18700 + Math.floor(Math.random() * 200)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message));
  await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });   // avviso privacy già accettato
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-001/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1000);
  await c.evaluate(() => document.querySelector('#btn-scale').click()); await c.waitForTimeout(500);
  const sc = await c.evaluate(() => { const s = document.querySelector('#scala-scelta'); return { prima: s?.value, gruppi: [...(s?.querySelectorAll('optgroup') || [])].map((g) => g.label + ' (' + g.children.length + ')') }; });
  ok('0 TC torace: Σ Scale non parte dalla mammella', sc.prima && sc.prima !== 'mammella' && /Adatte/.test(sc.gruppi[0] || ''), sc);
  await c.evaluate(() => { document.querySelector('#scale').hidden = true; });
  await c.click('#cl-referto'); await c.waitForSelector('#dlg-referto[open]'); await c.click('#ref-finestra'); await c.waitForTimeout(1200);
  const st = await c.evaluate(() => { const w = window.__dbg?.FIN_REF?.win; if (!w) return null; const d = w.document;
    return { regole: [...d.styleSheets].reduce((a, s) => { try { return a + s.cssRules.length; } catch { return a; } }, 0), font: w.getComputedStyle(d.body).fontFamily, editorBordo: w.getComputedStyle(d.querySelector('.ref-editor')).borderRadius, testaSticky: w.getComputedStyle(d.querySelector('.ref-testa')).position }; });
  ok('1 finestra separata con gli stili', st && st.regole > 500 && !/^(serif|Times)/i.test(st.font) && st.testaSticky === 'sticky', st);
  await c.evaluate(() => window.__dbg.FIN_REF.win.close()); await c.waitForTimeout(500);
  // foto: stessa impaginazione della finestra separata, a 1000×1100
  await c.setViewportSize({ width: 1000, height: 1100 });
  await c.evaluate(() => { const d = document.querySelector('#dlg-referto'); if (!d.open) d.show(); d.classList.add('in-finestra'); document.body.classList.add('fin-referto'); });
  await c.waitForTimeout(400); await c.screenshot({ path: '/Volumes/Caloggero/_viste/v212_referto_finestra.png' });
  ok('2 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
