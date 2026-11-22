// prova_giro_completo.mjs (1.302): giro completo del visualizzatore, come lo farebbe una persona, a ogni pubblicazione.
// Visualizzatore scaricabile (esame TC aperto dal disco): misura, immagine chiave, referto con le misure e PDF, esportazione
// delle immagini chiave (PDF) e delle misure come DICOM SR, MPR + 3D con il menu «Avanzate», solo immagini (F), chiusura.
// Piattaforma (simulatore, amministratore): caso TC con la disposizione automatica, misura, immagine chiave, referto, MPR,
// solo immagini, ritorno all'elenco. Nessun errore JavaScript, nessuna richiesta fuori dal computer nel client.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23981, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const tutti = (id) => { const d = path.join(CASI, id, 'serie'); return fs.readdirSync(d, { recursive: true }).filter((x) => /\.dcm$/i.test(x)).map((x) => path.join(d, x)); };
const b = await chromium.launch(), err = [];
const nMisure = (p) => p.evaluate(() => Object.values(window.__dbg.V.misure || {}).reduce((a, l) => a + l.filter((m) => !m.copia).length, 0));
const misura = async (p) => {   // tasto R e trascinamento al centro del riquadro attivo
  const c = await p.evaluate(() => { const e = document.querySelector('#stage canvas'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.keyboard.press('r'); await p.mouse.move(c.x - 40, c.y); await p.mouse.down(); await p.mouse.move(c.x + 40, c.y + 10, { steps: 6 }); await p.mouse.up(); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
};
const scarica = async (p, azione) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), azione()]); return fs.readFileSync(await d.path()); };
try {
  // ======================================== visualizzatore scaricabile
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT', acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-protocollo-auto', '0'); } catch {} });
  const c = await ctx.newPage(), fuori = []; c.on('pageerror', (e) => err.push('client: ' + e.message)); c.on('dialog', (d) => d.accept());
  c.on('request', (r) => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) fuori.push(r.url()); });
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  esito(await c.isVisible('#cl-guida'), 'client: guida rapida alla prima apertura');
  await c.click('#cl-guida-ok'); esito(!(await c.isVisible('#cl-guida')), 'client: «Ho capito» chiude la guida');
  await c.setInputFiles('#cl-file', tutti('caso-tcia-004')); await c.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 90000 }); await c.waitForTimeout(800);
  esito(true, 'client: esame aperto dal disco', await c.evaluate(() => `${window.__dbg.V.serie.length} serie`));
  await misura(c); esito(await nMisure(c) >= 1, 'client: distanza misurata (R + trascinamento)');
  await c.keyboard.press('k'); await c.waitForTimeout(400); esito(await c.evaluate(() => window.__dbg.IC.lista.length) === 1, 'client: immagine chiave (K)');
  await c.click('#cl-referto'); await c.waitForSelector('#dlg-referto[open]', { timeout: 15000 }); await c.waitForTimeout(400);
  await c.click('#ref-misure-ins'); await c.waitForTimeout(300);
  const testoRef = await c.evaluate(() => document.querySelector('#ref-testo').innerText);
  esito(/\d+([.,]\d+)?\s*mm/.test(testoRef), 'client: referto con la misura inserita', testoRef.replace(/\s+/g, ' ').slice(0, 80));
  const pdf = await scarica(c, () => c.click('#ref-pdf')); esito(pdf.slice(0, 4).toString() === '%PDF' && pdf.length > 5000, 'client: referto in PDF', `${(pdf.length / 1024).toFixed(0)} kB`);
  await c.keyboard.press('Escape'); await c.waitForTimeout(300); if (await c.isVisible('#dlg-referto[open]')) await c.click('#ref-chiudi');
  await c.click('#cl-esporta'); await c.waitForSelector('#dlg-esporta[open]');
  await c.check('input[name="ex-cosa"][value="chiave-pdf"]'); const pk = await scarica(c, () => c.click('#ex-vai'));
  esito(pk.slice(0, 4).toString() === '%PDF', 'client: immagini chiave esportate in PDF', `${(pk.length / 1024).toFixed(0)} kB`);
  await c.check('input[name="ex-cosa"][value="sr"]'); const sr = await scarica(c, () => c.click('#ex-vai'));
  esito(sr.slice(128, 132).toString() === 'DICM', 'client: misure esportate come DICOM SR', `${sr.length} byte`);
  await c.click('#ex-chiudi');
  await c.click('#modo-mpr'); await c.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#vp-assiale canvas'), null, { timeout: 120000 }); await c.waitForTimeout(1200);
  await c.click('#menu-mpr-avanzate > summary'); await c.waitForTimeout(200);
  esito(await c.evaluate(() => document.querySelector('#menu-mpr-avanzate').open && !!document.querySelector('#menu-mpr-avanzate #mpr-seg')), 'client: MPR + 3D con il menu «Avanzate»');
  await c.keyboard.press('Escape'); await c.click('#modo-2d'); await c.waitForTimeout(600);
  await c.mouse.click(5, 895).catch(() => {}); await c.keyboard.press('f'); await c.waitForTimeout(500);
  const solo = await c.evaluate(() => document.body.classList.contains('solo-immagini') && getComputedStyle(document.querySelector('header.top')).display === 'none');
  await c.keyboard.press('Escape'); await c.waitForTimeout(300);
  esito(solo && !(await c.evaluate(() => document.body.classList.contains('solo-immagini'))), 'client: solo immagini (F) e ritorno (Esc)');
  await c.click('#cl-chiudi'); await c.waitForTimeout(300);
  if (await c.isVisible('#cl-chiudi-menu [data-tutti]')) await c.click('#cl-chiudi-menu [data-tutti]');   // più esami aperti: «Tutti gli esami»
  await c.waitForTimeout(400); if (await c.isVisible('#dlg-ann[open]')) await c.click('#dlg-ann button[value="no"]');   // misure non salvate: «Non salvare»
  await c.waitForSelector('#vista-client:not([hidden])', { timeout: 15000 });
  esito(true, 'client: esame chiuso, di nuovo la pagina iniziale');
  esito(!fuori.length, 'client: nessuna richiesta fuori dal computer', fuori.slice(0, 2).join(' '));
  await ctx.close();
  // ======================================== piattaforma
  const ctx2 = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT', acceptDownloads: true });
  const p = await ctx2.newPage(); p.on('pageerror', (e) => err.push('piattaforma: ' + e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 60000 }); await p.waitForTimeout(2500);
  const n = await p.evaluate(() => window.__dbg.V.n); esito(n >= 2, 'piattaforma: TC del torace con la disposizione automatica', `${n} riquadri`);
  await misura(p); esito(await nMisure(p) >= 1, 'piattaforma: distanza misurata');
  await p.keyboard.press('k'); await p.waitForTimeout(400); esito(await p.evaluate(() => window.__dbg.IC.lista.length) >= 1, 'piattaforma: immagine chiave (K)');
  await p.click('#cl-referto'); await p.waitForSelector('#dlg-referto[open]', { timeout: 15000 });
  esito(true, 'piattaforma: editor del referto aperto'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); if (await p.isVisible('#dlg-referto[open]')) await p.click('#ref-chiudi');
  await p.click('#modo-mpr'); await p.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelector('#vp-assiale canvas'), null, { timeout: 120000 }); await p.waitForTimeout(1000);
  esito(await p.isVisible('#menu-mpr-avanzate > summary'), 'piattaforma: MPR + 3D con il menu «Avanzate»');
  await p.click('#modo-2d'); await p.waitForTimeout(500);
  await p.mouse.click(5, 895).catch(() => {}); await p.keyboard.press('f'); await p.waitForTimeout(400);
  const soloP = await p.evaluate(() => document.body.classList.contains('solo-immagini') && getComputedStyle(document.querySelector('#vista-caso > aside.quiz')).display === 'none');
  await p.keyboard.press('f'); await p.waitForTimeout(300); esito(soloP, 'piattaforma: solo immagini (F): niente pannello delle domande, poi di nuovo');
  await p.click('#cl-chiudi'); await p.waitForTimeout(500);
  if (await p.isVisible('#dlg-ann[open]')) await p.click('#dlg-ann button[value="no"]');   // misure non salvate: «Chiudi senza salvare»
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 }); esito(true, 'piattaforma: «✕ Chiudi» → di nuovo l\'elenco dei casi');
  await ctx2.close();
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`); console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
