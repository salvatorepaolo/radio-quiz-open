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
  const a = await (await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-014'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-014', null, { timeout: 60000 }); await a.waitForTimeout(4000);
  const foto = () => a.evaluate(() => {
    const bar = document.querySelector('#preset').closest('.barra-unica') || document.querySelector('#barra-2d'); const r = {};
    bar.querySelectorAll('*').forEach((e, i) => { if (e.offsetParent === null) return; const q = e.getBoundingClientRect(); r[(e.id || e.className || e.tagName) + '#' + i] = Math.round(q.width) + 'x' + Math.round(q.height) + '|' + (e.children.length ? '' : (e.textContent || e.value || '').trim().slice(0, 20)); });
    return { h: Math.round(bar.getBoundingClientRect().height), r };
  });
  const zone = await a.evaluate(() => { const v = [...document.querySelectorAll('canvas')].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 150 && r.height > 100);
    const u = []; v.forEach((r) => { if (!u.some((q) => Math.abs(q.x - r.x) < 20 && Math.abs(q.y - r.y) < 20)) u.push({ x: r.x, y: r.y, width: r.width, height: r.height }); }); return u.sort((p, q) => p.x - q.x); });
  await a.screenshot({ path: '/tmp/barra0.png', clip: { x: 0, y: 0, width: W, height: 330 } });
  for (let k = 0; k < 4; k++) { const z = [{ x: 20, y: 300, width: 460, height: 400 }, { x: 520, y: 300, width: 460, height: 400 }][k % 2]; await a.mouse.move(z.x + z.width / 2, z.y + z.height / 2); await a.mouse.wheel(0, 120); await a.waitForTimeout(300); await a.mouse.click(z.x + z.width / 2, z.y + z.height / 2); await a.waitForTimeout(400);
    const h = await a.evaluate(() => { let e = document.querySelector('#preset').parentElement; while (e && !(e.getBoundingClientRect().height > 0 && getComputedStyle(e).display !== 'contents' && e.classList.contains('grp') === false)) e = e.parentElement; return (e.id || e.className) + ' ' + Math.round(e.getBoundingClientRect().height); }); console.log('riquadri', zone.length, 'riquadro', k % 2, 'altezza barra', h);
    await a.screenshot({ path: `/tmp/barra${k + 1}.png`, clip: { x: 0, y: 0, width: W, height: 330 } }); }
} catch (e) { console.log('ERRORE', e); } finally { await b.close(); sim.kill(); }
