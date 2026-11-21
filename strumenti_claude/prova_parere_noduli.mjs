// prova_parere_noduli.mjs: secondo parere IA (noduli-client.js, secondoParere: rete MONAI su un riquadro intorno al
// punto) confrontato con la seconda lettura IA salvata nei casi e con segmentaNodulo (/tmp/volumi_noduli.json di
// prova_volumi_noduli.mjs). Scrive /tmp/parere_noduli.json. Uso: node prova_parere_noduli.mjs [--max N]
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const MAX = +(process.argv[process.argv.indexOf('--max') + 1] || 1e9);
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23420, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  errore JS:', e.message));
await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
await p.evaluate(async () => { const M = await import('/noduli-client.js'); if (!(await M.giaScaricato())) await M.scarica(); });
const geo = new Map(); try { for (const r of JSON.parse(fs.readFileSync('/tmp/volumi_noduli.json', 'utf8'))) geo.set(`${r.caso}|${r.serie}|${r.d}|${r.ref}`, r); } catch {}
const lavori = [];
for (const c of fs.readdirSync(CASI).sort()) { const d = path.join(CASI, c, 'ia'); if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) { let j; try { j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch { continue; }
    const nod = j.analisi?.noduli || []; if (nod.length) lavori.push({ caso: c, serie: f.replace(/\.json$/, ''), nod }); } }
const righe = []; let fatti = 0;
for (const L of lavori) {
  if (fatti >= MAX) break;
  await p.goto(B + `/?prova&n=${fatti}#/caso/${L.caso}`);
  await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.P(0)?.img, L.caso, { timeout: 60000 }).catch(() => {});
  for (const n of L.nod) {
    if (fatti++ >= MAX) break;
    const r = await p.evaluate(async ([serie, q]) => {
      const d = window.__dbg, si = d.V.serie.findIndex((s) => (s.files || []).some((f) => f.includes('/' + serie + '/'))); if (si < 0) return { errore: 'serie non trovata' };
      window.__vol ||= {}; const vol = window.__vol[si] ||= await d.volumeDi(si);
      const M = await import('/noduli-client.js'); return await M.secondoParere(vol, q);
    }, [L.serie, n.centro_lps]).catch((e) => ({ errore: e.message.slice(0, 160) }));
    const g = geo.get(`${L.caso}|${L.serie.slice(0, 24)}|${n.diametro_medio_mm}|${Math.round(n.volume_mm3)}`);
    const riga = { caso: L.caso, serie: L.serie.slice(0, 24), d: n.diametro_medio_mm, hu: Math.round(n.hu), tipo: n.tipo, ref: Math.round(n.volume_mm3), geo: typeof g?.nuovo === 'number' ? g.nuovo : null, ...r };
    righe.push(riga); fs.writeFileSync('/tmp/parere_noduli.json', JSON.stringify(righe, null, 1));
    const l2 = (x) => (x ? Math.log2(x / riga.ref).toFixed(1).padStart(5) : '    —');
    console.log(`${riga.caso} ${String(riga.d).padStart(4)} mm  rif ${String(riga.ref).padStart(6)}  geo ${l2(riga.geo)}  IA ${r.trovato ? l2(r.volume) + ' d ' + r.diametro + ' s ' + r.score : r.errore || 'non trovato'}  ${r.secondi ?? ''} s`);
  }
  await p.evaluate(() => { window.__vol = {}; });
}
await b.close(); sim.kill();
