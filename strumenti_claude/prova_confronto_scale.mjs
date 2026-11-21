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
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'it-IT' }); const p = await ctx.newPage(); segui(p, () => 'scale');
  const a = await ctx.newPage(); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  console.log('rif', JSON.stringify(await a.evaluate(() => fetch('/api/casi/caso-tcia-022/scala', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scala: { id: 'pirads', valori: { sede: ['base-PZpl-dx', 'medio-PZpl-dx', 'medio-PZpm-dx'], zona: 'pz', dwi: '5' }, valore: 'PI-RADS 5', testo: 'PI-RADS 5 — zona periferica destra, base e terzo medio' } }) }).then((r) => r.status))));
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Scale', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await a.close();
  await ctx.clearCookies(); await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  await p.goto(B + '/?prova#/caso/caso-tcia-022'); await p.waitForTimeout(3500);
  await p.click('#btn-scale'); await p.waitForTimeout(600);
  console.log('opzioni', await p.evaluate(() => [...document.querySelectorAll('#scala-scelta option')].map((o) => o.value).join(',')));
  await p.selectOption('#scala-scelta', 'pirads'); await p.waitForTimeout(400);
  await p.locator('#scala-corpo [data-s="base-PZpl-dx"]').click({ force: true }); await p.locator('#scala-corpo [data-s="base-TZa-dx"]').click({ force: true });
  for (const n of await p.evaluate(() => [...new Set([...document.querySelectorAll('#scala-corpo input[type=radio]')].map((x) => x.name))])) await p.locator(`#scala-corpo input[name="${n}"]`).last().check({ timeout: 800 }).catch(() => {});
  await p.waitForTimeout(300); await p.click('#scala-chiudi').catch(() => {});
  for (const cb of (await p.locator('#q-form input[type=checkbox]').all()).slice(0, 2)) await cb.check().catch(() => {});
  for (let k = 0; k < 8; k++) {
    const cbs = await p.locator('#q-form input[type=checkbox]:visible').all(); if (cbs.length) await cbs[0].check().catch(() => {});
    for (const s of await p.locator('#q-form button:visible', { hasText: 'Sicuro' }).all()) await s.click().catch(() => {});
    await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); const bt = p.locator('#btn-conferma:visible, #q-succ:visible').first(); if (!(await bt.count())) break; await bt.click().catch(() => {}); await p.waitForTimeout(700); }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/Volumes/Caloggero/_viste/schemi/cs_fine.png' }); console.log('esito', (await p.evaluate(() => document.querySelector('#q-esito, .esito, #esito')?.innerText || '')).slice(0, 300));
  const el = p.locator('.sc-confronto').first(); console.log('confronti', await p.locator('.sc-confronto').count(), 'disegni', await p.locator('.sc-disegni').count());
  if (await el.count()) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: '/Volumes/Caloggero/_viste/schemi/confronto_scale.png' }); }
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
