// Esattezza della sovrapposizione SULLE IMMAGINI MOSTRATE dal client (28/11): per ogni vista (nativa, Cor, Sag, OMP) e
// ogni 4ª immagine: etichetta dell'atlante sotto ogni pixel (stessa formula di etichettaIn) e valore del pixel.
// Misure: etichette su osso/aria (TC) o sfondo (RM), ventricoli sul liquor, lato (sinistra del paziente = x LPS maggiore).
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const CL = '/Volumes/Caloggero/piattaforma-quiz/cloud', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(CL + '/test/package.json')('playwright');
const P = 8937, sim = spawn(process.execPath, [CL + '/test/simulatore.mjs'], { cwd: CL, env: { ...process.env, PORTA: String(P), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const B = `http://localhost:${P}`, err = [];
const b = await chromium.launch(process.env.GPU ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } : {});
const dcm = (dir) => { const f = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const x = path.join(d, e.name); if (e.isDirectory()) giro(x); else if (/\.dcm$/i.test(e.name) || !/\./.test(e.name)) f.push(x); } }; giro(dir); return f; };
const esami = process.argv.slice(2).map((a) => a.startsWith('/') ? a : path.join(CASI, a, 'serie'));
try {
  for (const dir of esami) {
    const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage();
    p.on('pageerror', (e) => err.push(e.message));
    await p.goto(B + '/client/index.html?prova'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await p.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }).then(() => p.click('#pr-accetto')).catch(() => {});
    await p.setInputFiles('#cl-file', dcm(dir));
    await p.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await p.waitForTimeout(3000);
    if (!(await p.isVisible('#btn-atlante'))) { console.log(path.basename(path.dirname(dir)), 'nessun bottone atlante'); continue; }
    if (process.env.FORZA_TEMPLATE) await p.evaluate(() => { window.__atl.ATL.forzaTemplate = true; });
    await p.click('#btn-atlante'); await p.waitForSelector('#atl-avvia'); await p.click('#atl-avvia');
    await p.waitForSelector('#atl-pannello .atl-qual', { timeout: 300000 });
    const qual = (await p.textContent('#atl-pannello .atl-qual')) + ' · ' + ((await p.textContent('#atl-pannello')).match(/\d+ strutture[^.]*|la segmentazione automatica[^:]*/)?.[0] || '');
    await p.click('#atl-chiudi');
    console.log('==', dir.split('/').slice(-2).join('/'), qual);
    for (const vista of ['nativa', 'Cor', 'Sag', 'OMP']) {
      if (vista !== 'nativa') { const ok = await p.click(`text="${vista}"`, { timeout: 3000 }).then(() => true).catch(() => false); if (!ok) { console.log('  ', vista, 'non disponibile'); continue; } await p.waitForTimeout(2500); }
      const r = await p.evaluate(async () => {
        const D = window.__dbg, A = window.__atl, q = D.P(D.V.attivo ?? 0), si = q.sIdx, d = A.atlanteDi(si); if (!d) return { errore: 'atlante non disponibile su questa serie' };
        const g = d.geo, nomi = g.etichette, [W, H, N] = g.dim, tc = q.img.modalita === 'CT';
        const lab = (x) => { const dd = [x[0] - g.origine[0], x[1] - g.origine[1], x[2] - g.origine[2]], ix = (a) => Math.round((dd[0] * g.assi[a][0] + dd[1] * g.assi[a][1] + dd[2] * g.assi[a][2]) / g.sp[a]);
          const i = ix(0), j = ix(1), k = ix(2); return i < 0 || j < 0 || k < 0 || i >= W || j >= H || k >= N ? 0 : d.lab[(k * H + j) * W + i]; };
        const righe = [];
        for (let t = 0; t < q.frames.length; t += Math.max(1, Math.floor(q.frames.length / 12))) {
          const im = await D.immagineDi(q, t); if (!im?.ipp || !im.pix) continue;
          const r = im.iop.slice(0, 3), c = im.iop.slice(3, 6), sl = im.slope ?? 1, it = im.inter ?? 0;
          // soglia dello sfondo nella RM: 8% del 99° percentile dell'immagine
          const val = []; for (let y = 0; y < im.rows; y += 2) for (let x = 0; x < im.cols; x += 2) val.push(im.pix[y * im.cols + x] * sl + it);
          const ord = val.slice().sort((a, b) => a - b), p99 = ord[Math.floor(ord.length * 0.99)];
          let n = 0, fuori = 0, nv = 0, sv = 0, nw = 0, sw = 0, xs = 0, ns = 0, xd = 0, nd = 0;
          for (let y = 0; y < im.rows; y += 2) for (let x = 0; x < im.cols; x += 2) {
            const pz = [0, 1, 2].map((a) => im.ipp[a] + x * im.spCol * r[a] + y * im.spRow * c[a]), e = lab(pz); if (!e) continue;
            const v = im.pix[y * im.cols + x] * sl + it, nm = nomi[e] || ''; n++;
            if (tc ? (v > 150 || v < -100) : v < 0.08 * p99) fuori++;
            if (/Lateral-Ventricle/.test(nm)) { nv++; sv += v; } else if (/Cerebral-White-Matter/.test(nm)) { nw++; sw += v; }
            if (/^ctx-lh|^Left-/.test(nm)) { xs += pz[0]; ns++; } else if (/^ctx-rh|^Right-/.test(nm)) { xd += pz[0]; nd++; }
          }
          if (n < 200) continue;
          righe.push({ t, fuori: +(fuori / n).toFixed(3), ventr: nv > 30 && nw > 30 ? +((sv / nv) / (tc ? 1 : sw / nw)).toFixed(tc ? 1 : 2) : null, bianca: tc && nw > 30 ? +(sw / nw).toFixed(1) : null, lato: ns > 50 && nd > 50 ? +((xs / ns) - (xd / nd)).toFixed(0) : null });
        }
        return { piano: q.img.riformattata || 'nativa', n: q.frames.length, righe };
      });
      if (r.errore) { console.log('  ', vista, r.errore); continue; }
      const rr = r.righe, med = (k) => { const v = rr.map((x) => x[k]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
      const peggio = rr.reduce((m, x) => (x.fuori > (m?.fuori ?? -1) ? x : m), null);
      console.log('  ', vista.padEnd(6), `(${r.piano}, ${r.n} img)`, 'etichette fuori dall\'encefalo: mediana', med('fuori'), 'peggiore', peggio?.fuori, '(img ' + peggio?.t + ')',
        '| ventricoli', med('ventr'), r.righe[0]?.bianca != null ? '(bianca ' + med('bianca') + ')' : '(rapporto con la bianca)', '| lato sin−dx', rr.map((x) => x.lato).filter((x) => x != null).join(','));
    }
    await p.context().close();
  }
} finally { console.log('errori JS:', err.length ? err.join(' | ') : 'nessuno'); await b.close(); sim.kill(); }
