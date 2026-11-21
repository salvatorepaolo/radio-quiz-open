import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18900 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}/?prova`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
await p.waitForSelector('#vista-elenco:not([hidden])');
for (const id of process.argv.slice(2)) {
  await p.goto(B + `#/caso/${id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
  const t0 = Date.now();
  for (let k = 0; k < 20; k++) {
    const st = await p.evaluate(() => { const cv = document.querySelector('#canvas'), d = window.__dbg; return { cw: cv?.width, img: !!d?.V?.img, si: d ? d.V.serie[d.P(0).sIdx]?._i : null, dbg: !!d, img0: !!d?.P(0)?.img }; });
    console.log(id, Date.now() - t0, JSON.stringify(st));
    if (st.cw > 50 && st.img) break;
    await p.waitForTimeout(1500);
  }
}
await browser.close(); sim.kill(); console.log('FINE');
