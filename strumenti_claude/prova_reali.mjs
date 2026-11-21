// file DICOM reali (dati di test pubblici di pydicom: vari produttori, compressioni, multi-frame, colore) + CD con DICOMDIR
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const D = '/Volumes/Caloggero/_viste/dicom_reali/', OUT = '/Volumes/Caloggero/_viste/prova3d/reali/';
fs.mkdirSync(OUT, { recursive: true });
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok_) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok_(); }));
const browser = await chromium.launch();
try {
  const p = await (await browser.newContext({ viewport: { width: 1300, height: 850 } })).newPage(); const err = [];
  p.on('pageerror', (e) => { err.push(e.message); log('PAGEERROR', e.message); });
  await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  const file = fs.readdirSync(D).filter((f) => f.endsWith('.dcm')).sort();
  let ok = 0;
  for (const f of file) {
    await p.goto(B + '/client/index.html#/'); await p.waitForSelector('#vista-client:not([hidden])');
    await p.evaluate(() => { if (window.__dbg) window.__dbg.V.img = null; document.querySelector('#cl-stato').className = 'stato'; });
    await p.setInputFiles('#cl-file', [D + f]);
    const fine = await p.waitForFunction(() => (window.__dbg?.V?.img && location.hash === '#/caso/locale') || /errore/.test(document.querySelector('#cl-stato')?.className || '') || (!document.querySelector('#caricamento').hidden && /Errore/.test(document.querySelector('#caricamento').textContent)), null, { timeout: 30000 }).then(() => true).catch(() => false);
    await p.waitForTimeout(700);
    const r = await p.evaluate(() => { const d = window.__dbg, im = d?.P?.()?.img; let s = 0, s2 = 0, n = 0; if (im) for (let i = 0; i < im.pix.length; i += 31) { const v = im.pix[i]; s += v; s2 += v * v; n++; }
      return { img: !!im, dim: im ? `${im.cols}×${im.rows}` : '', rgb: !!im?.rgb, fot: d?.P?.()?.frames?.length, ds: n ? Math.round(Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2))) : 0, stato: document.querySelector('#cl-stato').innerText.slice(0, 140), errore: document.querySelector('#caricamento').hidden ? '' : document.querySelector('#caricamento').textContent }; });
    const visto = r.img && r.ds > 0;
    if (visto) ok++;
    log(visto ? 'VISTO ' : 'NO    ', f.padEnd(36), r.dim, r.rgb ? 'colore' : '', r.fot > 1 ? r.fot + ' fotogrammi' : '', `ds ${r.ds}`, r.errore || (!r.img ? r.stato : ''), fine ? '' : '(tempo scaduto)');
    if (visto) await p.screenshot({ path: OUT + f.replace('.dcm', '.png') });
  }
  log(`totale: ${ok} / ${file.length} visualizzati`);
  // CD vero con DICOMDIR
  await p.goto(B + '/client/index.html#/'); await p.waitForSelector('#vista-client:not([hidden])');
  await p.setInputFiles('#cl-cartella', D + 'cd'); await p.waitForTimeout(3000);
  const sc = await p.evaluate(() => (!document.querySelector('#cl-scelta').hidden ? document.querySelector('#cl-scelta').innerText : document.querySelector('#cl-stato').innerText));
  log('CD DICOMDIR:', JSON.stringify(sc.slice(0, 600)));
  if (await p.locator('#cl-scelta-apri').isVisible().catch(() => false)) {
    await p.evaluate(() => document.querySelectorAll('#cl-scelta input').forEach((x) => { x.checked = true; })); await p.click('#cl-scelta-apri');
    await p.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(1500);
    log('CD aperto:', JSON.stringify(await p.evaluate(() => ({ titolo: document.querySelector('#titolo-caso').textContent, serie: window.__dbg.V.serie.length, stato: document.querySelector('#cl-stato').innerText.slice(0, 200) }))));
    await p.screenshot({ path: OUT + 'cd.png' });
  }
  log('errori JS:', JSON.stringify(err));
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
