// prova_v210.mjs: client, l'esame si riapre dopo un ricaricamento della pagina (riferimenti alla cartella, qui una cartella OPFS)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18600 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
let ctx; try {
  ctx = await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/rq-profilo-'), { viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); const c = await ctx.newPage().then(async (pg) => { await pg.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} }); return pg; }); c.on('pageerror', (e) => errori.push(e.message)); c.on('crash', () => console.log('   PAGINA CRASH')); c.on('close', () => console.log('   PAGINA CHIUSA')); c.on('console', (m) => { if (!/GL Driver|GPU stall/.test(m.text())) console.log('   console', m.type(), m.text().slice(0, 200)); }); c.on('dialog', (d) => { console.log('   dialogo', d.type(), d.message()); d.accept(); });
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  ok('1 selettori con riferimento disponibili', await c.evaluate(() => 'showDirectoryPicker' in window && 'showOpenFilePicker' in window));
  // file DICOM in una cartella OPFS (stessa interfaccia delle cartelle scelte dall'utente)
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.evaluate(() => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.id = 'prova-in'; document.body.append(i); });
  await c.setInputFiles('#prova-in', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-001/serie'));
  await c.evaluate(async () => {
    const radice = await navigator.storage.getDirectory(), dir = await radice.getDirectoryHandle('esame-prova', { create: true });
    for (const f of document.querySelector('#prova-in').files) { const h = await dir.getFileHandle(f.name, { create: true }), w = await h.createWritable(); await w.write(f); await w.close(); }
    const fl = await window.__dbg.fileDaManiglie([dir]); await window.__dbg.ricordaManiglie([dir]); await window.__dbg.caricaClient(fl);
  });
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1000);
  const n1 = await c.evaluate(() => window.__dbg.V.serie.length);
  ok('2 esame aperto dalla cartella', n1 > 0, n1);
  // chiuso l'esame, il pulsante lo riapre
  await c.click('#cl-chiudi'); await c.waitForTimeout(400); if (await c.$('#cl-chiudi-menu')) await c.click('#cl-chiudi-menu [data-tutti]'); await c.waitForTimeout(800);
  const pul = await c.evaluate(() => ({ vis: !document.querySelector('#cl-ultimo').hidden, testo: document.querySelector('#cl-ultimo').textContent }));
  ok('4 home: «Riapri l\'ultimo esame» visibile', pul.vis && /esame-prova/.test(pul.testo), pul);
  await c.click('#cl-ultimo'); await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }).catch(() => {});
  ok('5 il pulsante riapre l\'esame', await c.evaluate(() => location.hash === '#/caso/locale' && !!window.__dbg.V.img));
  // Maiusc+Cmd+R: ricaricamento
  console.log('   ricarico'); await c.reload().catch((e) => console.log('   reload', e.message)); console.log('   ricaricata'); await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }).catch(() => {});
  await c.waitForTimeout(1000);
  const dopo = await c.evaluate(() => ({ hash: location.hash, serie: window.__dbg?.V?.serie?.length, img: !!window.__dbg?.V?.img }));
  ok('3 dopo il ricaricamento l\'esame si riapre da solo', dopo.hash === '#/caso/locale' && dopo.serie === n1 && dopo.img, dopo);
  ok('6 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await ctx?.close?.().catch(() => {}); await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
