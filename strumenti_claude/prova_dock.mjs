// prova_dock.mjs (1.278): nel visualizzatore scaricabile su monitor largo, immagini chiave e misure vanno nella colonna a
// destra e l'immagine non si accorcia; su telefono restano sotto. Schermate in /tmp/dock_*.png
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23481, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
process.on('uncaughtException', (e) => { console.log('KO  ' + e.message.split('\n')[0]); sim.kill(); process.exit(1); });
const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
giro(path.join(CASI, 'caso-tcia-001', 'serie', '0003_Recon_2_CHEST'));
const b = await chromium.launch(); let ok = 0, ko = 0; const esito = (c, t) => { console.log(`${c ? 'OK' : 'KO'}  ${t}`); c ? ok++ : ko++; };
for (const [nome, w, h] of [['largo', 1600, 900], ['telefono', 390, 844]]) {
  const c = await (await b.newContext({ viewport: { width: w, height: h }, locale: 'it-IT' })).newPage(), err = [];
  c.on('pageerror', (e) => err.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }); await c.click('#pr-accetto');
  await c.setInputFiles('#cl-file', files.slice(0, 120));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 });
  await c.waitForTimeout(1500);
  const alt = () => c.evaluate(() => { const r = document.querySelector('#stage').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  const prima = await alt();
  // cinque immagini chiave (tasto K) e alcune misure ROI
  for (let k = 0; k < 5; k++) { await c.evaluate(() => document.querySelector('#cl-chiave')?.click()); await c.waitForTimeout(400); await c.keyboard.press('ArrowDown'); }
  await c.evaluate(async () => { const d = window.__dbg; for (let i = 0; i < 3; i++) await d.volumeDa?.(d.V.attivo, { x: 200 + i * 20, y: 250 }, d.P().idx).catch(() => {}); });
  await c.waitForTimeout(1500);
  const dopo = await alt(), dock = await c.evaluate(() => { const d = document.querySelector('#dock'), r = d?.getBoundingClientRect(); return { vis: !!d && getComputedStyle(d).display !== 'none', x: Math.round(r?.left || 0), w: Math.round(r?.width || 0), ic: !document.querySelector('#ic-striscia')?.hidden }; });
  await c.screenshot({ path: `/tmp/dock_${nome}.png` });
  if (nome === 'largo') {
    esito(dock.vis && dock.x > dopo[0] - 5 && dock.w > 200, `colonna dei risultati a destra (${dock.w} px)`);
    esito(dopo[1] >= prima[1] - 30,   // la striscia dei segni (22 px) sotto l immagine c era già
    `altezza dell'immagine invariata: ${prima[1]} → ${dopo[1]} px`);
    await c.click('#dock-chiudi'); await c.waitForTimeout(400); const chiusa = await alt();
    esito(chiusa[0] > dopo[0] + 150, `colonna chiusa: immagine più larga ${dopo[0]} → ${chiusa[0]} px`);
  } else esito(!dock.vis || dock.x < 20, 'telefono: risultati sotto le immagini');
  esito(!err.length, `${nome}: nessun errore JavaScript` + (err.length ? ': ' + err.join(' | ') : ''));
  esito(dock.ic, `${nome}: immagini chiave presenti`);
}
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`); await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
