// prova_piani.mjs: tasti rapidi, scorrimento col sinistro e piani ricostruiti nel riquadro (2 riquadri)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const CASI = (process.argv[2] || '119,018').split(',');
const PORTA = 18500 + Math.floor(Math.random() * 400), R = (n) => `http://localhost:${PORTA}/?prova&r=${n}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
const browser = await chromium.launch();
const ok = (c, m) => log(c ? 'OK  ' : 'FAIL', m);
try {
  const p = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  p.on('pageerror', (e) => log('PAGEERROR', e.message));
  await p.goto(R(1) + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
  const st = () => p.evaluate(() => { const { V } = window.__dbg; return { tool: V.tool, n: V.n, att: V.attivo, cine: !!V.cine, pan: V.pannelli.slice(0, V.n).map((q) => ({ s: q.sIdx, piano: q.piano, idx: q.idx, nf: q.frames.length, r: q.img?.rows, c: q.img?.cols, spR: q.img?.spRow?.toFixed(2), spC: q.img?.spCol?.toFixed(2), iop: q.img?.iop?.map((x) => +x.toFixed(2)).join(','), wc: q.wc, ww: q.ww })) }; });
  const attendi = () => p.waitForFunction(() => document.querySelector('#caricamento')?.hidden, null, { timeout: 120000 }).then(() => p.waitForTimeout(700));
  for (const n of CASI) {
    log('--- caso', n);
    await p.goto(R(n) + `#/caso/caso-tcia-${n}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
    await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 40000 }); await p.waitForTimeout(1500);
    let s = await st(); ok(s.tool === 'scroll', 'strumento iniziale Scorri: ' + s.tool);
    await p.selectOption('#riquadri', '2'); await p.waitForTimeout(1500);
    // riquadro B attivo: stessa serie del riquadro A
    const box = await p.locator('#canvas').boundingBox();
    await p.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2); await p.waitForTimeout(300);
    s = await st(); log('prima', JSON.stringify(s));
    const sA = s.pan[0].s; await p.evaluate((si) => window.__dbg && document.querySelectorAll('#lista-serie .s')[si]?.click(), sA); await p.waitForTimeout(1500);
    s = await st(); const nativo = await p.evaluate(() => { const i = window.__dbg.V.pannelli[1].img.iop; const n = [i[1]*i[5]-i[2]*i[4], i[2]*i[3]-i[0]*i[5], i[0]*i[4]-i[1]*i[3]].map(Math.abs); return ['s','c','a'][n.indexOf(Math.max(...n))]; });
    const tasto = nativo === 'a' ? 'c' : 'a';
    await p.keyboard.press(tasto); await attendi();
    s = await st(); log('dopo', tasto, JSON.stringify(s));
    ok(s.pan[1].piano && s.pan[0].piano == null && s.n === 2, `piano ${s.pan[1].piano} nel solo riquadro B, A invariato, sempre 2 riquadri`);
    await p.screenshot({ path: OUT + `piani_${n}_1.png` });
    const t2 = nativo === 's' ? 'c' : 's';
    await p.keyboard.press(t2); await attendi(); s = await st(); ok(!!s.pan[1].piano, 'secondo piano: ' + JSON.stringify(s.pan[1]));
    await p.screenshot({ path: OUT + `piani_${n}_2.png` });
    // scorrimento col sinistro nel riquadro B
    const i0 = s.pan[1].idx;
    await p.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.75, box.y + box.height / 2 + 120, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500);
    s = await st(); ok(s.pan[1].idx > i0, `trascinando giù: immagine ${i0} → ${s.pan[1].idx}`);
    { const cx = box.x + box.width * 0.75, cy = box.y + box.height / 2; let a = await st();
      await p.mouse.move(cx, cy); await p.mouse.down({ button: 'right' }); await p.mouse.move(cx + 80, cy + 40, { steps: 6 }); await p.mouse.up({ button: 'right' }); await p.waitForTimeout(200);
      let b = await st(); ok(b.pan[1].ww !== a.pan[1].ww && b.pan[1].idx === a.pan[1].idx, `destro = finestra: ${a.pan[1].ww} → ${b.pan[1].ww}`);
      const z0 = await p.evaluate(() => window.__dbg.P(1).zoom);
      await p.mouse.move(cx, cy); await p.mouse.down({ button: 'middle' }); await p.mouse.move(cx, cy - 80, { steps: 6 }); await p.mouse.up({ button: 'middle' }); await p.waitForTimeout(200);
      const z1 = await p.evaluate(() => window.__dbg.P(1).zoom); ok(z1 > z0, `rotellina premuta su = zoom: ${z0} → ${z1.toFixed(2)}`); }
    // tasti
    for (const [k, atteso] of [['r', 'misura'], ['e', 'roi'], ['z', 'zoom'], ['Escape', 'scroll']]) { await p.keyboard.press(k); await p.waitForTimeout(150); s = await st(); ok(s.tool === atteso, `tasto ${k} → ${s.tool}`); }
    if (n !== '018') for (const [k, wc, ww] of [['1', 40, 400], ['2', -600, 1500], ['5', 200, 600], ['7', 60, 160]]) { await p.keyboard.press(k); await p.waitForTimeout(200); s = await st(); ok(s.pan[1].wc === wc && s.pan[1].ww === ww, `finestra ${k}: ${s.pan[1].wc}/${s.pan[1].ww}`); }
    await p.keyboard.press(' '); await p.waitForTimeout(400); s = await st(); ok(s.cine, 'spazio avvia il cine'); await p.keyboard.press(' '); await p.waitForTimeout(200); s = await st(); ok(!s.cine, 'spazio ferma il cine');
    // ritorno al piano nativo
    await p.keyboard.press(nativo); await attendi(); s = await st(); ok(s.pan[1].piano == null, 'ritorno al piano originale: ' + JSON.stringify(s.pan[1]));
    await p.keyboard.press('?'); await p.waitForTimeout(300); ok(await p.locator('#tasti-rapidi').isVisible(), 'elenco tasti'); await p.screenshot({ path: OUT + `piani_${n}_tasti.png` }); await p.keyboard.press('?');
  }
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
