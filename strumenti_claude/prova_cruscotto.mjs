// prova_cruscotto.mjs: cruscotto dell'amministratore e del docente (simulatore): si apre, numeri e «Da fare», niente errori JS
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23481, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(), errori = []; let ok = 0, ko = 0;
const esito = (c, t) => { console.log(`${c ? 'OK' : 'KO'}  ${t}`); c ? ok++ : ko++; };
async function entra(codice, w = 1300) {
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: w, height: 900 } }), p = await ctx.newPage();
  p.on('pageerror', (e) => errori.push(e.message));
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 }); return p;
}
const a = await entra('admin-test-0000');
esito(await a.locator('#mg-cruscotto').count() === 1 && !(await a.$eval('#mg-cruscotto', (x) => x.hidden)), 'voce «Cruscotto» nel menu Gestione dell\'amministratore');
await a.goto(B + '/?prova#/cruscotto'); await a.waitForSelector('#vista-cruscotto:not([hidden]) .tr-tiles', { timeout: 20000 });
esito(/amministratore/.test(await a.textContent('#cr-titolo')), 'titolo dell\'amministratore');
esito((await a.locator('#cr-corpo .tr-tile').count()) >= 6, 'sei riquadri con i numeri');
esito(await a.locator('#cr-corpo .cr-da-fare').count() === 1, 'sezione «Da fare»');
await a.screenshot({ path: '/tmp/cruscotto_admin.png', fullPage: true });
// un docente con codice personale (solo nel simulatore)
const cod = await a.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Docente di prova', ruolo: 'docente' }) })).json()).codice);
esito(!!cod, 'docente di prova creato nel simulatore');
const d = await entra(cod, 390);
await d.goto(B + '/?prova#/cruscotto'); await d.waitForSelector('#vista-cruscotto:not([hidden]) .tr-tiles', { timeout: 20000 });
esito(/docente/.test(await d.textContent('#cr-titolo')), 'titolo del docente');
esito(!(await d.textContent('#cr-corpo')).includes('soglia gratuita'), 'il docente non vede i consumi dei server');
esito(await d.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'telefono: niente scorrimento orizzontale');
await d.screenshot({ path: '/tmp/cruscotto_docente.png', fullPage: true });
await d.click('#cr-corpo a.cr-tile[href="#/analisi/referti"]'); await d.waitForSelector('#vista-analisi:not([hidden])', { timeout: 15000 });
esito(await d.$eval('[data-scheda="referti"]', (x) => x.classList.contains('on')), 'dal riquadro dei referti si apre la scheda «Referti» dell\'analisi');
esito(!errori.length, 'nessun errore JavaScript' + (errori.length ? ': ' + errori.join(' | ') : ''));
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`); await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
