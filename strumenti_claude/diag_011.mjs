// diag_011.mjs: apre un caso sul sito vero e misura quando compare l'immagine (uso: node diag_011.mjs caso-tcia-011)
import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const id = process.argv[2] || 'caso-tcia-011';
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const log = []; p.on('pageerror', (e) => log.push('ERR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.push(m.type() + ' ' + m.text().slice(0, 200)); });
p.on('response', (r) => { if (r.status() >= 400) log.push(r.status() + ' ' + r.url()); });
const t0 = Date.now();
await p.goto('https://radio-quiz.it/#/'); await p.waitForTimeout(500); await p.goto('https://radio-quiz.it/#/caso/' + id);
for (let k = 0; k < 16; k++) {
  await p.waitForTimeout(2500);
  const s = await p.evaluate(() => { const V = window.__dbg?.V; const cs = [...document.querySelectorAll('#vista-caso canvas')].filter((c) => c.width && c.offsetWidth).map((c) => { let pix = 0; try { const g = c.getContext('2d'); if (g) { const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4000) if (d[i] > 10) pix++; } else pix = -1; } catch { pix = -2; } return c.id + ':' + pix; });
    return { img: !!V?.img, car: document.querySelector('#caricamento')?.hidden === false ? document.querySelector('#caricamento').textContent : '', cs: cs.join(','), hash: location.hash }; });
  console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', JSON.stringify(s));
  if (s.img && /:\d*[1-9]/.test(s.cs)) break;
}
console.log(log.slice(0, 15).join('\n')); await b.close();
