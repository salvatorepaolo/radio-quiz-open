// foto_aspetto.mjs: fotografie delle schermate principali sul simulatore locale, per giudicare l'aspetto (1.269):
// pagina iniziale (computer e telefono), home dello studente dopo un caso svolto, caso con la correzione, tema scuro.
// Uso: node foto_aspetto.mjs <cartella>
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', OUT = process.argv[2] || '/tmp/aspetto';
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19650 + Math.floor(Math.random() * 40)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
const nuova = async (opz = {}) => { const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', ...opz }); const p = await ctx.newPage(); p.on('pageerror', (e) => console.log('  errore JS:', e.message)); return p; };
const entra = async (p) => { await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 }); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 }); };
const foto = async (p, nome, full = false) => { await p.waitForTimeout(1200); await p.screenshot({ path: path.join(OUT, nome + '.png'), fullPage: full }); console.log('foto', nome); };
try {
  let p = await nuova(); await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]'); await foto(p, '1-home', true);
  p = await nuova({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]'); await foto(p, '2-home-telefono'); await foto(p, '2b-home-telefono-intera', true);
  p = await nuova(); await entra(p);
  const casi = await (await p.request.get(B + '/api/casi')).json(), c = casi.find((x) => x.visibile !== false && /TC/.test(x.modalita || '')) || casi[0];
  await p.goto(B + `#/caso/${c.id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 }); await p.waitForTimeout(2500);
  await p.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  for (let k = 0; k < 15; k++) {
    const scelta = p.locator('#q-form .sezione:not([hidden]) .opz input').first();
    if (await scelta.count() && !(await scelta.isChecked())) { await scelta.check({ force: true }); await p.locator('#q-form .sezione:not([hidden]) .opz button[data-conf]').first().click({ force: true }).catch(() => {}); }
    await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
    await p.waitForTimeout(250);
    if (await p.locator('#btn-conferma').isVisible()) { await p.locator('#btn-conferma').evaluate((e) => e.click()); break; }
    const av = p.locator('#q-succ:not([hidden])'); if (await av.count()) await av.evaluate((e) => e.click()); else break;
  }
  await p.waitForSelector('#q-esito:not([hidden])', { timeout: 20000 }).catch(() => {}); await p.evaluate(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close(); });
  await foto(p, '3-caso-correzione');
  await p.evaluate(() => { const q = document.querySelector('#q-esito'); q?.scrollIntoView(); });
  await foto(p, '3b-caso-correzione-esito');
  await p.goto(B + '#/'); await p.waitForSelector('#vista-elenco:not([hidden])'); await foto(p, '4-home-studente', true);
  await p.evaluate(() => document.documentElement.setAttribute('data-tema', 'scuro')); await foto(p, '5-home-scuro');
  p = await nuova({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await entra(p); await foto(p, '6-home-studente-telefono');
  await p.goto(B + `#/caso/${c.id}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 }); await p.waitForTimeout(3000); await foto(p, '7-caso-telefono');
} finally { await b.close(); sim.kill(); }
