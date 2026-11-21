// prova_v240.mjs: richieste dell'8/11: ✕ della linguetta, RECIST a una misura, ✕ dei riquadri, Ctrl+clic, B+clic, T, immagini chiave, Confronta, referto in finestra
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
  c.on('dialog', (d) => d.accept());
  await c.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await c.reload(); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await c.waitForTimeout(1500);
  const D = (f, x) => c.evaluate(f, x);
  // riquadro A: geometria per cliccare
  const geo = async (k) => D((k) => { const cv = document.querySelector('#canvas').getBoundingClientRect(), d = window.__dbg; const r = d.V.pannelli && (() => { const R = { n: d.V.n }; return R; })(); return { x: cv.x, y: cv.y, w: cv.width, h: cv.height, n: d.V.n }; }, k);
  // --- 1 RECIST: una sola misura salvata dopo un trascinamento
  await c.evaluate(() => document.querySelector('#barra-2d [data-tool="recist"]').click());
  let g = await geo(0); const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
  await c.mouse.move(cx - 40, cy); await c.mouse.down(); await c.mouse.move(cx, cy, { steps: 4 }); await c.mouse.move(cx + 40, cy, { steps: 4 }); await c.mouse.up(); await c.waitForTimeout(300);
  const r1 = await D(() => { const d = window.__dbg, l = Object.values(d.V.misure).flat().filter((m) => m.tipo === 'recist'); return { n: l.length, due: l.some((m) => m.c || m.d), inCorso: !!d.V.inCorso }; });
  ok('1 RECIST: una misura sola, salvata subito', r1.n === 1 && !r1.due && !r1.inCorso, r1);
  // secondo clic sul pulsante: linfonodo
  await c.evaluate(() => document.querySelector('#barra-2d [data-tool="recist"]').click());
  await c.mouse.move(cx - 30, cy + 40); await c.mouse.down(); await c.mouse.move(cx + 30, cy + 40, { steps: 4 }); await c.mouse.up(); await c.waitForTimeout(300);
  const r2 = await D(() => Object.values(window.__dbg.V.misure).flat().filter((m) => m.tipo === 'recist').map((m) => !!m.linfonodo));
  ok('1b secondo clic sul pulsante: misura di linfonodo (asse corto)', r2.length === 2 && r2[1] === true && r2[0] === false, r2);
  await c.evaluate(() => document.querySelector('#barra-2d [data-tool="scroll"]').click());
  // --- 2 T = freccia
  await c.evaluate(() => document.activeElement?.blur?.()); await c.keyboard.press('t'); await c.waitForTimeout(100);
  ok('2 tasto T: freccia con testo', await D(() => window.__dbg.V.tool) === 'nota', await D(() => window.__dbg.V.tool));
  await c.keyboard.press('Escape');
  // --- 3 B + clic: immagine chiave
  const ic0 = await D(() => document.querySelectorAll('#ic-lista .ic-voce').length);
  await c.keyboard.down('b'); await c.mouse.click(cx, cy - 60); await c.keyboard.up('b'); await c.waitForTimeout(500);
  const ic1 = await D(() => document.querySelectorAll('#ic-lista .ic-voce').length);
  ok('3 B + clic: immagine chiave aggiunta', ic1 === ic0 + 1, { ic0, ic1 });
  // --- 4 clic sull'immagine chiave: il riquadro attivo torna su quell'immagine e quella serie
  const icDove = await D(() => { const p = window.__dbg.P(); return { s: p.sIdx, i: p.idx }; });
  await D(async () => { const d = window.__dbg; await d.selezionaSerie(d.V.serie.length > 1 ? (d.P().sIdx + 1) % d.V.serie.length : d.P().sIdx, d.V.attivo, { idx: 3 }); });
  await c.waitForTimeout(500);
  await c.evaluate(() => document.querySelector('#ic-lista .ic-voce:last-child .ic-img').click()); await c.waitForTimeout(1500);
  const dopoIc = await D(() => { const p = window.__dbg.P(); return { s: p.sIdx, i: p.idx }; });
  ok('4 clic sull\'immagine chiave: stessa serie e immagine nel riquadro attivo', dopoIc.s === icDove.s && dopoIc.i === icDove.i, { icDove, dopoIc });
  // --- 5 Ctrl + clic su una serie: riquadro in più
  const n0 = await D(() => window.__dbg.V.n);
  await c.click('#lista-serie .s[data-i="1"]', { modifiers: ['Meta'] }); await c.waitForTimeout(1500);
  const n1 = await D(() => ({ n: window.__dbg.V.n, s: window.__dbg.V.pannelli.slice(0, window.__dbg.V.n).map((p) => p.sIdx) }));
  ok('5 ⌘/Ctrl + clic su una serie: si apre in un riquadro in più, quella di prima resta', n1.n === n0 + 1 && n1.s[n1.n - 1] === 1, { n0, n1 });
  // --- 6 ✕ del riquadro: si chiude e la disposizione si adatta
  g = await geo(0);
  const sAprima = await D(() => window.__dbg.V.pannelli.slice(0, window.__dbg.V.n).map((p) => p.sIdx));
  { const r = await D(() => { const G = window.__dbg.geometriaDi(0), cr = document.querySelector('#canvas').getBoundingClientRect(); return { x: cr.left + G.R.x + G.R.w - 14, y: cr.top + G.R.y + 14 }; }); await c.mouse.click(r.x, r.y); } await c.waitForTimeout(600);   // la ✕ è in alto a destra (1.232)
  const dopoX = await D(() => ({ n: window.__dbg.V.n, s: window.__dbg.V.pannelli.slice(0, window.__dbg.V.n).map((p) => p.sIdx) }));
  ok('6 ✕ in alto a destra: il riquadro A si chiude, gli altri restano', dopoX.n === n1.n - 1 && JSON.stringify(dopoX.s) === JSON.stringify(sAprima.slice(1)), { prima: sAprima, dopoX });
  // --- 7 Confronta: la serie del riquadro attivo (non quella del confronto precedente)
  await D(async () => { const d = window.__dbg; await d.impostaRiquadri?.(1); });
  // --- 8 ✕ della linguetta: chiude quell'esame, l'altro resta
  const st0 = await D(() => window.__dbg.V.studi.length);
  console.log('studi', JSON.stringify(await D(() => { const d = window.__dbg, CL = d.CL; const b = CL?.studio?.buf; return { tipo: b?.constructor?.name, n: b?.size, chiavi: b ? [...b.keys()].slice(0, 2) : null, file0: d.V.serie[0]?.files?.[0], sorg: CL?.sorgenti?.length }; })));
  if (st0 > 1) {
    await c.locator('#tab-studi .tab-chiudi').first().click(); await c.waitForTimeout(5000);
    const st1 = await D(() => ({ studi: window.__dbg.V.studi.length, serie: window.__dbg.V.serie.length, hash: location.hash }));
    ok('8 ✕ della linguetta: l\'esame si chiude, l\'altro resta aperto', st1.studi <= 1 && st1.serie === 1 && st1.hash === '#/caso/locale', st1);
  } else ok('8 (salta: un solo esame)', true);
  // --- 9 referto in finestra separata: finestra vera, due colonne se larga, ritorno nella pagina alla chiusura
  await c.click('#cl-referto').catch(() => D(() => document.querySelector('[data-azione="referto"], #btn-referto')?.click()));
  await c.waitForSelector('#dlg-referto[open]', { timeout: 10000 });
  const [pop] = await Promise.all([c.waitForEvent('popup', { timeout: 10000 }), c.click('#ref-finestra')]);
  await pop.setViewportSize({ width: 1200, height: 900 }); await pop.waitForTimeout(800);
  const lay = await pop.evaluate(() => { const g = document.querySelector('.ref-griglia'); return { iw: innerWidth, mq: matchMedia('(min-width:900px)').matches, gtc: getComputedStyle(g).gridTemplateColumns, regola: [...document.styleSheets].some((sh) => { try { return [...sh.cssRules].some((r) => r.cssText.includes('340px minmax')); } catch { return false; } }), col: getComputedStyle(g).gridTemplateColumns.split(' ').length, dlg: !!document.querySelector('#dlg-referto.in-finestra'), pieno: getComputedStyle(document.querySelector('#ref-pieno')).display !== 'none' }; });
  ok('9 referto in una finestra vera: due colonne (paziente/intestazione e referto) e pulsante ⛶ visibile', lay.dlg && lay.col === 2 && lay.pieno, lay);
  await pop.close(); await c.waitForTimeout(500);
  const tornato = await D(() => document.querySelector('#dlg-referto')?.ownerDocument === document && !document.querySelector('#dlg-referto').classList.contains('in-finestra'));
  ok('9b chiusa la finestra, il referto torna nella pagina', tornato);
  ok('10 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
