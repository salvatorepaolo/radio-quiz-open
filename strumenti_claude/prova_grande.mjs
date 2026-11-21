// controllo_generale.mjs: giro di tutte le pagine (amministratore, studente, client) a caccia di errori JavaScript,
// richieste fallite, pagine più larghe dello schermo ed elementi che si sovrappongono nella barra in alto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18500 + Math.floor(Math.random() * 400)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const problemi = [];
const segui = (p, dove) => {
  p.on('pageerror', (e) => problemi.push(`[${dove()}] ERRORE JS: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 40[134]|Failed to load resource/.test(m.text())) problemi.push(`[${dove()}] console: ${m.text().slice(0, 160)}`); });
  p.on('response', (r) => { if (r.status() >= 500 || (r.status() === 404 && !/\/api\//.test(r.url()))) problemi.push(`[${dove()}] ${r.status()} ${r.url().replace(B, '')}`); });
};
const controlla = async (p, dove) => {
  const r = await p.evaluate(() => {
    const largo = document.documentElement.scrollWidth - innerWidth;
    const top = [...document.querySelectorAll('header.top > *')].filter((e) => e.offsetParent && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect());
    let sovr = 0; for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { const a = top[i], c = top[j]; if (a.width && c.width && a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) sovr++; }
    return { largo, sovr, h: document.querySelector('header.top')?.getBoundingClientRect().height };
  });
  if (r.largo > 2) problemi.push(`[${dove}] pagina più larga dello schermo di ${r.largo}px`);
  if (r.sovr) problemi.push(`[${dove}] ${r.sovr} elementi sovrapposti nella barra in alto (altezza ${Math.round(r.h)})`);
};
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 }));
  const c = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); segui(c, () => 'grande');
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  const t0 = Date.now();
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-042/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 });
  console.log('2D pronto in', Date.now() - t0, 'ms');
  // scorre tutta la serie nel 2D: la memoria dei file grezzi resta sotto il limite
  for (let k = 0; k < 40; k++) { await c.keyboard.press('PageDown').catch(() => {}); }
  await c.click('#modo-mpr'); const t1 = Date.now();
  await c.waitForFunction(() => /Serie molto grande|MPR non disponibile/.test(document.querySelector('#mpr-info')?.textContent + document.querySelector('#mpr-stato')?.textContent), null, { timeout: 120000 }).catch(() => {});
  console.log('MPR in', Date.now() - t1, 'ms:', (await c.textContent('#mpr-info')).slice(0, 220));
  console.log('memoria JS', await c.evaluate(() => Math.round((performance.memory?.usedJSHeapSize || 0) / 2 ** 20)), 'MB');
  await c.screenshot({ path: '/Volumes/Caloggero/_viste/schemi/mpr_grande.png' });
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
