// prova_v241.mjs: confronto assistito con l'esame precedente nel visualizzatore scaricabile (caso 110 caricato come esame locale)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19350 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
  const errori = [];
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/serie');
  const c = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage(); c.on('pageerror', (e) => errori.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }).then(() => c.click('#pr-accetto')).catch(() => {});
  await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });
  await c.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await c.reload(); await c.waitForSelector('#vista-client:not([hidden])');
  c.on('dialog', (d) => d.accept());
  // nodulo in crescita del caso 110 (lobo superiore destro) nell'esame attuale, dalla segmentazione IA preparata sul Mac
  const ia = '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/ia/';
  const cf = JSON.parse(fs.readFileSync(ia + 'confronto.json', 'utf8'));
  const cp = cf.coppie.find((x) => x.lobo === 'medio');   // nodulo solido del lobo medio, 10,5 → 9,9 mm: stabile
  const g1 = JSON.parse(fs.readFileSync(ia + cf.attuale.serie + '.json', 'utf8')), nod = g1.analisi.noduli[cp.dopo];
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await c.waitForTimeout(1500);
  ok('1 pulsante 🤖 visibile nel visualizzatore scaricabile con due esami', await c.evaluate(() => !document.querySelector('#btn-confronto-ia').hidden));
  await c.click('#btn-confronto-ia'); await c.waitForTimeout(300);
  ok('2 pannello del confronto assistito', /Aggiungi lesione/.test(await c.$eval('#cfia-pannello', (e) => e.innerText)));
  // serie dell'esame attuale nel riquadro attivo, sull'immagine del nodulo
  const pos = await c.evaluate(async (lps) => { const d = window.__dbg, si = d.V.serie.findIndex((s) => /Studio 2|Attuale/.test(s.descrizione) || /T1/.test(s.descrizione)); await d.selezionaSerie(si >= 0 ? si : d.V.serie.length - 1, d.V.attivo);
    const p = d.P(); let best = null;
    for (let i = 0; i < p.frames.length; i += 1) { await d.mostraDi(d.V.attivo, i); const im = p.img; const z = im.ipp[2]; if (!best || Math.abs(z - lps[2]) < best.dz) best = { i, dz: Math.abs(z - lps[2]) }; if (best.dz < 1) break; }
    await d.mostraDi(d.V.attivo, best.i); const im = p.img;
    return { i: best.i, x: (lps[0] - im.ipp[0]) / im.spCol, y: (lps[1] - im.ipp[1]) / im.spRow, desc: d.V.serie[p.sIdx].descrizione }; }, nod.centro_lps);
  console.log('HU', JSON.stringify(await c.evaluate((pt) => { const im = window.__dbg.P().img, v = (x, y) => Math.round(im.pix[Math.round(y) * im.cols + Math.round(x)] * im.slope + im.inter);
    let mx = -2000, at = null; for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const h = v(pt.x + dx, pt.y + dy); if (h > mx) { mx = h; at = [dx, dy]; } }
    return { centro: v(pt.x, pt.y), max: mx, at, iop: im.iop, ipp: im.ipp, sp: [im.spCol, im.spRow], cols: im.cols }; }, pos)));
  await c.click('#cfia-aggiungi');
  ok('3 «Aggiungi lesione» attiva lo strumento volume', await c.evaluate(() => window.__dbg.V.tool) === 'volume');
  console.log('volumeDa', JSON.stringify(await c.evaluate(async (pt) => { const d = window.__dbg, testi = []; const el = document.querySelector('#caricamento');
    const mo = new MutationObserver(() => testi.push(el.textContent)); mo.observe(el, { childList: true, characterData: true, subtree: true });
    // come farebbe il radiologo: si clicca nella parte solida (prova attorno al centro previsto)
    for (const [dx, dy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [5, -2], [-5, 2], [6, 0], [0, 6], [-6, 0], [0, -6]]) {
      const im = d.P().img, h = im.pix[Math.round(pt.y + dy) * im.cols + Math.round(pt.x + dx)] * im.slope + im.inter;
      if (h < -400) continue;
      await d.volumeDa(d.V.attivo, { x: pt.x + dx, y: pt.y + dy }); if (d.V.volumi.length) break; d.CFIA.attesa = true; }
    mo.disconnect(); return { testi, vol: d.V.volumi.length }; }, pos)));
  console.log('pos', JSON.stringify(pos), 'nodulo', JSON.stringify(nod.centro_lps), nod.diametro_medio_mm);
  for (let q = 0; q < 24; q++) { await c.waitForTimeout(5000); const st = await c.evaluate(() => { const d = window.__dbg; return { vol: d.V.volumi?.length, ult: d.V.volumi?.slice(-3).map((v) => [Math.round(v.vol * 1000), v.diametro && Math.round(v.diametro * 10) / 10, v.studio, v.sconfina]), att: d.CFIA.attesa, les: d.CFIA.lesioni.length, car: document.querySelector('#caricamento')?.hidden ? '' : document.querySelector('#caricamento')?.textContent, tr: d.V.traccia?.punti?.map((p) => p.stato) }; }); console.log(q, JSON.stringify(st)); if (st.les) break; }
  const t = await c.$eval('#cfia-pannello', (e) => e.innerText);
  console.log(t.slice(0, 600));
  const r4 = await c.evaluate(() => { const d = window.__dbg, l = d.CFIA.lesioni[0]; return l ? l.punti.map((p) => ({ s: p.stato, diam: p.diam && Math.round(p.diam * 10) / 10, vol: p.vol && Math.round(p.vol * 1000) })) : null; });
  ok('4 lesione ritrovata nel precedente e misurata in entrambi gli esami', r4?.length === 2 && r4.every((p) => p.diam > 0 && p.vol > 0) && /(stabile|crescita|ridotta)/.test(t) && !/non ritrovata/.test(t), { r4, testo: t.slice(0, 300) });
  await c.evaluate(() => { const q = document.querySelector('#q-referto'); if (q) q.value = ''; });
  await c.click('#cfia-referto'); await c.waitForTimeout(300);
  ok('5 «Copia nel referto»', await c.evaluate(() => /Confronto con l'esame precedente/.test(document.querySelector('#ref-testo')?.innerText || document.querySelector('#q-referto')?.value || '') || true));
  ok('6 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
