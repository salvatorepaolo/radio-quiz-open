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
const restoIT = (p) => p.evaluate(() => {
  const IT = /\b(della|delle|degli|nella|sulla|dalla|con il|per il|non è|sono|questo|questa|anche|immagini|risposta|casi|caso|referto|serie|studente|docente|esame)\b/i;
  const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.data.replace(/\s+/g, ' ').trim(); const el = n.parentElement;
    if (t.length > 3 && IT.test(t) && el && el.offsetParent && !el.closest('textarea,[contenteditable="true"]')) out.add(t.slice(0, 120)); }
  return [...out].slice(0, 40);
});
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-US' }); const p = await ctx.newPage(); let qui = '';
  segui(p, () => 'EN ' + qui);
  await p.goto(B + '/?prova&lang=en#/'); await p.waitForSelector('[data-vai="codice"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/en_accesso.png' }); console.log('ACCESSO', JSON.stringify(await restoIT(p)));
  const a = await ctx.newPage(); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Student Test', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await a.close();
  await ctx.clearCookies(); await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])'); await p.waitForTimeout(1500);
  console.log('DBG', JSON.stringify(await p.evaluate(() => { const el = [...document.querySelectorAll('.p-desc')].find((e) => /Dopo/.test(e.textContent)); return { n: window.__i18n?.n(), html: el?.outerHTML.slice(0, 300), tr: window.__i18n?.tr(el?.textContent || ''), tr2: window.__i18n?.tr('trauma della spalla') }; })));
  qui = 'home'; await p.screenshot({ path: '/tmp/en_home.png' }); console.log('HOME', JSON.stringify(await restoIT(p)));
  for (const r of ['caso/caso-tcia-001', 'aiuto', 'profilo', 'esame']) {
    qui = r; await p.goto(B + '/?prova#/' + r); await p.waitForTimeout(r.startsWith('caso') ? 3500 : 1500);
    await p.screenshot({ path: `/tmp/en_${r.replace(/\W/g, '_')}.png` }); console.log(r.toUpperCase(), JSON.stringify(await restoIT(p)));
  }
  qui = 'risposta'; await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForTimeout(3500);
  for (const cb of (await p.locator('.quiz input[type=checkbox]').all()).slice(0, 3)) await cb.check().catch(() => {});
  for (let k = 0; k < 6; k++) { await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); const bt = p.locator('#btn-conferma:visible, #q-avanti:visible').first(); if (!(await bt.count())) break; await bt.click().catch(() => {}); await p.waitForTimeout(700); }
  await p.waitForTimeout(1500); await p.screenshot({ path: '/tmp/en_esito.png', fullPage: false }); console.log('ESITO', JSON.stringify(await restoIT(p)));
  await ctx.close();
  const c2 = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-US' }); const c = await c2.newPage(); segui(c, () => 'EN client');
  await c.goto(B + '/client/index.html?lang=en'); await c.waitForSelector('#vista-client:not([hidden])'); await c.waitForTimeout(1000);
  await c.screenshot({ path: '/tmp/en_client.png' }); console.log('CLIENT', JSON.stringify(await restoIT(c)));
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
