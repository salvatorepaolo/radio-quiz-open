// prova_parere_ui.mjs: il secondo parere IA compare nell'elenco dei volumi dopo la misura di un nodulo (modello scaricato)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23441, B = `http://localhost:${PORTA}`, CASO = process.env.CASO || 'caso-tcia-014';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage();
const errori = []; p.on('pageerror', (e) => errori.push(e.message));
await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
await p.evaluate(async () => { const M = await import('/noduli-client.js'); if (!(await M.giaScaricato())) await M.scarica(); });
const d = path.join(CASI, CASO, 'ia'), f = fs.readdirSync(d).find((x) => JSON.parse(fs.readFileSync(path.join(d, x), 'utf8')).analisi?.noduli?.length);
const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')), n = j.analisi.noduli[+(process.env.N || 0)], serie = f.replace(/\.json$/, '');
await p.goto(B + `/?prova#/caso/${CASO}`);
await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.P(0)?.img, CASO, { timeout: 60000 });
const r = await p.evaluate(async ([serie, q]) => {
  const d = window.__dbg, si = d.V.serie.findIndex((s) => (s.files || []).some((f) => f.includes('/' + serie + '/')));
  await d.selezionaSerie(si); const pn = d.P(d.V.attivo); let best = 0, dist = Infinity;
  for (let i = 0; i < pn.frames.length; i++) { const im = await d.immagineDi(pn, i); if (!im?.ipp) continue; const nn = d.normaleDi(im.iop), dd = Math.abs((im.ipp[0] - q[0]) * nn[0] + (im.ipp[1] - q[1]) * nn[1] + (im.ipp[2] - q[2]) * nn[2]); if (dd < dist) { dist = dd; best = i; } }
  await d.mostraDi(d.V.attivo, best); const im = await d.immagineDi(pn, best), px = d.pixelDa(im, q);
  await d.volumeDa(d.V.attivo, { x: px.x, y: px.y }, best);
  const t0 = performance.now(); while (performance.now() - t0 < 120000) { const v = d.V.volumi.at(-1); if (v?.parere && !v.parere.attesa) break; await new Promise((ok) => setTimeout(ok, 500)); }
  const v = d.V.volumi.at(-1); return { vol: v?.vol, parere: v?.parere, testo: document.querySelector('#volumi')?.innerText };
}, [serie, n.centro_lps]);
console.log(CASO, 'rif', n.volume_mm3, 'mm³', JSON.stringify(r).slice(0, 600));
const ok = r.parere?.trovato !== undefined && /Secondo parere IA/.test(r.testo || '') && !errori.length;
console.log(errori.length ? 'errori JS: ' + errori.join(' | ') : 'nessun errore JS');
console.log(`ℹ pass ${+ok}\nℹ fail ${+!ok}`); await b.close(); sim.kill(); process.exit(ok ? 0 : 1);
