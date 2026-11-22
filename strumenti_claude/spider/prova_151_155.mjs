// prova_151_155.mjs: apre i casi RM lombari 151-155 sul simulatore, controlla che le due serie si carichino e fotografa il visualizzatore
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 23941, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const ck = (await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: 'admin-test-0000' }) })).headers.get('set-cookie').split(';')[0];
const b = await chromium.launch(), err = []; let ok = 0, ko = 0;
for (const n of [151, 152, 153, 154, 155]) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } }); const [k, v] = ck.split('='); await ctx.addCookies([{ name: k, value: v, url: B }]);
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-guida-vista', '1'); } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(n + ': ' + e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(`${B}/#/caso/caso-tcia-${n}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 });
  await p.waitForTimeout(4000);
  const info = await p.evaluate(() => ({ titolo: document.querySelector('#titolo-caso')?.textContent, canvas: [...document.querySelectorAll('canvas')].filter((c) => c.offsetParent && c.width > 200).length,
    testo: [...document.querySelectorAll('.ov, .overlay, [class*="ov-"]')].map((e) => e.textContent).join(' | ').slice(0, 300), serie: document.querySelectorAll('#serie-lista .thumb, .serie-mini, [data-serie]').length }));
  await p.screenshot({ path: `/Volumes/Caloggero/strumenti_claude/spider/foto_${n}.png` });
  const buono = info.canvas >= 2; buono ? ok++ : ko++; console.log(buono ? 'OK' : 'KO', n, JSON.stringify(info));
  await ctx.close();
}
console.log(err.length ? 'ERRORI JS: ' + err.join(' | ') : 'nessun errore JS', `\n${ok} OK, ${ko} KO`); await b.close(); sim.kill();
