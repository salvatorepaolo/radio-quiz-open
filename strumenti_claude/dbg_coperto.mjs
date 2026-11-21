import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19950 + Math.floor(Math.random() * 40), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
try {
  for (const w of [1100, 1280, 1440]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 850 }, locale: 'it-IT' }); const p = await ctx.newPage();
    await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
    await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(1200);
    await p.evaluate(() => { const d = document.querySelector('#q-referto-box'); if (d) d.open = true; document.querySelector('#q-comunica')?.click(); });
    await p.waitForTimeout(500);
    const m = await p.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const x = e.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.right), Math.round(x.width)]; };
      return { scrollX: document.documentElement.scrollWidth - innerWidth, viewer: r('.caso>.viewer'), barra: r('.viewer>.barra-unica'), barraScroll: (() => { const e = document.querySelector('.viewer>.barra-unica'); return e.scrollWidth - e.clientWidth; })(), canvas: r('#canvas'), aside: r('.caso>aside.quiz'), grid: getComputedStyle(document.querySelector('.caso')).gridTemplateColumns }; });
    console.log(w, JSON.stringify(m));
    await p.screenshot({ path: `/Volumes/Caloggero/_viste/coperto_${w}.png` });
    await ctx.close();
  }
} catch (e) { console.log('ERR', e.message); } finally { await b.close(); sim.kill(); }
