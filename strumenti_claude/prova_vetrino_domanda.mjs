// prova_vetrino_domanda.mjs (1.303): domanda sul vetrino nella piattaforma (simulatore locale), caso 136 (solo vetrino).
// - l'autore segna la zona del reperto con un rettangolo («🎯 Zona del reperto») e la rende domanda sulla figura;
// - lo studente prima della risposta non riceve la zona, solo quale vetrino; indica un punto sul vetrino;
// - il server valuta centrato / vicino / mancato / assente; la correzione porta la zona e la mostra sul vetrino.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23691, B = `http://localhost:${PORTA}`, CASO = 'caso-tcia-136';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const b = await chromium.launch(), err = [];
const pagina = async (ctx) => { const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); p.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('Carcinoma infiltrante') : d.accept())); return p; };
const centro = (p) => p.evaluate(() => { const e = document.querySelector('#vt-incorporato .vt-osd').getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
const apri = async (p) => { await p.goto(B + `/?prova#/caso/${CASO}`); await p.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 90000 }); await p.waitForTimeout(2000); };
try {
  const ca = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' }), p = await pagina(ca), E = (f, a) => p.evaluate(f, a);
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await apri(p);
  esito(await p.isVisible('#vt-incorporato .vt-zona'), 'l\'autore vede «🎯 Zona del reperto»');
  await p.click('#vt-incorporato .vt-zona'); await p.waitForTimeout(300);
  const c = await centro(p);
  await p.mouse.move(c.x - 60, c.y - 40); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 5 }); await p.mouse.move(c.x + 60, c.y + 40, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(1500);
  const comp = await E(async (id) => (await (await fetch(`/api/casi/${id}/completo`)).json()), CASO);
  const z = comp.zona_vetrino;
  esito(z && z.domanda === true && comp.localizza === true && z.r[2] > z.r[0] && z.nota === 'Carcinoma infiltrante', 'zona salvata nel caso, con la domanda sul vetrino', JSON.stringify(z));
  esito(await E(() => window.__dbg.VT.segni.some((g) => g.r)) && await E(() => document.querySelectorAll('#vt-incorporato .vt-misure path').length) >= 1, 'la zona si vede sul vetrino (autore)');
  // studente
  const cod = await E(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Vetrino', ruolo: 'specializzando' }) })).json()).codice);
  const cs = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' }), q = await pagina(cs), F = (f, a) => q.evaluate(f, a);
  await q.goto(B + '/?prova#/'); const acc = await F(async (c) => (await fetch('/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: c }) })).status, cod);
  const pub = await F(async (id) => (await (await fetch(`/api/casi/${id}`)).json()), CASO);
  esito(acc === 200 && !pub.zona_vetrino && pub.localizza?.vetrino === 0, 'prima della risposta lo studente sa solo quale vetrino', JSON.stringify(pub.localizza));
  await apri(q);
  esito(await q.isVisible('#q-loc') && /vetrino/.test(await q.textContent('#btn-punta')), 'domanda «Indica sul vetrino» visibile', await q.textContent('#btn-punta'));
  esito(!(await F(() => window.__dbg.VT.segni.some((g) => g.r))), 'lo studente non vede la zona prima della risposta');
  await q.click('#btn-punta'); await q.waitForTimeout(400);
  const cq = await centro(q); await q.mouse.click(cq.x + 5, cq.y + 5); await q.waitForTimeout(500);
  const pt = await F(() => window.__dbg.V.punto);
  esito(pt?.vt === 0 && Number.isFinite(pt.x) && /indicato sul vetrino/.test(await q.textContent('#q-loc-testo')) && await F(() => window.__dbg.VT.segni.some((g) => g.p)), 'punto indicato sul vetrino e segnato', JSON.stringify(pt));
  // Esc annulla la scelta del punto
  await q.click('#btn-punta'); await q.waitForTimeout(300); await q.keyboard.press('Escape'); await q.waitForTimeout(300);
  esito(/già indicato/.test(await q.textContent('#q-loc-testo')), 'Esc annulla la scelta del punto', await q.textContent('#q-loc-testo'));
  // risposta dall'interfaccia (una scelta per sezione, «Avanti», conferma): messaggio della localizzazione e zona sul vetrino
  for (let k = 0; k < 15; k++) {
    await q.evaluate(() => { const i = [...document.querySelectorAll('#q-form input[type=checkbox], #q-form input[type=radio]')].find((x) => x.offsetParent); if (i && !i.checked) i.click(); i?.closest('.opz')?.querySelector('button[data-conf]')?.click(); });
    await q.waitForTimeout(300);
    await q.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
    const bc = await q.$('#btn-conferma:not([hidden])'); if (bc && await bc.isVisible()) { await bc.evaluate((e) => e.click()); break; }
    const av = await q.$('#q-succ:not([hidden])'); if (av) await av.evaluate((e) => e.click());
    await q.waitForTimeout(200);
  }
  await q.waitForSelector('.loc-esito', { timeout: 15000 }).catch(() => {});
  const msg = await F(() => document.querySelector('.loc-esito')?.textContent || '');
  esito(/localizzato correttamente/.test(msg) && /rettangolo giallo/.test(msg) && await F(() => window.__dbg.VT.segni.some((g) => g.r) && window.__dbg.VT.segni.some((g) => g.p)), 'risposta dall\'interfaccia: esito della localizzazione, zona e punto sul vetrino', msg.trim());
  const risp = (punto) => F(async ([id, punto]) => (await (await fetch(`/api/casi/${id}/risposta`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scelte: [0], punto, dettagli: {} }) })).json()), [CASO, punto]);
  const r1 = await risp({ vt: pt.vt, x: pt.x, y: pt.y });
  esito(r1.localizzazione?.esito === 'centrato' && r1.zonaVetrino?.r?.length === 4, 'punto nella zona → «centrato», la correzione porta la zona', JSON.stringify(r1.localizzazione));
  const W = z.r[2] - z.r[0], H = z.r[3] - z.r[1], L = Math.max(W, H);
  const r2 = await risp({ vt: 0, x: z.r[2] + 0.6 * L, y: (z.r[1] + z.r[3]) / 2 }), r3 = await risp({ vt: 0, x: z.r[2] + 3 * L, y: z.r[3] + 3 * L }), r4 = await risp(null), r5 = await risp({ vt: 1, x: pt.x, y: pt.y });
  esito(r2.localizzazione?.esito === 'vicino' && r3.localizzazione?.esito === 'mancato' && r4.localizzazione?.esito === 'assente' && r5.localizzazione?.altroVetrino, 'vicino / mancato / assente / altro vetrino', [r2, r3, r4, r5].map((r) => r.localizzazione?.esito).join(' '));
  esito(r1.punteggio >= 20 && r4.punteggio <= r1.punteggio - 20 + 0.5 + 0 || r4.punteggio < r1.punteggio, 'la localizzazione pesa sul punteggio', `${r1.punteggio} / ${r4.punteggio}`);
  await F((z) => window.__dbg.mostraZonaVetrino(z, { esito: 'mancato' }), r1.zonaVetrino); await q.waitForTimeout(1500);
  const dopo = await F(() => ({ s: window.__dbg.VT.segni, v: window.__dbg.VT.vista() }));
  const cz = [(z.r[0] + z.r[2]) / 2, (z.r[1] + z.r[3]) / 2];
  esito(dopo.s.some((g) => g.r) && dopo.s.some((g) => g.p) && Math.abs(dopo.v.c[0] - cz[0]) < W && Math.abs(dopo.v.c[1] - cz[1]) < H, 'dopo la risposta zona e punto sul vetrino, vista sulla zona', JSON.stringify(dopo.v));
  await cs.close(); await ca.close();
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
