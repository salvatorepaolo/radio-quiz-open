// prova_v224.mjs: barra delle serie in una finestra separata (clic, anteprime, cambio caso, ritorno nella pagina)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19300 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
const caso = async (p, id) => { await p.goto(B + '/?prova#/'); await p.goto(B + '/?prova#/caso/' + id); await p.waitForFunction((id) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === id, id, { timeout: 60000 }); await p.waitForTimeout(800); };
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await caso(a, 'caso-tcia-108');
  const h0 = await a.evaluate(() => document.querySelector('#stage').offsetHeight);
  const [pop] = await Promise.all([ctx.waitForEvent('page'), a.click('#btn-serie-finestra')]);
  pop.on('pageerror', (e) => errori.push('finestra: ' + e.message));
  await pop.waitForSelector('aside.serie.in-finestra #lista-serie .s', { timeout: 10000 });
  await pop.waitForFunction(() => document.querySelectorAll('#lista-serie .s canvas.anteprima').length >= 3, null, { timeout: 20000 }).catch(() => {});
  const st = await a.evaluate(() => ({ nellaPagina: !!document.querySelector('aside.serie'), classe: document.querySelector('#vista-caso').classList.contains('serie-staccata'), h: document.querySelector('#stage').offsetHeight }));
  const anteprime = await pop.evaluate(() => [document.querySelectorAll('#lista-serie .s').length, document.querySelectorAll('#lista-serie .s canvas.anteprima').length]);
  ok('1 serie nella finestra separata, immagini più alte, anteprime disegnate', !st.nellaPagina && st.classe && st.h > h0 && anteprime[1] >= 3, { ...st, h0, anteprime });
  await pop.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/serie_finestra.png' });
  await pop.click('#lista-serie .s[data-i="4"]'); await a.waitForTimeout(800);
  ok('2 clic su una serie nella finestra: si apre nel visualizzatore', await a.evaluate(() => window.__dbg.P().sIdx === 4));
  // cambio caso con la finestra aperta: l'elenco si aggiorna lì e i clic funzionano
  await a.goto(B + '/?prova#/caso/caso-tcia-001'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-001', null, { timeout: 60000 }).catch(() => {}); await a.waitForTimeout(1500);
  const aperta = !pop.isClosed();
  ok('3 andando a un altro caso (senza passare dall\'elenco) la finestra resta e mostra le sue serie', aperta && await pop.evaluate(() => document.querySelectorAll('#lista-serie .s').length) === await a.evaluate(() => window.__dbg.V.serie.length));
  const n1 = await a.evaluate(() => window.__dbg.V.serie.length);
  if (n1 > 1) { await pop.click('#lista-serie .s[data-i="1"]'); await a.waitForTimeout(800); }
  ok('4 clic dopo il cambio di caso', n1 < 2 || await a.evaluate(() => window.__dbg.P().sIdx === 1), n1);
  // rimetti nella pagina: i clic funzionano anche lì
  await pop.click('#btn-serie-finestra'); await a.waitForSelector('#vista-caso > aside.serie', { timeout: 5000 }).catch(() => {}); await a.waitForTimeout(800);
  const r = await a.evaluate(() => ({ in: !!document.querySelector('#vista-caso > aside.serie'), classe: document.querySelector('#vista-caso').classList.contains('serie-staccata'), btn: document.querySelector('#btn-serie-finestra')?.textContent }));
  ok('5 «⤓» rimette la barra in basso', r.in && !r.classe && r.btn === '⧉', r);
  await a.click('#lista-serie .s[data-i="0"]'); await a.waitForTimeout(800);
  ok('6 clic su una serie nella pagina dopo il ritorno', await a.evaluate(() => window.__dbg.P().sIdx === 0));
  // tornare all'elenco dei casi chiude la finestra
  const [pop2] = await Promise.all([ctx.waitForEvent('page'), a.click('#btn-serie-finestra')]);
  await pop2.waitForSelector('aside.serie.in-finestra'); await a.goto(B + '/?prova#/'); await a.waitForTimeout(1800);
  ok('7 tornando all\'elenco la finestra si chiude e la barra rientra', pop2.isClosed() && await a.evaluate(() => !!document.querySelector('#vista-caso > aside.serie')));
  // chiusura con la ✕ della finestra: la barra rientra e i comandi funzionano
  await caso(a, 'caso-tcia-108');
  const [pop3] = await Promise.all([ctx.waitForEvent('page'), a.click('#btn-serie-finestra')]);
  await pop3.waitForSelector('aside.serie.in-finestra'); await pop3.close({ runBeforeUnload: true }); await a.waitForTimeout(1500);
  await a.click('#lista-serie .s[data-i="3"]'); await a.waitForTimeout(800);
  ok('7b dopo la chiusura della finestra i clic sulle serie funzionano', await a.evaluate(() => window.__dbg.P().sIdx === 3));
  // stesso controllo per le domande in finestra separata
  const [pq] = await Promise.all([ctx.waitForEvent('page'), a.click('#btn-quiz-finestra')]);
  await pq.waitForSelector('aside.quiz.in-finestra'); await pq.close({ runBeforeUnload: true }); await a.waitForTimeout(1500);
  const rientrato = await a.evaluate(() => !!document.querySelector('#vista-caso aside.quiz:not(.in-finestra)'));
  const pq2 = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }), a.click('#btn-quiz-finestra')]).then(([p]) => p).catch(() => null);
  ok('7c domande: dopo la chiusura della finestra rientrano e i pulsanti rispondono', rientrato && !!pq2, { rientrato, riaperta: !!pq2 });
  await pq2?.close({ runBeforeUnload: true });
  ok('8 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
