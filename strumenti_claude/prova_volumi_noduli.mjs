// prova_volumi_noduli.mjs: volume semiautomatico dei noduli polmonari confrontato con la seconda lettura IA salvata nei
// casi (casi-free/*/ia/*.json: centro e volume di ogni nodulo). Per ogni nodulo: metodo generale (crescita di regione
// per immagine, volumeDa) e metodo per i noduli (segmentaNodulo, 3D). Riassunto: quota entro ×1,5 e ×2 dal volume
// dell'IA, mediana dello scarto |log2|, misure fallite.
// Uso: node prova_volumi_noduli.mjs [file del candidato segmentaNodulo] [--max N]
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const CAND = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null, MAX = +(process.argv[process.argv.indexOf('--max') + 1] || 1e9);
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19760 + Math.floor(Math.random() * 30)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }), p = await ctx.newPage();
p.on('pageerror', (e) => console.log('  errore JS:', e.message));
await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
const lavori = [], SOLO = process.env.CASO;
for (const c of fs.readdirSync(CASI).sort()) {
  if (SOLO && c !== SOLO) continue;
  const d = path.join(CASI, c, 'ia'); if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) { let j; try { j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')); } catch { continue; }
    const nod = j.analisi?.noduli || []; if (nod.length) lavori.push({ caso: c, serie: f.replace(/\.json$/, ''), nod }); }
}
const righe = []; let fatti = 0;
for (const L of lavori) {
  if (fatti >= MAX) break;
  await p.goto(B + `/?prova&n=${fatti}#/caso/${L.caso}`);
  await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 }).catch(() => {});
  await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.P(0)?.img, L.caso, { timeout: 60000 }).catch(() => {});
  if (CAND) await p.evaluate((src) => { (0, eval)(src + '\nwindow.__seg = segmentaNodulo;'); }, fs.readFileSync(CAND, 'utf8'));
  for (const n of L.nod) {
    if (fatti++ >= MAX) break;
    const r = await p.evaluate(async ([serie, q, cand]) => {
      const d = window.__dbg, si = d.V.serie.findIndex((s) => (s.files || []).some((f) => f.includes('/' + serie + '/'))); if (si < 0) return { errore: 'serie non trovata: caso ' + d.V.caso?.id + ' · ' + d.V.serie.map((s) => (s.files || [])[0] || s.descrizione).join(' | ').slice(0, 200) };
      await d.selezionaSerie(si); const pn = d.P(d.V.attivo);
      let best = 0, dist = Infinity;
      for (let i = 0; i < pn.frames.length; i++) { const im = await d.immagineDi(pn, i); if (!im?.ipp) continue; const nn = d.normaleDi(im.iop), dd = Math.abs((im.ipp[0] - q[0]) * nn[0] + (im.ipp[1] - q[1]) * nn[1] + (im.ipp[2] - q[2]) * nn[2]); if (dd < dist) { dist = dd; best = i; } }
      await d.mostraDi(d.V.attivo, best); const im = await d.immagineDi(pn, best), px = d.pixelDa(im, q);
      const t0 = performance.now(), prima = d.V.volumi.length;
      await d.volumeDa(d.V.attivo, { x: px.x, y: px.y }, best);
      const v = d.V.volumi.length > prima ? d.V.volumi.at(-1) : null, tVec = performance.now() - t0;
      let nuovo = null, tNuovo = 0;
      if (cand && window.__seg) { const t1 = performance.now(); const s = await window.__seg(pn, best, Math.round(px.x), Math.round(px.y), d.immagineDi, d.normaleDi); tNuovo = performance.now() - t1;
        nuovo = s ? (s.errore ? { errore: s.errore } : { vol: s.vol, sconfina: s.sconfina, subsolido: s.subsolido, raggio: s.raggio }) : { generale: true }; }
      return { vecchio: v ? { vol: v.vol, sconfina: v.sconfina } : null, nuovo, tVec, tNuovo };
    }, [L.serie, n.centro_lps, !!CAND]).catch((e) => ({ errore: e.message.slice(0, 120) }));
    const ref = n.volume_mm3, mm = (x) => (x?.vol != null ? Math.round(x.vol * 1000) : null);
    const riga = { caso: L.caso, serie: L.serie.slice(0, 24), d: n.diametro_medio_mm, hu: Math.round(n.hu), ref: Math.round(ref), vecchio: mm(r.vecchio), vSconf: !!r.vecchio?.sconfina,
      nuovo: r.nuovo?.generale ? 'gen' : mm(r.nuovo), nSconf: !!r.nuovo?.sconfina, sub: !!r.nuovo?.subsolido, err: r.errore || r.nuovo?.errore || '', t: Math.round(r.tNuovo || 0) };
    righe.push(riga);
    console.log(`${riga.caso} ${riga.serie.padEnd(24)} ${String(riga.d).padStart(3)} mm ${String(riga.hu).padStart(5)} HU  IA ${String(riga.ref).padStart(6)}  vecchio ${String(riga.vecchio ?? '—').padStart(7)}${riga.vSconf ? '!' : ' '}  nuovo ${String(riga.nuovo ?? '—').padStart(7)}${riga.nSconf ? '!' : ' '}${riga.sub ? ' gg' : '   '} ${riga.t} ms ${riga.err}`);
  }
}
const stat = (k) => {
  const l = righe.map((r) => (typeof r[k] === 'number' ? Math.abs(Math.log2(r[k] / r.ref)) : Infinity));
  const s = [...l].sort((a, b) => a - b), ok = (f) => l.filter((x) => x <= Math.log2(f)).length;
  return `${k}: entro ×1,5 ${ok(1.5)}/${l.length}, entro ×2 ${ok(2)}/${l.length}, mediana |log2| ${s[s.length >> 1]?.toFixed(2)}, non misurati ${l.filter((x) => !Number.isFinite(x)).length}`;
};
console.log('\n' + stat('vecchio')); if (CAND) console.log(stat('nuovo'));
// senza candidato si misura il visualizzatore così com'è (volumeDa): soglie di non regressione (1.270: 79/140 entro ×2,
// 1.270 finale: 91/140, mediana 0,66; prima della 1.270: 5/140)
if (!CAND && righe.length >= 100) {
  const l = righe.map((r) => (typeof r.vecchio === 'number' ? Math.abs(Math.log2(r.vecchio / r.ref)) : Infinity)), s = [...l].sort((a, b) => a - b);
  const entro2 = l.filter((x) => x <= 1).length / l.length, med = s[s.length >> 1];
  console.log(`${entro2 >= 0.6 ? 'OK' : 'KO'}  volumi dei noduli entro ×2 dalla seconda lettura IA → ${(entro2 * 100).toFixed(0)}% (soglia 60%)`);
  console.log(`${med <= 0.8 ? 'OK' : 'KO'}  scarto mediano |log2| → ${med.toFixed(2)} (soglia 0,80)`);
  console.log(`ℹ pass ${(entro2 >= 0.6) + (med <= 0.8)}\nℹ fail ${(entro2 < 0.6) + (med > 0.8)}`); await b.close(); sim.kill(); process.exit(entro2 >= 0.6 && med <= 0.8 ? 0 : 1);
}
fs.writeFileSync('/tmp/volumi_noduli.json', JSON.stringify(righe, null, 1));
await b.close(); sim.kill();
