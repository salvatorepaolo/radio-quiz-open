// prova_v214.mjs: modelli di referto correlati all'esame (quiz ed editor), «Finestra» leggibile, nitidezza
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18450 + Math.floor(Math.random() * 100)), B = `http://localhost:${PORTA}`;
const CASO = process.argv[2] || 'caso-tcia-094';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const err = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n} → ${JSON.stringify(x)}`); if (!c) ko++; };
try {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  for (const [caso, atteso] of [[CASO, 'rx-msk'], ['caso-tcia-001', 'tc-torace']]) {
    await p.goto(B + '/?prova#/caso/' + caso); await p.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso.id === c, caso, { timeout: 60000 }); await p.waitForTimeout(800);
    const q = await p.evaluate(() => { const s = document.querySelector('#q-modello'); const g = s.querySelector('optgroup'); return { gruppo: g?.label, primo: g?.querySelector('option')?.value }; });
    ok(`1 ${caso}: menu del quiz parte dai modelli dell'esame`, q.gruppo === 'Per questo esame' && q.primo === atteso, q);
    await p.click('#cl-referto'); await p.waitForSelector('#dlg-referto[open]'); await p.waitForTimeout(500);
    const e = await p.evaluate(() => ({ scelto: document.querySelector('#ref-modello').value, testo: document.querySelector('#ref-testo').innerText.slice(0, 40), gruppo: document.querySelector('#ref-modello optgroup')?.label }));
    ok(`2 ${caso}: l'editor propone il modello dell'esame`, e.scelto === atteso && e.gruppo === 'Per questo esame', e);
    await p.click('#ref-chiudi');
  }
  const w = await p.evaluate(() => { const s = document.querySelector('#preset'); return { w: s.getBoundingClientRect().width, testo: s.options[s.selectedIndex]?.text }; });
  ok('3 «Finestra» non tagliata (larghezza)', w.w >= 110, w);
  await p.click('#btn-nitid'); await p.click('#btn-nitid'); const n = await p.evaluate(() => [window.__dbg.V.nitid, document.querySelector('#nitid-liv').textContent]);
  await p.click('#btn-nitid', { modifiers: ['Shift'] }); const n2 = await p.evaluate(() => window.__dbg.V.nitid);
  ok('4 nitidezza: 2 clic = 2, Maiusc+clic = 1', n[0] === 2 && n[1] === '2' && n2 === 1, { n, n2 });
  ok('5 nessun errore JavaScript', !err.length, err.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
