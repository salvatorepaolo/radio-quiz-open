// prova_memoria.mjs: memoria del visualizzatore aprendo di seguito molti casi grandi (TC, RM). Dopo ogni caso si torna
// all'elenco, si libera la memoria (garbage collector) e si misura quella usata dalla pagina, compresi i dati delle immagini.
// Se cresce sempre, qualcosa non viene liberato: dopo un po' il browser rallenta o si chiude (soprattutto su iPad).
// Regole: dopo il riscaldamento (primi 8 casi) la memoria non deve salire caso dopo caso e non deve superare 1,5 GB.
// Trovato e corretto nella 1.261: i file del caso precedente restavano in memoria (fino a 700 MB) anche nell'elenco.
// Uso: node prova_memoria.mjs [numero di casi, predefinito 24]   (solo Chromium: le misure vengono dal suo protocollo)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const N = +process.argv[2] || 24, CALDO = 8;
const PORTA = +process.env.PORTA_PROVA || (19470 + Math.floor(Math.random() * 80)), B = `http://localhost:${PORTA}/?prova`;
const conta = (d) => { let n = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) n += e.isDirectory() ? conta(path.join(d, e.name)) : e.name.endsWith('.dcm') ? 1 : 0; return n; };
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc'] });
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d ? ' → ' + d : ''}`); };
const MB = (x) => Math.round(x / 1048576);
try {
  const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage(), errori = [];
  p.on('pageerror', (e) => errori.push(e.message + ' ‖ ' + (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  await p.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const cdp = await p.context().newCDPSession(p);
  await p.goto(B + '#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
  const casi = (await p.evaluate(async () => (await (await fetch('/api/casi')).json())))
    .filter((c) => ["TC", "RM"].includes(c.modalita)).map((c) => ({ id: c.id, n: 0 }));
  for (const c of casi) c.n = fs.existsSync(path.join(CASI, c.id)) ? conta(path.join(CASI, c.id)) : 0;
  casi.sort((a, z) => z.n - a.n);
  const scelti = casi.slice(0, N);
  const misura = async () => {
    await p.evaluate(() => window.gc?.()); await cdp.send('HeapProfiler.collectGarbage'); await p.waitForTimeout(300);
    const h = await cdp.send('Runtime.getHeapUsage');
    const { JSHeapUsedSize } = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    return { totale: h.usedSize + (h.backingStorageSize || 0) + (h.embedderHeapUsedSize || 0), js: JSHeapUsedSize, dati: h.backingStorageSize || 0 };
  };
  await cdp.send('Performance.enable');
  const base = await misura(), serie = [];
  console.log(`partenza: ${MB(base.totale)} MB; ${scelti.length} casi, da ${scelti[0].n} a ${scelti.at(-1).n} immagini`);
  for (const [k, c] of scelti.entries()) {
    await p.goto(B + `#/caso/${c.id}`);
    await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.V.pannelli.slice(0, window.__dbg.V.n).every((x) => x.img), c.id, { timeout: 60000 }).catch(() => {});
    // si scorre la serie come farebbe chi legge l'esame: le immagini vengono scaricate e decodificate
    await p.evaluate(async () => { const d = window.__dbg, pn = d.P(d.V.attivo), n = pn.frames?.length || 1; for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 40))) { await d.mostraDi(d.V.attivo, i); await new Promise((r) => setTimeout(r, 15)); } }).catch(() => {});
    await p.waitForTimeout(800);
    await p.goto(B + '#/'); await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
    const m = await misura(); serie.push(m.totale);
    console.log(`${String(k + 1).padStart(2)}. ${c.id.padEnd(16)} ${String(c.n).padStart(5)} immagini  memoria ${MB(m.totale)} MB (dati immagini ${MB(m.dati)} MB)`);
  }
  // tendenza dopo il riscaldamento (retta dei minimi quadrati): una perdita fa salire la memoria a ogni caso
  const dopo = serie.slice(CALDO), xm = (dopo.length - 1) / 2, ym = dopo.reduce((a, b) => a + b, 0) / dopo.length;
  const pend = dopo.reduce((a, y, i) => a + (i - xm) * (y - ym), 0) / dopo.reduce((a, _, i) => a + (i - xm) ** 2, 0);
  const massimo = Math.max(...serie);
  esito(pend < 10 * 1048576, 'dopo il riscaldamento la memoria non cresce caso dopo caso (meno di 10 MB per caso)', `${(pend / 1048576).toFixed(1)} MB per caso; ultimi casi: ${serie.slice(-3).map(MB).join(', ')} MB`);
  esito(massimo < 1536 * 1048576, 'mai oltre 1,5 GB', `massimo ${MB(massimo)} MB`);
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 2).join(' | ').slice(0, 300));
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
