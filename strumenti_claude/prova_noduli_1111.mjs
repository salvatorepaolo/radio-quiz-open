// prova_noduli_1111.mjs: noduli IA in automatico nella piattaforma (cerchi sulle immagini, pannello, «vai»);
// studente: niente prima della risposta
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19300 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-034'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-034', null, { timeout: 60000 });
  await a.waitForSelector('#btn-noduli:not([hidden])', { timeout: 20000 }).catch(() => {});
  const n = await a.evaluate(() => ({ vis: !document.querySelector('#btn-noduli').hidden, n: document.querySelector('#btn-noduli .n')?.textContent, n1: window.__dbg.V.n }));
  ok('1 TC torace con analisi: pulsante 🫁 con il numero dei noduli, 1×1', n.vis && +n.n > 0 && n.n1 === 1, n);
  await a.click('#btn-noduli'); await a.waitForTimeout(400);
  const righe = await a.evaluate(() => document.querySelectorAll('#nod-pannello tbody tr').length);
  ok('2 pannello con l\'elenco dei noduli', righe === +n.n, righe);
  const i0 = await a.evaluate(() => window.__dbg.V.idx);
  await a.click('#nod-pannello .ia-nodulo'); await a.waitForTimeout(1200);
  const i1 = await a.evaluate(() => window.__dbg.V.idx);
  ok('3 «vai» porta all\'immagine del nodulo', i1 !== i0, { i0, i1 });
  await a.screenshot({ path: '/Volumes/Caloggero/_viste/noduli_auto.png' });
  // studente: nessun nodulo prima della risposta
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Stud Noduli', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice));
  const s = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); s.on('pageerror', (e) => errori.push(e.message));
  await s.goto(B + '/?prova#/'); await s.click('[data-vai="codice"]'); await s.fill('#codice', cod); await s.press('#codice', 'Enter'); await s.waitForSelector('#vista-elenco:not([hidden])');
  await s.goto(B + '/?prova#/caso/caso-tcia-034'); await s.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await s.waitForTimeout(3000);
  const st = await s.evaluate(() => ({ n: document.querySelector('#btn-noduli .n')?.textContent, vis: !document.querySelector('#btn-noduli').hidden }));
  ok('4 studente prima della risposta: il numero non si vede', !st.vis || st.n === '?', st);
  ok('5 nessun errore JavaScript', !errori.length, errori.slice(0, 4));
} catch (e) { console.log('KO eccezione', e.message); ko++; }
finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTI OK'); }
