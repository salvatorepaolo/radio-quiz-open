// prova_v234.mjs: una serie scelta dall'utente mentre la disposizione del docente si sta ancora caricando non viene sostituita
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
  // rete lenta per le immagini: la disposizione impiega qualche secondo
  await a.route('**/casi/caso-tcia-070/**', async (r) => { await new Promise((ok) => setTimeout(ok, 700)); r.continue(); });
  await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/caso/caso-tcia-070');
  await a.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-070' && document.querySelectorAll('#lista-serie .s').length > 5, null, { timeout: 60000 });
  const d0 = await a.evaluate(() => (window.__dbg.V.caso.disposizione || []).length);
  await a.evaluate(() => document.querySelector('#lista-serie .s[data-i="0"]').click());   // «Cine 4 camere» subito, nel riquadro attivo
  await a.waitForFunction(() => { const d = window.__dbg; return d.V.n >= 2 && d.V.pannelli.slice(0, d.V.n).every((p) => p.img); }, null, { timeout: 90000 });
  await a.waitForTimeout(2500);
  const st = await a.evaluate(() => { const d = window.__dbg; return d.V.pannelli.slice(0, d.V.n).map((p) => d.V.serie[p.sIdx]?.descrizione); });
  ok('1 il caso ha una disposizione del docente su più riquadri', d0 >= 2, d0);
  ok('2 la serie scelta subito resta nel suo riquadro', st[0] === 'Cine 4 camere', st);
  ok('3 gli altri riquadri ricevono comunque la disposizione del docente', st.slice(1).some((x) => /asse corto 5\/10/.test(x)), st);
  // senza intervento: la disposizione del docente come prima
  // pagina nuova (la vista dell'ultimo caso aperto si ricorda nella scheda)
  const a2 = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage(); a2.on('pageerror', (e) => errori.push(e.message));
  await a2.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a2.goto(B + '/?prova#/'); await a2.click('[data-vai="codice"]'); await a2.fill('#codice', 'admin-test-0000'); await a2.press('#codice', 'Enter'); await a2.waitForSelector('#vista-elenco:not([hidden])');
  await a2.goto(B + '/?prova#/caso/caso-tcia-070');
  await a2.waitForFunction(() => { const d = window.__dbg; return d.V.caso?.id === 'caso-tcia-070' && d.V.n >= 2 && d.V.pannelli.slice(0, d.V.n).every((p) => p.img); }, null, { timeout: 90000 });
  await a2.waitForTimeout(1500);
  const st2 = await a2.evaluate(() => { const d = window.__dbg; return { att: d.V.attivo, s: d.V.pannelli.slice(0, d.V.n).map((p) => d.V.serie[p.sIdx]?.descrizione) }; });
  ok('4 senza scelte dell\'utente: disposizione del docente, primo riquadro attivo', st2.att === 0 && /3 camere/.test(st2.s[0]) && /asse corto 5\/10/.test(st2.s[1]), st2);
  ok('5 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
