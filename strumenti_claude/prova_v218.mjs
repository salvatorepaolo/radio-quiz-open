// prova_v218.mjs: pannello delle domande in una finestra separata (risposta dalla finestra, cambio di caso, ritorno nella pagina)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19200 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Finestra', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice));
  const s = await ctx.newPage(); s.on('pageerror', (e) => errori.push('studente: ' + e.message));
  await s.goto(B + '/?prova#/'); await s.evaluate(() => fetch('/api/esci', { method: 'POST' }).catch(() => {}));
  const cs = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); await cs.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const p = await cs.newPage(); p.on('pageerror', (e) => errori.push('studente: ' + e.message));
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  await p.goto(B + '/?prova#/caso/caso-tcia-013'); await p.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-013', null, { timeout: 60000 }); await p.waitForTimeout(1200);
  const w0 = await p.evaluate(() => document.querySelector('.vista-canvas, #canvas')?.getBoundingClientRect().width || 0);
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('#btn-quiz-finestra')]);
  await pop.waitForSelector('aside.quiz.in-finestra #q-form .opz', { timeout: 10000 }); await p.waitForTimeout(600);
  const st = await p.evaluate(() => ({ inPagina: !!document.querySelector('aside.quiz'), staccato: document.querySelector('#vista-caso').classList.contains('quiz-staccato'), w: document.querySelector('.vista-canvas, #canvas')?.getBoundingClientRect().width || 0 }));
  ok('1 domande nella finestra separata, visualizzatore più largo', !st.inPagina && st.staccato && st.w >= w0, { ...st, w0 });
  // risposta dalla finestra separata
  await pop.click('#q-form .opz input'); await pop.waitForTimeout(200); await pop.click('#q-form .opz .conf button'); await pop.waitForTimeout(200);
  const passi = await pop.evaluate(() => document.querySelectorAll('#q-passi button').length);
  for (let i = 0; i < passi + 2; i++) { const vis = await pop.evaluate(() => !document.querySelector('#btn-conferma').hidden); if (vis) break; await pop.evaluate(() => document.querySelector('#q-succ')?.click()); await pop.waitForTimeout(250); }
  await pop.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); await pop.evaluate(() => document.querySelector('#btn-conferma').click());
  await pop.waitForSelector('#q-esito .punteggio', { timeout: 20000 }).catch(() => {});
  ok('2 risposta confermata dalla finestra separata: esito lì', /Punteggio|Risposta esatta/.test(await pop.textContent('#q-esito')), (await pop.textContent('#q-esito')).slice(0, 80));
  // cambio di caso: le domande nuove compaiono nella finestra
  await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-001' && window.__dbg.V.img, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  ok('3 cambio di caso: titolo nuovo nella finestra separata', /nodulo|torace/i.test(await pop.textContent('#q-titolo')), await pop.textContent('#q-titolo'));
  await pop.close(); await p.waitForTimeout(1500);
  ok('4 chiusa la finestra le domande tornano nella pagina', await p.evaluate(() => !!document.querySelector('#vista-caso aside.quiz') && !document.querySelector('#vista-caso').classList.contains('quiz-staccato') && !document.querySelector('#btn-pannello').hidden));
  ok('5 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
