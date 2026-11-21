// diag_3d_live.mjs: sul sito vero, visualizzatore scaricabile con un esame TC dal disco: si apre «MPR + 3D»? (errori, tempi)
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const caso = process.argv[2] || 'caso-tcia-004', canale = process.argv[3] || '';
const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
giro(caso.startsWith('/') ? caso : `/Volumes/Caloggero/piattaforma-quiz/casi-free/${caso}/serie`);
const b = await chromium.launch(canale ? { channel: canale, headless: false } : {});
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
const c = await ctx.newPage(); const log = [];
c.on('pageerror', (e) => log.push('ERR ' + e.message + ' ' + (e.stack || '').split('\n')[1])); c.on('console', (m) => { if (/error|warn/.test(m.type())) log.push(m.type() + ' ' + m.text().slice(0, 300)); });
c.on('response', (r) => { if (r.status() >= 400) log.push(r.status() + ' ' + r.url()); });
try {
  await c.goto('https://radio-quiz.it/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 60000 });
  console.log('versione', await c.evaluate(() => fetch('/versione.json').then((r) => r.json())));
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => location.hash === '#/caso/locale' && !document.querySelector('#modo-mpr')?.hidden, null, { timeout: 120000 }); await c.waitForTimeout(2500);
  const t0 = Date.now(); await c.click('#modo-mpr');
  for (let k = 0; k < 30; k++) { await c.waitForTimeout(2000); const s = await c.evaluate(() => ({ att: !document.querySelector('#mpr')?.hidden, stato: document.querySelector('#mpr-stato')?.hidden ? '' : document.querySelector('#mpr-stato')?.innerText, canvas: document.querySelectorAll('#mpr canvas').length }));
    console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(s)); if (s.canvas >= 3 && !s.stato) break; }
  if (!process.env.NOFOTO) await c.screenshot({ path: '/Volumes/Caloggero/_viste/diag3d.png' });
  console.log('serie', await c.evaluate(() => [...document.querySelectorAll('#lista-serie .s')].map((b) => (b.classList.contains('on') ? '*' : '') + (b.querySelector('.s-nome')?.textContent || '') + ' ' + (b.querySelector('small')?.textContent || '')).join(' | ')));
} catch (e) { console.log('ECCEZIONE', e.message); }
console.log(log.slice(0, 20).join('\n')); await b.close();
