// prova_v207.mjs: piattaforma allineata al visualizzatore (📸 Chiave, 📝 Referto, ✕ Chiudi, niente download di immagini)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18900 + Math.floor(Math.random() * 400)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true, locale: process.env.LINGUA === 'en' ? 'en-US' : 'it-IT' });
  const a = await ctx.newPage(); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Prova', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await a.close();
  await ctx.clearCookies();
  const p = await ctx.newPage(); p.on('pageerror', (e) => errori.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/40[134]|Failed to load/.test(m.text())) errori.push(m.text()); });
  await p.goto(B + (process.env.LINGUA === 'en' ? '/?prova&lang=en#/' : '/?prova#/')); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  let corpo = null; p.on('request', (r) => { if (r.method() === 'POST' && /\/api\/casi\/[\w-]+\/risposta$/.test(r.url())) corpo = r.postDataJSON(); });
  await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const vis = await p.evaluate(() => [...document.querySelectorAll('#grp-client > *')].filter((e) => e.offsetParent).map((e) => e.id));
  ok('1 barra: Chiave, Salva annotazioni, Referto, Chiudi, Multischermo (9/11)', JSON.stringify(vis) === '["cl-chiave","cl-ann","cl-referto","cl-chiudi","cl-finestra","cl-altro"]', vis);
  ok('2 stella ★ tolta', !(await p.$('#btn-chiave')));
  // misura e nota, poi immagine chiave con K
  await p.click('#barra-2d [data-tool="misura"]'); const r = await (await p.$('#canvas')).boundingBox();
  await p.mouse.move(r.x + r.width * 0.4, r.y + r.height * 0.45); await p.mouse.down(); await p.mouse.move(r.x + r.width * 0.55, r.y + r.height * 0.5, { steps: 6 }); await p.mouse.up();
  await p.click('#barra-2d [data-tool="misura"]');
  await p.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.7); await p.keyboard.press('k'); await p.waitForTimeout(600);
  const s1 = await p.evaluate(() => ({ striscia: !document.querySelector('#ic-striscia').hidden, n: document.querySelectorAll('#ic-lista .ic-voce').length, chiavi: window.__dbg.V.chiavi.length, esporta: !!document.querySelector('#ic-esporta').offsetParent, badge: document.querySelector('#cl-chiave-n').textContent }));
  ok('3 K salva immagine chiave (striscia, vista per il docente, senza esporta)', s1.striscia && s1.n === 1 && s1.chiavi === 1 && !s1.esporta && s1.badge === '1', s1);
  await p.fill('#ic-lista .ic-did', 'nodulo del lobo superiore'); await p.waitForTimeout(200);
  ok('4 didascalia tra le note per il docente', await p.evaluate(() => window.__dbg.V.chiavi[0].d === 'nodulo del lobo superiore'));
  await p.click('#ic-chiudi'); ok('5 ✕ nasconde la striscia', await p.evaluate(() => document.querySelector('#ic-striscia').hidden));
  await p.click('#cl-chiave-n'); ok('6 il numero la riapre', await p.evaluate(() => !document.querySelector('#ic-striscia').hidden));
  // referto
  await p.click('#cl-referto'); await p.waitForSelector('#dlg-referto[open]'); await p.waitForTimeout(500);
  const s2 = await p.evaluate(() => ({ paz: !!document.querySelector('.ref-paz').offsetParent, conImg: !!document.querySelector('#ref-con-img').offsetParent, ic: document.querySelectorAll('#ref-ic .ref-ic').length, did: document.querySelector('#ref-ic .ref-ic-did')?.value, avv: document.querySelector('#ref-avviso').textContent.slice(0, 60), quesito: document.querySelector('#ref-quesito').value }));
  ok('7 referto: niente dati paziente, immagine chiave con la didascalia', !s2.paz && !s2.conImg && s2.ic === 1 && s2.did === 'nodulo del lobo superiore', s2);
  await p.evaluate(() => { const e = document.querySelector('#ref-testo'); e.innerHTML = ''; e.focus(); });
  await p.keyboard.type('TC del torace. Nodulo polmonare. '); await p.waitForTimeout(800);
  ok('8 il testo arriva nel riquadro del quiz', /TC del torace\. Nodulo polmonare\./.test(await p.inputValue('#q-referto')), await p.inputValue('#q-referto'));
  await p.click('#ref-misure-ins'); await p.waitForTimeout(500);
  const t3 = await p.inputValue('#q-referto'); ok('9 ＋ Inserisci le misure → testo e quiz', /MISURE/.test(t3) && /mm/.test(t3), t3.slice(-120));
  // stampa/PDF: nessuna immagine
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#ref-pdf')]); const f = await dl.path(); const pdf = fs.readFileSync(f, 'latin1');
  ok('10 PDF senza immagini chiave', !/\/Subtype\s*\/Image/.test(pdf) && /TC del torace/.test(pdf) || !/\/Subtype\s*\/Image/.test(pdf), { byte: pdf.length });
  // riapertura: il testo resta
  await p.click('#ref-chiudi'); await p.click('#cl-referto'); await p.waitForTimeout(500);
  ok('11 riaperto: testo conservato', /Nodulo polmonare/.test(await p.evaluate(() => document.querySelector('#ref-testo').innerText)));
  // modifica dal riquadro del quiz → l'editor la riprende
  await p.click('#ref-chiudi'); await p.evaluate(() => { const d = document.querySelector('#q-referto-box'); d.open = true; });
  await p.fill('#q-referto', 'Testo scritto nel riquadro.'); await p.click('#q-ref-completo'); await p.waitForTimeout(500);
  ok('12 l\'editor riprende il testo del quiz', /Testo scritto nel riquadro/.test(await p.evaluate(() => document.querySelector('#ref-testo').innerText)));
  // finestra separata (Document PiP): in Chromium senza interfaccia può mancare → affiancato
  await p.click('#ref-finestra').catch(() => {}); await p.waitForTimeout(800);
  const modo = await p.evaluate(() => ({ pip: !!window.__dbg?.FIN_REF?.win, aff: !!document.querySelector('#dlg-referto')?.classList.contains('affiancato'), inPip: !!window.__dbg?.FIN_REF?.win?.document.querySelector('#dlg-referto[open]') }));
  ok('13 finestra separata o affiancato', (modo.pip && modo.inPip) || modo.aff, modo);
  { const prima = await p.evaluate(() => window.__dbg.P().idx); await p.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.3); await p.mouse.wheel(0, 300); await p.waitForTimeout(400);
    ok('14 immagini scorrono con il referto aperto', (await p.evaluate(() => window.__dbg.P().idx)) !== prima); }
  if (modo.pip) { await p.evaluate(() => { const d = window.__dbg.FIN_REF.win.document.querySelector('#ref-testo'); d.focus(); }); }
  if (modo.pip) { const w = await p.evaluate(() => { const e = window.__dbg.FIN_REF.win.document.querySelector('#ref-testo'); e.append(Object.assign(document.createElement('p'), { textContent: 'Scritto nella finestra.' })); e.dispatchEvent(new Event('input', { bubbles: true })); return 1; }); await p.waitForTimeout(900); ok('14b testo scritto nella finestra separata arriva al quiz', /Scritto nella finestra/.test(await p.inputValue('#q-referto'))); }
  await p.evaluate(() => { window.__dbg?.FIN_REF?.win?.close(); }); await p.waitForTimeout(400);
  await p.evaluate(() => { const d = document.querySelector('#dlg-referto'); d.close(); d.classList.remove('affiancato'); try { localStorage.removeItem('rq-referto-finestra'); } catch {} });
  // invio della risposta: referto e immagini chiave al docente
  p.on('dialog', (d) => { console.log('   dialogo:', d.message().slice(0, 100)); d.accept(); });
  await p.click('#q-modo-referto'); await p.waitForTimeout(500);
  console.log('   referto prima dell\'invio:', JSON.stringify((await p.inputValue('#q-referto')).slice(0, 80)));
  await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); await p.click('#btn-conferma'); await p.waitForTimeout(2500);
  ok('15 risposta con referto e chiave (didascalia)', !!corpo && /Testo scritto/.test(corpo.dettagli?.referto || '') && /Scritto nella finestra|Testo scritto/.test(corpo.dettagli.referto) && corpo.dettagli?.chiavi?.[0]?.d === 'nodulo del lobo superiore' && corpo.dettagli.chiavi[0].si != null && corpo.dettagli.chiavi[0].ww > 0, corpo && { ref: corpo.dettagli?.referto?.slice(0, 40), chiavi: corpo.dettagli?.chiavi });
  // ✕ Chiudi → elenco; nuovo caso pulito
  await p.click('#cl-chiudi'); await p.waitForTimeout(500); if (await p.evaluate(() => document.querySelector('#dlg-ann').open)) await p.click('#dlg-ann button[value="no"]'); await p.waitForTimeout(800); ok('16 ✕ Chiudi torna all\'elenco', await p.evaluate(() => location.hash === '#/' || location.hash === ''), await p.evaluate(() => location.hash));
  await p.goto(B + '/?prova#/caso/caso-tcia-018'); await p.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-018', null, { timeout: 60000 }); await p.waitForTimeout(1000);
  ok('17 nuovo caso: nessuna immagine chiave', await p.evaluate(() => document.querySelector('#ic-striscia').hidden && window.__dbg.V.chiavi.length === 0 && document.querySelector('#cl-chiave-n').hidden));
  await p.screenshot({ path: '/Volumes/Caloggero/_viste/v207_piattaforma.png' });
  ok('18 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
