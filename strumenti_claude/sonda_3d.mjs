// sonda_3d.mjs: preset del 3D, ritaglio, contrasto, punto centrale (foto in _viste/3d_*.png)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19900 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ headless: !process.env.VEDI, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] }); const errori = [];
const caso = process.argv[2] || 'caso-tcia-118', voci = (process.argv[3] || 'QR-vascular,QR-angiography,QR-angio-ossa,CT-Bone,CT-Soft-Tissue,CT-Chest-Vessels,CT-Lung').split(',');
const attendi = (a) => a.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 180000 });
try {
  const a = await (await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' })).newPage();
  a.on('pageerror', (e) => errori.push(e.message)); a.on('console', (m) => { if (m.type() === 'error') errori.push('console: ' + m.text().slice(0, 200)); });
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + `/?prova#/caso/${caso}`); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await a.waitForTimeout(1000);
  await a.click('#modo-mpr'); await a.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#mpr-stato').hidden && document.querySelector('#vp-assiale canvas'), null, { timeout: 180000 });
  await a.waitForTimeout(1500);
  console.log('menu', await a.evaluate(() => [...document.querySelectorAll('#mpr-preset option')].map((o) => o.value + '=' + o.textContent).join(' | ')));
  console.log('centri', await a.evaluate(() => [...document.querySelectorAll('.mpr-centro')].map((d) => !d.hidden + ' ' + d.style.left + ',' + d.style.top).join(' ; ')));
  for (const v of voci) {
    const t0 = Date.now(); await a.selectOption('#mpr-preset', v); await a.waitForTimeout(500); await attendi(a); await a.waitForTimeout(1500);
    const st = await a.evaluate(() => ({ grande: [...document.querySelectorAll('.mpr-cella.grande .mpr-vp')].map((x) => x.id)[0], info: document.querySelector('#mpr-info').textContent }));
    console.log(v, Math.round((Date.now() - t0) / 1000) + 's', JSON.stringify(st));
    await a.screenshot({ path: `/Volumes/Caloggero/_viste/3d_${caso}_${v}.png`, clip: { x: 0, y: 120, width: 1500, height: 830 } });
  }
  // contrasto: tasto destro trascinato verso il basso sul 3D
  const r3 = await (await a.$('#vp-3d')).boundingBox();
  await a.mouse.move(r3.x + r3.width / 2, r3.y + r3.height / 2); await a.mouse.down({ button: 'right' }); await a.mouse.move(r3.x + r3.width / 2, r3.y + r3.height / 2 + 120, { steps: 6 }); await a.mouse.up({ button: 'right' });
  await a.waitForTimeout(800); console.log('contrasto', JSON.stringify(await a.evaluate(() => window.__dbg.MPR.modulo.statoContrasto3d())));
  await a.screenshot({ path: `/Volumes/Caloggero/_viste/3d_${caso}_contrasto.png`, clip: { x: 0, y: 120, width: 1500, height: 830 } });
  // ritaglio: un rettangolo nella metà sinistra del 3D
  await a.click('#mpr-taglio'); await a.waitForTimeout(300);
  const cx = r3.x + r3.width * 0.3, cy = r3.y + r3.height * 0.5;
  await a.mouse.move(cx - 80, cy - 150); await a.mouse.down(); for (const [dx, dy] of [[80, -150], [80, 150], [-80, 150], [-80, -150]]) await a.mouse.move(cx + dx, cy + dy, { steps: 8 }); await a.mouse.up();
  await a.waitForTimeout(500); await attendi(a); await a.waitForTimeout(1200);
  console.log('tagli', await a.evaluate(() => window.__dbg.MPR.modulo.numeroTagli()), 'annulla attivo', await a.evaluate(() => !document.querySelector('#mpr-taglio-annulla').disabled));
  await a.screenshot({ path: `/Volumes/Caloggero/_viste/3d_${caso}_ritaglio.png`, clip: { x: 0, y: 120, width: 1500, height: 830 } });
  await a.click('#mpr-taglio-annulla'); await attendi(a); console.log('dopo annulla', await a.evaluate(() => window.__dbg.MPR.modulo.numeroTagli()));
  // punto centrale: trascina quello della vista assiale
  await a.selectOption('#mpr-preset', 'mpr'); await a.waitForTimeout(800);
  const dot = await a.$('#vp-assiale .mpr-centro'); const bb = await dot.boundingBox(); const c0 = await a.evaluate(() => window.__dbg.MPR.modulo._stato?.() || null);
  await a.mouse.move(bb.x + 7, bb.y + 7); await a.mouse.down(); await a.mouse.move(bb.x + 60, bb.y + 40, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(600);
  const bb2 = await (await a.$('#vp-assiale .mpr-centro')).boundingBox();
  console.log('centro spostato', JSON.stringify({ prima: [bb.x, bb.y].map(Math.round), dopo: [bb2.x, bb2.y].map(Math.round) }));
  await a.screenshot({ path: `/Volumes/Caloggero/_viste/3d_${caso}_centro.png`, clip: { x: 0, y: 120, width: 1500, height: 830 } });
} catch (e) { console.log('eccezione', e.message); }
finally { console.log('errori', errori.slice(0, 6)); await b.close(); sim.kill(); }
