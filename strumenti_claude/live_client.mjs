import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch(); const p = await b.newPage(); const err = [];
p.on('pageerror', (e) => err.push('PE ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') err.push('CE ' + m.text()); });
p.on('requestfailed', (r) => err.push('RF ' + r.url() + ' ' + r.failure()?.errorText));
await p.goto('https://radio-quiz.it/#/'); await p.waitForTimeout(3000);
const [pop] = await Promise.all([p.context().waitForEvent('page', { timeout: 5000 }).catch(() => null), p.click('text=Scarica').catch((e) => err.push('CLICK ' + e.message))]);
await p.waitForTimeout(4000);
const q = pop || p; console.log('URL', q.url());
console.log(await q.evaluate(() => ({ t: document.title, vis: !document.querySelector('#vista-client')?.hidden, priv: !!document.querySelector('#dlg-privacy-cl[open]'), body: document.body.innerText.slice(0, 300) })).catch((e) => e.message));
if (pop) { pop.on('pageerror', (e) => err.push('PE2 ' + e.message)); }
console.log(JSON.stringify(err.slice(0, 10))); await b.close();
