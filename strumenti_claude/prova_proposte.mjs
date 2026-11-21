// prova_proposte.mjs: controllo dell'anonimato di un caso proposto, nel browser come lo fa il docente (Gestione → Revisione
// delle bozze → «Controlla l'anonimato»), su tre proposte INVENTATE (genera_proposte.py): anonima, con i dati del paziente
// in un file, con nome e ospedale scritti nei pixel. Controlla l'esito mostrato, che i valori trovati non compaiano nella pagina
// e che il server registri il controllo (senza esito positivo la proposta non si pubblica: api-proposte.test.mjs).
import { spawn, execFileSync } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const CASI = fs.mkdtempSync(path.join(os.tmpdir(), 'proposte-'));
execFileSync(path.join(os.homedir(), '.radioquiz-ia/venv/bin/python'), ['/Volumes/Caloggero/strumenti_claude/genera_proposte.py', CASI], { stdio: 'inherit' });
// anonimizzazione come nel browser dell'iscritto (web/anonimizza.js); in prop-datipaz1 il secondo file resta con i dati
{ const WEB = '/Volumes/Caloggero/piattaforma-quiz/cloud/web', m = { exports: {} };
  new Function('module', 'exports', 'require', fs.readFileSync(WEB + '/lib/dicomParser.min.js', 'utf8'))(m, m.exports, createRequire(import.meta.url)); globalThis.dicomParser = m.exports;
  const A = await import(WEB + '/anonimizza.js');
  for (const id of ['prop-pulita01', 'prop-datipaz1', 'prop-scritta1']) for (const k of [0, 1]) {
    if (id === 'prop-datipaz1' && k === 1) continue;
    const p = path.join(CASI, id, `serie/s1/img${k}.dcm`), u8 = new Uint8Array(fs.readFileSync(p));
    fs.writeFileSync(p, await A.anonimizza(u8.buffer, { idCaso: id, sale: 'sale-della-prova' }));
  } }
const PORTA = +process.env.PORTA_PROVA || (19650 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
let ok = 0, ko = 0; const esito = (cond, msg, dettaglio = '') => { if (cond) ok++; else ko++; console.log(`${cond ? 'OK' : 'KO'}  ${msg}${dettaglio ? ' → ' + dettaglio : ''}`); };
try {
  const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage(), errori = [];
  p.on('pageerror', (e) => errori.push(e.message));
  await p.goto(B + '#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
  await p.goto(B + '#/revisione'); await p.waitForSelector('.rv-caso[data-id="prop-pulita01"]', { timeout: 20000 });
  const controlla = async (id) => {
    const sec = p.locator(`.rv-caso[data-id="${id}"]`);
    await sec.locator('button.rv-anon').click();
    await p.waitForFunction((id) => { const t = document.querySelector(`.rv-caso[data-id="${id}"] .rv-anon-esito`)?.textContent || ''; return /✓|non pubblicare|non riuscito/.test(t); }, id, { timeout: 60000 });
    return { sec, testo: await sec.locator('.rv-anon-esito').innerText() };
  };
  const server = async (id) => (await (await p.request.get(`${B}/api/casi/${id}/completo`)).json()).proposta?.controllo;

  // 1. anonima: esito positivo, spunta obbligatoria, controllo registrato
  let { sec, testo } = await controlla('prop-pulita01');
  esito(/Intestazioni anonime in tutti i 2 file/.test(testo), 'anonima: intestazioni anonime in tutti i file', testo.split('\n')[0]);
  esito(/Nessun testo impresso trovato/.test(testo), 'anonima: nessun testo impresso');
  esito(await sec.locator('.rv-anon-salva').isDisabled(), 'anonima: «Registra il controllo» disattivato finché non si spunta la conferma');
  await sec.locator('.rv-anon-ok').check(); await sec.locator('.rv-anon-salva').click();
  await p.waitForFunction(() => /Controllo registrato/.test(document.querySelector('.rv-caso[data-id="prop-pulita01"] .rv-anon-esito')?.textContent || ''), null, { timeout: 15000 });
  const c1 = await server('prop-pulita01'); esito(c1?.esito === 'ok' && c1.file === 2, 'anonima: il server registra il controllo positivo', JSON.stringify(c1));

  // 2. dati del paziente in un file: «non pubblicare», nessuna spunta, problemi registrati, valori mai mostrati
  ({ sec, testo } = await controlla('prop-datipaz1'));
  esito(/Intestazioni non anonime: non pubblicare/.test(testo), 'dati del paziente: «non pubblicare»');
  esito(await sec.locator('.rv-anon-ok').count() === 0, 'dati del paziente: nessuna spunta per confermare');
  esito(!/ROSSIGNOLI|MARCELLO|SANTACROCE|19800101|RSSMRC/i.test(testo), 'dati del paziente: i valori trovati non compaiono nella pagina');
  await p.waitForTimeout(500);
  const c2 = await server('prop-datipaz1'); esito(c2?.esito === 'problemi' && (c2.problemi || []).length > 0, 'dati del paziente: il server registra «problemi»', JSON.stringify(c2?.problemi?.slice(0, 3)));

  // 3. scritta nei pixel: segnalata, con la zona in rosso sull'anteprima
  ({ sec, testo } = await controlla('prop-scritta1'));
  esito(/Possibile testo impresso/.test(testo), 'scritta nei pixel: «possibile testo impresso»');
  esito(await sec.locator('.rv-anteprime .serie-card.sospetta').count() >= 1, 'scritta nei pixel: anteprima segnata come sospetta');
  esito(!/Rossignoli|SANTACROCE/i.test(testo), 'scritta nei pixel: il testo letto non viene trascritto');
  esito(errori.length === 0, 'nessun errore JavaScript', errori.join(' | '));
} catch (e) { ko++; console.log('KO  errore:', e.message); }
finally { await b.close(); sim.kill(); fs.rmSync(CASI, { recursive: true, force: true }); }
console.log(ko ? `\n${ko} controlli falliti` : '\nTUTTO OK'); console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
