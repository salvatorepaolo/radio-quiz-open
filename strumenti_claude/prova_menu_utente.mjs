// prova_menu_utente.mjs: apre menu del profilo → Gestione (amministratore) e controlla che tutte le voci siano visibili.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23517, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
process.on('uncaughtException', (e) => { console.log('KO  ' + e.message.split('\n')[0]); sim.kill(); process.exit(1); });
const b = await chromium.launch(), err = []; let ko = 0;
for (const [w, h, tema] of [[1280, 800, 'chiaro'], [1920, 1080, 'scuro'], [390, 844, 'chiaro']]) {
  const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: w, height: h }, colorScheme: tema === 'scuro' ? 'dark' : 'light' })).newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.click('#menu-utente>summary'); await p.click('#menu-gestione>summary'); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const fuori = [];
    for (const a of document.querySelectorAll('#menu-gestione .menu-voci a')) { if (a.hidden || !a.offsetParent) continue;
      const ra = a.getBoundingClientRect(); let c = a.parentElement; while (c && c !== document.body) { const cs = getComputedStyle(c);
        if (/auto|hidden|scroll/.test(cs.overflow)) { const rc = c.getBoundingClientRect(); if (ra.top < rc.top - 1 || ra.bottom > rc.bottom + 1) { /* scorrevole: va bene se si raggiunge scorrendo */ if (!/auto|scroll/.test(cs.overflowY)) fuori.push(a.textContent.trim().slice(0, 30)); } } c = c.parentElement; } }
    const v = document.querySelectorAll('#menu-gestione .menu-voci a:not([hidden])').length; const m = document.querySelector('#menu-utente>.menu-voci').getBoundingClientRect();
    return { voci: v, tagliate: fuori, alto: Math.round(m.height), basso: Math.round(m.bottom) }; });
  // la prima voce di Gestione e l'ultima devono essere raggiungibili e cliccabili
  const ult = p.locator('#menu-gestione .menu-voci a:not([hidden])').last(); await ult.scrollIntoViewIfNeeded(); const vis = await ult.isVisible();
  const ok = r.voci > 3 && !r.tagliate.length && vis && r.basso <= h; if (!ok) ko++;
  console.log(`${ok ? 'OK' : 'KO'}  ${w}×${h} ${tema}: ${r.voci} voci, menu alto ${r.alto} px (fino a ${r.basso}/${h}), tagliate: ${r.tagliate.join(', ') || 'nessuna'}`);
  await ult.evaluate((e) => e.closest('.menu-voci').parentElement.closest('.menu-voci').scrollTop = 0);
  await p.screenshot({ path: `/tmp/menu_${w}.png` });
}
console.log(err.length ? 'errori JS: ' + err.join(' | ') : 'nessun errore JS'); await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
