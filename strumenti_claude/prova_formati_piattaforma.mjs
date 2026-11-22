// prova_formati_piattaforma.mjs: vetrini non DICOM in un caso della piattaforma (simulatore locale), letti dal sito a pezzi
// con richieste parziali come da S3/CloudFront. Caso di prova costruito in una cartella temporanea con collegamenti ai file
// di /Volumes/Caloggero/vetrini_formati_prova (non in git). Per ogni vetrino del caso: si apre, si vede, al livello pieno le
// tessere arrivano, calibrazione presente, nessun errore.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', DIR = '/Volumes/Caloggero/vetrini_formati_prova', CASI0 = '/Volumes/Caloggero/piattaforma-quiz/casi-free';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23750, B = `http://localhost:${PORTA}`, ID = process.env.PREPARATI ? 'caso-pv' : 'caso-prova-formati';
const VETRINI = [
  ['Aperio SVS', ['Aperio/CMU-1-Small-Region.svs']], ['Hamamatsu NDPI', ['Hamamatsu/CMU-1.ndpi']],
  ['3DHISTECH MRXS', ['Mirax/CMU-1-Saved-1_16.mrxs', ...fs.readdirSync(path.join(DIR, 'Mirax/CMU-1-Saved-1_16')).map((x) => 'Mirax/CMU-1-Saved-1_16/' + x)]],
  ['Zeiss CZI', ['Zeiss/Zeiss-5-JXR.czi']], ['Philips iSyntax', ['Philips-iSyntax/testslide.isyntax']], ['Leica SCN fluorescenza', ['Leica/Leica-Fluorescence-1.scn']],
].filter(([, l]) => l.every((x) => fs.existsSync(path.join(DIR, x))));
// caso temporaneo: caso.json del caso 136 (solo vetrino), serie.json con un vetrino per formato
// PREPARATI=<cartella dei casi>: usa un caso già preparato con strumenti/prepara_vetrino.py (file ripuliti) invece di costruirlo
const PREP = process.env.PREPARATI, CASI = PREP || fs.mkdtempSync(path.join(os.tmpdir(), 'casi-formati-')), C = path.join(CASI, ID);
if (!PREP) {
fs.mkdirSync(path.join(C, 'serie'), { recursive: true });
const caso = JSON.parse(fs.readFileSync(path.join(CASI0, 'caso-tcia-136/caso.json'), 'utf8')); caso.titolo = 'Prova formati'; delete caso.zona_vetrino; delete caso.localizza;
fs.writeFileSync(path.join(C, 'caso.json'), JSON.stringify(caso));
const serie = VETRINI.map(([nome, l], k) => {
  const files = l.map((x) => { const dst = path.join(C, 'serie', `v${k}`, path.relative(path.dirname(l[0]), x)); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.symlinkSync(path.join(DIR, x), dst); return path.relative(C, dst); });
  return { descrizione: nome, tipo: 'vetrino', files, dimensioni: l.map((x) => fs.statSync(path.join(DIR, x)).size) };
});
fs.writeFileSync(path.join(C, 'serie.json'), JSON.stringify(serie));
} else { VETRINI.length = 0; for (const x of JSON.parse(fs.readFileSync(path.join(C, 'serie.json'), 'utf8'))) VETRINI.push([x.descrizione, x.files]); }
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' }), p = await ctx.newPage(), err = [];
p.on('pageerror', (e) => err.push(e.message));
try {
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 20000 });
  await p.goto(B + `/?prova#/caso/${ID}`);
  for (const [k, [nome]] of VETRINI.entries()) {
    const t0 = Date.now();
    if (k > 0) await p.evaluate((k) => window.__dbg.apriVetrinoClient(k, { incorporato: true }), k);
    const aperto = await p.waitForFunction((k) => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1 && window.__dbg.VT.vista().i === k, k, { timeout: 120000 }).then(() => true, () => false);
    esito(aperto, `${nome}: si apre dal sito`, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (!aperto) { console.log('   ', await p.evaluate(() => document.querySelector('.vista-vetrino .errore')?.textContent || '')); continue; }
    await p.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).catch(() => {});
    const info = await p.evaluate(() => { const vt = window.__dbg.VT; return { sp: vt.sp, W: vt.V.W, formato: vt.V.formato, et: !!document.querySelector('.vt-etichetta'), pan: !!document.querySelector('.vt-panoramica') }; });
    // al centro del vetrino, a 1 pixel dello schermo per pixel del vetrino
    await p.evaluate(() => { const vt = window.__dbg.VT; vt.vaiVista({ i: vt.vista().i, c: [vt.V.W / 2, vt.V.H / 2], s: 1, r: 0 }); });
    const pieno = await p.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).then(() => true, () => false);
    esito(pieno && info.formato, `${nome}: tessere al livello pieno dal sito`, `${info.formato}, ${info.W} px di larghezza, ${info.sp?.toFixed?.(3)} µm/pixel`);
    esito(!info.et && !info.pan, `${nome}: sulla piattaforma niente etichetta né panoramica (possono avere i dati del paziente)`);
  }
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!err.length, 'nessun errore JavaScript', err.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); if (!PREP) fs.rmSync(CASI, { recursive: true, force: true }); process.exit(ko ? 1 : 0);
