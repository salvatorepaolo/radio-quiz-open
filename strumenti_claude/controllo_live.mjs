// controllo_live.mjs: dopo ogni pubblicazione controlla il sito vero (radio-quiz.it) come lo vede un utente:
// pagine, file della lingua, accesso, apertura di un caso con le immagini, visualizzatore client. Esce con 1 se qualcosa non va
// e scrive l'elenco dei problemi in /tmp/controllo_live.txt (pubblica_vetrina.sh lo manda per email).
import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const B = process.env.SITO || 'https://radio-quiz.it';
const codice = (fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/.segreti', 'utf8').match(/^CODICE_AMMINISTRATORE="(.*)"/m) || [])[1];
const problemi = [];
const ok = async (u) => { try { const r = await fetch(B + u, { cache: 'no-store' }); if (!r.ok) problemi.push(`${u}: HTTP ${r.status}`); return r; } catch (e) { problemi.push(`${u}: ${e.message}`); } };
const v = await (await ok('/versione.json'))?.json().catch(() => null);
for (const u of ['/', '/app.js', '/style.css', '/i18n.js', '/lingua/en.json', '/lingua/casi/_titoli.json', '/manuale-client.html', '/licenze.html', '/api/istanza']) await ok(u);
const b = await chromium.launch();
const segui = (p, dove) => {
  p.on('pageerror', (e) => problemi.push(`[${dove}] errore JavaScript: ${e.message}`));
  p.on('response', (r) => { if (r.status() >= 500) problemi.push(`[${dove}] ${r.status()} ${r.url().replace(B, '')}`); });
};
try {
  // pagina di accesso, in italiano e in inglese
  for (const [loc, atteso] of [['it-IT', /Accedi|Entra|codice/i], ['en-US', /Sign in|Log in|code/i]]) {
    const ctx = await b.newContext({ locale: loc }); const p = await ctx.newPage(); segui(p, 'accesso ' + loc);
    await p.goto(B + '/', { waitUntil: 'load', timeout: 45000 }); await p.waitForTimeout(2500);
    const t = await p.evaluate(() => document.body.innerText);
    if (!atteso.test(t)) problemi.push(`[accesso ${loc}] la pagina non mostra il testo atteso`);
    await ctx.close();
  }
  // accesso e apertura di un caso con le immagini
  if (codice) {
    const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } }); const p = await ctx.newPage(); segui(p, 'caso');
    await p.goto(B + '/#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter');
    await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 30000 }).catch(() => problemi.push('[accesso] la home non si apre dopo l\'accesso'));
    await p.waitForTimeout(3000); const n = await p.evaluate(() => fetch('/api/casi').then((r) => r.json()).then((l) => l.filter((c) => c.visibile !== false).length).catch(() => 0)); if (n < 50) problemi.push(`[home] solo ${n} casi visibili nell'elenco`);
    await p.goto(B + '/#/caso/caso-tcia-001'); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 }).catch(() => problemi.push('[caso] il caso non si apre'));
    await p.waitForTimeout(6000);
    const pix = await p.evaluate(() => { const c = document.querySelector('#vista-caso canvas'); if (!c || !c.width) return 0; const g = c.getContext('2d'); if (!g) return 1; const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4000) s += d[i]; return s; });
    if (!pix) problemi.push('[caso] le immagini del caso non si vedono');
    await ctx.close();
  } else problemi.push('codice amministratore non trovato in .segreti: accesso non controllato');
  // visualizzatore client
  { const ctx = await b.newContext({ locale: 'it-IT' }); const p = await ctx.newPage(); segui(p, 'client');
    await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 60000 }).catch(async () => problemi.push('[client] la pagina del visualizzatore non si apre: ' + (await p.evaluate(() => document.body.innerText.slice(0, 200)).catch(() => ''))));
    await ctx.close(); }
} catch (e) { problemi.push('controllo interrotto: ' + e.message); }
await b.close();
const testo = `Controllo di ${B} dopo la pubblicazione ${v?.versione || '?'} (${new Date().toLocaleString('it-IT')}):\n` + (problemi.length ? [...new Set(problemi)].map((x) => '- ' + x).join('\n') : 'tutto a posto.');
fs.writeFileSync('/tmp/controllo_live.txt', testo + '\n'); console.log(testo);
process.exit(problemi.length ? 1 : 0);
