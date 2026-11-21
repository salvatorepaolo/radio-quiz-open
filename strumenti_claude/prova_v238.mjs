// prova_v238.mjs: pagina iniziale leggera: elenco ?indice=1 e schede dei casi costruite solo quando si apre una metodica
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
  const req = []; a.on('request', (r) => { if (r.url().includes('/api/casi')) req.push(r.url().replace(B, '')); });
  await a.goto(B + '/?prova#/'); await a.evaluate(() => { sessionStorage.clear(); }); await a.reload(); await a.waitForSelector('#vista-elenco:not([hidden])'); await a.waitForTimeout(1500);
  ok('1 la home chiede l\'elenco leggero', req.some((u) => /\/api\/casi\?indice=1/.test(u)), req);
  const r1 = await a.evaluate(() => ({ card: document.querySelectorAll('#lista-casi .card').length, gruppi: document.querySelectorAll('#lista-casi details.gruppo-metodica').length, aperti: document.querySelectorAll('#lista-casi details.gruppo-metodica[open]').length, nodi: document.querySelectorAll('*').length, chiavi: Object.keys(window.__dbg?.ELENCO?.[0] || {}) }));
  ok('2 metodiche chiuse: nessuna scheda costruita', r1.gruppi >= 3 && r1.aperti === 0 && r1.card === 0, r1);
  const s1 = await a.evaluate(async () => { const r = await fetch('/api/casi?indice=1'); const l = await r.json(); return { n: l.length, controlli: l.some((c) => 'controlli' in c), kb: Math.round(JSON.stringify(l).length / 1024) }; });
  const s2 = await a.evaluate(async () => { const r = await fetch('/api/casi'); const l = await r.json(); return { n: l.length, controlli: l.some((c) => 'controlli' in c), kb: Math.round(JSON.stringify(l).length / 1024) }; });
  ok('3 indice senza i controlli (che restano nell\'elenco completo per la gestione)', s1.n === s2.n && !s1.controlli && s2.controlli, { indice: s1, completo: s2 });
  // apro TC: si costruiscono solo le schede TC
  await a.evaluate(() => { const d = [...document.querySelectorAll('#lista-casi details.gruppo-metodica')].find((x) => /^TC/.test(x.querySelector('h2').textContent)); d.open = true; });
  await a.waitForTimeout(400);
  const r2 = await a.evaluate(() => ({ card: document.querySelectorAll('#lista-casi .card').length, tc: [...document.querySelectorAll('#lista-casi .card')].every((c) => c.closest('details').querySelector('h2').textContent.startsWith('TC')), n: +([...document.querySelectorAll('#lista-casi details.gruppo-metodica')].find((x) => /^TC/.test(x.querySelector('h2').textContent)).querySelector('small').textContent.match(/\d+/)[0]) }));
  ok('4 aperta la TC: tutte e sole le schede TC', r2.card === r2.n && r2.tc && r2.card > 10, r2);
  // clic sulla scheda apre il caso
  const id = await a.evaluate(() => document.querySelector('#lista-casi .card').dataset.id);
  await a.click('#lista-casi .card'); await a.waitForFunction((c) => location.hash === '#/caso/' + c, id, { timeout: 10000 });
  ok('5 clic su una scheda: si apre il caso', true, id);
  // filtro metodica RM: gruppo aperto e schede RM
  await a.goto(B + '/?prova#/'); await a.waitForSelector('#vista-elenco:not([hidden])'); await a.waitForTimeout(800);
  await a.evaluate(() => [...document.querySelectorAll('#filtro-metodica button')].find((b) => /^RM/.test(b.textContent)).click()); await a.waitForTimeout(400);
  const r3 = await a.evaluate(() => ({ card: document.querySelectorAll('#lista-casi .card').length, met: [...new Set([...document.querySelectorAll('#lista-casi .card .met-pill')].map((x) => x.textContent))] }));
  ok('6 filtro RM: solo schede RM', r3.card > 5 && r3.met.length === 1 && r3.met[0] === 'RM', r3);
  // ricerca: gruppi aperti con i risultati
  await a.evaluate(() => [...document.querySelectorAll('#filtro-metodica button')].find((b) => /^Tutte/.test(b.textContent)).click());
  await a.fill('#cerca', 'embolia'); await a.waitForTimeout(500);
  const r4 = await a.evaluate(() => ({ card: document.querySelectorAll('#lista-casi .card').length, n: document.querySelector('#cerca-n').textContent }));
  ok('7 ricerca «embolia»: schede visibili come il conteggio', r4.card > 0 && r4.n.startsWith(String(r4.card)), r4);
  ok('8 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
