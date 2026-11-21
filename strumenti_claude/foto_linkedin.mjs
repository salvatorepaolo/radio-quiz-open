// controllo_generale.mjs: giro di tutte le pagine (amministratore, studente, client) a caccia di errori JavaScript,
// richieste fallite, pagine più larghe dello schermo ed elementi che si sovrappongono nella barra in alto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
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
const OUT = '/Volumes/Caloggero/_viste/linkedin/'; fs.mkdirSync(OUT, { recursive: true });
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'it-IT' }); const p = await ctx.newPage(); segui(p, () => 'li');
  const a = await ctx.newPage(); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Giulia Rossi', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await a.close();
  await ctx.clearCookies(); await p.goto(B + '/?prova#/'); await p.waitForTimeout(800); await p.screenshot({ path: OUT + '0_accesso.png' });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])'); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '1_home.png' });
  await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForTimeout(4000); await p.screenshot({ path: OUT + '2_caso.png' });
  await p.goto(B + '/?prova#/caso/caso-tcia-004'); await p.waitForTimeout(4000); await p.click('#modo-mpr').catch(() => {}); await p.waitForTimeout(12000); await p.screenshot({ path: OUT + '3_mpr3d.png' });
  await p.goto(B + '/?prova#/caso/caso-tcia-050'); await p.waitForTimeout(5000); await p.screenshot({ path: OUT + '4_petct.png' });
  await ctx.close();
  const c2 = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'it-IT', acceptDownloads: true }); const c = await c2.newPage(); segui(c, () => 'client');
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])'); await c.waitForTimeout(800); await c.screenshot({ path: OUT + '5_client.png' });
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-022/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(2000);
  await c.click('#cl-referto'); await c.waitForTimeout(800); await c.click('#ref-scale'); await c.waitForTimeout(600);
  await c.selectOption('#scala-scelta', 'pirads'); await c.waitForTimeout(400);
  const s = c.locator('#scala-corpo [data-mappa] [data-s]'); await s.nth(9).click({ force: true }); await s.nth(12).click({ force: true });
  for (const n of await c.evaluate(() => [...new Set([...document.querySelectorAll('#scala-corpo input[type=radio]')].map((x) => x.name))])) await c.locator(`#scala-corpo input[name="${n}"]`).last().check({ timeout: 800 }).catch(() => {});
  for (const x of await c.locator('#scala-corpo input[type=number]').all()) await x.fill('14', { timeout: 800 }).catch(() => {});
  await c.waitForTimeout(400); await c.screenshot({ path: OUT + '6_scala.png' });
  await c.click('#scala-copia'); await c.waitForTimeout(1500);
  await c.evaluate(() => { const d = document.querySelector('#dlg-referto'); d.querySelector('.ref-editor')?.scrollIntoView(); });
  await c.screenshot({ path: OUT + '7_referto.png' });
  const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 15000 }), c.click('#ref-pdf')]); await dl.saveAs(OUT + '8_referto.pdf');
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
