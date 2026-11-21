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
  const errori=[];
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-004'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-004', null, { timeout: 60000 }); await a.waitForTimeout(1500);
  await a.click('#modo-mpr'); await a.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }); await a.waitForTimeout(3000);
  const M = (f, x) => a.evaluate(f, x);
  const rett = (id) => M((id) => { const r = document.querySelector('#' + id).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }, id);
  const [ass, cor, sag, vr] = [await rett('vp-assiale'), await rett('vp-coronale'), await rett('vp-sagittale'), await rett('vp-3d')];
  ok('10 disposizione Esaote: assiale, coronale, sagittale in colonna a sinistra, 3D grande a destra',
    ass.x === cor.x && cor.x === sag.x && ass.y < cor.y && cor.y < sag.y && vr.x > ass.x + ass.w && vr.w > 1.8 * ass.w && vr.h > 2.5 * ass.h, { ass, cor, sag, vr });
  const cx2 = ass.x + ass.w / 2, cy2 = ass.y + ass.h / 2;
  const F = () => M(() => { const d = window.__dbg.MPR.modulo._diagnosi(); return [d.assiale.fuoco, d.coronale.fuoco, d.sagittale.fuoco].map(String).join(' | '); });
  await a.click('[data-mpr-tool="pan"]'); await a.waitForTimeout(200);
  console.log('inizio', await F());
  await a.mouse.move(cx2, cy2); await a.mouse.down(); await a.mouse.move(cx2 + 40, cy2 + 30, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(300);
  console.log('pan dal centro', await F());
  await a.mouse.move(ass.x + 40, ass.y + 40); await a.mouse.down(); await a.mouse.move(ass.x + 80, ass.y + 70, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(300);
  console.log('pan dall angolo', await F());
  await a.mouse.click(ass.x + ass.w * 0.3, ass.y + ass.h * 0.75); await a.waitForTimeout(300);
  console.log('clic (pan attivo)', await F());
  await a.click('[data-mpr-tool="crosshair"]'); await a.mouse.click(ass.x + ass.w * 0.3, ass.y + ass.h * 0.75); await a.waitForTimeout(300);
  console.log('clic (linee)', await F(), JSON.stringify(await M(() => window.__dbg.MPR.modulo.centroMirino())));
  await a.click('[data-mpr-tool="pan"]'); await a.waitForTimeout(200);
  await a.mouse.move(cx2, cy2); await a.mouse.down(); await a.mouse.move(cx2 + 40, cy2 + 30, { steps: 8 }); await a.mouse.up(); await a.waitForTimeout(300);
  console.log('pan dopo clic', await F());
} catch (e) { console.log('ERRORE', e); } finally { await b.close(); sim.kill(); process.exit(0); }
