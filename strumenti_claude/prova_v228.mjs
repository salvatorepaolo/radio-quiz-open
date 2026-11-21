// prova_v228.mjs: calcio coronarico (Agatston semiautomatico e CAC-DRS visiva) su una TC del torace
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const CASO = process.env.CASO || 'caso-tcia-110';
const PORTA = +process.env.PORTA_PROVA || (19500 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + `/?prova#/caso/${CASO}`); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, CASO, { timeout: 60000 }); await a.waitForTimeout(1500);
  // la serie più lunga (strati sottili) e una piccola calcificazione nel mediastino (componente piccola e densa)
  const trovata = await a.evaluate(async () => {
    const d = window.__dbg, l = d.V.serie.map((s, i) => [i, s.files.length]).sort((x, y) => y[1] - x[1]); await d.selezionaSerie(l[0][0], d.V.attivo); await new Promise((r) => setTimeout(r, 800));
    const p = d.P();
    for (let j = Math.floor(p.frames.length * 0.35); j < Math.floor(p.frames.length * 0.75); j++) {
      await d.selezionaSerie(l[0][0], d.V.attivo, { idx: j }); const im = d.P().img, W = im.cols, H = im.rows, v = (i) => im.pix[i] * im.slope + im.inter;
      for (let y = Math.floor(H * 0.3); y < H * 0.6; y += 2) for (let x = Math.floor(W * 0.38); x < W * 0.62; x += 2) {
        if (v(y * W + x) < 250) continue;
        // componente piccola: entro 8 px tutto il resto sotto 130 al bordo
        let bordo = 0, dentro = 0; for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const q = v((y + dy) * W + x + dx); if (Math.max(Math.abs(dx), Math.abs(dy)) === 8 && q >= 130) bordo++; if (q >= 130) dentro++; }
        if (!bordo && dentro >= 3 && dentro <= 60) return { j, x, y, idx: d.P().idx };
      } }
    return null; });
  ok('1 calcificazione candidata trovata', !!trovata, trovata);
  await a.evaluate(() => { const b2 = document.querySelector('[data-tool="calcio"]'); b2.closest('details')?.setAttribute('open', ''); b2.click(); });
  ok('2 pannello del calcio coronarico aperto', await a.evaluate(() => !document.querySelector('#calcio-pannello').hidden));
  await a.evaluate(() => document.querySelector('[data-cac-vaso="IVA"]').click());
  if (trovata) await a.evaluate(async (t) => { await window.__dbg.calcioDa(window.__dbg.V.attivo, { x: t.x, y: t.y }); }, trovata).catch((e) => errori.push(e.message));
  await a.waitForTimeout(500);
  const r = await a.evaluate(() => ({ n: window.__dbg.CAC.lesioni.length, ag: window.__dbg.CAC.lesioni[0]?.agatston, vaso: window.__dbg.CAC.lesioni[0]?.vaso, testo: document.querySelector('.cac-esito')?.textContent }));
  ok('3 calcificazione misurata, assegnata all\'IVA, con Agatston e categoria', r.n === 1 && r.ag > 0 && r.vaso === 'IVA' && /CAC-DRS A[1-3]\/N1/.test(r.testo), r);
  // un secondo clic sulla stessa la riassegna, non la conta due volte
  await a.evaluate(() => document.querySelector('[data-cac-vaso="CD"]').click());
  if (trovata) await a.evaluate(async (t) => { await window.__dbg.calcioDa(window.__dbg.V.attivo, { x: t.x, y: t.y }); }, trovata);
  ok('4 stessa calcificazione: riassegnata, non contata due volte', await a.evaluate(() => window.__dbg.CAC.lesioni.length === 1 && window.__dbg.CAC.lesioni[0].vaso === 'CD'));
  await a.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/calcio.png' });
  // scala visiva
  await a.evaluate(() => document.querySelector('[data-cac-modo="visivo"]').click());
  await a.evaluate(() => { for (const s of ['IVA:2', 'CD:2', 'CX:1']) document.querySelector(`[data-cac-vis="${s}"]`).click(); });
  const vis = await a.evaluate(() => document.querySelector('.cac-esito').textContent);
  ok('5 scala visiva: somma 5 → CAC-DRS V2/N3', /V2\/N3/.test(vis), vis);
  await a.evaluate(() => document.querySelector('#cac-referto').click());
  const ref = await a.evaluate(() => document.querySelector('#q-referto')?.value || '');
  ok('6 «Copia nel referto»', /CAC-DRS V2\/N3/.test(ref), ref.slice(0, 160));
  ok('7 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
