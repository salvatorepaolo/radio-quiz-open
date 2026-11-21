// sonda_barra.mjs: quale elemento della barra cambia larghezza mentre si scorrono le immagini (caso 014, viewport 2000x900)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19350 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch();
const W = +(process.env.LARG || 1000);
try {
  const a = await (await b.newContext({ viewport: { width: W, height: 450 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-014'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-014', null, { timeout: 60000 }); await a.waitForTimeout(4000);
  const foto = () => a.evaluate(() => {
    const bar = document.querySelector('#barra-2d'); const r = {};
    bar.querySelectorAll('*').forEach((e, i) => { if (e.offsetParent === null) return; const q = e.getBoundingClientRect(); r[(e.id || e.className || e.tagName) + '#' + i] = Math.round(q.width) + 'x' + Math.round(q.height) + '|' + (e.children.length ? '' : (e.textContent || e.value || '').trim().slice(0, 20)); });
    return { h: Math.round(bar.getBoundingClientRect().height), r };
  });
  const p0 = await foto(); console.log('altezza iniziale', p0.h);
  // pannello B (TC): scorri
  const c = await a.$$('canvas'); const box = await (c[1] || c[0]).boundingBox();
  await a.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2);
  for (let k = 0; k < 25; k++) {
    await a.mouse.wheel(0, 120); await a.waitForTimeout(120);
    const p = await foto();
    const diff = Object.keys(p.r).filter((x) => p.r[x] !== p0.r[x]).map((x) => `${x}: ${p0.r[x]} → ${p.r[x]}`);
    if (p.h !== p0.h || diff.length) { console.log(`passo ${k} altezza ${p.h}`); diff.slice(0, 12).forEach((d) => console.log('  ', d)); }
  }
} catch (e) { console.log('ERRORE', e); } finally { await b.close(); sim.kill(); }
