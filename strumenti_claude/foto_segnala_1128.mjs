// 28/11: fotografie del modulo «Segnalazioni e suggerimenti» e della pagina dell'amministratore (simulatore)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400), BASE = `http://localhost:${PORTA}`, D = '/Volumes/Caloggero/_viste/revisione/';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const ck = (await fetch(BASE + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice: 'admin-test-0000' }) })).headers.get('set-cookie').split(';')[0];
const [n, v] = ck.split('=');
const b = await chromium.launch(); const err = [];
const pagina = async (cookie, w = 1440, h = 900) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5, locale: 'it-IT' });
  if (cookie) await ctx.addCookies([{ name: n, value: v, url: BASE }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); return [ctx, p];
};
// 1. ospite dalla pagina iniziale: pulsante in alto, invio
{ const [ctx, p] = await pagina(false); await p.goto(BASE + '/'); await p.waitForTimeout(2500);
  console.log('ospite pulsante', await p.isVisible('#btn-segnala'));
  await p.click('#btn-segnala'); await p.waitForSelector('#dlg-segnala[open]');
  console.log('ospite email visibile', await p.isVisible('#sg-email'));
  await p.click('input[name="sg-tipo"][value="idea"]'); await p.fill('#sg-testo', 'Sarebbe utile un percorso dedicato all\'ecografia pediatrica.'); await p.fill('#sg-email', 'ospite@esempio.it');
  await p.screenshot({ path: D + 'segnala_ospite.png' });
  await p.click('#sg-invia'); await p.waitForTimeout(800); console.log('ospite esito', await p.textContent('#sg-esito'));
  await ctx.close(); }
// 2. amministratore dal caso: tipo «caso» preselezionato; poi telefono
{ const [ctx, p] = await pagina(true); await p.goto(BASE + '/#/caso/caso-tcia-021'); await p.waitForSelector('#vista-caso:not([hidden]) #canvas', { timeout: 30000 }); await p.waitForTimeout(2500);
  await p.click('#btn-segnala'); await p.waitForSelector('#dlg-segnala[open]');
  console.log('caso tipo', await p.$eval('input[name="sg-tipo"]:checked', (x) => x.value), 'email nascosta', !(await p.isVisible('#sg-email')));
  await p.fill('#sg-testo', 'Nella domanda 2 la risposta sul segmento VII mi sembra in contrasto con la spiegazione.');
  await p.click('#sg-invia'); await p.waitForTimeout(800); console.log('caso esito', await p.textContent('#sg-esito'));
  await p.waitForTimeout(2500);
  await p.goto(BASE + '/#/segnalazioni'); await p.waitForSelector('#sgl-lista .sgl-v', { timeout: 15000 }); await p.waitForTimeout(500);
  await p.screenshot({ path: D + 'segnala_admin.png', fullPage: false });
  console.log('admin voci', await p.$$eval('.sgl-v', (l) => l.length), 'menu', await p.$eval('#mg-segnalazioni', (x) => !x.hidden));
  await ctx.close(); }
{ const [ctx, p] = await pagina(false, 390, 844); await p.goto(BASE + '/'); await p.waitForTimeout(2500);
  await p.click('#btn-segnala'); await p.waitForSelector('#dlg-segnala[open]'); await p.waitForTimeout(300);
  await p.screenshot({ path: D + 'segnala_tel.png' });
  console.log('tel scroll', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  await ctx.close(); }
console.log('errori', JSON.stringify(err)); await b.close(); sim.kill();
