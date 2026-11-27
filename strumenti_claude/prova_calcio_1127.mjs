// prova_calcio_1127.mjs: test approfonditi della regola delle calcificazioni nel 3D (vecchio contro nuovo)
// uso: node prova_calcio_1127.mjs caso1,caso2,...   → righe JSON in stdout, foto in _viste/pc_<caso>_<preset>_<v|n>.jpg
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19900 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const casi = process.argv[2].split(','), FOTO = process.env.FOTO !== '0';
const attendi = (a) => a.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 240000 });
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' });
const a = await ctx.newPage(); const errori = [];
a.on('pageerror', (e) => errori.push(e.message));
await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
const scegli = async (v, calcio, osso = false) => {
  await a.evaluate((c) => window.__dbg.MPR.modulo._opzioniVasi({ calcio: c }), calcio);
  await a.selectOption('#mpr-preset', 'mpr'); await a.waitForTimeout(250);
  await a.evaluate((o) => { const c = document.querySelector('#vr-osso'); if (c) c.checked = o; }, osso);
  const t0 = Date.now(); await a.selectOption('#mpr-preset', v); await a.waitForTimeout(400); await attendi(a); await a.waitForTimeout(900);
  return Date.now() - t0;
};
for (const caso of casi) {
  const riga = { caso }; errori.length = 0;
  try {
    await a.goto(B + `/?prova#/caso/${caso}`); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 90000 }); await a.waitForTimeout(600);
    await a.click('#modo-mpr'); await a.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#mpr-stato').hidden && document.querySelector('#vp-assiale canvas'), null, { timeout: 240000 });
    await a.waitForTimeout(800);
    riga.hu = await a.evaluate(() => window.__dbg.MPR.modulo.unita?.());
    // Vascular: vecchio, poi nuovo, confronto delle maschere
    riga.tVecchio = await scegli('QR-vascular', false);
    riga.infoVecchio = await a.evaluate(() => document.querySelector('#mpr-info').textContent);
    await a.evaluate(() => window.__dbg.MPR.modulo._salvaVasi());
    if (FOTO) await a.screenshot({ path: `/Volumes/Caloggero/_viste/pc_${caso}_vasc_v.jpg`, quality: 80, clip: { x: 0, y: 120, width: 1500, height: 830 } });
    riga.tNuovo = await scegli('QR-vascular', true);
    riga.info = await a.evaluate(() => document.querySelector('#mpr-info').textContent);
    riga.diag = await a.evaluate(() => window.__dbg.MPR.modulo._diagnosiCalcio());
    riga.confronto = await a.evaluate(() => window.__dbg.MPR.modulo._confrontoVasi());
    const url = await a.evaluate(() => window.__dbg.MPR.modulo._mappaConfronto?.());
    if (url) (await import('node:fs')).writeFileSync(`/Volumes/Caloggero/_viste/pc_${caso}_mappa.png`, Buffer.from(url.split(',')[1], 'base64'));
    if (FOTO) await a.screenshot({ path: `/Volumes/Caloggero/_viste/pc_${caso}_vasc_n.jpg`, quality: 80, clip: { x: 0, y: 120, width: 1500, height: 830 } });
    // Angiography (MIP) e Angio + ossa, e «togli l'osso» con il preset standard: devono funzionare senza errori
    riga.tMip = await scegli('QR-angiography', true);
    riga.tAngioOssa = await scegli('QR-angio-ossa', true);
    if (FOTO) await a.screenshot({ path: `/Volumes/Caloggero/_viste/pc_${caso}_angioossa_n.jpg`, quality: 80, clip: { x: 0, y: 120, width: 1500, height: 830 } });
    // «Arterie polmonari» toglie sempre l'osso (mascheraOssoFine); «Cuore e coronarie» con «togli l'osso» spuntato
    const pre = process.env.PRESET_OSSO || 'CT-Pulmonary-Arteries';
    if (pre) {
      await scegli(pre, false, true); if (FOTO) await a.screenshot({ path: `/Volumes/Caloggero/_viste/pc_${caso}_senzaosso_v.jpg`, quality: 80, clip: { x: 0, y: 120, width: 1500, height: 830 } });
      riga.tSenzaOsso = await scegli(pre, true, true); if (FOTO) await a.screenshot({ path: `/Volumes/Caloggero/_viste/pc_${caso}_senzaosso_n.jpg`, quality: 80, clip: { x: 0, y: 120, width: 1500, height: 830 } });
    }
    await a.click('#modo-2d').catch(() => {});
  } catch (e) { riga.eccezione = e.message.slice(0, 200); }
  riga.errori = errori.slice(0, 4);
  console.log(JSON.stringify(riga));
}
await b.close(); sim.kill();
