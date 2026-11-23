// prova_156_164.mjs: i casi 156-164 si aprono nel visualizzatore del simulatore (schermate in eco2d/schermate)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 23951, B = `http://localhost:${PORTA}`, OUT = '/Volumes/Caloggero/strumenti_claude/eco2d/schermate/'; fs.mkdirSync(OUT, { recursive: true });
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const ck = (await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: 'admin-test-0000' }) })).headers.get('set-cookie').split(';')[0];
const b = await chromium.launch(), err = [];
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-guida-vista', '1'); } catch {} });
const [n, v] = ck.split('='); await ctx.addCookies([{ name: n, value: v, url: B }]);
const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
let ko = 0;
for (const id of ['156', '157', '158', '159', '160', '161', '162', '163', '164']) {
  await p.goto(`${B}/#/caso/caso-tcia-${id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 }); await p.waitForTimeout(3500);
  const info = await p.evaluate(() => ({ canvas: [...document.querySelectorAll('#vista-caso canvas')].filter((c) => c.width > 100 && c.offsetParent).length, tit: document.querySelector('#vista-caso h1, #q-titolo, .caso h1')?.textContent || '' }));
  console.log(id, JSON.stringify(info)); if (!info.canvas) ko++;
  await p.screenshot({ path: `${OUT}caso-${id}.png` });
}
console.log('errori JS:', err.length ? err.join(' | ') : 'nessuno'); await b.close(); sim.kill(); process.exit(ko || err.length ? 1 : 0);
