// prova_vetrini.mjs: vetrini digitali DICOM nel visualizzatore client (vetrini.js + OpenSeadragon), con due vetrini di
// prova pubblici (OpenSlide test data, CC0): Leica-4 (tessere JPEG, TILED_SPARSE) e JP2K-33003-1 (JPEG 2000, TILED_FULL).
// Controlli: si apre la vista del vetrino, le tessere si vedono (non grigie), si ingrandisce fino al livello pieno, la
// barra di scala e la distanza sono in µm coerenti con la calibrazione, l'etichetta (dati del paziente) è nascosta,
// nessuna richiesta di rete fuori dal computer, nessun errore. Uso: node prova_vetrini.mjs   (BROWSER=webkit|firefox)
// I vetrini stanno in ~/rq-vetrini (non in git: scaricati da https://openslide.cs.cmu.edu/download/openslide-testdata/DICOM/)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', DIR = path.join(os.homedir(), 'rq-vetrini');
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || (19380 + Math.floor(Math.random() * 20)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const tutti = (d) => fs.readdirSync(d).filter((x) => /\.dcm$/i.test(x)).map((x) => path.join(d, x));
try {
  for (const [nome, dir] of [['Leica-4 (JPEG, sparso)', 'leica'], ['JP2K-33003-1 (JPEG 2000)', 'jp2k']]) {
    if (!fs.existsSync(path.join(DIR, dir))) { console.log(`⚠   ${nome}: file assenti in ${DIR}/${dir}`); continue; }
    const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' });
    await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
    const c = await ctx.newPage(), errori = [], fuori = [];
    c.on('pageerror', (e) => errori.push(e.message)); c.on('request', (r) => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) fuori.push(r.url()); });
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    const t0 = Date.now();
    await c.setInputFiles('#cl-file', tutti(path.join(DIR, dir)));
    const aperto = await c.waitForFunction(() => !document.querySelector('#vista-vetrino')?.hidden && window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 120000 }).then(() => true, () => false);
    esito(aperto, `${nome}: si apre la vista del vetrino`, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (!aperto) { console.log('   stato:', await c.evaluate(() => document.querySelector('#cl-stato')?.textContent)); await ctx.close(); continue; }
    const pieno = () => c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).then(() => true, () => false);
    // pixel della vista: quanti diversi dal grigio di attesa (#f3f3f3) e quanto variano
    const contenuto = () => c.evaluate(() => { const cv = document.querySelector('.vt-osd canvas'); const g = cv.getContext('2d'); const d = g.getImageData(0, 0, cv.width, cv.height).data; let n = 0, t = 0, s = 0, s2 = 0;
      for (let i = 0; i < d.length; i += 40) { t++; const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; if (Math.abs(d[i] - 243) > 12 || Math.abs(d[i + 1] - 243) > 12 || Math.abs(d[i + 2] - 243) > 12) n++; }
      const m = s / t; return { colorati: n / t, ds: Math.sqrt(Math.max(0, s2 / t - m * m)) }; });
    await pieno(); await c.waitForTimeout(800);
    const vInt = await contenuto();
    esito(vInt.colorati > 0.05 && vInt.ds > 5, `${nome}: vetrino intero visibile`, `${(vInt.colorati * 100).toFixed(0)}% di pixel con tessuto, variazione ${vInt.ds.toFixed(0)}`);
    // ingrandimento al massimo, al centro del tessuto (punto con più contenuto nella panoramica)
    const info = await c.evaluate(() => { const vt = window.__dbg.VT, v = vt.viewer;
      // punto con più tessuto nella vista intera (blocco di 32 pixel più scuro), poi ingrandimento al livello pieno lì
      const cv = document.querySelector('.vt-osd canvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data, r = cv.width / cv.clientWidth;
      let best = null, bv = 1e9;
      for (let y = 0; y + 32 <= cv.height; y += 32) for (let x = 0; x + 32 <= cv.width; x += 32) { let sm = 0; for (let yy = 0; yy < 32; yy += 4) for (let xx = 0; xx < 32; xx += 4) { const i = ((y + yy) * cv.width + x + xx) * 4; sm += d[i] + d[i + 1] + d[i + 2]; } if (sm < bv && sm > 0) { bv = sm; best = [(x + 16) / r, (y + 16) / r]; } }
      const p = v.viewport.viewerElementToViewportCoordinates(new OpenSeadragon.Point(best[0], best[1]));
      v.viewport.zoomTo(v.viewport.imageToViewportZoom(1), null, true); v.viewport.panTo(p, true); v.viewport.applyConstraints(true);
      return { sp: vt.sp, zoom: v.viewport.viewportToImageZoom(v.viewport.getZoom(true)) }; });
    await pieno(); await c.waitForTimeout(800);
    const vMax = await contenuto();
    esito(vMax.colorati > 0.02 || vMax.ds > 3, `${nome}: al livello pieno le tessere si vedono`, `zoom ${info.zoom.toFixed(2)} · ${(vMax.colorati * 100).toFixed(0)}% · variazione ${vMax.ds.toFixed(0)}`);
    await c.evaluate(() => window.__dbg.VT.viewer.viewport.goHome(true)); await c.waitForTimeout(500);
    // distanza: 200 pixel dello schermo in orizzontale → valore in µm = pixel dell'immagine × µm/pixel
    await c.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('rq-vt-ann:')) localStorage.removeItem(k); window.__dbg.VT.misure.length = 0; }); await c.click('.vt-misura');
    const r = await c.evaluate(() => { const e = document.querySelector('.vt-misure').getBoundingClientRect(); return { x: e.x + e.width / 2 - 100, y: e.y + e.height / 2 }; });
    await c.mouse.move(r.x, r.y); await c.mouse.down(); await c.mouse.move(r.x + 200, r.y, { steps: 8 }); await c.mouse.up(); await c.waitForTimeout(400);
    const m = await c.evaluate(() => { const vt = window.__dbg.VT, mm = vt.misure[0]; return mm ? { um: vt._lung(mm), px: Math.hypot(mm.p[1][0] - mm.p[0][0], mm.p[1][1] - mm.p[0][1]), sp: vt.sp, testo: document.querySelector('.vt-misure text')?.textContent, scala: document.querySelector('.vt-scala span')?.textContent } : null; });
    esito(m && m.sp > 0 && Math.abs(m.um - m.px * m.sp) < 1e-6 && /µm|mm/.test(m.testo || ''), `${nome}: distanza in µm dalla calibrazione del vetrino`, m ? `${m.testo} (${m.px.toFixed(0)} px × ${m.sp.toFixed(4)} µm) · scala ${m.scala}` : 'nessuna misura');
    // etichetta (può avere i dati del paziente): con «dati paziente» spento serve una conferma; rifiutandola non si vede
    if (await c.$('.vt-etichetta')) { c.once('dialog', (d) => d.dismiss()); await c.click('.vt-etichetta'); await c.waitForTimeout(800); esito(!(await c.$('.vt-dlg canvas')), `${nome}: etichetta mostrata solo dopo la conferma`); }
    esito(!fuori.length, `${nome}: nessuna richiesta fuori dal computer`, fuori.slice(0, 2).join(' '));
    esito(!errori.length, `${nome}: nessun errore JavaScript`, errori.slice(0, 2).join(' | ').slice(0, 250));
    await c.screenshot({ path: `/tmp/vetrino_${dir}.png` });
    await ctx.close();
  }
  // vetrini sintetici (crea_vetrini_prova.mjs): fluorescenza 3 canali × 3 piani, campo chiaro TILED_SPARSE con 2 piani,
  // etichetta e panoramica
  const SINT = path.join(DIR, 'sintetici');
  if (fs.existsSync(SINT)) {
    const apriFile = async (files) => {
      const ctx = await b.newContext({ viewport: { width: 1200, height: 800 }, locale: 'it-IT' }); await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
      const c = await ctx.newPage(), errori = []; c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
      await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
      await c.setInputFiles('#cl-file', files.map((x) => path.join(SINT, x)));
      await c.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemAt(0)?.getFullyLoaded(), null, { timeout: 60000 }).catch(() => {});
      await c.waitForTimeout(700); return { c, ctx, errori };
    };
    const pieno = (c) => c.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0)?.getFullyLoaded(), null, { timeout: 30000 }).catch(() => {});
    const colori = (c) => c.evaluate(() => { const cv = document.querySelector('.vt-osd canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let r = 0, g = 0, bl = 0, t = 0;
      for (let i = 0; i < d.length; i += 16) { t++; if (d[i + 2] > 120 && d[i] < 100) bl++; if (d[i + 1] > 120 && d[i] < 100 && d[i + 2] < 100) g++; if (d[i] > 120 && d[i + 1] < 100) r++; } return { blu: bl / t, verde: g / t, rosso: r / t }; });
    {
      const { c, ctx, errori } = await apriFile(['fluo_l0.dcm', 'fluo_l1.dcm']);
      const info = await c.evaluate(() => { const V = window.__dbg.VT.V; return { canali: V.canali.map((x) => x.nome), piani: V.piani.length, mono: V.mono }; });
      esito(info.mono && info.canali.length === 3 && info.piani === 3, 'fluorescenza: 3 canali e 3 piani focali riconosciuti', JSON.stringify(info));
      const k0 = await colori(c);
      esito(k0.blu > 0.01 && k0.verde > 0.01 && k0.rosso > 0.01, 'fluorescenza: i tre canali compaiono nei loro colori', JSON.stringify(Object.fromEntries(Object.entries(k0).map(([k, v]) => [k, +(v * 100).toFixed(1)]))));
      await c.click('.vt-canali [data-c="0"]'); await c.waitForTimeout(300); await pieno(c); await c.waitForTimeout(500);
      const k1 = await colori(c);
      esito(k1.blu < k0.blu / 3, 'fluorescenza: spegnendo DAPI il blu sparisce', `${(k0.blu * 100).toFixed(1)}% → ${(k1.blu * 100).toFixed(1)}%`);
      await c.evaluate(() => window.__dbg.VT.vaiZ(2)); await c.waitForTimeout(300); await pieno(c); await c.waitForTimeout(500);
      const k2 = await colori(c);
      esito(Math.abs(k2.verde - k1.verde) > 0.005, 'fluorescenza: cambiando piano focale cambia l\'immagine', `verde ${(k1.verde * 100).toFixed(1)}% → ${(k2.verde * 100).toFixed(1)}% (piano 3)`);
      esito(!errori.length, 'fluorescenza: nessun errore JavaScript', errori.slice(0, 2).join(' | ').slice(0, 200));
      await ctx.close();
    }
    {
      const { c, ctx, errori } = await apriFile(['rgb_sparse.dcm', 'rgb_etichetta.dcm', 'rgb_panoramica.dcm']);
      const media = () => c.evaluate(() => { const cv = document.querySelector('.vt-osd canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let r = 0, t = 0; for (let i = 0; i < d.length; i += 16) { if (d[i] < 240) { t++; r += d[i]; } } return t ? r / t : 0; });
      const piani = await c.evaluate(() => window.__dbg.VT.V.piani);
      esito(piani.length === 2, 'campo chiaro TILED_SPARSE: 2 piani focali (Z in µm dall\'intestazione)', JSON.stringify(piani));
      const m0 = await media(); await c.evaluate(() => window.__dbg.VT.vaiZ(1)); await c.waitForTimeout(300); await pieno(c); await c.waitForTimeout(400); const m1 = await media();
      esito(Math.abs(m0 - m1) > 40, 'campo chiaro: il secondo piano focale ha altre tessere', `rosso medio ${m0.toFixed(0)} → ${m1.toFixed(0)}`);
      esito(!!(await c.$('.vt-panoramica')) && !!(await c.$('.vt-etichetta')), 'pulsanti di etichetta e panoramica presenti');
      await c.click('.vt-etichetta'); const et = await c.waitForSelector('.vt-dlg canvas.vt-img', { timeout: 10000 }).then(() => true, () => false);
      esito(et, 'etichetta: dopo la conferma si vede (nel visualizzatore client)');
      await c.evaluate(() => document.querySelector('.vt-dlg')?.remove());
      await c.click('.vt-panoramica'); esito(await c.waitForSelector('.vt-dlg canvas.vt-img', { timeout: 10000 }).then(() => true, () => false), 'panoramica del vetrino visibile');
      esito(!errori.length, 'campo chiaro: nessun errore JavaScript', errori.slice(0, 2).join(' | ').slice(0, 200));
      await ctx.close();
    }
  } else console.log('⚠   vetrini sintetici assenti: node crea_vetrini_prova.mjs');
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
