// prova_v242.mjs: comandi del mouse e della tastiera come «ⓘ» nella barra; linguetta senza «nato/a il»
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19350 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
  const errori = [];
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/serie');
  const c = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage(); c.on('pageerror', (e) => errori.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }).then(() => c.click('#pr-accetto')).catch(() => {});
  await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); await c.reload(); await c.waitForSelector('#vista-client:not([hidden])');
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await c.waitForTimeout(1500);
  const r = await c.evaluate(() => { const a = document.querySelector('#aiuto-2d'); return { inBarra: !!a.closest('.toolbar, .barra-unica'), testo: a.textContent, visibile: a.getBoundingClientRect().width > 0 }; });
  ok('1 ⓘ nella barra', r.inBarra && r.testo === 'ⓘ' && r.visibile, r);
  await c.click('#aiuto-2d'); await c.waitForTimeout(300);
  const r2 = await c.evaluate(() => { const a = document.querySelector('#aiuto-2d'), q = a.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height), top: Math.round(q.top), t: a.textContent.slice(0, 40) }; });
  ok('2 clic: il testo si apre sotto, leggibile', r2.w > 300 && r2.h > 40 && /Tasti/.test(r2.t), r2);
  await c.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/aiuto_barra.png' });
  await c.mouse.click(600, 600); await c.waitForTimeout(200);
  ok('3 clic altrove: si richiude', await c.evaluate(() => document.querySelector('#aiuto-2d').textContent) === 'ⓘ');
  ok('4 linguetta senza «nato/a il»', await c.evaluate(() => [...document.querySelectorAll('#tab-studi .tab-paz')].every((x) => !/nato/.test(x.textContent))));
  ok('5 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
