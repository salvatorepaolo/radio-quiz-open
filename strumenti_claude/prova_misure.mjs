// prova_misure.mjs: misure e ROI modificabili e cancellabili singolarmente; serie trascinata in un riquadro; client: aggiungi esame
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/', D = '/Volumes/Caloggero/_viste/dicom_prova/';
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
  const mis = () => p.evaluate(() => { const { V, P } = window.__dbg, q = P(); return (V.misure[`${q.sIdx}:${q.idx}`] || []).map((m) => JSON.stringify({ t: m.tipo, a: m.a && [Math.round(m.a.x), Math.round(m.a.y)], b: m.b && [Math.round(m.b.x), Math.round(m.b.y)] })); });
  const trascina = async (x0, y0, x1, y1) => { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200); };
  await p.keyboard.press('r'); await trascina(cx - 150, cy - 100, cx + 50, cy - 100);
  await p.keyboard.press('e'); await trascina(cx - 100, cy + 40, cx + 20, cy + 120);
  let m = await mis(); log('dopo il disegno', m); ok(m.length === 2, 'distanza e ROI disegnate');
  // estremo della linea trascinato
  await trascina(cx + 50, cy - 100, cx + 150, cy - 60); m = await mis(); log('estremo', m[0]); ok(m[0] !== JSON.parse(JSON.stringify(m[0])) || true, '');
  const lin = JSON.parse(m[0]); ok(lin.b && Math.abs(lin.b[0] - lin.a[0]) > 0, 'estremo spostato');
  // corpo della linea spostato
  const prima = m[0]; await trascina(cx - 50, cy - 90, cx - 50, cy - 20); m = await mis(); ok(m[0] !== prima, 'linea spostata trascinando il corpo: ' + m[0]);
  // angolo della ROI
  log('debug', JSON.stringify(await p.evaluate(([x, y]) => { const d = window.__dbg, g = d.geometriaDi(d.V.attivo), r = g.r, q = d.P(), m = d.V.misure[`${q.sIdx}:${q.idx}`][1], s = d.aSchermo(g, m.b); const h = d.misuraSotto(d.V.attivo, x - r.left, y - r.top); return { bSchermo: [r.left + s.x, r.top + s.y], mouse: [x, y], hit: h && { tipo: h.m.tipo, man: h.maniglia, canc: h.cancella }, sel: d.V.sel && d.V.sel.m.tipo, tool: d.V.tool }; }, [cx + 20, cy + 120])));
  const roiPrima = m[1]; await trascina(cx - 100, cy + 40, cx - 140, cy + 10); log('dopo angolo', JSON.stringify(await p.evaluate(() => { const d = window.__dbg; const el = document.elementFromPoint(590, 550); return { sopra: el && (el.id || el.className || el.tagName), sel: d.V.sel && d.V.sel.m.tipo, inCorso: d.V.inCorso && d.V.inCorso.tipo, tool: d.V.tool, mis: JSON.stringify(d.V.misure) }; }))); m = await mis(); ok(m[1] !== roiPrima, 'ROI ridimensionata dall\'angolo: ' + m[1]);
  await p.screenshot({ path: OUT + 'misure_selezione.png' });
  // ROI selezionata e cancellata con Canc
  await p.mouse.click(cx - 20, cy + 100); await p.waitForTimeout(150); await p.keyboard.press('Delete'); await p.waitForTimeout(200);
  m = await mis(); ok(m.length === 1 && /linea/.test(m[0]), 'Canc cancella solo la ROI selezionata');
  // linea selezionata e cancellata con la ×
  const lp = JSON.parse(m[0]);
  const sel = await p.evaluate(() => { const { V, P } = window.__dbg, q = P(), m = V.misure[`${q.sIdx}:${q.idx}`][0], d = window.__dbg, g = d.geometriaDi(d.V.attivo), s = d.aSchermo(g, { x: (m.a.x + m.b.x) / 2, y: (m.a.y + m.b.y) / 2 }); return { x: g.r.left + s.x, y: g.r.top + s.y }; });
  await p.mouse.click(sel.x, sel.y); await p.waitForTimeout(200);
  const xx = await p.evaluate(() => { const s = window.__dbg.V.sel, r = document.querySelector('#canvas').getBoundingClientRect(); return s?.x ? { x: r.left + s.x.x, y: r.top + s.x.y } : null; });
  ok(!!xx, 'misura selezionata con la ×');
  if (xx) { await p.mouse.click(xx.x, xx.y); await p.waitForTimeout(200); }
  m = await mis(); ok(m.length === 0, 'la × cancella la misura');
  // serie trascinata in un riquadro
  await p.goto(B + '/?prova#/caso/caso-tcia-018'); await p.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso.id === 'caso-tcia-018', null, { timeout: 40000 }); await p.waitForTimeout(1500);
  if ((await p.evaluate(() => window.__dbg.V.n)) < 2) { await p.selectOption('#riquadri', '2'); await p.waitForTimeout(1000); }
  const prima2 = await p.evaluate(() => window.__dbg.V.pannelli.slice(0, 2).map((q) => q.sIdx));
  const libero = await p.evaluate((x) => [0, 1, 2].find((i) => !x.includes(i)) ?? 2, prima2);
  const b2 = await p.locator('#canvas').boundingBox();
  await p.locator(`#lista-serie .s[data-i="${libero}"]`).dragTo(p.locator('#canvas'), { targetPosition: { x: b2.width * 0.75, y: b2.height / 2 } });
  await p.waitForTimeout(1500);
  const dopo2 = await p.evaluate(() => window.__dbg.V.pannelli.slice(0, 2).map((q) => q.sIdx));
  ok(dopo2[1] === libero && dopo2[0] === prima2[0], `serie ${libero} trascinata nel riquadro B: ${prima2} → ${dopo2}`);
  // client: aggiungi esame
  const c = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage(); c.on('pageerror', (e) => { err.push(e.message); log('PAGEERROR client', e.message); });
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', fs.readdirSync(D + 'ct_j2k').map((f) => D + 'ct_j2k/' + f));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await c.waitForTimeout(800);
  await c.evaluate(() => { window.__dbg.V.img = null; });
  await c.setInputFiles('#cl-aggiungi-file', [D + 'rx_testo.dcm', D + 'us_clip_mf.dcm']);
  await c.waitForFunction(() => window.__dbg?.V?.serie?.length >= 3 && window.__dbg.V.img, null, { timeout: 60000 }); await c.waitForTimeout(800);
  const s = await c.evaluate(() => ({ serie: window.__dbg.V.serie.map((x) => x.descrizione), tab: [...document.querySelectorAll('#tab-studi button')].map((b) => b.textContent), titolo: document.querySelector('#titolo-caso').textContent }));
  log('aggiungi', JSON.stringify(s)); ok(s.serie.length === 3 && s.tab.length >= 2, 'esame aggiunto: studi separati per il confronto');
  await c.screenshot({ path: OUT + 'client_aggiungi.png' });
  ok(!err.length, 'nessun errore JavaScript ' + err.join(' | '));
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
