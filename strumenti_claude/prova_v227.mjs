// prova_v227.mjs: refertazione libera valutata voce per voce (regole sopra il modello, tabella per parole chiave, voci dal server)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const RL = await import('/Volumes/Caloggero/piattaforma-quiz/cloud/web/refertolocale.js');
let ko = 0; const errori = [];
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
// ---- A. regole sopra il modello (senza modello)
const voci = [{ testo: 'Calcolo di 5 mm nell\'uretere pelvico sinistro', principale: true, sezione: 'Reperti' },
  { testo: 'Idronefrosi sinistra di grado lieve', principale: false, sezione: 'Reperti' },
  { testo: 'Non versamento libero in addome', principale: false, sezione: 'Reperti' }];
const sbagliate = ['Diverticolite acuta del sigma'];
const testo = 'TC addome senza mdc. Calcolo di circa 5 mm nell\'uretere pelvico di sinistra con lieve dilatazione delle cavità renali. Diverticolite del sigma.';
const j = { voci: [{ n: 1, esito: 'presente', frase: 'Calcolo di circa 5 mm nell\'uretere pelvico di sinistra', nota: '' },
  { n: 2, esito: 'parziale', frase: 'lieve dilatazione delle cavità renali', nota: 'non dice idronefrosi' },
  { n: 3, esito: 'presente', frase: 'Assenza di versamento', nota: '' }], errori: ['Diverticolite del sigma', 'Aneurisma dell\'aorta'], commento: 'Buono.' };
const r = RL.ripulisciVoci(j, voci, sbagliate, testo);
ok('A1 voce presente con la frase vera', r.voci[0].esito === 'presente' && /uretere/.test(r.voci[0].frase), r.voci[0]);
ok('A2 voce parziale con la frase vera', r.voci[1].esito === 'parziale' && /cavit/.test(r.voci[1].frase), r.voci[1]);
ok('A3 «presente» inventata (frase non nel testo) diventa assente', r.voci[2].esito === 'assente' && !r.voci[2].frase, r.voci[2]);
ok('A4 errori: resta solo quello davvero scritto', r.errori.length === 1 && /Diverticolite/.test(r.errori[0]), r.errori);
ok('A5 punteggio pesato meno gli errori', r.punteggio === Math.max(0, Math.round(100 * (2 + 0.5) / 4) - 10), r.punteggio);
const r2 = RL.ripulisciVoci({ voci: [{ n: 1, esito: 'assente' }, { n: 2, esito: 'presente', frase: 'lieve dilatazione delle cavità renali' }], errori: [] }, voci, sbagliate, 'Lieve dilatazione delle cavità renali. Nient\'altro.');
ok('A6 principale assente: punteggio al massimo 50 con la nota', r2.punteggio <= 50 && !!r2.notaVoto, { p: r2.punteggio, n: r2.notaVoto });
const r3 = RL.ripulisciVoci({ voci: [] }, voci, sbagliate, 'Calcolo di 5 mm nell\'uretere pelvico sinistro.');
ok('A7 il modello dimentica una voce scritta: torna «parziale» dalle parole', r3.voci[0].esito === 'parziale', r3.voci[0]);
// ---- B. nel sito: voci dal server e tabella voce per voce dopo il «solo referto»
const PORTA = +process.env.PORTA_PROVA || (19900 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok2) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok2(); }));
const b = await chromium.launch();
const js = async (p, url, corpo) => p.evaluate(async ([url, corpo]) => { const r = await fetch(url, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {}); return { stato: r.status, j: await r.json().catch(() => null) }; }, [url, corpo]);
try {
  const a = await (await b.newContext({ locale: 'it-IT' })).newPage();
  await a.goto(B + '/?prova#/'); await js(a, '/api/accesso', { codice: 'admin-test-0000' });
  const at = await js(a, '/api/casi/caso-tcia-001/atteso');
  ok('B1 /atteso con le voci del referto del docente e le affermazioni sbagliate', at.stato === 200 && at.j.voci?.length >= 2 && Array.isArray(at.j.sbagliate) && at.j.voci.every((v) => 'sezione' in v), { stato: at.stato, n: at.j?.voci?.length });
  const acc = await js(a, '/api/account', { nome: 'Studente Referto', ruolo: 'studente' });
  const s = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'it-IT' })).newPage(); s.on('pageerror', (e) => errori.push(e.message));
  await s.goto(B + '/?prova#/'); await js(s, '/api/accesso', { codice: acc.j.codice });
  await s.goto(B + '/?prova#/caso/caso-tcia-001'); await s.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await s.waitForTimeout(1000);
  await s.click('#q-modo-referto');
  const testoRef = 'TC del torace. ' + at.j.voci.slice(0, 2).map((v) => v.testo).join('. ') + '. Conclusione: vedi sopra.';
  await s.fill('#q-referto', testoRef); await s.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); await s.click('#btn-conferma');
  await s.waitForSelector('#q-esito:not([hidden]) .voci-ref', { timeout: 30000 }).catch(() => {});
  const t = await s.evaluate(() => ({ righe: document.querySelectorAll('.voci-ref .vv-tab tbody tr:not(.vv-sez)').length, ok: document.querySelectorAll('.voci-ref tr.vv-ok').length, ko: document.querySelectorAll('.voci-ref tr.vv-ko').length, testo: document.querySelector('.voci-ref p')?.textContent }));
  ok('B2 tabella voce per voce dopo il solo referto', t.righe === at.j.voci.length && t.ok >= 2, t);
  await s.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/referto_voci.png', fullPage: true });
  ok('B3 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
