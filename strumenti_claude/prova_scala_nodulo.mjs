// prova_scala_nodulo.mjs: dal volume semiautomatico di un nodulo alla scala Fleischner (1.271). Caso 110 (TC del torace),
// nodulo n. 2 della seconda lettura IA: si misura il volume, si apre la scala Fleischner, il pulsante «⟵ nodulo» porta nel
// campo il diametro medio (media tra asse lungo e corto del contorno) e la scala dà un risultato.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19890 + Math.floor(Math.random() * 20)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const errori = []; p.on('pageerror', (e) => errori.push(e.message));
try {
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.goto(B + '/?prova#/caso/caso-tcia-110'); await p.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-110' && window.__dbg.P(0)?.img, null, { timeout: 60000 });
  const n = JSON.parse(fs.readFileSync(`${CASI}/caso-tcia-110/ia/0003_0_OPA_SE_VZOOM_B50f_300_2_120_75_40_na.json`, 'utf8')).analisi.noduli[1];
  const v = await p.evaluate(async (q) => {
    const d = window.__dbg, si = d.V.serie.findIndex((s) => /Studio 1/.test(s.descrizione || '')); await d.selezionaSerie(si); const pn = d.P(d.V.attivo);
    let best = 0, dist = Infinity; for (let i = 0; i < pn.frames.length; i++) { const im = await d.immagineDi(pn, i), nn = d.normaleDi(im.iop), dd = Math.abs((im.ipp[0] - q[0]) * nn[0] + (im.ipp[1] - q[1]) * nn[1] + (im.ipp[2] - q[2]) * nn[2]); if (dd < dist) { dist = dd; best = i; } }
    await d.mostraDi(d.V.attivo, best); const im = await d.immagineDi(pn, best), px = d.pixelDa(im, q), t0 = performance.now();
    await d.volumeDa(d.V.attivo, { x: px.x, y: px.y }, best); const vv = d.V.volumi.at(-1);
    return vv ? { vol: Math.round(vv.vol * 1000), lung: vv.recist?.lung, corto: vv.recist?.corto, ms: Math.round(performance.now() - t0), nodulo: vv.nodulo } : null;
  }, n.centro_lps);
  esito(v?.vol > 0 && v.lung > 0 && v.nodulo, 'volume del nodulo misurato con il metodo per i noduli', JSON.stringify(v));
  await p.click('#btn-scale'); await p.waitForSelector('#scala-scelta', { timeout: 10000 });
  const c = await p.evaluate(() => { const s = document.querySelector('#scala-scelta'); if (![...s.options].some((o) => o.value === 'fleischner')) return false; s.value = 'fleischner'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; });
  esito(c, 'scala Fleischner disponibile per la TC');
  await p.waitForSelector('#scala-corpo [data-nodulo]', { timeout: 10000 }).catch(() => {});
  const bt = await p.textContent('#scala-corpo [data-nodulo]').catch(() => null), atteso = v ? Math.round(((v.lung + v.corto) / 2) * 10) / 10 : null;
  esito(!!bt && bt.includes(String(atteso).replace('.', ',')), 'pulsante «⟵ nodulo» con il diametro medio del contorno', `${bt} (atteso ${atteso})`);
  await p.click('#scala-corpo [data-nodulo]').catch(() => {});
  for (const [c2, val] of [['t', 'solido'], ['num', '1'], ['r', 'basso']]) await p.check(`#scala-corpo input[data-c="${c2}"][value="${val}"]`).catch(() => {});
  await p.waitForTimeout(300);
  const campo = await p.inputValue('#scala-corpo input[data-c="d"]').catch(() => ''), ris = await p.textContent('#scala-esito .scala-valore').catch(() => '');
  esito(+campo === atteso, 'il campo «Diametro medio» prende il valore', campo);
  esito(!!ris && ris.length > 10, 'la scala Fleischner dà la raccomandazione', ris?.slice(0, 120));
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 2).join(' | '));
} catch (e) { esito(false, 'prova interrotta', e.message.slice(0, 200)); }
finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`); process.exit(ko ? 1 : 0);
