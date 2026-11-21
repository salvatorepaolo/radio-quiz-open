// prova_v231.mjs: apertura progressiva delle TC grandi (anteprima ridotta della serie, poi l'immagine completa), con rete lenta
import { spawn, execSync } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const CASO = process.env.CASO || 'caso-tcia-001';
const PORTA = +process.env.PORTA_PROVA || (19450 + Math.floor(Math.random() * 40)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' }); let a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  // rete lenta (come un'ADSL): circa 4 Mbit/s, 60 ms
  const a0 = a; const a2 = await ctx.newPage(); a2.on('pageerror', (e) => errori.push(e.message)); await a0.close();
  const cdp = await ctx.newCDPSession(a2); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 500000, uploadThroughput: 200000 });
  const t0 = Date.now();
  a = a2;
  await a.goto(B + `/?prova#/caso/${CASO}`); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, CASO, { timeout: 120000 });
  const tPrima = Date.now() - t0;
  const ant = await a.waitForFunction(() => { const d = window.__dbg, s = d.V.serie[d.P().sIdx]; return s?._ant ? { n: s._ant.n, w: s._ant.w, f: s._ant.f } : null; }, null, { timeout: 100000 }).then((h) => h.jsonValue()).catch(() => null);
  ok('1 anteprima della serie scaricata', !!ant, { ant, primaImmagine_ms: tPrima });
  // salto a una fetta lontana: subito l'anteprima, poi l'immagine completa
  const salto = await a.evaluate(async () => { const d = window.__dbg, p = d.P(), j = p.idx > p.frames.length / 2 ? 2 : p.frames.length - 3, t = performance.now();
    const pr = d.mostraDi(d.V.attivo, j); await new Promise((r) => setTimeout(r, 120));
    const subito = { anteprima: !!p.img?.anteprima, idx: p.idx, ms: Math.round(performance.now() - t) };
    await pr; for (let k = 0; k < 300 && (p.img?.anteprima || p.idx !== j); k++) await new Promise((r) => setTimeout(r, 100));
    return { subito, completa: !p.img?.anteprima && p.idx === j, ms: Math.round(performance.now() - t) }; });
  ok('2 fetta lontana: anteprima entro 120 ms, poi l\'immagine completa', salto.subito.anteprima && salto.completa, salto);
  await a.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/anteprima.png' });
  // scorrimento veloce: ogni fetta si vede subito
  const scorri = await a.evaluate(async () => { const d = window.__dbg, p = d.P(); let viste = 0; const n = Math.min(30, p.frames.length);
    for (let j = 0; j < n; j++) { d.mostraDi(d.V.attivo, Math.floor(j * p.frames.length / n)); await new Promise((r) => setTimeout(r, 30)); if (p.img && (p.img.anteprima || p.idx === Math.floor(j * p.frames.length / n))) viste++; }
    return { viste, n }; });
  ok('3 scorrimento veloce sulla rete lenta: ogni fetta visibile subito', scorri.viste === scorri.n, scorri);
  ok('4 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
