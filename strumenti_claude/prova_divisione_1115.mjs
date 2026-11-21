// 1.248 — non regressione della divisione di app.js (scale in scale.js / scale-dati.js, caricate a richiesta)
// e delle miniature delle serie girate come il visualizzatore nella RM mammella.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19700 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
const b = await chromium.launch();
try {
  const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'it-IT' })).newPage();
  p.on('pageerror', (e) => errori.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/status of 40[134]|Failed to load/.test(m.text())) errori.push(m.text()); });
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])');
  // richieste dei moduli delle scale (non performance: il suo elenco si riempie con le immagini)
  const scaricati = new Set(); p.on('request', (r) => { const x = new URL(r.url()).pathname; if (/^\/(scale(-dati)?|cmr-ui)\.js$/.test(x)) scaricati.add(x); });
  const moduli = async () => [...scaricati].filter((x) => x.includes('scale'));
  const cmrScaricato = () => scaricati.has('/cmr-ui.js');
  // RM mammella: anteriore in basso nelle immagini → il visualizzatore gira di 180°, e ora anche le miniature
  await p.goto(B + '/?prova#/caso/caso-tcia-055');
  await p.waitForFunction(() => window.__dbg?.V?.img || window.__dbg?.P?.()?.img, null, { timeout: 60000 });
  await p.evaluate(() => document.querySelector('#lista-serie')?.scrollIntoView());
  await p.waitForFunction(() => document.querySelectorAll('#lista-serie canvas.anteprima').length >= 3, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  const m = await p.evaluate(() => ({ rot: window.__dbg.P().rot, mini: [...document.querySelectorAll('#lista-serie canvas.anteprima')].map((c) => c.classList.contains('rot180')) }));
  ok('1 RM mammella: immagine girata di 180° e miniature girate allo stesso modo', m.rot === 2 && m.mini.length >= 3 && m.mini.every(Boolean), m);
  ok('2 aprendo il caso le scale non si scaricano', (await moduli()).length === 0, await moduli());
  await p.waitForFunction(() => !document.getElementById('q-scale').hidden, null, { timeout: 15000 }).catch(() => {});
  ok('3 il pannello delle domande elenca le scale chieste dal caso (indice senza scaricare le scale)', await p.evaluate(() => !document.getElementById('q-scale').hidden && /Mammella/.test(document.getElementById('q-scale').textContent)));
  await p.click('#q-scale [data-scala]'); await p.waitForSelector('#scala-corpo input[data-c="br"]', { timeout: 15000 });
  ok('4 al clic si scaricano scale.js e scale-dati.js e si apre la scheda giusta', (await moduli()).length === 2 && await p.evaluate(() => document.getElementById('scala-scelta').value === 'mammella'), await moduli());
  await p.evaluate(() => [...document.querySelectorAll('#scala-corpo input[data-c="br"]')].find((x) => x.value === '4b').click()); await p.waitForTimeout(300);
  ok('5 la scheda calcola (BI-RADS 4B → biopsia)', /BI-RADS 4B: biopsia/.test(await p.evaluate(() => document.getElementById('scala-corpo').innerText)));
  // un caso non della mammella: miniature diritte
  await p.goto(B + '/?prova#/caso/caso-tcia-001');
  await p.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-001' && window.__dbg?.P?.()?.img, null, { timeout: 60000 });
  await p.evaluate(() => document.querySelector('#lista-serie')?.scrollIntoView());
  await p.waitForFunction(() => document.querySelectorAll('#lista-serie canvas.anteprima').length >= 1, null, { timeout: 30000 }); await p.waitForTimeout(800);
  ok('6 caso non della mammella: nessuna miniatura girata', await p.evaluate(() => !document.querySelector('#lista-serie canvas.anteprima.rot180') && !window.__dbg.P().rot));
  // client offline (service worker): le scale si aprono senza ricaricare app.js una seconda volta
  { const fs = await import('node:fs'), path = await import('node:path');
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' }); const c = await ctx.newPage();
    c.on('pageerror', (e) => errori.push('client: ' + e.message));
    await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
    await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie'));
    await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(800);
    await c.click('#btn-scale'); await c.waitForTimeout(1500);
    const r = await c.evaluate(() => ({ app: performance.getEntriesByType('resource').filter((x) => /\/app\.js$/.test(x.name)).length, caso: !document.getElementById('vista-caso').hidden, scelta: !!document.getElementById('scala-scelta')?.offsetParent }));
    ok('8 client offline: la scheda delle scale si apre, app.js caricato una volta sola, il caso resta aperto', r.app === 1 && r.caso && r.scelta, r);
    await ctx.close(); }
  ok('9 RM cardiaca non scaricata finché non si usa', !cmrScaricato());
  await p.goto(B + '/?prova#/caso/caso-tcia-070');
  await p.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-070' && window.__dbg?.P?.()?.img, null, { timeout: 60000 }); await p.waitForTimeout(1200);
  for (let i = 0; i < 4; i++) { await p.click('[data-tool="cmr"]'); if (await p.waitForFunction(() => window.__dbg.V.tool === 'cmr' && !document.getElementById('cmr-pannello').hidden && /RM cardiaca/.test(document.getElementById('cmr-pannello').innerText), null, { timeout: 4000 }).then(() => true, () => false)) break; }
  ok('10 strumento «RM cardiaca»: cmr-ui.js scaricato e scheda mostrata', cmrScaricato() && await p.evaluate(() => /Traccia i ventricoli|FE VS/.test(document.getElementById('cmr-pannello').innerText)));
  ok('7 nessun errore JavaScript', errori.length === 0, errori.slice(0, 5));
} finally { await b.close(); sim.kill(); }
console.log(ko ? `${ko} KO` : 'TUTTI OK'); process.exit(ko ? 1 : 0);
