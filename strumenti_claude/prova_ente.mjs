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
const OUT = '/Volumes/Caloggero/_viste/schemi/'; 
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'it-IT' }); const c = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); segui(c, () => 'client');
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1500);
  await c.click('#cl-referto'); await c.waitForTimeout(800);
  await c.click('#ref-prof > summary');
  await c.fill('#rp-ente', 'Azienda Ospedaliera di Prova'); await c.fill('#rp-reparto', 'U.O.C. Radiologia'); await c.fill('#rp-indirizzo', 'Via Roma 1, Palermo · tel. 091 000000');
  await c.fill('#rp-medico', 'Dott. Mario Bianchi'); await c.fill('#rp-qualifica', 'Dirigente medico radiologo');
  await c.setInputFiles('#rp-logo', '/Volumes/Caloggero/piattaforma-quiz/cloud/web/client/icona-512.png'); await c.waitForTimeout(800);
  console.log('firma:', await c.inputValue('#ref-firma'), '| logo visibile:', await c.isVisible('#rp-logo-img'));
  await c.click('#ref-detta'); await c.waitForTimeout(800); console.log('detta:', await c.textContent('#ref-stato'));
  await c.screenshot({ path: OUT + 'referto_profilo.png' });
  const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 15000 }), c.click('#ref-pdf')]); await dl.saveAs(OUT + 'referto_ente.pdf');
  const [dw] = await Promise.all([c.waitForEvent('download', { timeout: 15000 }), c.click('#ref-word')]); await dw.saveAs(OUT + 'referto_ente.docx');
  // riapertura: i dati restano
  await c.click('#ref-chiudi'); await c.waitForTimeout(300); await c.click('#cl-referto'); await c.waitForTimeout(800);
  console.log('dopo riapertura:', await c.inputValue('#rp-ente'), '|', await c.inputValue('#ref-firma'));
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
