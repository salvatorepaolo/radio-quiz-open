// prova_omp_1114.mjs: piano orbito-meatale (OMP) — automatico all'apertura, pulsante OMP accanto a Sag (spegne e riaccende),
// punti di repere trovati in TC dell'encefalo (CQ500, solo in locale), OMP nell'MPR, menu del 3D con MPR e Willis
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19600 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
const D = '/Volumes/Caloggero/_tcia_grezzi/testa/cq0/CQ500CT0 CQ500CT0/Unknown Study/CT PLAIN THIN/';
try {
  if (!fs.existsSync(D)) { console.log('dati CQ500 assenti: prova saltata'); process.exit(0); }
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/client/index.html'); await a.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await a.setInputFiles('#cl-file', fs.readdirSync(D).filter((f) => f.endsWith('.dcm')).map((f) => D + f));
  await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 90000 });
  await a.waitForFunction(() => { const V = window.__dbg.V; return V.serie[window.__dbg.P(0).sIdx]?._omp; }, null, { timeout: 60000 });
  const r = await a.evaluate(() => { const V = window.__dbg.V, o = V.serie[window.__dbg.P(0).sIdx]._omp; return { ok: o.ok, piano: window.__dbg.P(0).piano, on: document.querySelector('#btn-raddrizza').classList.contains('on'),
    dopoSag: document.querySelector('#grp-piani [data-piano="sagittale"]').nextElementSibling?.id, testo: document.querySelector('#btn-raddrizza').textContent }; });
  ok('1 all\'apertura: OMP dai punti di repere (globi e meati), serie OMP, pulsante acceso', r.ok && r.piano === 'obliqua' && r.on, r);
  ok('2 pulsante «OMP» subito a destra di Sag', r.dopoSag === 'btn-raddrizza' && r.testo === 'OMP', r);
  await a.click('#btn-raddrizza'); await a.waitForTimeout(1500);
  const off = await a.evaluate(() => ({ piano: window.__dbg.P(0).piano, on: document.querySelector('#btn-raddrizza').classList.contains('on') }));
  ok('3 OMP di nuovo: immagini originali, pulsante spento', !off.piano && !off.on, off);
  await a.click('#btn-raddrizza'); await a.waitForTimeout(2500);
  const on = await a.evaluate(() => ({ piano: window.__dbg.P(0).piano, on: document.querySelector('#btn-raddrizza').classList.contains('on') }));
  ok('4 e ancora: di nuovo sul piano OMP (prima non funzionava)', on.piano === 'obliqua' && on.on, on);
  await a.click('#grp-piani [data-piano="coronale"]'); await a.waitForTimeout(2500); await a.click('#btn-raddrizza'); await a.waitForTimeout(2500);
  ok('5 dalla coronale: OMP funziona', await a.evaluate(() => window.__dbg.P(0).piano === 'obliqua' && document.querySelector('#btn-raddrizza').classList.contains('on')));
  // MPR
  await a.click('#modo-mpr'); await a.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#mpr-stato').hidden && document.querySelector('#vp-assiale canvas'), null, { timeout: 180000 }); await a.waitForTimeout(1500);
  const menu = await a.evaluate(() => [...document.querySelectorAll('#mpr-preset option')].map((o) => o.value));
  ok('6 menu del 3D: prima «MPR», Willis in alto (esame neuro)', menu[0] === 'mpr' && menu[1] === 'QR-willis', menu.slice(0, 4));
  ok('7 OMP anche nell\'MPR', await a.evaluate(() => !document.querySelector('#mpr-omp').hidden));
  const n0 = await a.evaluate(() => window.__dbg.MPR.modulo.pianoVista('assiale').normale);
  await a.click('#mpr-omp'); await a.waitForTimeout(1500);
  const n1 = await a.evaluate(() => window.__dbg.MPR.modulo.pianoVista('assiale').normale);
  const ang = Math.acos(Math.min(1, Math.abs(n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]))) * 180 / Math.PI;
  ok('8 piani dell\'MPR orientati sull\'OMP', ang > 2, { gradi: +ang.toFixed(1) });
  await a.screenshot({ path: '/Volumes/Caloggero/_viste/omp_mpr.png' });
  ok('9 nessun errore JavaScript', errori.length === 0, errori.slice(0, 5));
} catch (e) { console.log('KO eccezione', e.message); ko++; }
finally { await b.close(); sim.kill(); }
console.log(ko ? `${ko} KO` : 'TUTTI OK'); process.exit(ko ? 1 : 0);
