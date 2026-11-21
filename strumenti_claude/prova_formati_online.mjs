import { createRequire } from 'node:module'; import fs from 'node:fs';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const D = '/Volumes/Caloggero/_viste/dicom_prova/';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const err = []; p.on('pageerror', (e) => err.push(e.message));
await p.goto('https://radio-quiz.it/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
for (const n of ['ct_j2k', 'ct_jls', 'ct_jpeg8']) {
  await p.goto('https://radio-quiz.it/client/index.html#/'); await p.waitForSelector('#vista-client:not([hidden])');
  await p.evaluate(() => { if (window.__dbg) window.__dbg.V.img = null; });
  await p.setInputFiles('#cl-file', fs.readdirSync(D + n).map((f) => D + n + '/' + f));
  await p.waitForFunction(() => location.hash === '#/caso/locale' && !document.querySelector('#vista-caso').hidden, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  const s = await p.evaluate(() => { const cv = document.querySelector('#canvas'), c = cv.getContext('2d'), d = c.getImageData(cv.width / 2 - 50, cv.height / 2 - 50, 100, 100).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i]; return { luce: Math.round(t / (d.length / 4)), errore: document.querySelector('#caricamento').hidden ? '' : document.querySelector('#caricamento').textContent }; });
  console.log(n, JSON.stringify(s));
}
console.log('errori', JSON.stringify(err)); await b.close();
