// prova_en_client.mjs: il visualizzatore scaricabile in inglese con un esame aperto: testi e suggerimenti (title) rimasti
// in italiano nel 2D, nell'Aiuto sopra l'esame, nel referto e nell'MPR + 3D; messaggi della serie dal piano e della gomma
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19500 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let tot = 0;
const IT = /\b(della|delle|degli|dello|nella|nelle|sulla|sulle|dalla|alla|con il|per il|per la|non è|sono|questo|questa|anche|immagini|immagine|risposta|referto|serie|esame|clic|misura|misure|riquadro|vista|piano|tasto|trascina|scorri|apri|chiudi|salva|cancella|finestra|sinistr|destr|piccol|grande|rotellin|nuov[ao])\b/i;
const restoIT = (p, radice) => p.evaluate(([re, rad]) => {
  const IT = new RegExp(re, 'i'), out = new Set(), root = document.querySelector(rad) || document.body;
  const vis = (el) => el && (el.offsetParent || getComputedStyle(el).position === 'fixed') && !el.closest('textarea,[contenteditable="true"],#aiuto-corpo .esempio');
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.data.replace(/\s+/g, ' ').trim(); if (t.length > 3 && IT.test(t) && vis(n.parentElement)) out.add('testo: ' + t.slice(0, 140)); }
  for (const el of root.querySelectorAll('[title],[aria-label]')) { if (!vis(el)) continue; for (const a of ['title', 'aria-label']) { const t = el.getAttribute(a); if (t && t.length > 3 && IT.test(t)) out.add(a + ': ' + t.slice(0, 140)); } }
  return [...out];
}, [IT.source, radice]);
const mostra = (dove, l) => { tot += l.length; console.log(`== ${dove}: ${l.length ? l.length + ' testi in italiano' : 'tutto in inglese ✓'}`); for (const x of l.slice(0, 40)) console.log('   ' + x); };
try {
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie');
  const ctx = await b.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-lingua', 'en'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 }); await c.waitForTimeout(1500);
  console.log('lingua', await c.evaluate(() => document.documentElement.lang));
  mostra('client, pagina iniziale', await restoIT(c, 'body'));
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 180000 }); await c.waitForTimeout(3000);
  mostra('esame aperto, 2D (barra, serie, immagine)', await restoIT(c, 'body'));
  await c.click('#btn-aiuto'); await c.waitForTimeout(1200);
  mostra('Aiuto sopra l\'esame (intestazione e indice)', await restoIT(c, '#vista-aiuto .aiuto-testa'));
  const corpo = await restoIT(c, '#aiuto-corpo'); console.log(`   (corpo dell'Aiuto: ${corpo.length} frasi sospette)`); for (const x of corpo.slice(0, 10)) console.log('   ' + x);
  await c.keyboard.press('Escape'); await c.waitForTimeout(400);
  await c.click('#cl-referto'); await c.waitForTimeout(1500);
  mostra('referto', await restoIT(c, '#dlg-referto'));
  await c.click('#ref-chiudi').catch(() => {}); await c.waitForTimeout(500);
  await c.click('#modo-mpr'); await c.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await c.waitForTimeout(2500);
  mostra('MPR + 3D', await restoIT(c, 'body'));
  await c.click('[data-mpr-tool="gomma"]'); const r = await c.evaluate(() => { const e = document.querySelector('#vp-coronale').getBoundingClientRect(); return { x: e.x + 20, y: e.y + 20 }; });
  await c.mouse.click(r.x, r.y); await c.waitForTimeout(300);
  console.log('messaggio gomma:', await c.evaluate(() => [...document.querySelectorAll('.avviso-breve, #avviso-breve, .toast')].map((x) => x.textContent).join(' | ')));
  await c.click('[data-mpr-tool="scorri"]');
  await c.click('#mpr-obliqua');
  await c.waitForFunction(() => window.__dbg.V.pannelli[window.__dbg.V.attivo].piano === 'obliqua' && window.__dbg.V.img, null, { timeout: 120000 }); await c.waitForTimeout(800);
  console.log('messaggio serie:', await c.evaluate(() => [...document.querySelectorAll('.avviso-breve, #avviso-breve, .toast')].map((x) => x.textContent).join(' | ')));
  await c.screenshot({ path: '/Volumes/Caloggero/_viste/en_obliqua.png' });
  mostra('serie dal piano nel 2D', await restoIT(c, 'body'));
} catch (e) { console.log('ECCEZIONE', e.message); }
finally { console.log(errori.length ? 'ERRORI JS: ' + errori.join(' | ') : 'nessun errore JavaScript'); console.log('TOTALE testi in italiano:', tot); await b.close(); sim.kill(); }
