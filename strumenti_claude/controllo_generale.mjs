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
  // amministratore e studente, schermo largo e telefono
  for (const [ruolo, w] of [['admin', 1400], ['admin', 390], ['studente', 1400], ['studente', 390]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); let qui = '';
    segui(p, () => `${ruolo} ${w} ${qui}`);
    await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]');
    if (ruolo === 'admin') { await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); }
    else {
      const a = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
      const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Prova', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await a.close();
      await ctx.clearCookies(); await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter');
    }
    await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 }).catch(() => problemi.push(`[${ruolo} ${w}] la home non si apre`));
    const rotte = ruolo === 'admin' ? ['', 'statistiche', 'sponsor', 'tenant', 'account', 'gestione-casi', 'revisione', 'percorsi', 'classi', 'analisi', 'esame', 'errore', 'aiuto', 'nuovo', 'editor/caso-tcia-001', 'caso/caso-tcia-012', 'caso/caso-tcia-002']
      : ['', 'profilo', 'esame', 'errore', 'confronto', 'aiuto', 'proponi', 'caso/caso-tcia-001', 'caso/caso-tcia-018'];
    for (const r of rotte) {
      qui = r || 'home'; await p.goto(B + '/?prova#/' + r); await p.waitForTimeout(r.startsWith('caso') ? 3000 : 1300);
      await controlla(p, `${ruolo} ${w} ${qui}`);
    }
    // nel caso: rispondi e guarda l'esito (studente)
    if (ruolo === 'studente' && w === 1400) {
      qui = 'risposta'; await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForTimeout(3000);
      const cb = p.locator('.quiz input[type=checkbox]').first(); if (await cb.count()) await cb.check().catch(() => {});
      for (let k = 0; k < 6; k++) { await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); const bt = p.locator('#btn-conferma:visible, #q-avanti:visible').first(); if (!(await bt.count())) break; await bt.click().catch(() => {}); await p.waitForTimeout(600); }
      await controlla(p, 'studente esito');
    }
    await ctx.close();
  }
  // client: home, esame, pulsanti principali
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const c = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); let qui = 'client';
  segui(c, () => qui);
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])'); await controlla(c, 'client home');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(2000); await controlla(c, 'client esame');
  for (const id of ['#cl-chiave', '#btn-scale', '#btn-scale', '#cl-referto']) { qui = 'client ' + id; await c.click(id).catch((e) => problemi.push(`[client] non clicco ${id}: ${e.message.slice(0, 80)}`)); await c.waitForTimeout(900); }
  await c.click('#ref-scale').catch(() => {}); await c.waitForTimeout(600);
  qui = 'client manuale'; const m = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); segui(m, () => 'manuale'); await m.goto(B + '/client/manuale-client.html'); await m.waitForTimeout(800);
  if (!(await m.locator('h1').innerText()).includes('Manuale')) problemi.push('[client] /client/manuale-client.html non mostra il manuale');
  qui = 'client mpr'; await c.keyboard.press('Escape'); await c.click('#modo-mpr').catch(() => {}); await c.waitForTimeout(8000); await controlla(c, 'client mpr');
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
