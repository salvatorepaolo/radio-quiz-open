// prova_novizio_1114.mjs: correzioni dal test «da principiante» (1.244): benvenuto, titolo senza reperto, promemoria della
// domanda, «Avanti» senza sicurezza, Aiuto sopra il caso, uscita con conferma, spiegazione del punteggio, esame di esempio
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19500 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
try {
  const ctx = await b.newContext({ viewport: { width: 1000, height: 760 }, locale: 'it-IT' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errori.push(e.message));
  // iscrizione e conferma (simulatore: le email in /__posta)
  await p.goto(B + '/?prova'); const r = await p.evaluate(async () => (await fetch('/api/iscrizione', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'Nuovo Iscritto', email: 'nuovo@example.com', password: 'prova-sicura-2026', categoria: 'specializzando', privacy: true, maggiorenne: true }) })).status);   // gitleaks:allow (account di prova sul simulatore locale)
  const link = (await p.evaluate(() => fetch('/__posta').then((x) => x.text()))).match(/#\/conferma\/[\w.-]+/g)?.pop();
  ok('1 iscrizione e link di conferma', r === 200 && !!link, { r, link });
  await p.goto(B + '/?prova&essenziale' + link); await p.waitForSelector('#pr-benvenuto:not([hidden])', { timeout: 15000 }); await p.waitForTimeout(700);
  ok('2 benvenuto in cima con «Inizia con il primo caso»', await p.evaluate(() => document.getElementById('pr-benvenuto').getBoundingClientRect().top < 200 && document.activeElement?.id === 'pr-inizia'));
  await p.click('#pr-inizia');
  try { await p.waitForFunction(() => /#\/caso\//.test(location.hash) && window.__dbg?.V?.img, null, { timeout: 60000 }); }
  catch (x) { console.log('stato', await p.evaluate(() => ({ h: location.hash, el: !document.getElementById('vista-elenco').hidden, btn: !!document.getElementById('btn-casuale')?.offsetParent, img: !!window.__dbg?.V?.img, dbg: !!window.__dbg }))); throw x; }
  await p.waitForTimeout(800);
  const t = await p.evaluate(() => ({ q: document.getElementById('q-titolo').textContent, caso: window.__dbg.V.caso.titolo, prom: !document.getElementById('q-promemoria').hidden && getComputedStyle(document.getElementById('q-promemoria')).display !== 'none' }));
  ok('3 si apre un caso; titolo senza la parte dopo i due punti', !t.q.includes(': ') && (t.caso.includes(': ') ? t.caso.includes(t.q) : t.q === t.caso), t);
  ok('4 schermo stretto: promemoria della domanda sopra le immagini', t.prom);
  await p.click('#q-prom-vai'); await p.waitForTimeout(600);
  ok('5 «Rispondi ↓» porta alla domanda', await p.evaluate(() => { const r = document.getElementById('q-domanda').getBoundingClientRect(); return r.top >= -5 && r.top < innerHeight; }));
  // «Avanti» con una risposta senza sicurezza
  const multi = await p.evaluate(() => !document.getElementById('q-succ').hidden);
  await p.evaluate(() => { const f = [...document.querySelectorAll('#q-form .sezione')].find((x) => !x.hidden) || document.getElementById('q-form'); f.querySelector('.opz input').click(); });
  if (multi) {
    await p.click('#q-succ'); await p.waitForTimeout(400);
    const s = await p.evaluate(() => ({ msg: !document.getElementById('q-nav-msg').hidden && document.getElementById('q-nav-msg').textContent, ev: document.querySelectorAll('#q-form .opz.manca-conf').length, passo: [...document.querySelectorAll('#q-form .sezione')].findIndex((x) => !x.hidden) }));
    ok('6 «Avanti» senza sicurezza: messaggio accanto al pulsante, risposta evidenziata, resta al passo 1', !!s.msg && s.ev === 1 && s.passo === 0, s);
  } else ok('6 (caso a un solo passo)', true);
  await p.evaluate(() => document.querySelector('#q-form .opz.manca-conf .conf button[data-conf="probabile"], #q-form .opz input:checked')?.closest('.opz').querySelector('.conf button[data-conf="probabile"]').click());
  ok('7 scelta la sicurezza: evidenza e messaggio spariscono', await p.evaluate(() => !document.querySelector('#q-form .opz.manca-conf') && document.getElementById('q-nav-msg').hidden));
  // Aiuto sopra il caso: le risposte restano
  await p.click('#btn-aiuto'); await p.waitForSelector('#vista-aiuto.sopra:not([hidden])'); await p.waitForTimeout(400);
  const prima = await p.evaluate(() => ({ h: location.hash, pp: !!document.getElementById('aiuto-primi-passi') }));
  await p.click('#aiuto-indietro'); await p.waitForTimeout(400);
  const dopo = await p.evaluate(() => ({ h: location.hash, sel: document.querySelectorAll('#q-form input:checked').length, conf: document.querySelector('#q-form .opz[data-conf]')?.dataset.conf }));
  ok('8 l\'Aiuto si apre sopra il caso (con «Primi passi») e chiudendolo le risposte restano', prima.h === dopo.h && prima.pp && dopo.sel === 1 && dopo.conf === 'probabile', { prima, dopo });
  // ✕ Chiudi con risposte non confermate: chiede conferma (qui si annulla e si resta nel caso)
  let chiesto = ''; p.once('dialog', (d) => { chiesto = d.message(); d.dismiss(); });
  await p.click('#cl-chiudi'); await p.waitForTimeout(400);
  ok('9 ✕ Chiudi a metà caso: chiede prima di uscire, annullando si resta', /non hai confermato/.test(chiesto) && /#\/caso\//.test(await p.evaluate(() => location.hash)), chiesto);
  // completa e conferma: titolo intero, spiegazione del punteggio
  ok('14 barra essenziale per chi inizia (con «⚙ Tutti gli strumenti»)', await p.evaluate(() => document.body.classList.contains('barra-essenziale') && !document.getElementById('menu-misure')?.offsetParent && !!document.getElementById('btn-barra-tutti')?.offsetParent));
  ok('15 nessuna data dell\'esame tipo «dic 1982» nella piattaforma', await p.evaluate(() => !/\b(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic) (19|20)\d\d\b/.test(document.getElementById('vista-caso').innerText)));
  await p.evaluate(async () => { const w = (t) => new Promise((r) => setTimeout(r, t));
    for (let k = 0; k < 6; k++) { const s = document.getElementById('q-succ'); if (s.hidden) break; s.click(); await w(300);
      const f = [...document.querySelectorAll('#q-form .sezione')].find((x) => !x.hidden); const o = f.querySelector('.opz'); o.querySelector('input').click(); await w(80); o.querySelector('.conf button[data-conf="ipotesi"]').click(); await w(80); } });
  await p.click('#btn-conferma'); await p.waitForTimeout(500);
  ok('16 senza scegliere la comunicazione dell\'esito la prima conferma avvisa: riquadro visibile ed evidenziato', await p.evaluate(() => { const b = document.getElementById('q-com-blocco'); return !b.hidden && b.classList.contains('manca') && !document.querySelector('#q-esito .punteggio'); }));
  // secondo «Conferma» senza scegliere: si conferma con il solo referto
  await p.click('#btn-conferma'); await p.waitForSelector('#q-esito .punteggio', { timeout: 15000 });
  ok('18 il secondo «Conferma» senza scelta conferma lo stesso', true);
  const e = await p.evaluate(() => ({ q: document.getElementById('q-titolo').textContent, caso: window.__dbg.V.caso.titolo, come: document.querySelector('#q-esito .come-punteggio')?.textContent || '', perf: /esatta/i.test(document.querySelector('#q-esito .punteggio').textContent) }));
  await p.waitForTimeout(1200);
  ok('17 dopo la risposta: «Mostra il reperto» e «Prossimo» subito sotto il punteggio, visibili', await p.evaluate(() => { const az = document.querySelector('#q-esito .esito-azioni'); const r = az?.getBoundingClientRect(); return !!az && !!az.querySelector('#btn-prossimo') && r.top < innerHeight && r.bottom > 0; }), await p.evaluate(() => ({ az: !!document.querySelector('#q-esito .esito-azioni'), pr: document.getElementById('btn-prossimo').hidden, par: document.getElementById('btn-prossimo').parentElement?.className, top: Math.round(document.querySelector('#q-esito').getBoundingClientRect().top) })));
  ok('10 dopo la risposta: titolo intero e «Come si calcola»', e.q === e.caso && (e.perf || /Come si calcola/.test(e.come)), e);
  // visualizzatore scaricabile: esame di esempio
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (x) => errori.push(x.message));
  await c.goto(B + '/client/index.html?prova'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  ok('11 client: pulsante «Prova con un esame di esempio»', await c.evaluate(() => !document.getElementById('cl-esempio-box').hidden));
  await c.click('#cl-esempio'); await c.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 90000 }); await c.waitForTimeout(1500);
  const es = await c.evaluate(() => ({ n: window.__dbg.V.serie.reduce((t, s) => t + (s.files?.length || s.immagini?.length || 0), 0), stato: document.getElementById('cl-stato').textContent }));
  ok('12 l\'esame di esempio si apre (137 immagini, niente «non DICOM»)', /137 immagini/.test(es.stato) && !/non visualizzabili/.test(es.stato), es);
  ok('13 nessun errore JavaScript', errori.length === 0, errori.slice(0, 5));
} catch (x) { console.log('KO eccezione', x.message); ko++; }
finally { await b.close(); sim.kill(); }
console.log(ko ? `${ko} KO` : 'TUTTI OK'); process.exit(ko ? 1 : 0);
