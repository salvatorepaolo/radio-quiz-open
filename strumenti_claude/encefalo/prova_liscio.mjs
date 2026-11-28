// Schermate dell'atlante sovrapposto (ingrandito) per confrontare il disegno: node prova_liscio.mjs <prefisso> caso...
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const CL = '/Volumes/Caloggero/piattaforma-quiz/cloud', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(CL + '/test/package.json')('playwright');
const P = 8941, sim = spawn(process.execPath, [CL + '/test/simulatore.mjs'], { cwd: CL, env: { ...process.env, PORTA: String(P), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const B = `http://localhost:${P}`, [pref, ...casi] = process.argv.slice(2), err = [];
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] });
try {
  for (const id of casi) {
    const p = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })).newPage();
    p.on('pageerror', (e) => err.push(e.message));
    await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
    await p.waitForSelector('#vista-elenco:not([hidden])'); await p.goto(B + '/?prova#/caso/' + id); await p.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 60000 }); await p.waitForTimeout(3000);
    await p.click('#btn-atlante'); await p.waitForTimeout(1500);
    if (await p.$('#atl-avvia')) await p.click('#atl-avvia');
    await p.waitForSelector('#atl-pannello .atl-qual', { timeout: 300000 });
    await p.click('#atl-chiudi');
    const bb = await p.evaluate(() => { const c = [...document.querySelectorAll('canvas')].map((x) => x.getBoundingClientRect()).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: c.x, y: c.y, width: c.width, height: c.height }; });
    // al centro dell'encefalo: immagine a metà serie, ingrandita con la rotella
    await p.mouse.move(bb.x + bb.width * 0.25, bb.y + bb.height * 0.45);
    for (let i = 0; i < 6; i++) { await p.keyboard.down('Control'); await p.mouse.wheel(0, -200); await p.keyboard.up('Control'); await p.waitForTimeout(150); }
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `/tmp/${pref}_${id}.png`, clip: bb });
    const ms = await p.evaluate(() => { const D = window.__dbg, A = window.__atl, q = D.P(0), d = A.atlanteDi(q.sIdx); if (!d || !window.__etL) return null;
      const t0 = performance.now(); for (let i = 0; i < 3; i++) window.__etL(d, q.img, 3 + 0 * i, true); return Math.round((performance.now() - t0) / 3); }).catch(() => null);
    console.log('ok', id, 'ms per immagine (f=3, senza cache):', ms);
    await p.context().close();
  }
} finally { console.log('errori JS:', err.length ? err.join(' | ') : 'nessuno'); await b.close(); sim.kill(); }
