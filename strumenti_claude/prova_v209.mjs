// prova_v209.mjs: barra compatta (righe), menu ⋯, nuova finestra sincronizzata nella piattaforma, immagini chiave salvate
// con le annotazioni, dettatura del quiz solo sul computer, B I U in inglese, referto a una colonna
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18200 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
const righe = (p) => p.evaluate(() => { const v = document.querySelector('.viewer'); const tops = new Set(); for (const e of v.querySelectorAll('.barra-unica > *, .barra-unica .toolbar > *')) { if (!e.offsetParent || e.classList.contains('toolbar')) continue; const r = e.getBoundingClientRect(); if (r.width && r.height) tops.add(Math.round(r.top / 8)); } return tops.size; });
try {
  // ---------------- client: righe della barra
  for (const w of [1000, 1440, 1920]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, locale: 'it-IT' }); const c = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); c.on('pageerror', (e) => errori.push('client: ' + e.message));
    await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
    const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
    await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-006/serie'));
    await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1500);
    const h = await c.evaluate(() => Math.round([...document.querySelectorAll('.viewer > .barra-unica, .viewer > .toolbar')].filter((e) => e.offsetParent).reduce((a, e) => a + e.getBoundingClientRect().height, 0)));
    console.log(`   client ${w}px: righe ${await righe(c)}, altezza barra ${h}px`);
    await c.screenshot({ path: `/Volumes/Caloggero/_viste/v209_barra_${w}.png`, clip: { x: 0, y: 0, width: w, height: 330 } });
    if (w === 1000) {
      await c.click('#cl-altro summary'); await c.waitForTimeout(300);
      const m = await c.evaluate(() => { const v = document.querySelector('#cl-altro .cl-aggiungi-voci'), r = v.getBoundingClientRect(); return { vis: v.getClientRects().length > 0 && getComputedStyle(v).display !== 'none', dentro: r.right <= innerWidth && r.left >= 0, voci: [...v.querySelectorAll('button,label,a')].filter((x) => x.offsetParent).map((x) => x.textContent.trim().slice(0, 22)) }; });
      ok('1 menu ⋯ dentro lo schermo con le funzioni', m.vis && m.dentro && m.voci.some((x) => /dati paziente/.test(x)) && (await c.evaluate(() => !!document.querySelector('#cl-finestra')?.offsetParent)), m);
      await c.screenshot({ path: '/Volumes/Caloggero/_viste/v209_menu.png', clip: { x: 0, y: 0, width: 1000, height: 460 } });
      await c.mouse.click(5, 880); await c.waitForTimeout(200); ok('2 clic fuori chiude il menu', await c.evaluate(() => !document.querySelector('#cl-altro').open));
    }
    await ctx.close();
  }
  // ---------------- piattaforma
  const ctx0 = await b.newContext(); const a = await ctx0.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Prova', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await ctx0.close();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  const p = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); p.on('pageerror', (e) => errori.push('piattaforma: ' + e.message));
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  const caso = async (id) => { await p.goto(B + '/?prova#/caso/' + id); await p.waitForFunction((id) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === id, id, { timeout: 60000 }); await p.waitForTimeout(1200); };
  await caso('caso-tcia-006');
  console.log(`   piattaforma 1440px: righe ${await righe(p)}`);
  // dettatura del quiz
  await p.evaluate(() => { document.querySelector('#q-detta').hidden = false; document.querySelector('#q-referto-box').open = true; });
  await p.click('#q-detta'); await p.waitForTimeout(500);
  const st = await p.textContent('#q-detta-stato'); ok('3 dettatura del quiz: in Chromium resta spenta (niente audio su internet)', /sul computer|non riconosce/.test(st) && !(await p.evaluate(() => document.querySelector('#q-detta').classList.contains('on'))), st);
  // referto a una colonna
  await p.click('#cl-referto'); await p.waitForSelector('#dlg-referto[open]');
  ok('4 referto a una colonna', await p.evaluate(() => getComputedStyle(document.querySelector('#dlg-referto .ref-griglia')).gridTemplateColumns.split(' ').length === 1));
  await p.click('#ref-chiudi');
  // nuova finestra sincronizzata (TC: caso 001)
  await caso('caso-tcia-001');
  const [w] = await Promise.all([p.waitForEvent('popup'), p.click('#cl-finestra')]);
  await w.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await w.waitForTimeout(1200); w.on('pageerror', (e) => errori.push('finestra: ' + e.message));
  const fin = await w.evaluate(() => ({ quiz: !!document.querySelector('aside.quiz')?.offsetParent, titolo: document.querySelector('#titolo-caso').textContent, chiave: !!document.querySelector('#cl-chiave').offsetParent, url: location.search }));
  ok('5 nuova finestra: solo immagini, stesso caso', !fin.quiz && /finestra 2/.test(fin.titolo) && !fin.chiave && /finestra=2/.test(fin.url), fin);
  await w.evaluate(async () => { await window.__dbg.selezionaSerie(window.__dbg.V.serie.length > 1 ? 0 : 0, 0); }); await w.waitForTimeout(800);
  const s0 = await p.evaluate(() => window.__dbg.P().sIdx), wsi = await w.evaluate(() => window.__dbg.P().sIdx);
  const prima = await w.evaluate(() => window.__dbg.P().idx);
  const r = await (await p.$('#canvas')).boundingBox(); await p.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.4);
  for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(50); } await p.waitForTimeout(1200);
  const dopo = await w.evaluate(() => window.__dbg.P().idx), pm = await p.evaluate(() => window.__dbg.P().idx);
  ok('6 scorrendo nella principale la finestra segue', s0 !== wsi || dopo !== prima, { serie: [s0, wsi], principale: pm, finestra: [prima, dopo] });
  const misNonSalv = await w.evaluate(() => typeof window.__dbg !== 'undefined');
  await w.close();
  // immagini chiave salvate con le annotazioni
  await caso('caso-tcia-006');
  await p.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.5); await p.keyboard.press('k'); await p.waitForTimeout(500);
  await p.fill('#ic-lista .ic-did', 'bookmark di prova'); await p.waitForTimeout(1700);
  ok('7 immagine chiave nuova = annotazione non salvata', await p.evaluate(() => !document.querySelector('#cl-ann-stato').hidden));
  await p.keyboard.press('Control+s'); await p.waitForTimeout(600);
  ok('8 Ctrl+S salva anche l\'immagine chiave', await p.evaluate(() => document.querySelector('#cl-ann-stato').hidden));
  await p.click('#cl-chiudi'); await p.waitForTimeout(800); ok('9 chiusura senza domande', await p.evaluate(() => !document.querySelector('#dlg-ann').open && !document.querySelector('#vista-elenco').hidden));
  await caso('caso-tcia-006'); await p.waitForTimeout(800);
  const ic = await p.evaluate(() => ({ n: document.querySelectorAll('#ic-lista .ic-voce').length, did: document.querySelector('#ic-lista .ic-did')?.value, chiavi: window.__dbg.V.chiavi.length, segni: [...document.querySelectorAll('#slider-segni .segno-k')].length }));
  ok('10 riaperto: immagine chiave ritrovata (striscia, docente, barra)', ic.n === 1 && ic.did === 'bookmark di prova' && ic.chiavi === 1, ic);
  await p.keyboard.press('k'); await p.waitForTimeout(400); await p.click('#cl-chiudi'); await p.waitForSelector('#dlg-ann[open]', { timeout: 3000 }).catch(() => {});
  ok('11 immagine chiave non salvata → domanda alla chiusura', await p.evaluate(() => document.querySelector('#dlg-ann').open));
  await p.click('#dlg-ann button[value="no"]'); await p.waitForTimeout(600);
  await caso('caso-tcia-006'); ok('12 senza salvare: resta solo quella salvata', (await p.evaluate(() => document.querySelectorAll('#ic-lista .ic-voce').length)) === 1);
  // inglese: B I U
  const e = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); await e.goto(B + '/?prova&lang=en#/caso/caso-tcia-006'); await e.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await e.waitForTimeout(800);
  const biu = await e.evaluate(() => ['bold', 'italic', 'underline'].map((c) => document.querySelector(`.ref-barra [data-cmd="${c}"]`).textContent).join(''));
  ok('13 inglese: B I U', biu === 'BIU', biu);
  ok('14 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
