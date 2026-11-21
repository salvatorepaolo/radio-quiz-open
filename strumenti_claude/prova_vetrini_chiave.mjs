// prova_vetrini_chiave.mjs (1.294): ritaglio, immagini chiave e referto nel visualizzatore dei vetrini, nel client, con i
// vetrini pubblici di prova in ~/rq-vetrini (OpenSlide test data). Controlli:
// - ritaglio (✂, tasto X): rettangolo → finestra con anteprima; JPEG alla risoluzione piena con le dimensioni giuste;
//   PNG; con la vista ruotata di 90° larghezza e altezza si scambiano; l'annotazione (giallo) compare nel ritaglio;
// - immagine chiave dal vetrino (tasto K e dal ritaglio): nella striscia, con la vista; un clic riporta centro, scala, rotazione;
// - misure nel referto (tasto I): il referto si apre con il modello di anatomia patologica e contiene la distanza;
// - i tasti del visualizzatore radiologico non scattano sopra il vetrino; nessuna richiesta fuori dal computer, nessun errore.
// Uso: node prova_vetrini_chiave.mjs   (BROWSER=webkit|firefox)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', DIR = path.join(os.homedir(), 'rq-vetrini');
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || (19560 + Math.floor(Math.random() * 20)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch();
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const tutti = (d) => fs.readdirSync(d).filter((x) => /\.dcm$/i.test(x)).map((x) => path.join(d, x));
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT', acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); for (const k of Object.keys(localStorage)) if (/^rq-(vt-ann|chiave|referto):/.test(k)) localStorage.removeItem(k); } catch {} });
const c = await ctx.newPage(), errori = [], fuori = [];
c.on('pageerror', (e) => errori.push(e.message)); c.on('request', (r) => { if (!/^(http:\/\/localhost|data:|blob:)/.test(r.url())) fuori.push(r.url()); });
c.on('dialog', (d) => d.accept());
const VT = (f, a) => c.evaluate(f, a), fermo = () => c.waitForTimeout(900);
try {
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.setInputFiles('#cl-file', tutti(path.join(DIR, 'jp2k')));
  await c.waitForFunction(() => !document.querySelector('#vista-vetrino')?.hidden && window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 120000 });
  await c.waitForTimeout(1500);
  esito(await c.isVisible('.vt-ritaglia') && await c.isVisible('.vt-chiave') && await c.isVisible('.vt-referto') && await c.isVisible('.vt-al-referto'), 'pulsanti Ritaglia, Chiave, Referto e Misure nel referto');
  await c.click('.vt-ingr[data-m="10"]'); await fermo(); await c.waitForTimeout(1500);
  const R = await VT(() => { const e = document.querySelector('.vt-pane .vt-misure').getBoundingClientRect(); return { x: e.x + e.width / 2, y: e.y + e.height / 2 }; });
  // annotazione: una distanza al centro
  await c.click('.vt-s[data-s="dist"]'); await c.mouse.move(R.x - 60, R.y); await c.mouse.down(); await c.mouse.move(R.x + 60, R.y, { steps: 6 }); await c.mouse.up(); await c.keyboard.press('Escape');
  esito((await VT(() => window.__dbg.VT.ann.length)) === 1, 'distanza disegnata');
  // ------------------------------------------------ ritaglio
  await c.keyboard.press('x');
  esito(await VT(() => document.querySelector('.vt-ritaglia').classList.contains('on')), 'tasto X → strumento Ritaglia');
  await c.mouse.move(R.x - 100, R.y - 80); await c.mouse.down(); await c.mouse.move(R.x + 100, R.y + 80, { steps: 8 }); await c.mouse.up();
  await c.waitForSelector('dialog.vt-rit[open]', { timeout: 10000 });
  await c.waitForSelector('dialog.vt-rit .vt-rit-ant canvas', { timeout: 20000 });
  const opz = await VT(() => [...document.querySelectorAll('.vt-rit-ris option')].map((o) => ({ v: o.value, t: o.textContent, d: o.disabled })));
  const sel = await VT(() => document.querySelector('.vt-rit-ris').value);
  esito(opz.length === 4 && sel === 'piena', 'finestra del ritaglio: 4 risoluzioni, proposta la piena', opz.map((o) => o.t).join(' | '));
  const attesa = opz.find((o) => o.v === 'piena').t.match(/([\d.,]+) × ([\d.,]+) px/).slice(1).map((x) => +x.replace(/[.,]/g, ''));
  // 200 × 160 pixel dello schermo a 10× (1 µm per pixel) ≈ 800 × 640 pixel del vetrino (0,25 µm)
  const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 60000 }), c.click('.vt-rit-scarica')]);
  const f = await dl.path(), buf = fs.readFileSync(f), jpg = buf[0] === 0xff && buf[1] === 0xd8;
  const dim = await VT(() => ({ w: window.__dbg.VT.ultimoRitaglio?.w, h: window.__dbg.VT.ultimoRitaglio?.h }));
  esito(jpg && /\.jpg$/.test(dl.suggestedFilename()), 'JPEG scaricato', `${dl.suggestedFilename()} · ${(buf.length / 1024).toFixed(0)} kB`);
  const did = await VT(() => document.querySelector('.vt-rit-did').checked);
  esito(dim.w === attesa[0] && Math.abs(dim.h - attesa[1] - (did ? Math.round(30 * Math.max(1, Math.min(8, Math.max(attesa[0], attesa[1]) / 1100))) : 0)) <= 1, 'dimensioni del JPEG = risoluzione piena (+ didascalia)', `${dim.w} × ${dim.h}, atteso ${attesa.join(' × ')}`);
  // giallo dell'annotazione nel ritaglio (composto a risoluzione piena, senza didascalia)
  const giallo = await VT(async () => { const r = window.__dbg.VT; const v = r.vista(); const cv = await r.componi([v.c[0] - 300, v.c[1] - 200, 600, 400], { f: 1, conDid: false, conScala: false });
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 230 && d[i + 1] > 190 && d[i + 2] < 60) n++; return { n, w: cv.width, h: cv.height }; });
  esito(giallo.n > 200 && giallo.w === 600 && giallo.h === 400, 'annotazione disegnata nel ritaglio a risoluzione piena', `${giallo.n} pixel gialli, ${giallo.w} × ${giallo.h}`);
  // PNG
  await c.selectOption('.vt-rit-fmt', 'png');
  const [dl2] = await Promise.all([c.waitForEvent('download', { timeout: 60000 }), c.click('.vt-rit-scarica')]);
  const b2 = fs.readFileSync(await dl2.path()); esito(b2[1] === 0x50 && b2[2] === 0x4e && b2[3] === 0x47, 'PNG scaricato', dl2.suggestedFilename());
  // immagine chiave dal ritaglio
  await c.click('.vt-rit-chiave'); await c.waitForTimeout(400);
  const ic1 = await VT(() => window.__dbg.IC.lista.map((x) => ({ vt: x.vt, serie: x.serie, w: x.w, h: x.h })));
  esito(ic1.length === 1 && ic1[0].vt?.rit?.length === 4, 'immagine chiave dal ritaglio, con la zona ritagliata', JSON.stringify(ic1[0]?.vt));
  await c.click('.vt-rit-annulla');
  // vista ruotata di 90°: larghezza e altezza scambiate
  await c.click('.vt-ruota[data-r="90"]'); await fermo();
  const rot = await VT(async () => { const r = window.__dbg.VT, v = r.vista(), cv = await r.componi([v.c[0] - 300, v.c[1] - 100, 600, 200], { f: 1, conDid: false }); return [cv.width, cv.height, v.r]; });
  esito(rot[0] === 200 && rot[1] === 600 && rot[2] === 90, 'ritaglio con la vista ruotata di 90°: lati scambiati', rot.join(' · '));
  // ------------------------------------------------ immagine chiave della vista (tasto K) e ritorno
  const prima = await VT(() => window.__dbg.VT.vista());
  await c.keyboard.press('k'); await c.waitForTimeout(500);
  const ic2 = await VT(() => ({ n: window.__dbg.IC.lista.length, ult: window.__dbg.IC.lista.at(-1), did: window.__dbg.didascaliaBase(window.__dbg.IC.lista.at(-1)), etichetta: document.querySelector('.vt-chiave-n')?.textContent }));
  esito(ic2.n === 2 && ic2.ult.vt && ic2.ult.url.startsWith('data:image/jpeg') && Math.max(ic2.ult.w, ic2.ult.h) <= 1600, 'tasto K → immagine chiave della vista (JPEG, al massimo 1600 px)', `${ic2.ult.w} × ${ic2.ult.h} · «${ic2.did}» · pulsante «${ic2.etichetta}»`);
  esito(/10×/.test(ic2.did) && ic2.ult.misure.some((m) => /distanza/.test(m)), 'didascalia con l\'ingrandimento e misure dell\'immagine chiave', ic2.ult.misure.join('; '));
  await c.keyboard.press('0'); await c.click('.vt-ruota[data-r="-90"]'); await fermo();
  await VT(() => window.__dbg.vaiIC(window.__dbg.IC.lista.at(-1))); await fermo();
  const dopo = await VT(() => window.__dbg.VT.vista());
  esito(Math.abs(dopo.c[0] - prima.c[0]) <= 3 && Math.abs(dopo.c[1] - prima.c[1]) <= 3 && Math.abs(dopo.um / prima.um - 1) < 0.02 && dopo.r === prima.r, 'clic sull\'immagine chiave → stessa vista (centro, scala, rotazione)', `${JSON.stringify(prima)} / ${JSON.stringify(dopo)}`);
  esito(await VT(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('rq-chiave:'))) || '[]').length) === 2, 'immagini chiave salvate nel browser');
  // ------------------------------------------------ misure nel referto
  await c.keyboard.press('i'); await c.waitForSelector('#dlg-referto[open]', { timeout: 15000 }); await c.waitForTimeout(600);
  const ref = await VT(() => ({ modello: document.querySelector('#ref-modello').value, testo: document.querySelector('#ref-testo').innerText, img: document.querySelectorAll('#ref-ic figure').length }));
  esito(ref.modello === 'anatomia-patologica', 'referto con il modello di anatomia patologica', ref.modello);
  esito(/distanza \d/.test(ref.testo) && /MICROSCOPICA/.test(ref.testo), 'tasto I → misure del vetrino nel referto', ref.testo.replace(/\s+/g, ' ').slice(0, 160));
  esito(ref.img === 2, 'le 2 immagini chiave del vetrino sono nel referto', ref.img);
  await c.keyboard.press('Escape'); await c.waitForTimeout(400);
  esito(!fuori.length, 'nessuna richiesta fuori dal computer', fuori.slice(0, 3).join(' '));
} catch (e) { esito(false, 'prova interrotta', e.message.split('\n')[0]); }
esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 3).join(' | '));
console.log(`\n${ok} superati, ${ko} non superati`);
await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
