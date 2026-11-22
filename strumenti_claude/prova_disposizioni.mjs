// prova_disposizioni.mjs (1.302): disposizioni automatiche all'apertura nel visualizzatore scaricabile, con esami pubblici
// aperti dal disco come farebbe l'utente:
// - mammografia (caso 002) → 4 viste; TC del torace (001) → polmone e mediastino affiancati; TC multifase (003) → fasi affiancate;
//   RM con esame precedente (064) → attuale e precedente affiancati;
// - spegnendo una regola («⚙ Regole») quell'esame si apre in un riquadro; spegnendole tutte, tutto in un riquadro;
// - «📌 Ricorda» vince sulle regole: la disposizione salvata torna all'apertura successiva.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23931, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const tutti = (id) => { const d = path.join(CASI, id, 'serie'); return fs.readdirSync(d, { recursive: true }).filter((x) => /\.dcm$/i.test(x)).map((x) => path.join(d, x)); };
const b = await chromium.launch(), err = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); p.on('dialog', (d) => d.accept());
const stato = () => p.evaluate(() => { const d = window.__dbg, V = d.V; const vis = Array.from({ length: V.n }, (_, k) => d.P(k)).filter((q) => q?.frames?.length);
  return { n: V.n, mg: !document.querySelector('#ws-mg')?.hidden && !!document.querySelector('#ws-mg button.on'), serie: vis.map((q) => (V.serie[q.sIdx]?.descrizione || '').slice(0, 28)), wl: vis.map((q) => Math.round(q.ww)), studi: new Set(vis.map((q) => V.serie[q.sIdx]?.studio || V.serie[q.sIdx]?.descrizione?.match(/Studio \d/)?.[0] || '')).size }; });
const apri = async (id) => {
  await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await p.setInputFiles('#cl-file', tutti(id)); await p.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 120000 }); await p.waitForTimeout(3500);
  return stato();
};
const regole = (o) => p.evaluate((o) => { localStorage.setItem('rq-protocollo-regole', JSON.stringify(o)); }, o);
try {
  await p.goto(B + '/client/index.html'); await p.evaluate(() => { localStorage.removeItem('rq-protocollo-regole'); localStorage.removeItem('rq-protocolli'); localStorage.removeItem('rq-protocollo-auto'); });
  let s = await apri('caso-tcia-002'); esito(s.n >= 4 || s.mg, 'mammografia → 4 viste', JSON.stringify(s));
  s = await apri('caso-tcia-001'); esito(s.n === 2 && s.wl.includes(1500) && s.wl.some((w) => w <= 450), 'TC del torace → polmone e mediastino affiancati', JSON.stringify(s));
  s = await apri('caso-tcia-003'); esito(s.n >= 2 && new Set(s.serie).size >= 2, 'TC multifase → fasi affiancate', JSON.stringify(s));
  s = await apri('caso-tcia-064'); esito(s.n >= 2 && s.studi >= 2, 'RM con esame precedente → attuale e precedente affiancati', JSON.stringify(s));
  // il pannello delle regole
  await p.click('#cl-altro > summary'); await p.click('#hp-regole'); await p.waitForSelector('#dlg-regole-hp[open]');
  esito(await p.evaluate(() => document.querySelectorAll('#dlg-regole-hp [data-r]').length) === 5, '«⚙ Regole»: 5 regole con la casella');
  await p.uncheck('#dlg-regole-hp [data-r="torace"]'); await p.click('#hp-reg-ok');
  s = await apri('caso-tcia-001'); esito(s.n === 1, 'regola «TC del torace» spenta → un riquadro', JSON.stringify(s));
  s = await apri('caso-tcia-002'); esito(s.n >= 4 || s.mg, 'le altre regole restano accese (mammografia nelle 4 viste)', JSON.stringify(s));
  await p.evaluate(() => localStorage.setItem('rq-protocollo-auto', '0'));
  s = await apri('caso-tcia-003'); esito(s.n === 1, 'disposizioni automatiche spente → un riquadro', JSON.stringify(s));
  await p.evaluate(() => { localStorage.removeItem('rq-protocollo-auto'); localStorage.removeItem('rq-protocollo-regole'); });
  // 📌 Ricorda vince: TC del torace salvata con 3 riquadri
  s = await apri('caso-tcia-001');
  await p.evaluate(async () => { await window.__dbg.impostaRiquadri(3); });
  await p.click('#cl-altro > summary'); await p.click('#hp-ricorda'); await p.waitForTimeout(500);
  s = await apri('caso-tcia-001'); esito(s.n === 3, '«📌 Ricorda» vince sulle regole: la disposizione salvata torna', JSON.stringify(s));
  await p.evaluate(() => localStorage.removeItem('rq-protocolli'));
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
