// prova_v191.mjs: home (sezioni per metodica) ed esportazione anonima con testo impresso annerito
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const ok = (c, m) => console.log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
try {
  for (const [tema, w] of [['chiaro', 1300], ['scuro', 1300], ['chiaro', 390]]) {
    const h = await b.newPage({ viewport: { width: w, height: 900 } }); h.on('pageerror', (e) => err.push(e.message));
    await h.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
    await h.goto(B + '/?prova#/'); await h.click('[data-vai="codice"]'); await h.fill('#codice', 'admin-test-0000'); await h.press('#codice', 'Enter');
    await h.waitForSelector('#vista-elenco:not([hidden]) .home-hero'); await h.waitForTimeout(800);
    await h.click('details.met-rx > summary'); await h.waitForTimeout(400);
    await h.evaluate(() => document.querySelector('.barra-elenco').scrollIntoView());
    await h.screenshot({ path: OUT + `home2_${tema}_${w}.png` });
    console.log(tema, w, 'largo', await h.evaluate(() => document.documentElement.scrollWidth - innerWidth)); await h.close();
  }
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const c = await ctx.newPage(); c.on('pageerror', (e) => err.push('client: ' + e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', ['/Volumes/Caloggero/_viste/dicom_prova/rx_testo.dcm']);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await c.waitForTimeout(1200);
  await c.screenshot({ path: OUT + 'anon_prima.png' });
  for (const f of ['png', 'jpeg']) {
    await c.click('#cl-esporta'); await c.check('input[name="ex-cosa"][value="png"]'); await c.selectOption('#ex-formato', f);
    const [dl] = await Promise.all([c.waitForEvent('download'), c.click('#ex-vai')]);
    const file = OUT + 'anon_' + dl.suggestedFilename(); await dl.saveAs(file);
    const msg = await c.locator('#ex-stato').innerText(); console.log(f, dl.suggestedFilename(), msg); ok(/annerit/.test(msg), 'testo impresso annerito (' + f + ')');
    await c.click('#ex-chiudi');
  }
  // anteprima del file esportato
  const v = await b.newPage(); await v.setContent(`<body style="margin:0;background:#333"><img src="data:image/png;base64,${fs.readFileSync(fs.readdirSync(OUT).filter((x) => /^anon_.*\.png$/.test(x)).map((x) => OUT + x)[0]).toString('base64')}" style="max-width:900px"></body>`);
  await v.screenshot({ path: OUT + 'anon_dopo.png', fullPage: true });
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
