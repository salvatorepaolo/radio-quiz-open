// prova_v211.mjs: il docente vede le immagini chiave con didascalia e le riapre; disposizione automatica nella piattaforma;
// piattaforma installabile (manifest); metodiche chiuse nella pagina iniziale
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18300 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
const entra = async (p, cod) => { await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])'); };
try {
  const ca = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); const a = await ca.newPage(); a.on('pageerror', (e) => errori.push('admin: ' + e.message));
  await entra(a, 'admin-test-0000');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Chiavi', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice));
  // home: metodiche chiuse anche dopo averne aperta una
  ok('1a home: metodiche chiuse all\'apertura', await a.evaluate(() => [...document.querySelectorAll('details.gruppo-metodica')].every((d) => !d.open)));
  await a.evaluate(() => { document.querySelector('details.gruppo-metodica').open = true; }); await a.waitForTimeout(200);
  await a.goto(B + '/?prova#/caso/caso-tcia-001'); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await a.goto(B + '/?prova#/'); await a.waitForSelector('#vista-elenco:not([hidden])'); await a.waitForTimeout(600);
  ok('1b tornando da un caso la metodica aperta resta aperta', await a.evaluate(() => document.querySelector('details.gruppo-metodica').open));
  const a2 = await ca.newPage(); await a2.goto(B + '/?prova#/'); await a2.waitForSelector('#vista-elenco:not([hidden])'); await a2.waitForTimeout(500);
  ok('1c nuova visita (nuova scheda): di nuovo chiuse', await a2.evaluate(() => [...document.querySelectorAll('details.gruppo-metodica')].every((d) => !d.open))); await a2.close();
  ok('2 manifest e pulsante «Installa come app»', await a.evaluate(() => !!document.querySelector('link[rel="manifest"][href="/manifest.json"]') && !document.querySelector('#btn-installa').hidden));
  const man = await a.evaluate(() => fetch('/manifest.json').then((r) => r.json())); ok('3 manifest valido', man.start_url === '/' && man.display === 'standalone' && man.icons.length === 2);
  // studente: immagine chiave con didascalia e risposta
  const cs = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); const s = await cs.newPage(); s.on('pageerror', (e) => errori.push('studente: ' + e.message));
  await entra(s, cod);
  await s.goto(B + '/?prova#/caso/caso-tcia-001'); await s.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-001', null, { timeout: 60000 }); await s.waitForTimeout(1200);
  const r = await (await s.$('#canvas')).boundingBox(); await s.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.4);
  for (let i = 0; i < 7; i++) { await s.mouse.wheel(0, 120); await s.waitForTimeout(60); } await s.waitForTimeout(400);
  const vista = await s.evaluate(() => { const p = window.__dbg.P(); p.wc = -600; p.ww = 1500; p.zoom = 1.7; window.__dbg.disegna(); return { idx: p.idx, sIdx: p.sIdx }; });
  await s.keyboard.press('k'); await s.waitForTimeout(500); await s.fill('#ic-lista .ic-did', 'nodulo apicale destro'); await s.waitForTimeout(300);
  await s.click('#q-modo-referto'); await s.waitForTimeout(300); await s.evaluate(() => { document.querySelector('#q-referto-box').open = true; });
  await s.fill('#q-referto', 'TC del torace con mezzo di contrasto. Nodulo polmonare solido nel lobo superiore destro, margini regolari. Conclusione: nodulo polmonare da caratterizzare.');
  await s.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); await s.click('#btn-conferma'); await s.waitForTimeout(2500);
  // docente: referti degli studenti
  await a.goto(B + '/?prova#/analisi'); await a.waitForSelector('#vista-analisi:not([hidden])'); await a.click('[data-scheda="referti"]'); await a.waitForSelector('.ref-card', { timeout: 15000 });
  const card = await a.evaluate(() => { const c = [...document.querySelectorAll('.ref-card')].find((x) => x.textContent.includes('Studente Chiavi')); return c ? { testo: c.querySelector('.ref-chiavi')?.textContent || '', bott: c.querySelectorAll('.ch-vai').length } : null; });
  ok('4 referti: immagine chiave con didascalia e «Apri»', card && /nodulo apicale destro/.test(card.testo) && card.bott === 1, card);
  await a.click('.ref-card .ch-vai'); await a.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-001' && window.__dbg.V.img, null, { timeout: 60000 }); await a.waitForTimeout(2500);
  const v = await a.evaluate(() => { const p = window.__dbg.P(); return { idx: p.idx, sIdx: p.sIdx, wc: Math.round(p.wc), ww: Math.round(p.ww), zoom: +p.zoom.toFixed(2) }; });
  ok('5 «Apri» porta alla stessa vista (immagine, finestra, zoom)', v.idx === vista.idx && v.sIdx === vista.sIdx && v.wc === -600 && v.ww === 1500 && v.zoom === 1.7, { attesa: vista, vista: v });
  // analisi del caso: tabella delle immagini chiave
  await a.goto(B + '/?prova#/analisi'); await a.waitForSelector('#vista-analisi:not([hidden])'); await a.click('[data-scheda="casi"]'); await a.waitForTimeout(1500);
  const tab = await a.evaluate(() => [...document.querySelectorAll('.an-caso')].map((d) => d.querySelector('.ch-doc')?.textContent || '').find((t) => /nodulo apicale destro/.test(t)) || '');
  ok('6 analisi del caso: didascalia nella tabella', /nodulo apicale destro/.test(tab), tab.slice(0, 120));
  // disposizione automatica: mammografia nelle 4 viste (se il docente non ha scelto una disposizione)
  await s.goto(B + '/?prova#/caso/caso-tcia-006'); await s.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-006' && window.__dbg.V.img, null, { timeout: 60000 }).catch(() => {}); await s.waitForTimeout(2500);
  const mg = await s.evaluate(() => ({ n: window.__dbg.V.n, docente: !!(window.__dbg.V.caso.disposizione || []).length || Number.isInteger(window.__dbg.V.caso.riquadri), ricorda: !!document.querySelector('#hp-ricorda') }));
  ok('7 disposizione automatica nella piattaforma', mg.docente || mg.n >= 2, mg);
  ok('8 «Ricorda» nel menu ⋯ della piattaforma', await s.evaluate(() => { document.querySelector('#cl-altro').open = true; const v = getComputedStyle(document.querySelector('#cl-altro .cl-hp')).display !== 'none'; document.querySelector('#cl-altro').open = false; return v; }));
  ok('9 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
