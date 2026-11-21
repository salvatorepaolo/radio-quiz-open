// prova_traccia.mjs: traccia e schema di lettura (1.270) sul simulatore, caso TC del torace con la vista del reperto.
// 1. Risposta data senza scorrere fino al reperto → «Come hai letto il caso» con l'errore di ricerca (riquadro rosso).
// 2. «Riprova»: si va sull'immagine del reperto con la finestra polmonare per 2 s e si risponde → riquadro «passato sul
//    reperto» (giallo se la risposta non è esatta, verde se è esatta), grafico con la linea del reperto.
// 3. Schema di lettura: «Polmone» si spunta dopo aver scorso tutta la serie con la finestra polmonare.
// 4. Pausa senza input oltre 60 s: il tempo non cresce. Nessuna richiesta di rete per la traccia, nessun errore.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19870 + Math.floor(Math.random() * 20)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const errori = [], richieste = []; p.on('pageerror', (e) => errori.push(e.message)); p.on('request', (r) => richieste.push(r.url()));
await p.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
const rispondi = async () => {
  for (let k = 0; k < 15; k++) {
    const scelta = p.locator('#q-form .sezione:not([hidden]) .opz input').first();
    if (await scelta.count() && !(await scelta.isChecked())) { await scelta.check({ force: true }); await p.locator('#q-form .sezione:not([hidden]) .opz button[data-conf]').first().click({ force: true }).catch(() => {}); }
    await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
    await p.waitForTimeout(200);
    if (await p.locator('#btn-conferma').isVisible()) { await p.locator('#btn-conferma').evaluate((e) => e.click()); break; }
    const av = p.locator('#q-succ:not([hidden])'); if (await av.count()) await av.evaluate((e) => e.click()); else break;
  }
  await p.waitForSelector('#q-esito:not([hidden]) .tr-box, #q-esito:not([hidden]) .esito-testa', { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(400);
};
const muovi = () => p.mouse.move(300 + Math.random() * 200, 400 + Math.random() * 100);
try {
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-001' && window.__dbg.P(0)?.img, null, { timeout: 60000 });
  esito(await p.locator('#schema-lettura .sl-voce').count() === 3, 'schema di lettura del torace: polmone, mediastino, osso', await p.textContent('#schema-lettura').catch(() => ''));
  // 1. risposta senza scorrere (prima immagine della serie)
  await p.evaluate(async () => { const d = window.__dbg; await d.mostraDi(d.V.attivo, 0); }); for (let i = 0; i < 6; i++) { await muovi(); await p.waitForTimeout(250); }
  await rispondi();
  const v = await p.evaluate(() => window.__dbg.V.vistaReperto);
  const g1 = await p.evaluate(() => { const t = document.querySelector('.tr-box'); return t ? { cl: t.querySelector('.tr-giudizio')?.className, testo: t.textContent.slice(0, 160), linea: !!t.querySelector('line.rep') } : null; });
  esito(!!v && g1?.cl?.includes('ko') && g1.linea, 'senza passare dal reperto: «errore di ricerca» e grafico con la linea del reperto', g1?.testo);
  // 2. Riprova: sul reperto con la finestra polmonare
  await p.click('#btn-conferma'); await p.waitForTimeout(600);
  await p.evaluate(async (v) => { const d = window.__dbg, si = d.V.serie.findIndex((s) => s._i === v.serie); await d.selezionaSerie(si); const pp = d.P(d.V.attivo); pp.wc = -600; pp.ww = 1500; await d.mostraDi(d.V.attivo, v.idx); }, v);
  for (let i = 0; i < 9; i++) { await muovi(); await p.waitForTimeout(250); }
  // scorre tutta la serie con la finestra polmonare (schema: «Polmone»)
  const n = await p.evaluate(async () => { const d = window.__dbg, pp = d.P(d.V.attivo); return pp.frames.length; });
  for (let i = 0; i < n; i += 1) { await p.evaluate(async (i) => { const d = window.__dbg, pp = d.P(d.V.attivo); pp.wc = -600; pp.ww = 1500; await d.mostraDi(d.V.attivo, i); }, i); if (i % 4 === 0) await muovi(); await p.waitForTimeout(i % 2 ? 0 : 260); }
  await p.waitForTimeout(1200);
  const fatte = await p.$$eval('#schema-lettura .sl-voce.fatta', (l) => l.map((x) => x.textContent.trim()));
  esito(fatte.some((x) => /Polmone/.test(x)), 'schema di lettura: «Polmone» spuntato dopo aver scorso la serie con la finestra polmonare', fatte.join(', '));
  await p.evaluate(async (v) => { const d = window.__dbg; const pp = d.P(d.V.attivo); pp.wc = -600; pp.ww = 1500; await d.mostraDi(d.V.attivo, v.idx); }, v);
  for (let i = 0; i < 6; i++) { await muovi(); await p.waitForTimeout(250); }
  await rispondi();
  const g2 = await p.evaluate(() => { const t = document.querySelector('.tr-box'); return t ? { cl: t.querySelector('.tr-giudizio')?.className, testo: t.querySelector('.tr-giudizio')?.textContent } : null; });
  esito(/ok|medio/.test(g2?.cl || '') && /finestra polmone/.test(g2?.testo || ''), 'sul reperto con la finestra polmonare: giudizio «passato sul reperto» con la finestra', g2?.testo);
  // 4. pausa senza input
  await p.click('#btn-conferma'); await p.waitForTimeout(400);
  const t0 = await p.evaluate(() => window.__dbg?.V && document.querySelector('#schema-lettura') && 0);
  await p.evaluate(() => { const ora = Date.now; Date.now = () => ora() + 120000; setTimeout(() => { Date.now = ora; }, 1500); });
  const prima = await p.evaluate(() => performance.now()); void prima; void t0;
  await p.waitForTimeout(1000);
  await rispondi();
  const tempo = await p.evaluate(() => document.querySelector('.tr-box')?.textContent.match(/Tempo di lettura: ([\d,]+) s/)?.[1]);
  esito(tempo != null && parseFloat(tempo.replace(',', '.')) < 3, 'pausa senza mouse né tastiera: il tempo non cresce', `${tempo} s`);
  esito(!richieste.some((u) => /traccia|lettura/i.test(u)), 'la traccia non fa richieste di rete');
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 2).join(' | '));
} catch (e) { esito(false, 'prova interrotta', e.message.slice(0, 200)); }
finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`); process.exit(ko ? 1 : 0);
