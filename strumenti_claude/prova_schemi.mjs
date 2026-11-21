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
  // 1) pagina editor a 390 px: chi sborda?
  { const ctx = await b.newContext({ viewport: { width: 390, height: 900 } }); const p = await ctx.newPage();
    await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
    await p.goto(B + '/?prova#/editor/caso-tcia-001'); await p.waitForTimeout(2500);
    console.log('LARGHI', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 2)
      .filter((e) => ![...e.children].some((c) => c.getBoundingClientRect().right > innerWidth + 2)).slice(0, 12).map((e) => `${e.tagName}#${e.id}.${[...e.classList].join('.')} r=${Math.round(e.getBoundingClientRect().right)} w=${Math.round(e.getBoundingClientRect().width)}`))));
    await ctx.close(); }
  // 2) client: disegni delle scale nel referto
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const c = await ctx.newPage(); segui(c, () => 'client');
  await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });   // avviso privacy già accettato
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1500);
  await c.click('#cl-referto'); await c.waitForTimeout(800); await c.click('#ref-scale'); await c.waitForTimeout(600);
  const opzT = await c.evaluate(() => [...document.querySelectorAll('#scala-scelta option')].map((o) => o.value));
  console.log('scale', opzT.join(',')); const opz = opzT.filter((x) => /^(pirads|mammella|segmenti|cinetica|lirads)$/.test(x));
  for (const k of opz) { try {
    await c.selectOption('#scala-scelta', k); await c.waitForTimeout(400);
    const m = c.locator('#scala-corpo [data-mappa] svg').first(); if (!(await m.count())) { console.log(k, 'senza disegno'); continue; }
    // compila: clic su due settori / un punto della mammella, poi la prima scelta di ogni gruppo radio
    const bb = await m.boundingBox();
    const s = c.locator('#scala-corpo [data-mappa] [data-s]'); 
    if (await s.count()) { await s.nth(2).click({ force: true }); await s.nth(5).click({ force: true }); } else await c.mouse.click(bb.x + bb.width * 0.3, bb.y + bb.height * 0.5);
    for (const n of await c.evaluate(() => [...new Set([...document.querySelectorAll('#scala-corpo input[type=radio]')].map((x) => x.name))])) await c.locator(`#scala-corpo input[name="${n}"]`).last().check({ timeout: 800 }).catch(() => {});
    for (const x of await c.locator('#scala-corpo input[type=number]').all()) await x.fill("12", { timeout: 800 }).catch(() => {});
    await c.waitForTimeout(300);
    const cp = c.locator('#scala-copia'); if (!(await cp.count())) { console.log(k, 'niente «Copia nel referto»'); continue; }
    await cp.click(); await c.waitForTimeout(1500);
    console.log(k, 'disegni nel referto:', await c.locator('#ref-schemi figure').count());
    await c.click('#ref-scale'); await c.waitForTimeout(500);
  } catch (e) { console.log(k, 'ERRORE', e.message.split('\n')[0]); } }
  console.log('dopo il giro'); if (!(await c.evaluate(() => document.querySelector('#dlg-referto').open))) await c.click('#cl-referto', { timeout: 5000 }); await c.waitForTimeout(800); console.log('dialogo aperto');
  await c.screenshot({ path: '/tmp/schemi_dialogo.png' });
  const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 15000 }), c.click('#ref-pdf')]); await dl.saveAs('/tmp/schemi.pdf');
  const [dw] = await Promise.all([c.waitForEvent('download', { timeout: 15000 }), c.click('#ref-word')]); await dw.saveAs('/tmp/schemi.docx');
  const sch = await c.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('rq-schemi:'))) || '[]'));
  sch.forEach((x, i) => fs.writeFileSync(`/tmp/schema_${i}.jpg`, Buffer.from(x.url.split(',')[1], 'base64')));
  console.log('salvati', sch.length, sch.map((x) => x.didascalia).join(' | '));
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
