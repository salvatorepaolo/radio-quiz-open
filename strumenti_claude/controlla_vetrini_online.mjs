// controlla_vetrini_online.mjs: i 5 casi della sezione «Vetrini» sul sito pubblicato (codice dell'amministratore, nessun account creato)
import { createRequire } from 'node:module'; import fs from 'node:fs';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const B = 'https://radio-quiz.it', COD = fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/.segreti', 'utf8').match(/^CODICE_AMMINISTRATORE="(.*)"/m)[1];
const b = await chromium.launch(), p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage(), err = [];
p.on('pageerror', (e) => err.push(e.message));
await p.goto(B + '/#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', COD); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 30000 });
let ko = 0;
for (const id of (process.argv[2] || 'caso-tcia-136,caso-tcia-137,caso-tcia-138,caso-tcia-139,caso-tcia-140').split(',')) {
  let mb = 0; const conta = (r) => { const l = +r.headers()['content-length'] || 0; if (r.url().includes('/vetrino/')) mb += l / 1048576; };
  p.on('response', conta);
  await p.goto(B + '/#/caso/' + id); await p.waitForTimeout(9000);
  const col = await p.evaluate(() => { const cv = document.querySelector('#vt-incorporato canvas'); if (!cv) return -1; const c = document.createElement('canvas'); c.width = 80; c.height = 60; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 80, 60); const d = x.getImageData(0, 0, 80, 60).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] - d[i + 1] > 25 && d[i + 2] - d[i + 1] > 15) n++; return n / 4800; });
  p.off('response', conta);
  const ok = col > 0.08;   // vetrini stretti e lunghi (colon) o a frammenti (fegato): meno riquadro coperto if (!ok) ko++;
  console.log(`${ok ? 'OK' : 'KO'}  ${id}: tessuto ${Math.round(col * 100)}% del riquadro, ${mb.toFixed(1)} MB del vetrino scaricati`);
}
console.log(err.length ? 'errori JS: ' + err.join(' | ') : 'nessun errore JS'); await b.close(); process.exit(ko || err.length ? 1 : 0);
