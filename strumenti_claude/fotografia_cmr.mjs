// Fotografia della RM cardiaca (non regressione dell'interfaccia, 1.249): sui casi 070, 071 (pila di asse corto) e 108 (area-lunghezza) si apre lo strumento
// «RM cardiaca», si lancia l'analisi automatica e si registrano le cifre (cifreCmr) e il testo della scheda.
// Uso: node fotografia_cmr.mjs > uscita.json   (WEB=… per una copia diversa del sito)
//      node fotografia_cmr.mjs --confronta      confronto con cloud/test/fixture/cmr-fotografia.json (presa prima
//      della divisione di app.js): stampa TUTTI OK o le differenze. Dopo una modifica voluta si rifà la fotografia.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (23700 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const out = {}; const errori = [];
const tonda = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));   // niente «riprendi le annotazioni»
  const a = await ctx.newPage();
  a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  for (const id of ['caso-tcia-070', 'caso-tcia-071', 'caso-tcia-108']) {
    await a.goto(B + `/?prova#/caso/${id}`); await a.waitForFunction((id) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === id, id, { timeout: 90000 }); await a.waitForTimeout(1200);
    // il caso può finire di prepararsi dopo il primo clic (strumento rimesso a «scorri»): si riprova
    for (let i = 0; i < 4; i++) { await a.click('[data-tool="cmr"]'); if (await a.waitForFunction(() => window.__dbg.V.tool === 'cmr' && !document.getElementById('cmr-pannello').hidden, null, { timeout: 4000 }).then(() => true, () => false)) break; await a.waitForTimeout(1000); }
    try { await a.waitForSelector('#cmr-pannello:not([hidden])', { timeout: 30000 }); }
    catch (e) { console.error('stato', JSON.stringify(await a.evaluate(() => { const bt = document.querySelector('[data-tool="cmr"]'), r = bt.getBoundingClientRect(), el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { tool: window.__dbg.V.tool, hid: document.getElementById('cmr-pannello')?.hidden, sopra: el && (el.id || el.className), dlg: [...document.querySelectorAll('dialog[open]')].map((d) => d.id), r: [r.x, r.y, r.width] }; }))); throw e; }
    await a.click('#cmr-auto'); await a.waitForFunction(() => document.querySelector('#cmr-pannello .cmr-kpis, #cmr-pannello .cmr-al-stato'), null, { timeout: 150000 }); await a.waitForTimeout(1500);
    out[id] = await a.evaluate(() => ({ cifre: window.__dbg.cifreCmr(), scheda: document.getElementById('cmr-pannello').innerText.replace(/\s+/g, ' ').trim() }));
    out[id] = tonda(out[id]);
  }
} finally { await b.close(); sim.kill(); }
out._errori = errori;
if (process.argv.includes('--confronta')) {
  const fs = await import('node:fs'), atteso = JSON.parse(fs.readFileSync(T + 'fixture/cmr-fotografia.json', 'utf8'));
  let ko = 0;
  for (const k of new Set([...Object.keys(atteso), ...Object.keys(out)])) { const ok = JSON.stringify(atteso[k]) === JSON.stringify(out[k]);
    console.log(`${ok ? 'OK ' : 'KO '} ${k}${ok ? '' : `\n  atteso: ${JSON.stringify(atteso[k]).slice(0, 400)}\n  ora:    ${JSON.stringify(out[k]).slice(0, 400)}`}`); if (!ok) ko++; }
  console.log(ko ? `${ko} KO` : 'TUTTI OK'); process.exit(ko ? 1 : 0);
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
