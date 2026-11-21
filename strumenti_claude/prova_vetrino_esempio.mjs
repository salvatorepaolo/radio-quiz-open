// prova_vetrino_esempio.mjs: nel visualizzatore client il pulsante «🔬 Prova con un vetrino di esempio» scarica
// /esempi/vetrino-esempio.zip, apre la vista del vetrino con il tessuto visibile, e offre panoramica ed etichetta.
// Uso: node prova_vetrino_esempio.mjs   (BROWSER=webkit|firefox)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || (19440 + Math.floor(Math.random() * 20)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
try {
  for (const loc of ['it-IT', 'en-US']) {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: loc });
    await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
    const c = await ctx.newPage(), errori = [], fuori = [], prima = [];
    c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
    c.on('request', (r) => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) fuori.push(r.url()); if (/vetrino-esempio/.test(r.url())) prima.push(r.url()); });
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await c.waitForTimeout(1500);
    esito(!prima.length, `[${loc}] il vetrino di esempio non si scarica da solo`);
    const testo = await c.textContent('#cl-esempio-vetrino');
    esito(loc === 'it-IT' ? /vetrino di esempio/.test(testo) : /sample slide/i.test(testo), `[${loc}] pulsante tradotto`, testo.trim());
    if (loc !== 'it-IT') { await ctx.close(); continue; }
    const t0 = Date.now(); await c.click('#cl-esempio-vetrino');
    const aperto = await c.waitForFunction(() => !document.querySelector('#vista-vetrino')?.hidden && window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 120000 }).then(() => true, () => false);
    esito(aperto, 'il vetrino di esempio si apre', `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (aperto) {
      await c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).catch(() => {});
      await c.waitForTimeout(800);
      const col = await c.evaluate(() => { const cv = document.querySelector('.vt-osd canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, t = 0; for (let i = 0; i < d.length; i += 40) { t++; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 25) n++; } return n / t; });
      esito(col > 0.02, 'tessuto colorato visibile', (col * 100).toFixed(1) + '%');
      const info = await c.evaluate(() => ({ testo: document.querySelector('#vista-vetrino')?.innerText || '', sp: window.__dbg.VT.sp }));
      esito(Math.abs(info.sp - 0.25) < 0.03, 'calibrazione ≈ 0,25 µm/pixel (40×)', info.sp);
      for (const [nome, re] of [['Panoramica', /Panoramica/], ['Etichetta', /Etichetta/]]) {
        const btn = c.locator('#vista-vetrino button', { hasText: re }).first();
        if (!(await btn.count())) { esito(false, `pulsante ${nome}`); continue; }
        await btn.click(); const img = await c.waitForSelector('.vt-dlg .vt-img, .vt-dlg canvas, .vt-dlg img', { timeout: 15000 }).then(() => true, () => false);
        esito(img, `${nome}: l'immagine si apre`);
        await c.keyboard.press('Escape'); await c.waitForTimeout(300);
      }
    }
    esito(!fuori.length, 'nessuna richiesta fuori dal computer', fuori.slice(0, 2).join(' '));
    esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 2).join(' | '));
    await ctx.close();
  }
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`); process.exit(ko ? 1 : 0);
