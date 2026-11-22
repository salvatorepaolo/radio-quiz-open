// prova_correlazione.mjs (1.297): correlazione radio-patologica nella piattaforma (simulatore locale), caso 003 (TC + vetrino).
// - il vetrino si apre accanto alle immagini radiologiche (tutte e due visibili, metà larghezza ciascuna) e torna a tutto schermo;
// - i tasti vanno a quello su cui si è cliccato per ultimo (R ruota il vetrino, non cambia strumento nella TC);
// - l'autore salva una corrispondenza (immagine TC + zona del vetrino + nota); compare nel riquadro del caso;
// - «Mostra» riporta la TC all'immagine salvata e il vetrino alla zona salvata;
// - uno studente non vede le corrispondenze prima della risposta, le riceve con la correzione; l'autore le può togliere.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23671, B = `http://localhost:${PORTA}`, CASO = 'caso-tcia-003';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' }), p = await ctx.newPage(), err = [];
p.on('pageerror', (e) => err.push(e.message)); p.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('Massa renale: carcinoma a cellule chiare') : d.accept()));
const E = (f, a) => p.evaluate(f, a);
try {
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.goto(B + `/?prova#/caso/${CASO}`); await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.P(0)?.img, CASO, { timeout: 60000 });
  await p.waitForSelector('#btn-vetrini:not([hidden])', { timeout: 20000 }); const genitore = await E(() => document.querySelector('#stage').parentElement.className); await p.click('#btn-vetrini');
  await p.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 90000 }); await p.waitForTimeout(1500);
  await p.click('.vt-modo-accanto'); await p.waitForFunction(() => document.querySelector('#vt-accanto') && window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 90000 }); await p.waitForTimeout(2000);
  const lay = await E(() => { const s = document.querySelector('#stage').getBoundingClientRect(), v = document.querySelector('#vt-accanto').getBoundingClientRect(); return { s: Math.round(s.width), v: Math.round(v.width), fianco: v.left >= s.right - 2, fs: !!document.querySelector('#vista-vetrino:not([hidden])') }; });
  esito(lay.fianco && lay.s > 300 && lay.v > 300 && !lay.fs, 'vetrino accanto alle immagini radiologiche', JSON.stringify(lay));
  esito(await p.isVisible('#vt-accanto .vt-corr'), 'l\'autore vede «🔗 Salva corrispondenza»');
  // tasti: clic nel vetrino → R ruota il vetrino; la TC non cambia strumento
  const R = await E(() => { const e = document.querySelector('#vt-accanto .vt-osd').getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
  const toolPrima = await E(() => window.__dbg.V.tool);
  await p.mouse.click(R.x, R.y); await p.keyboard.press('r'); await p.waitForTimeout(800);
  esito(await E(() => window.__dbg.VT.viewer.viewport.getRotation()) === 90 && await E(() => window.__dbg.V.tool) === toolPrima, 'clic sul vetrino, tasto R → ruota il vetrino, la TC non cambia', `${toolPrima}`);
  await p.keyboard.press('Shift+R'); await p.waitForTimeout(600);
  // la TC su un'altra immagine, poi corrispondenza
  await E(() => window.__dbg.mostraDi(0, 10)); await p.waitForTimeout(400);
  await p.click('#vt-accanto .vt-ingr[data-m="4"]'); await p.waitForTimeout(1200);
  const rx0 = await E(() => window.__dbg.vistaRadiologica()), vt0 = await E(() => window.__dbg.VT.vista());
  await p.click('#vt-accanto .vt-corr'); await p.waitForTimeout(1500);
  const box = await E(() => ({ vis: !document.querySelector('#q-correlazioni')?.hidden, n: document.querySelectorAll('#q-correlazioni li').length, t: document.querySelector('#q-correlazioni')?.innerText || '', l: window.__dbg.V.caso.correlazioni }));
  esito(box.vis && box.n === 1 && /cellule chiare/.test(box.t), 'corrispondenza salvata e mostrata nel riquadro del caso', box.t.replace(/\s+/g, ' ').slice(0, 120));
  const comp = await E(async (id) => (await (await fetch(`/api/casi/${id}/completo`)).json()).correlazioni, CASO);
  esito(comp?.length === 1 && comp[0].rx.idx === rx0.idx && comp[0].vt.um > 0, 'corrispondenza salvata nel caso (server)', JSON.stringify(comp?.[0]));
  // «Mostra»: si sposta tutto, poi si torna
  await E(() => window.__dbg.mostraDi(0, 2)); await p.keyboard.press('0'); await p.waitForTimeout(800);
  await p.click('#q-correlazioni [data-corr="0"]'); await p.waitForTimeout(2500);
  const dopo = await E(() => ({ rx: window.__dbg.vistaRadiologica(), vt: window.__dbg.VT.vista() }));
  esito(dopo.rx.idx === rx0.idx && dopo.rx.serie === rx0.serie, '«Mostra» → TC all\'immagine salvata', `${rx0.idx} / ${dopo.rx.idx}`);
  esito(Math.abs(dopo.vt.c[0] - vt0.c[0]) <= 3 && Math.abs(dopo.vt.um / vt0.um - 1) < 0.02, '«Mostra» → vetrino sulla zona salvata', `${JSON.stringify(vt0)} / ${JSON.stringify(dopo.vt)}`);
  // a tutto schermo e di nuovo chiuso
  await p.click('#vt-accanto .vt-modo-accanto'); await p.waitForFunction(() => !document.querySelector('#vt-accanto') && document.querySelector('#vista-vetrino:not([hidden])') && window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 60000 });
  esito(await E((g) => !document.querySelector('#vt-accanto-wrap') && document.querySelector('#stage').parentElement.className === g, genitore), '«A tutto schermo»: la TC torna al suo posto', genitore);
  await p.click('#vista-vetrino .vt-chiudi'); await p.waitForTimeout(400);
  // studente
  const cod = await E(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Correlazione', ruolo: 'specializzando' }) })).json()).codice);
  const st = await b.newContext(), q = await st.newPage();
  await q.goto(B + '/?prova#/');
  const accSt = await q.evaluate(async (c) => (await fetch('/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: c }) })).status, cod);
  const primaR = await q.evaluate(async (id) => (await (await fetch(`/api/casi/${id}`)).json()).correlazioni, CASO);
  esito(accSt === 200 && !primaR, 'lo studente non vede le corrispondenze prima della risposta', String(accSt));
  const risp = await q.evaluate(async (id) => (await (await fetch(`/api/casi/${id}/risposta`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scelte: [0], dettagli: {} }) })).json()), CASO);
  esito(risp.correlazioni?.length === 1, 'lo studente riceve le corrispondenze con la correzione', JSON.stringify(risp.correlazioni?.[0]?.nota));
  await st.close();
  // l'autore la toglie
  await p.click('#q-correlazioni [data-corr-via="0"]'); await p.waitForTimeout(1200);
  const fine = await E(async (id) => (await (await fetch(`/api/casi/${id}/completo`)).json()).correlazioni, CASO);
  esito(!fine?.length && await E(() => document.querySelector('#q-correlazioni').hidden), 'l\'autore toglie la corrispondenza');
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
