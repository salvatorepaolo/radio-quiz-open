// vedi_nodulo.mjs: immagine di controllo della segmentazione di un nodulo (5 strati attorno al centro, finestra
// polmonare, contorno rosso = candidato, croce verde = centro dell'IA). Uso: node vedi_nodulo.mjs <candidato.js> caso:serie:k ...
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 19850, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('  errore JS:', e.message));
await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
const src = fs.readFileSync(process.argv[2], 'utf8');
for (const voce of process.argv.slice(3)) {
  const [caso, serie, k] = voce.split(':'), n = JSON.parse(fs.readFileSync(path.join(CASI, caso, 'ia', serie + '.json'), 'utf8')).analisi.noduli[+k];
  await p.goto(B + `/?prova&v=${Date.now()}#/caso/${caso}`);
  await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.P(0)?.img, caso, { timeout: 60000 }).catch(() => {});
  await p.evaluate((s) => { (0, eval)(s + '\nwindow.__seg = segmentaNodulo;'); }, src);
  const url = await p.evaluate(async ([serie, q]) => {
    const d = window.__dbg, si = d.V.serie.findIndex((s) => (s.files || []).some((f) => f.includes('/' + serie + '/'))); await d.selezionaSerie(si); const pn = d.P(d.V.attivo);
    let best = 0, dist = Infinity;
    for (let i = 0; i < pn.frames.length; i++) { const im = await d.immagineDi(pn, i); if (!im?.ipp) continue; const nn = d.normaleDi(im.iop), dd = Math.abs((im.ipp[0] - q[0]) * nn[0] + (im.ipp[1] - q[1]) * nn[1] + (im.ipp[2] - q[2]) * nn[2]); if (dd < dist) { dist = dd; best = i; } }
    const im0 = await d.immagineDi(pn, best), px = d.pixelDa(im0, q), s = await window.__seg(pn, best, Math.round(px.x), Math.round(px.y), d.immagineDi, d.normaleDi);
    const W = im0.cols, H = im0.rows, lato = Math.round(40 / im0.spCol), x0 = Math.round(px.x - lato / 2), y0 = Math.round(px.y - lato / 2), S = 220;
    const cv = document.createElement('canvas'); cv.width = S * 5; cv.height = S + 40; const g = cv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    const passo = Math.max(1, Math.round(2.5 / (s?.passo || im0.spessore || 1)));
    for (let c = 0; c < 5; c++) {
      const j = best + (c - 2) * passo; if (j < 0 || j >= pn.frames.length) continue;
      const im = await d.immagineDi(pn, j), id = g.createImageData(lato, lato), m = new Set(s?.maschere?.get(j) || []);
      for (let y = 0; y < lato; y++) for (let x = 0; x < lato; x++) { const X = x0 + x, Y = y0 + y; let v = 0, r = 0;
        if (X >= 0 && Y >= 0 && X < W && Y < H) { const i = Y * W + X, hu = im.pix[i] * im.slope + im.inter; v = Math.max(0, Math.min(255, ((hu + 1350) / 1500) * 255)); r = m.has(i) ? 1 : 0; }
        const o = (y * lato + x) * 4; id.data[o] = r ? Math.min(255, v * 0.6 + 110) : v; id.data[o + 1] = r ? v * 0.6 : v; id.data[o + 2] = r ? v * 0.6 : v; id.data[o + 3] = 255; }
      const t = document.createElement('canvas'); t.width = lato; t.height = lato; t.getContext('2d').putImageData(id, 0, 0);
      g.imageSmoothingEnabled = false; g.drawImage(t, c * S, 0, S, S);
      if (c === 2) { g.strokeStyle = '#0f0'; const X = (px.x - x0) / lato * S, Y = (px.y - y0) / lato * S; g.beginPath(); g.moveTo(X - 6, Y); g.lineTo(X + 6, Y); g.moveTo(X, Y - 6); g.lineTo(X, Y + 6); g.stroke(); }
    }
    g.fillStyle = '#fff'; g.font = '14px sans-serif';
    g.fillText(`vol ${s?.vol != null ? Math.round(s.vol * 1000) : '—'} mm³ · soglia ${s?.soglia} · raggio ${s?.raggio?.toFixed?.(1)} · spessore ${s?.spessore?.toFixed?.(1)} · ${s?.subsolido ? 'vetro smerigliato' : 'solido'} · passo ${(s?.passo || 0).toFixed(1)} mm · riquadri 40 mm, ogni ${(passo * (s?.passo || 1)).toFixed(1)} mm`, 8, S + 26);
    return cv.toDataURL('image/png');
  }, [serie, n.centro_lps]);
  const f = `/Volumes/Caloggero/strumenti_claude/tmp_img/nod_${caso}_${k}.png`; fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f, `IA ${Math.round(n.volume_mm3)} mm³ ${n.diametro_medio_mm} mm`);
}
await b.close(); sim.kill();
