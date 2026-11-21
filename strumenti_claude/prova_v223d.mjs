// prova_v223.mjs: scheda delle scale in una finestra separata, ritorno nella pagina e chiusura
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19100 + Math.floor(Math.random() * 200), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-108'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-108', null, { timeout: 60000 }); await a.waitForTimeout(1000);
  await a.evaluate(() => document.querySelector('#btn-scale').click()); await a.waitForSelector('#scale:not([hidden]) #scala-finestra');
  ok('1 scheda delle scale aperta sotto le immagini, con il pulsante ⧉', await a.evaluate(() => document.querySelector('.viewer').classList.contains('con-scheda')));
  const opz = await a.evaluate(() => [...document.querySelectorAll('#scala-scelta option')].map((o) => o.value + ':' + o.textContent));
  ok('1b RM cardiaca: niente scale del fegato o di altri organi', opz.length >= 1 && !opz.some((x) => /fegat|couinaud|li-?rads/i.test(x)), opz);
  const [pop] = await Promise.all([ctx.waitForEvent('page'), a.click('#scala-finestra')]);
  pop.on('pageerror', (e) => errori.push('finestra: ' + e.message));
  await pop.waitForSelector('#scale.in-finestra #scala-scelta', { timeout: 10000 });
  const st = await a.evaluate(() => ({ nellaPagina: !!document.querySelector('#scale'), scheda: document.querySelector('.viewer').classList.contains('con-scheda') }));
  ok('2 scheda spostata nella finestra separata, immagini a tutta altezza', !st.nellaPagina && !st.scheda, st);
  // cambio scala nella finestra separata
  await pop.click('#scala-tutte'); await pop.waitForFunction(() => document.querySelectorAll('#scala-scelta option').length > 1, null, { timeout: 5000 }).catch(() => {});
  const valori = await pop.evaluate(() => [...document.querySelectorAll('#scala-scelta option')].map((o) => o.value));
  const prima = await pop.evaluate(() => document.querySelector('#scale').textContent.length);
  await pop.selectOption('#scala-scelta', valori[valori.length - 1]); await pop.waitForTimeout(400);
  const dopo = await pop.evaluate(() => document.querySelector('#scale').textContent.length);
  ok('3 nella finestra si cambia scala', valori.length > 1 && prima !== dopo, { n: valori.length, prima, dopo });
  await pop.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/scale_finestra.png' });
  // il pulsante delle scale nella pagina non nasconde la scheda staccata
  await a.evaluate(() => document.querySelector('#btn-scale').click()); await a.waitForTimeout(300);
  ok('4 «Scale» con la finestra aperta non la svuota', await pop.evaluate(() => !document.querySelector('#scale').hidden));
  // rimetti nella pagina
  await pop.click('#scala-finestra'); await a.waitForSelector('#scale:not([hidden])', { timeout: 5000 }).catch(() => {}); await a.waitForTimeout(500);
  const r = await a.evaluate(() => ({ vis: !document.querySelector('#scale').hidden, in: document.querySelector('#scale').closest('.viewer') != null, scheda: document.querySelector('.viewer').classList.contains('con-scheda'), btn: document.querySelector('#scala-finestra')?.textContent }));
  ok('5 «⤓» rimette la scheda sotto le immagini', r.vis && r.in && r.scheda && r.btn === '⧉', r);
  a.on('console', (m) => console.log('console:', m.text()));
  await a.evaluate(() => { const o = window.open; window.open = (...x) => { const w = o.apply(window, x); console.log('open ' + x[1] + ' -> ' + !!w); return w; }; });
  await a.click('#scala-finestra'); await a.waitForTimeout(1500);
  console.log('dopo', errori, ctx.pages().length, await a.evaluate(() => [!!document.querySelector('#scale'), document.querySelector('#scala-finestra')?.textContent, document.body.innerText.match(/bloccato[^\n]*/)?.[0]]));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); process.exit(0); }
