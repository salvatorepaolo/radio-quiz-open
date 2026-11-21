// sonda_mpr.mjs: comportamento attuale dell'MPR (sposta, modifica misure, testo, clic sulle linee di riferimento)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19700 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = [];
const CASO = process.env.CASO || 'caso-tcia-004';
try {
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/' + CASO); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, CASO, { timeout: 60000 }); await a.waitForTimeout(1500);
  await a.click('#modo-mpr'); await a.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await a.waitForTimeout(3000);
  const M = (f, x) => a.evaluate(f, x);
  const rett = async (id) => M((id) => { const r = document.querySelector('#' + id).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, id);
  const R = await rett('vp-assiale'); const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
  const diag = () => M(() => window.__dbg.MPR.modulo._diagnosi());
  console.log('rettangoli', JSON.stringify({ ass: R, cor: await rett('vp-coronale'), sag: await rett('vp-sagittale'), vr: await rett('vp-3d') }));
  // 1 sposta
  await a.click('[data-mpr-tool="pan"]'); await a.waitForTimeout(200);
  const f0 = (await diag()).assiale.fuoco;
  await a.mouse.move(cx, cy); await a.mouse.down(); await a.mouse.move(cx + 60, cy + 40, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(300);
  const f1 = (await diag()).assiale.fuoco;
  console.log('SPOSTA', JSON.stringify({ f0, f1, stato: await M(() => window.__dbg.MPR.modulo._stato().opzioni) }));
  // 2 cursore con «scorri»
  await a.click('[data-mpr-tool="scorri"]'); await a.waitForTimeout(200);
  await a.mouse.move(cx + 10, cy + 10); await a.waitForTimeout(100);
  console.log('CURSORE scorri', await M(() => { const el = document.querySelector('#vp-assiale'); const c = el.querySelector('canvas') || el; return [getComputedStyle(el).cursor, el.style.cursor, getComputedStyle(c).cursor, [...el.querySelectorAll('*')].map((x) => x.style.cursor).filter(Boolean).slice(0, 4)]; }));
  // 3 zoom con la rotellina premuta: su
  const z0 = await M(() => window.__dbg.MPR.modulo.csUtils && 0);
  const scala = () => M(() => { const m = window.__dbg.MPR.modulo; return m._scala ? m._scala() : null; });
  // 4 distanza, poi modifica della maniglia e del testo (con «scorri» attivo)
  await a.click('[data-mpr-tool="misura"]'); await a.waitForTimeout(200);
  await a.mouse.move(cx - 60, cy - 60); await a.mouse.down(); await a.mouse.move(cx - 20, cy - 60, { steps: 6 }); await a.mouse.up(); await a.waitForTimeout(400);
  const m0 = await M(() => window.__dbg.MPR.modulo._misure().map((x) => ({ tool: x.tool, punti: x.punti?.map((p) => p.map((v) => +v.toFixed(1))), len: x.stats?.length })));
  console.log('MISURA', JSON.stringify(m0));
  const tb0 = await M(() => window.__dbg.MPR.modulo.csUtils ? null : null);
  await a.click('[data-mpr-tool="scorri"]'); await a.waitForTimeout(200);
  // trascina la seconda maniglia
  await a.mouse.move(cx - 20, cy - 60); await a.mouse.down(); await a.mouse.move(cx + 20, cy - 60, { steps: 6 }); await a.mouse.up(); await a.waitForTimeout(400);
  const m1 = await M(() => window.__dbg.MPR.modulo._misure().map((x) => ({ punti: x.punti?.map((p) => p.map((v) => +v.toFixed(1))), len: x.stats?.length })));
  console.log('DOPO MANIGLIA (scorri)', JSON.stringify(m1));
  await a.click('[data-mpr-tool="crosshair"]'); await a.waitForTimeout(200);
  await a.mouse.move(cx + 20, cy - 60); await a.mouse.down(); await a.mouse.move(cx + 50, cy - 60, { steps: 6 }); await a.mouse.up(); await a.waitForTimeout(400);
  const m2 = await M(() => window.__dbg.MPR.modulo._misure().map((x) => ({ punti: x.punti?.map((p) => p.map((v) => +v.toFixed(1))), len: x.stats?.length })));
  console.log('DOPO MANIGLIA (linee rif.)', JSON.stringify(m2));
  // 5 clic con le linee di riferimento
  const c0 = await M(() => window.__dbg.MPR.modulo.centroMirino());
  await a.mouse.click(R.x + R.w * 0.3, R.y + R.h * 0.7); await a.waitForTimeout(400);
  const c1 = await M(() => window.__dbg.MPR.modulo.centroMirino());
  console.log('CLIC LINEE', JSON.stringify({ c0, c1, d: (await diag()).coronale.fuoco }));
  await a.screenshot({ path: '/Volumes/Caloggero/_viste/sonda_mpr.png' });
  console.log('ERRORI', JSON.stringify(errori.slice(0, 5)));
} catch (e) { console.log('ERRORE', e); } finally { await b.close(); sim.kill(); process.exit(0); }
