import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch(); const ctx = await b.newContext({ locale: 'it-IT' }); const p = await ctx.newPage(); const err = [];
p.on('pageerror', (e) => err.push('PE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') err.push('C ' + m.text().slice(0, 200)); });
p.on('requestfailed', (r) => err.push('RF ' + r.url() + ' ' + r.failure()?.errorText));
await p.goto('https://radio-quiz.it/client/index.html'); await p.waitForTimeout(12000);
console.log('URL', p.url());
console.log(JSON.stringify(await p.evaluate(() => ({ vis: !document.querySelector('#vista-client')?.hidden, priv: !!document.querySelector('#dlg-privacy-cl[open]'), body: document.body.innerText.slice(0, 200), ver: window.VERSIONE || document.querySelector('meta[name=versione]')?.content })).catch((e) => e.message)));
// home: card visualizzatore
const h = await ctx.newPage(); await h.goto('https://radio-quiz.it/#/'); await h.waitForTimeout(3000);
console.log('CARD', JSON.stringify(await h.evaluate(() => [...document.querySelectorAll('a,button')].filter((x) => /Scarica|Visualizzatore DICOM/.test(x.textContent)).map((x) => [x.tagName, x.textContent.trim().slice(0, 40), x.href || '', x.target || '', x.hidden]))));
console.log(JSON.stringify(err.slice(0, 12))); await b.close();
