import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
const err = []; p.on('pageerror', (e) => err.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') err.push(m.text()); });
await p.goto('https://radio-quiz.it/client/index.html');
await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
console.log('SW', await p.evaluate(() => !!navigator.serviceWorker.controller), 'avviso', await p.locator('.cl-avviso').isVisible(), 'versione', await p.evaluate(() => fetch('versione.json').then((r) => r.json()).then((v) => v.versione)));
await p.screenshot({ path: '/Volumes/Caloggero/_viste/prova3d/client_online.png' });
console.log('errori', JSON.stringify(err)); await b.close();
