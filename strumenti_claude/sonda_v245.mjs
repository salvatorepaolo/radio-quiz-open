// prova_v245.mjs: richieste del 9/11 — ✕ in alto a destra, testo delle misure spostabile, layout 2×1, Multischermo,
// referto senza «Rimetti nella pagina»; MPR in disposizione Esaote, zoom con la rotellina premuta, freccia con «scorri»,
// testo delle misure spostabile, clic che sposta il centro delle linee di riferimento, sposta nel 3D
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19800 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
try {
  // ---------------- 2D nel visualizzatore scaricabile
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-110/serie');
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await c.waitForTimeout(1500);
  const D = (f, x) => c.evaluate(f, x);
  const cv = await D(() => { const r = document.querySelector('#canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  // testo della distanza spostabile
  await D(() => document.querySelector('#barra-2d [data-tool="misura"]').click());
  const cx = cv.x + cv.w / 4, cy = cv.y + cv.h / 2;
  await c.mouse.move(cx - 50, cy); await c.mouse.down(); await c.mouse.move(cx + 30, cy, { steps: 6 }); await c.mouse.up(); await c.waitForTimeout(300);
  const et = await D(() => { const e = window.__dbg.ETICHETTE.find((x) => x.m.tipo === 'linea'); return e && { x: e.x, y: e.y, w: e.w, h: e.h, a: { ...e.m.a }, b: { ...e.m.b } }; });
  ok('1 etichetta della distanza registrata', !!et, et);
  if (et) {
    const ex = cv.x + et.x + et.w / 2, ey = cv.y + et.y + et.h / 2;
    await c.mouse.move(ex, ey); await c.mouse.down(); await c.mouse.move(ex + 60, ey + 40, { steps: 8 }); await c.mouse.up(); await c.waitForTimeout(300);
    const dopo = await D(() => { const m = Object.values(window.__dbg.V.misure).flat().find((x) => x.tipo === 'linea'); return { dt: m.dt, a: m.a, b: m.b, n: Object.values(window.__dbg.V.misure).flat().length }; });
    ok('2 trascinando il testo si sposta solo il testo (la misura resta)', dopo.dt && Math.abs(dopo.dt.x - 60) < 3 && Math.abs(dopo.dt.y - 40) < 3 && dopo.a.x === et.a.x && dopo.b.x === et.b.x && dopo.n === 1, dopo);
  }
  // ROI: anche il suo testo
  await D(() => document.querySelector('#barra-2d [data-tool="roi"]').click());
  await c.mouse.move(cx - 100, cy + 60); await c.mouse.down(); await c.mouse.move(cx - 60, cy + 100, { steps: 6 }); await c.mouse.up(); await c.waitForTimeout(300);
  const etR = await D(() => { const e = window.__dbg.ETICHETTE.find((x) => x.m.tipo === 'roi'); return e && { x: e.x, y: e.y, w: e.w, h: e.h }; });
  if (etR) { const ex = cv.x + etR.x + 10, ey = cv.y + etR.y + etR.h / 2; await c.mouse.move(ex, ey); await c.mouse.down(); await c.mouse.move(ex + 30, ey - 50, { steps: 6 }); await c.mouse.up(); await c.waitForTimeout(300); }
  const roi = await D(() => Object.values(window.__dbg.V.misure).flat().find((x) => x.tipo === 'roi')?.dt);
  ok('3 testo della ROI spostabile', roi && Math.abs(roi.x - 30) < 3 && Math.abs(roi.y + 50) < 3, { roi, etR, n: await D(() => [Object.values(window.__dbg.V.misure).flat().map((x) => x.tipo), window.__dbg.ETICHETTE.map((e) => e.m.tipo)]) });
  // layout 2×1 e ✕ in alto a destra
  await D(() => { const s = document.querySelector('#riquadri'); s.value = '2v'; s.dispatchEvent(new Event('change', { bubbles: true })); }); await c.waitForTimeout(1500);
  const lay = await D(() => { const d = window.__dbg; return { n: d.V.n, v: d.V.verticale, sel: document.querySelector('#riquadri').value }; });
  const r1 = await D(() => { const c = document.querySelector('#canvas').getBoundingClientRect(); return { w: c.width, h: c.height }; });
  ok('4 layout 2×1: due riquadri uno sopra l\'altro', lay.n === 2 && lay.v && lay.sel === '2v', lay);
  // ✕ del secondo riquadro (in basso): angolo in alto a destra
  const G = 4, h2 = (r1.h - G) / 2;
  await c.mouse.click(cv.x + 14, cv.y + h2 + G + 14); await c.waitForTimeout(300);
  ok('5 la vecchia ✕ in alto a sinistra non chiude più', (await D(() => window.__dbg.V.n)) === 2);
  await c.mouse.click(cv.x + r1.w - 14, cv.y + h2 + G + 14); await c.waitForTimeout(800);
  ok('6 la ✕ in alto a destra chiude il riquadro', (await D(() => window.__dbg.V.n)) === 1);
  // Multischermo
  const ms = await D(() => document.querySelector('#cl-finestra')?.textContent.trim());
  ok('7 «Multischermo» con l\'icona dei due monitor', (ms === 'Multischermo' || (await D(() => document.querySelector('#cl-finestra')?.getAttribute('aria-label'))) === 'Multischermo') && !!(await D(() => document.querySelector('#cl-finestra svg rect'))), ms);
  // referto in finestra separata: niente «Rimetti nella pagina»
  await D(() => document.querySelector('#cl-referto').click()); await c.waitForSelector('#dlg-referto[open]', { timeout: 10000 });
  const [pop] = await Promise.all([c.waitForEvent('popup', { timeout: 10000 }).catch(() => null), D(() => document.querySelector('#ref-finestra').click())]);
  await c.waitForTimeout(800);
  const fin = await D(() => { const w = window.__dbg.FIN_REF.win; return { win: !!w, nascosto: !!w && w.document.querySelector('#ref-finestra')?.hidden }; });
  ok('8 nella finestra separata il pulsante «Rimetti nella pagina» non c\'è', fin.win && fin.nascosto, fin);
  if (pop) { await pop.close(); await c.waitForTimeout(800); }
  const dopoChiusa = await D(() => ({ vis: !document.querySelector('#ref-finestra').hidden, pref: localStorage.getItem('rq-referto-finestra') }));
  ok('9 chiusa la finestra: il referto torna nella pagina e la prossima volta si apre lì', dopoChiusa.vis && !dopoChiusa.pref, dopoChiusa);

  // ---------------- MPR nella piattaforma
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-004'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-004', null, { timeout: 60000 }); await a.waitForTimeout(1500);
  await a.click('#modo-mpr'); await a.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await a.waitForTimeout(3000);
  const M = (f, x) => a.evaluate(f, x);
  const rett = (id) => M((id) => { const r = document.querySelector('#' + id).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, id);
  let [ass, cor, sag, vr] = [await rett('vp-assiale'), await rett('vp-coronale'), await rett('vp-sagittale'), await rett('vp-3d')];
  ok('10 disposizione: 3D grande a sinistra, assiale, coronale, sagittale in colonna a destra',
    ass.x === cor.x && cor.x === sag.x && ass.y < cor.y && cor.y < sag.y && vr.x < ass.x && vr.w > 1.8 * ass.w && vr.h > 2.5 * ass.h, { ass, cor, sag, vr });
  // clic su una vista piccola: va nel riquadro grande
  await a.mouse.click(ass.x + ass.w / 2, ass.y + ass.h / 2); await a.waitForTimeout(800);
  [ass, vr] = [await rett('vp-assiale'), await rett('vp-3d')];
  ok('10b clic sull\'assiale piccola: passa nel riquadro grande, il 3D tra le piccole', ass.w > 1.8 * vr.w && ass.x < vr.x, { ass, vr });
  const cx2 = ass.x + ass.w / 2, cy2 = ass.y + ass.h / 2;
  // rotellina premuta: su = ingrandisci
  const s0 = await M(() => window.__dbg.MPR.modulo._scala());
  await a.mouse.move(cx2 + 30, cy2 + 20); await a.mouse.down({ button: 'middle' }); await a.mouse.move(cx2 + 30, cy2 - 20, { steps: 6 }); await a.mouse.up({ button: 'middle' }); await a.waitForTimeout(300);
  const s1 = await M(() => window.__dbg.MPR.modulo._scala());
  await a.mouse.move(cx2 + 30, cy2 - 20); await a.mouse.down({ button: 'middle' }); await a.mouse.move(cx2 + 30, cy2 + 40, { steps: 6 }); await a.mouse.up({ button: 'middle' }); await a.waitForTimeout(300);
  const s2 = await M(() => window.__dbg.MPR.modulo._scala());
  ok('11 rotellina premuta: su ingrandisce, giù rimpicciolisce', s1 < s0 && s2 > s1, { s0, s1, s2 });
  // «scorri»: freccia
  await a.click('[data-mpr-tool="scorri"]'); await a.mouse.move(cx2 + 5, cy2 + 5); await a.waitForTimeout(200);
  const cur = await M(() => getComputedStyle(document.querySelector('#vp-assiale')).cursor);
  ok('12 con «scorri» il puntatore è la freccia', /default|auto/.test(cur) && !/StackScroll/.test(cur), cur);
  // distanza nell'MPR e testo trascinato
  await a.click('[data-mpr-tool="misura"]'); await a.waitForTimeout(200);
  await a.mouse.move(cx2 - 60, cy2 - 40); await a.mouse.down(); await a.mouse.move(cx2 - 10, cy2 - 40, { steps: 6 }); await a.mouse.up(); await a.waitForTimeout(500);
  const t0 = await M(() => window.__dbg.MPR.modulo._testi());
  const tr = await M(() => { const t = [...document.querySelectorAll('#vp-assiale svg text')].find((x) => /mm/.test(x.textContent)); const r = t?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (tr) { await a.mouse.move(tr.x, tr.y); await a.mouse.down(); await a.mouse.move(tr.x + 40, tr.y + 50, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(400); }
  const t1 = await M(() => window.__dbg.MPR.modulo._testi());
  ok('13 MPR: il testo della distanza si sposta', !!tr && t1[0]?.mosso && JSON.stringify(t1[0]?.tb) !== JSON.stringify(t0[0]?.tb), { t0, t1 });
  // maniglia modificabile anche con le linee di riferimento attive
  await a.click('[data-mpr-tool="crosshair"]'); await a.waitForTimeout(200);
  const l0 = await M(() => window.__dbg.MPR.modulo._misure()[0]?.stats?.length);
  await a.mouse.move(cx2 - 10, cy2 - 40); await a.mouse.down(); await a.mouse.move(cx2 + 30, cy2 - 40, { steps: 6 }); await a.mouse.up(); await a.waitForTimeout(400);
  const l1 = await M(() => window.__dbg.MPR.modulo._misure()[0]?.stats?.length);
  ok('14 MPR: la misura si modifica trascinando la maniglia', l1 > l0 + 5, { l0, l1 });
  // clic: il centro delle linee di riferimento va nel punto
  const c0 = await M(() => window.__dbg.MPR.modulo.centroMirino());
  await a.mouse.click(ass.x + ass.w * 0.3, ass.y + ass.h * 0.75); await a.waitForTimeout(400);
  const c1 = await M(() => window.__dbg.MPR.modulo.centroMirino());
  ok('15 clic con le linee di riferimento: il centro si sposta nel punto', Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) > 10, { c0, c1 });
  // «Sposta» nella vista grande (assiale), poi nel 3D portato nel riquadro grande
  await a.click('[data-mpr-tool="pan"]'); await a.waitForTimeout(200);
  const v0 = await M(() => window.__dbg.MPR.modulo._diagnosi().assiale.fuoco);
  console.log('STATO', JSON.stringify(await M(() => window.__dbg.MPR.modulo._stato().opzioni)), JSON.stringify(await M(() => { const d = window.__dbg.MPR.modulo._diagnosi(); return [d.assiale.fuoco, d.coronale.fuoco, d.sagittale.fuoco]; })));
  await a.mouse.move(ass.x + ass.w / 2, ass.y + ass.h / 2); await a.mouse.down(); await a.mouse.move(ass.x + ass.w / 2 + 40, ass.y + ass.h / 2 + 30, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(300);
  const v1 = await M(() => window.__dbg.MPR.modulo._diagnosi().assiale.fuoco);
  console.log('DOPO', JSON.stringify(await M(() => { const d = window.__dbg.MPR.modulo._diagnosi(); return [d.assiale.fuoco, d.coronale.fuoco, d.sagittale.fuoco, d.assiale.normale]; })));
  vr = await rett('vp-3d'); await a.mouse.click(vr.x + vr.w / 2, vr.y + vr.h / 2); await a.waitForTimeout(800); vr = await rett('vp-3d');
  const d0 = await M(() => window.__dbg.MPR.modulo._diagnosi().vr.fuoco);
  await a.mouse.move(vr.x + vr.w / 2, vr.y + vr.h / 2); await a.mouse.down(); await a.mouse.move(vr.x + vr.w / 2 + 80, vr.y + vr.h / 2 + 30, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(300);
  const d1 = await M(() => window.__dbg.MPR.modulo._diagnosi().vr.fuoco);
  ok('16 «Sposta» funziona nell\'MPR e nel 3D (nel riquadro grande)', v1[2] === v0[2] && (v1[0] !== v0[0] || v1[1] !== v0[1]) && JSON.stringify(d0) !== JSON.stringify(d1) && vr.w > 500, { v0, v1, d0, d1, vr });
  await a.screenshot({ path: '/Volumes/Caloggero/_viste/mpr_esaote.png' });
  ok('17 nessun errore JavaScript', !errori.length, errori.slice(0, 4));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
