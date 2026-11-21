import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 23412, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message, (e.stack || '').split('\n').slice(1, 3).join(' | ')));
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)); });
await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
for (const h of (process.env.PAGINE || 'gestione-casi,analisi,classi,revisione,percorsi,nuovo,statistiche,tenant,account').split(',')) {
  await p.goto(B + '/?prova#/' + h); await p.waitForTimeout(2500);
  console.log(h, await p.evaluate((h) => { const v = document.querySelector('#vista-' + h); return [location.hash, v ? (v.hidden ? 'nascosta' : 'visibile: ' + v.innerText.slice(0, 90).replace(/\s+/g, ' ')) : 'manca', document.querySelector('#vista-stato:not([hidden])')?.innerText?.slice(0, 80)]; }, h));
}
await b.close(); sim.kill();
