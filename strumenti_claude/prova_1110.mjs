// prova_1110.mjs: segnalazioni del 10/11 — barra delle serie compatta (rotella, intestazione fissa), Aiuto con ritorno,
// EN nel client; MPR: assiale grande a sinistra, «Scorri» all'apertura, doppio clic per scambiare, strumenti nelle viste
// piccole, gomma per una misura, cestino accanto a «nel referto», serie dal piano (obliqua) nel 2D
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19600 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
const fileDi = (caso) => { const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } }; giro(`/Volumes/Caloggero/piattaforma-quiz/casi-free/${caso}/serie`); return files; };
async function apriClient(caso) {
  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message)); c.on('dialog', (d) => d.accept());
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', fileDi(caso));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 180000 }); await c.waitForTimeout(2500);
  return c;
}
try {
  // ---------------- 2D: RM cardiaca con 17 serie
  const c = await apriClient('caso-tcia-071'); const D = (f, x) => c.evaluate(f, x);
  const st = await D(() => { const ls = document.querySelector('#lista-serie'), r = ls.getBoundingClientRect(); const s = [...ls.querySelectorAll('.s')];
    return { n: s.length, larg: Math.round(s[0].getBoundingClientRect().width), vis: s.filter((x) => { const q = x.getBoundingClientRect(); return q.right <= r.right + 1 && q.left >= r.left - 1; }).length, h3: Math.round(document.querySelector('aside.serie h3').getBoundingClientRect().x) }; });
  ok('1 miniature compatte: più serie visibili', st.larg <= 135 && st.vis >= 9, st);
  const idx0 = await D(() => window.__dbg.V.idx);
  const lr = await D(() => { const r = document.querySelector('#lista-serie').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await c.mouse.move(lr.x, lr.y); await c.mouse.wheel(0, 400); await c.waitForTimeout(400);
  const dopo = await D(() => ({ sl: document.querySelector('#lista-serie').scrollLeft, aside: document.querySelector('aside.serie').scrollLeft, idx: window.__dbg.V.idx, h3: Math.round(document.querySelector('aside.serie h3').getBoundingClientRect().x) }));
  ok('2 rotella sulle miniature: scorre l\'elenco, non le immagini', dopo.sl > 100 && dopo.idx === idx0, { idx0, ...dopo });
  ok('3 titolo della barra fermo mentre l\'elenco scorre', dopo.h3 === st.h3 && dopo.aside === 0, { prima: st.h3, ...dopo });
  // Aiuto sopra l'esame, ritorno con Esc e con «← Indietro»
  await c.click('#btn-aiuto'); await c.waitForTimeout(800);
  const a1 = await D(() => ({ vis: !document.querySelector('#vista-aiuto').hidden, sopra: document.querySelector('#vista-aiuto').classList.contains('sopra'), hash: location.hash, sez: document.querySelectorAll('#aiuto-corpo section').length }));
  ok('4 Aiuto aperto sopra l\'esame (l\'esame resta)', a1.vis && a1.sopra && a1.hash === '#/caso/locale' && a1.sez > 3, a1);
  await c.keyboard.press('Escape'); await c.waitForTimeout(300);
  const a2 = await D(() => ({ vis: !document.querySelector('#vista-aiuto').hidden, img: !!window.__dbg.V.img, idx: window.__dbg.V.idx }));
  ok('5 Esc chiude l\'Aiuto e torna all\'esame com\'era', !a2.vis && a2.img && a2.idx === idx0, a2);
  await c.click('#btn-aiuto'); await c.waitForTimeout(500); await c.click('#aiuto-indietro'); await c.waitForTimeout(300);
  ok('6 «← Indietro» chiude l\'Aiuto', await D(() => document.querySelector('#vista-aiuto').hidden));
  // EN
  await c.click('#btn-lingua'); await c.waitForTimeout(6000);
  const en = await D(() => [document.documentElement.lang, document.querySelector('#btn-lingua')?.textContent]);
  ok('7 EN: la pagina passa all\'inglese', en[0] === 'en' && en[1] === 'IT', en);
  await D(() => localStorage.setItem('rq-lingua', 'it'));
  await c.context().close();

  // ---------------- MPR: TC addome
  const m = await apriClient('caso-tcia-004'); const M = (f, x) => m.evaluate(f, x);
  await m.click('#modo-mpr'); await m.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await m.waitForTimeout(3000);
  // 14/11: il 3D si sceglie dal menu e va nel riquadro grande; qui si riporta l'assiale nel grande con il doppio clic
  await m.selectOption('#mpr-preset', await M(() => document.querySelector('#mpr-preset optgroup option').value)); await m.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 120000 }); await m.waitForTimeout(800);
  { const r = await M(() => { const x = document.querySelector('#vp-assiale').getBoundingClientRect(); return [x.x + x.width / 2, x.y + x.height / 2]; }); await m.mouse.dblclick(r[0], r[1]); await m.waitForTimeout(800); }
  const rett = (id) => M((id) => { const r = document.querySelector('#' + id).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, id);
  let [ass, cor, sag, vr] = [await rett('vp-assiale'), await rett('vp-coronale'), await rett('vp-sagittale'), await rett('vp-3d')];
  ok('8 assiale grande a sinistra, le tre piccole a destra', ass.w > 1.8 * cor.w && ass.x < cor.x && cor.x === sag.x && sag.x === vr.x && cor.y < sag.y && vr.y !== cor.y, { ass, cor, sag, vr });
  ok('9 all\'apertura lo strumento è «Scorri»', await M(() => [...document.querySelectorAll('[data-mpr-tool].on')].map((x) => x.dataset.mprTool).join() === 'scorri'));
  ok('10 cestino a sinistra di «nel referto»', await M(() => document.querySelector('#mpr-al-referto').previousElementSibling?.id === 'mpr-cancella'));
  // un clic singolo sulla piccola non scambia; il doppio clic sì
  await m.mouse.click(cor.x + cor.w / 2, cor.y + cor.h / 2); await m.waitForTimeout(500);
  ok('11 clic singolo su una vista piccola: nessuno scambio', (await rett('vp-assiale')).w > 1.8 * (await rett('vp-coronale')).w);
  await m.mouse.dblclick(cor.x + cor.w / 2, cor.y + cor.h / 2); await m.waitForTimeout(800);
  [ass, cor] = [await rett('vp-assiale'), await rett('vp-coronale')];
  ok('12 doppio clic sulla coronale piccola: va nel riquadro grande', cor.w > 1.8 * ass.w && cor.x < ass.x, { ass, cor });
  // misura in una vista piccola (assiale, ora piccola)
  const n0 = await M(() => window.__dbg.MPR.modulo._misure().length);
  await m.click('[data-mpr-tool="misura"]'); await m.waitForTimeout(200);
  const ax = ass.x + ass.w * 0.3, ay = ass.y + ass.h * 0.75;
  await m.mouse.move(ax - 40, ay); await m.mouse.down(); await m.mouse.move(ax + 20, ay, { steps: 6 }); await m.mouse.up(); await m.waitForTimeout(500);
  const n1 = await M(() => window.__dbg.MPR.modulo._misure().length);
  ok('13 misura fatta in una vista piccola', n1 === n0 + 1, { n0, n1 });
  // seconda misura nella grande, poi gomma sulla prima
  const gx = cor.x + cor.w / 2, gy = cor.y + cor.h / 2;
  await m.mouse.move(gx - 80, gy - 60); await m.mouse.down(); await m.mouse.move(gx + 40, gy - 60, { steps: 6 }); await m.mouse.up(); await m.waitForTimeout(500);
  const n2 = await M(() => window.__dbg.MPR.modulo._misure().length);
  await m.click('[data-mpr-tool="gomma"]'); await m.waitForTimeout(200);
  await m.mouse.click(gx - 20, gy - 60); await m.waitForTimeout(600);
  const n3 = await M(() => window.__dbg.MPR.modulo._misure().length);
  ok('14 gomma: cancellata solo la misura cliccata', n2 === n1 + 1 && n3 === n2 - 1, { n1, n2, n3 });
  // zoom nella piccola con la rotellina premuta
  await m.click('[data-mpr-tool="scorri"]');
  // serie dal piano
  await m.click('#mpr-obliqua');
  await m.waitForFunction(() => !window.__dbg.MPR.attivo && window.__dbg.V.pannelli[window.__dbg.V.attivo].piano === 'obliqua' && window.__dbg.V.img, null, { timeout: 120000 }); await m.waitForTimeout(1500);
  const ob = await M(() => { const p = window.__dbg.V.pannelli[window.__dbg.V.attivo]; return { n: p.frames.length, r: p.img.rows, c: p.img.cols, iop: p.img.iop.map((x) => Math.round(x * 100) / 100), media: p.img.pix.reduce((a, x) => a + x, 0) / p.img.pix.length }; });
  ok('15 «⊞ Serie»: serie ricostruita dal piano nel 2D', ob.n > 20 && ob.r > 100 && ob.c > 100 && ob.media > -1000, ob);
  await m.screenshot({ path: '/Volumes/Caloggero/_viste/v1110_obliqua.png' });
  // scorrere la serie ricostruita
  const i0 = await M(() => window.__dbg.V.idx); const cv = await rett('canvas');
  await m.mouse.move(cv.x + cv.w / 2, cv.y + cv.h / 2); await m.mouse.wheel(0, 300); await m.waitForTimeout(500);
  ok('16 la serie ricostruita si scorre', (await M(() => window.__dbg.V.idx)) !== i0);
  // riaprendo l'MPR (prima si era portata la coronale nel grande e attivata la gomma): di nuovo assiale e «Scorri»
  await m.click('#modo-mpr'); await m.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await m.waitForTimeout(2000);
  const ri = { ass: await rett('vp-assiale'), cor: await rett('vp-coronale'), gomma: await M(() => document.querySelector('#mpr').classList.contains('gomma')), tool: await M(() => [...document.querySelectorAll('[data-mpr-tool].on')].map((x) => x.dataset.mprTool).join()) };
  ok('18 riaprendo l\'MPR: assiale nel grande, «Scorri», gomma spenta', ri.ass.w > 1.8 * ri.cor.w && !ri.gomma && ri.tool === 'scorri', ri);
  ok('17 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('KO eccezione', e.message); ko++; }
finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTI OK'); process.exit(ko ? 1 : 0); }
