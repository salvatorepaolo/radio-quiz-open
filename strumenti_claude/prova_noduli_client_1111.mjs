// prova_noduli_client_1111.mjs: noduli IA facoltativi nel client (download del modello, analisi nel browser, cerchi e pannello)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19400 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ headless: process.env.VEDI ? false : true, args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal'] });
let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
const D = '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-034/serie/0002_SIMULATO/';
const attesi = JSON.parse(fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-034/ia/0002_SIMULATO.json')).analisi.noduli.map((n) => n.centro_lps);
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage();
  c.on('pageerror', (e) => errori.push(e.message)); c.on('console', (m) => { if (m.type() === 'error') errori.push('console: ' + m.text()); });
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  ok('1 opzione nelle impostazioni, spenta di base', await c.evaluate(() => !!document.querySelector('#cl-imp-noduli') && !document.querySelector('#cl-imp-noduli').checked));
  await c.evaluate(() => { document.querySelector('#cl-impostazioni').open = true; });
  await c.check('#cl-imp-noduli'); await c.waitForTimeout(500);
  await c.click('#cl-noduli-scarica');
  await c.waitForFunction(() => /Modello scaricato/.test(document.querySelector('#cl-noduli-stato').textContent), null, { timeout: 180000 });
  ok('2 modello scaricato nella cache del browser', await c.evaluate(async () => { const k = await caches.keys(); return k.includes('rq-modelli-noduli-v2'); }));
  const webgpu = await c.evaluate(() => !!navigator.gpu);
  const files = fs.readdirSync(D).filter((f) => f.endsWith('.dcm')).map((f) => D + f);
  const t0 = Date.now();
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 });
  await c.waitForTimeout(5000);
  let partito = await c.evaluate(() => /%/.test(document.querySelector('#btn-noduli .n')?.textContent || '') || document.querySelector('#btn-noduli .n')?.textContent !== '');
  if (!partito) { await c.click('#btn-noduli'); await c.waitForTimeout(500); if (await c.$('#nod-avvia')) await c.click('#nod-avvia'); }
  ok('3 pulsante 🫁 visibile nella TC del torace', await c.evaluate(() => !document.querySelector('#btn-noduli').hidden), { autoPartito: partito, webgpu });
  console.log('   pannello:', await c.evaluate(() => document.querySelector('#nod-pannello').innerText.slice(0, 300)));
  let ultimo = '';
  for (let i = 0; i < 1200; i++) {
    const s = await c.evaluate(() => document.querySelector('#btn-noduli .n')?.textContent || '');
    if (s !== ultimo || i % 15 === 0) { console.log('   …', s, await c.evaluate(() => document.querySelector('#nod-pannello').innerText.slice(0, 160).replace(/\n/g, ' | ')), Math.round((Date.now() - t0) / 1000) + ' s'); ultimo = s; }
    if (/^\d+$/.test(s)) break;
    await c.waitForTimeout(2000);
  }
  const tempo = Math.round((Date.now() - t0) / 1000);
  const l = await c.evaluate(() => [...window.__dbg.NOD?.cache?.values?.() || []][0] || null);
  const trovati = (l || []).map((x) => ({ d: x.diametro_medio_mm, tipo: x.tipo, lr: x.lung_rads, s: x.score, dist: Math.min(...[0].map(() => 0), 1e9) , c: x.centro_lps }));
  const vicini = attesi.map((a) => Math.min(...(l || []).map((x) => Math.hypot(...x.centro_lps.map((v, k) => v - a[k]))))).map((v) => +v.toFixed(1));
  ok('4 trova i noduli noti dell\'analisi online (centro entro 6 mm)', vicini.every((v) => v <= 6), { tempo, vicini, trovati });
  await c.evaluate(() => { if (document.querySelector('#nod-pannello').hidden) document.querySelector('#btn-noduli').click(); });
  await c.waitForTimeout(400);
  const righe = await c.evaluate(() => document.querySelectorAll('#nod-pannello tbody tr').length);
  ok('5 pannello con l\'elenco', righe === (l || []).length && righe > 0, righe);
  const i0 = await c.evaluate(() => window.__dbg.V.idx);
  await c.click('#nod-pannello .ia-nodulo'); await c.waitForTimeout(1200);
  ok('6 «vai» porta all\'immagine del nodulo', (await c.evaluate(() => window.__dbg.V.idx)) !== i0);
  await c.screenshot({ path: '/Volumes/Caloggero/_viste/noduli_client.png' });
  ok('7 nessun errore', errori.length === 0, errori.slice(0, 5));
} catch (e) { console.log('KO eccezione', e.message); ko++; }
finally { await b.close(); sim.kill(); }
console.log(ko ? `${ko} KO` : 'TUTTO OK'); process.exit(ko ? 1 : 0);
