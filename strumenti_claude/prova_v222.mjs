// prova_v222.mjs: CPR automatica lungo l'aorta dalla segmentazione IA (caso 004, TC addome)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19600 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-004'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-004', null, { timeout: 60000 }); await a.waitForTimeout(1500);
  // serie con la segmentazione IA (fase venosa o tardiva)
  await a.evaluate(async () => { const d = window.__dbg, si = d.V.serie.findIndex((s) => /VENOUS|DELAY/i.test(s.descrizione)); if (si >= 0) await d.selezionaSerie(si, d.V.attivo); });
  await a.waitForTimeout(1000);
  await a.click('#modo-mpr'); await a.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await a.waitForTimeout(3000);
  ok('1 MPR aperto con la segmentazione IA', await a.evaluate(() => !!window.__dbg.MPR.ia?.geo));
  await a.click('#btn-cpr'); await a.waitForTimeout(500);
  ok('2 pulsante «Aorta (IA)» visibile', await a.evaluate(() => !document.querySelector('#cpr-aorta').hidden));
  await a.click('#cpr-aorta'); await a.waitForFunction(() => !document.querySelector('#cpr-pannello')?.hidden, null, { timeout: 60000 }).catch(() => {}); await a.waitForTimeout(1000);
  const r = await a.evaluate(() => ({ testo: document.querySelector('#cpr-testo').textContent, pannello: !document.querySelector('#cpr-pannello').hidden }));
  ok('3 linea centrale dell\'aorta e CPR creata', r.pannello && /(\d+) punti/.test(r.testo) && +r.testo.match(/(\d+) punti/)[1] >= 4, r);
  await a.screenshot({ path: '/Volumes/Caloggero/_viste/cpr_aorta.png' });
  ok('4 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
