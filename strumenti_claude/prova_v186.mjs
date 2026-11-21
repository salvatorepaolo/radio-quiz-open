// annulla/ripeti, istogramma a richiesta, confronto automatico, finestre e tasti personali
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ok = (c, m) => log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok_) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok_(); }));
const browser = await chromium.launch();
try {
  const p = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); const err = [];
  p.on('pageerror', (e) => { err.push(e.message); log('PAGEERROR', e.message); });
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])');
  await p.goto(B + '/?prova#/caso/caso-tcia-119'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 40000 }); await p.waitForTimeout(1500);
  const box = await p.locator('#canvas').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const n = () => p.evaluate(() => Object.values(window.__dbg.V.misure).flat().length);
  const trascina = async (x0, y0, x1, y1) => { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200); };
  await p.keyboard.press('r'); await trascina(cx - 150, cy - 100, cx + 50, cy - 100);
  await p.keyboard.press('e'); await trascina(cx - 100, cy + 40, cx + 20, cy + 120);
  ok(await n() === 2, 'due misure');
  ok(await p.locator('#grafico').isHidden() && await p.locator('#grafico-chip').isVisible(), 'istogramma chiuso, etichetta visibile: ' + await p.locator('#grafico-chip').innerText());
  await p.click('#grafico-chip'); await p.waitForTimeout(300); ok(await p.locator('#grafico').isVisible(), 'istogramma aperto a richiesta');
  await p.click('#grafico-chiudi'); await p.waitForTimeout(200); ok(await p.locator('#grafico').isHidden(), 'istogramma richiuso');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(200); ok(await n() === 1, 'Ctrl+Z annulla la ROI');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200); ok(await n() === 2, 'Ctrl+Maiusc+Z la ripete');
  await p.mouse.click(cx - 20, cy + 100); await p.keyboard.press('Delete'); await p.waitForTimeout(200); ok(await n() === 1, 'cancellata');
  await p.click('#btn-annulla'); await p.waitForTimeout(200); ok(await n() === 2, 'pulsante annulla: ROI tornata');
  // finestre personali
  await p.selectOption('#preset', 'personalizza'); await p.waitForSelector('#dlg-pers[open]');
  await p.fill('[data-f="8"][data-c="n"]', 'Mia finestra'); await p.fill('[data-f="8"][data-c="c"]', '123'); await p.fill('[data-f="8"][data-c="w"]', '456');
  await p.fill('[data-t="misura"]', 'd'); await p.click('#pers-salva'); await p.waitForTimeout(300);
  await p.keyboard.press('8'); await p.waitForTimeout(200);
  const w = await p.evaluate(() => [window.__dbg.V.wc, window.__dbg.V.ww]); ok(w[0] === 123 && w[1] === 456, 'tasto 8 = finestra personale ' + w);
  await p.keyboard.press('d'); await p.waitForTimeout(100); ok(await p.evaluate(() => window.__dbg.V.tool) === 'misura', 'tasto D = distanza (personale)');
  ok(await p.evaluate(() => [...document.querySelectorAll('#preset option')].some((o) => /Mia finestra/.test(o.textContent))), '«Le mie finestre» nel menu');
  await p.reload(); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 40000 }); await p.waitForTimeout(800);
  await p.keyboard.press('8'); await p.waitForTimeout(200); ok((await p.evaluate(() => window.__dbg.V.wc)) === 123, 'preferenze ritrovate dopo il ricaricamento');
  // confronto automatico: caso con precedenti (NLST)
  for (const id of ['caso-tcia-110', 'caso-tcia-111']) {
    await p.goto(B + `/?prova#/caso/${id}`); await p.waitForFunction((id) => window.__dbg?.V?.img && window.__dbg.V.caso.id === id, id, { timeout: 40000 }); await p.waitForTimeout(3500);
    const s = await p.evaluate(() => { const { V } = window.__dbg; return { n: V.n, studi: V.studi.length, pan: V.pannelli.slice(0, V.n).map((q) => (V.serie[q.sIdx]?.descrizione || '').slice(0, 50) + ' @' + q.idx) }; });
    log(id, JSON.stringify(s)); ok(s.studi < 2 || (s.n === 2 && s.pan[0] !== s.pan[1]), `${id}: attuale e precedente affiancati`);
    await p.screenshot({ path: OUT + `confronto_${id}.png` });
  }
  ok(!err.length, 'nessun errore JavaScript ' + err.join(' | '));
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
