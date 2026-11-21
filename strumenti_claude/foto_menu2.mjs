// foto_menu2.mjs: fotografie dei menù e delle pagine di gestione (simulatore, amministratore)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19900 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const OUT = process.env.OUT || '/Volumes/Caloggero/_viste/menu'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
try {
  const a = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT', deviceScaleFactor: 1 })).newPage();
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.waitForTimeout(1200);
  // menu Gestione aperto
  await a.evaluate(() => { document.querySelector('#menu-gestione').open = true; }); await a.waitForTimeout(300);
  await a.screenshot({ path: `${OUT}/00_gestione.png` });
  await a.evaluate(() => { document.querySelector('#menu-gestione').open = false; });
  for (const [n, h] of (process.env.SOLO_CASO ? [] : [['01_account', '#/account'], ['02_casi', '#/gestione-casi'], ['03_revisione', '#/revisione'], ['04_classi', '#/classi'], ['05_percorsi', '#/percorsi'], ['06_studenti', '#/analisi/persone'], ['07_analisi', '#/analisi'], ['08_statistiche', '#/statistiche'], ['09_sponsor', '#/sponsor'], ['10_tenant', '#/tenant'], ['11_nuovo', '#/nuovo']])) {
    await a.goto(B + '/?prova' + h); await a.waitForTimeout(2500);
    await a.screenshot({ path: `${OUT}/${n}.png`, fullPage: false });
  }
  if (process.env.SOLO !== '1') {
    // menu ⋯ del visualizzatore e menu del referto in un caso
    await a.goto(B + '/?prova#/caso/caso-tcia-001'); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await a.waitForTimeout(1500);
    await a.screenshot({ path: `${OUT}/20_caso.png` });
    const n = await a.evaluate(() => [...document.querySelectorAll('#barra-2d details, #vista-caso details.cl-altro, header details')].filter((d) => d.offsetParent).length);
    for (let i = 0; i < n; i++) {
      const info = await a.evaluate((i) => { const l = [...document.querySelectorAll('#barra-2d details, #vista-caso details.cl-altro, header details')].filter((d) => d.offsetParent); l.forEach((d) => d.open = false); const d = l[i]; d.open = true; return d.id || d.className || d.querySelector('summary')?.title?.slice(0, 30); }, i);
      await a.waitForTimeout(300); await a.screenshot({ path: `${OUT}/2${i + 1}_menu.png` }); console.log(i, info);
    }
  }
} catch (e) { console.log('ERRORE', e); } finally { await b.close(); sim.kill(); console.log('FINE'); process.exit(0); }
