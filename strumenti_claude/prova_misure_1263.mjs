// prova_misure_1263.mjs (visualizzatore client): 1) le annotazioni salvate si ritrovano riaprendo l'esame e anche dopo aver
// aggiunto un altro esame per il confronto (prima si perdevano: erano legate all'insieme delle serie aperte);
// 2) le misure fatte nell'MPR entrano nelle annotazioni DICOM (GSPS) e nel referto strutturato (SR), con il valore misurato
// in 3D, sull'immagine acquisita più vicina. Uso: node prova_misure_1263.mjs
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const req = createRequire(T + 'package.json'), { chromium } = req('playwright');
const PORTA = +process.env.PORTA_PROVA || (19440 + Math.floor(Math.random() * 40)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const fileDi = (caso, max = 400) => { const out = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name) && out.length < max) out.push(f); } }; giro(path.join(CASI, caso, 'serie')); return out; };
const A = fileDi('caso-tcia-001'), Bx = fileDi('caso-tcia-110', 60);
const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
const c = await ctx.newPage(), errori = []; c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
const D = (f, x) => c.evaluate(f, x);
const carica = async (files, aggiungi = false) => {
  if (!aggiungi) { await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 }); await c.setInputFiles('#cl-file', files); }
  else { const prima = await D(() => window.__dbg.V.serie.length); await c.setInputFiles('#cl-aggiungi-file', files); await c.waitForFunction((n) => window.__dbg.V.serie.length > n, prima, { timeout: 120000 }); }
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 180000 }); await c.waitForTimeout(2000);
};
const serieTC = () => D(() => window.__dbg.V.serie.findIndex((s) => s.files.length >= 60));
try {
  // 1. annotazione salvata, riapertura, esame aggiunto
  await carica(A);
  const si = await serieTC();
  await D(async (si) => { const d = window.__dbg; await d.selezionaSerie(si); const p = d.P(d.V.attivo), k = `${si}:${p.idx}`;
    d.V.misure[k] = [{ tipo: 'linea', a: { x: 200, y: 200 }, b: { x: 260, y: 230 } }]; d.disegna(); d.salvaAnnotazioni(); }, si);
  const chiavi = await D(() => Object.keys(localStorage).filter((k) => k.startsWith('rq-misure')));
  esito(chiavi.some((k) => k.startsWith('rq-misure-s:')), 'annotazione salvata per serie', chiavi.join(', ').slice(0, 120));
  const idx0 = await D(() => window.__dbg.P(window.__dbg.V.attivo).idx);
  await carica(A);
  const ritrovate = await D(([si, i]) => (window.__dbg.V.misure[`${si}:${i}`] || []).length, [await serieTC(), idx0]);
  esito(ritrovate === 1, 'riaprendo l\'esame l\'annotazione si ritrova', ritrovate);
  await carica(Bx, true);
  const dopo = await D(([i]) => { const d = window.__dbg, si = d.V.serie.findIndex((s) => /Recon 2/.test(s.descrizione || '') && s.files.length === 139); return { si, n: Object.entries(d.V.misure).filter(([k]) => k.startsWith(si + ':' + i)).length }; }, [idx0]);
  esito(dopo.n === 1, 'con un altro esame aggiunto per il confronto l\'annotazione resta', JSON.stringify(dopo));

  // 2. misura nell'MPR → GSPS e SR
  await carica(A);
  await D((si) => window.__dbg.selezionaSerie(si), await serieTC()); await c.waitForTimeout(1500);
  await c.click('#modo-mpr');
  await c.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelectorAll('#mpr canvas').length >= 3, null, { timeout: 120000 });
  await c.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }).catch(() => {}); await c.waitForTimeout(1500);
  const r = await D(() => { const e = document.getElementById('vp-coronale').getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height }; });
  await c.click('[data-mpr-tool="misura"]'); await c.waitForTimeout(200);
  const x = r.x + r.w * 0.45, y = r.y + r.h * 0.5;
  let mpr = { l: [] };
  for (let t = 0; t < 4 && !mpr.l.length; t++) {
    await c.mouse.move(x, y); await c.mouse.down(); await c.mouse.move(x, y + r.h * 0.15, { steps: 10 }); await c.mouse.up(); await c.waitForTimeout(1500);
    mpr = await D(() => window.__dbg.misureMPREsporta());
    if (!mpr.l.length) console.log('   (nuovo tentativo)', JSON.stringify(await D(() => ({ n: window.__dbg.MPR.modulo?._misure?.().length, tool: [...document.querySelectorAll('[data-mpr-tool].on')].map((x) => x.dataset.mprTool).join() }))));
  }
  esito(mpr.l.length === 1, 'misura fatta nell\'MPR (vista coronale)', `${mpr.l.length} · ${mpr.l[0]?.tool} ${mpr.l[0]?.stats?.length?.toFixed?.(1)} mm`);
  const gs = await D(async () => { const f = await window.__dbg.esportaGSPS(); return { n: f.length, su: f.suPiani, byte: f[0]?.dati?.byteLength ?? f[0]?.dati?.length }; });
  esito(gs.n >= 1 && gs.su >= 1, 'annotazioni DICOM (GSPS) con la misura MPR', JSON.stringify(gs));
  const sr = await D(async () => { const f = await window.__dbg.esportaGSPS({ sr: true }); const u = new Uint8Array(f[0].dati.buffer || f[0].dati); return { n: f.length, testo: new TextDecoder('latin1').decode(u).match(/misurata in MPR[^\0]{0,40}/)?.[0] }; });
  esito(sr.n >= 1 && /misurata in MPR/.test(sr.testo || ''), 'referto strutturato DICOM (SR) con la misura MPR', JSON.stringify(sr));
  // dopo la chiusura dell'MPR la misura resta esportabile
  await c.click('#modo-mpr').catch(() => {}); await c.waitForTimeout(1000);
  const dopoChiusura = await D(async () => { try { const f = await window.__dbg.esportaGSPS(); return f.suPiani; } catch (e) { return e.message; } });
  esito(dopoChiusura >= 1, 'chiuso l\'MPR, la misura resta nelle esportazioni', dopoChiusura);
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 3).join(' | ').slice(0, 300));
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
