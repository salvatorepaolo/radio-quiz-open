// prova_v232.mjs: la barra degli strumenti non cambia numero di righe passando dal riquadro RX a quello TC (caso 014, varie larghezze)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19350 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const a = await (await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const err = []; a.on('pageerror', (e) => err.push(e.message)); a.on('console', (m) => { if (m.type() === 'error') err.push('console: ' + m.text()); });
  await a.goto(B + '/?prova#/caso/caso-tcia-109'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-109', null, { timeout: 60000 }); await a.waitForTimeout(800);
  await a.evaluate(async () => { const d = window.__dbg, si = d.V.serie.findIndex((x) => /Cuore.*fetta 2\/3/.test(x.descrizione || '')); await d.selezionaSerie(si, d.V.attivo, { idx: 0 }); });
  await a.waitForTimeout(3000);
  await a.evaluate(() => document.querySelector('#barra-2d [data-tool="cmr"]').click());
  await a.evaluate(async () => { await window.__dbg.autoCmr(); }); console.log('109 fatto');
  await a.evaluate(() => { document.querySelector('#cmr-chiudi').click(); });
  await a.goto(B + '/?prova#/caso/caso-tcia-070'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-070', null, { timeout: 60000 }); await a.waitForTimeout(1500);
  console.log(await a.evaluate(() => { const d = window.__dbg; return { n: d.V.n, att: d.V.attivo, serie: d.V.serie.map((s) => s.descrizione).slice(0, 14), pann: d.V.pannelli.slice(0, d.V.n).map((p) => p.sIdx) }; }));
  await a.evaluate(async () => { const d = window.__dbg, si = d.V.serie.findIndex((x) => /asse corto 5\/10/.test(x.descrizione || '')); window.__si = si; await d.selezionaSerie(si, d.V.attivo, { idx: 0 }); });
  for (let k = 0; k < 10; k++) { await a.waitForTimeout(2000); console.log(k, await a.evaluate(() => { const d = window.__dbg, p = d.P(d.V.attivo); return { si: window.__si, sIdx: p.sIdx, img: !!p.img, me: d.ME?.has?.(p.sIdx), meKeys: d.ME ? [...d.ME.keys()] : 'no ME', frames: p.frames.length, car: p.frames.filter((f) => f.buf).length }; })); }
  console.log('errori', err.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
