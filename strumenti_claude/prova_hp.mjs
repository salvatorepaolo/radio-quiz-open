// prova_hp.mjs: disposizioni automatiche nel client (mammografia, TC multifasica, disposizione ricordata)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/hp_', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
try {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
  for (const [giro, caso] of ['caso-tcia-002', 'caso-tcia-004', 'caso-tcia-004'].entries()) {
    const c = await ctx.newPage(); c.on('pageerror', (e) => err.push(e.message));
    const avvisi = []; await c.exposeFunction('__avv', (t) => avvisi.push(t));
    await c.addInitScript(() => { new MutationObserver(() => { const a = document.querySelector('.avviso-breve, #avviso-breve'); if (a && a.textContent) window.__avv(a.textContent); }).observe(document, { subtree: true, childList: true, characterData: true }); });
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await c.setInputFiles('#cl-file', tutti(CASI + caso + '/serie'));
    await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(3500);
    const st = await c.evaluate(() => ({ n: window.__dbg.V.n, serie: window.__dbg.V.pannelli.slice(0, window.__dbg.V.n).map((q) => window.__dbg.V.serie[q.sIdx]?.descrizione) }));
    console.log(caso, JSON.stringify(st), '| avvisi:', [...new Set(avvisi)].join(' / '));
    await c.screenshot({ path: OUT + caso + '_' + Math.random().toString(36).slice(2, 5) + '.png' });
    if (giro === 1) {
      // cambio disposizione: 1 riquadro coronale, e la ricordo
      await c.evaluate(async () => { await window.__dbg.attiva(0); });
      await c.selectOption('#riquadri', '1').catch(() => {}); await c.waitForTimeout(800); await c.keyboard.press('c'); await c.waitForTimeout(1500);
      await c.click('#hp-ricorda'); await c.waitForTimeout(800);
      console.log('ricordata:', await c.locator('#hp-ricorda').innerText(), await c.evaluate(() => localStorage.getItem('rq-protocolli')?.slice(0, 200)));
    }
    await c.close();
  }
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
