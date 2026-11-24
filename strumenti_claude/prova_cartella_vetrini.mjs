// prova_cartella_vetrini.mjs (1.322): cartella dei vetrini nel visualizzatore client. La finestra di scelta della cartella
// è sostituita da una cartella interna del browser (OPFS) con vetrini di prova di OpenSlide: SVS, CZI, MRXS (file + cartella),
// un TIFF piccolo che non è un vetrino, sottocartelle. Si controllano elenco, ricerca, apertura, permanenza dopo il ricaricamento.
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const DIR = '/Volumes/Caloggero/vetrini_formati_prova', PORTA = 23963, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
process.on('exit', () => sim.kill()); process.on('uncaughtException', (e) => { console.log('ERRORE', e.message.split('\n')[0]); process.exit(1); });
let ok = 0, ko = 0; const esito = (c, m, d = '') => { c ? ok++ : ko++; console.log(`${c ? 'OK' : 'KO'}  ${m}${d !== '' ? ' → ' + d : ''}`); };
// file da mettere nella cartella finta: [percorso nella cartella, file sul disco]
const mrx = fs.readdirSync(path.join(DIR, 'Mirax/CMU-1-Saved-1_16')).map((x) => [`patologia/mirax/CMU-1-Saved-1_16/${x}`, path.join(DIR, 'Mirax/CMU-1-Saved-1_16', x)]);
const FILE = [['patologia/aperio/CMU-1-Small-Region.svs', path.join(DIR, 'Aperio/CMU-1-Small-Region.svs')], ['Zeiss-5-SlidePreview-JXR.czi', path.join(DIR, 'Zeiss/Zeiss-5-SlidePreview-JXR.czi')],
  ['patologia/mirax/CMU-1-Saved-1_16.mrxs', path.join(DIR, 'Mirax/CMU-1-Saved-1_16.mrxs')], ...mrx, ['altro/foto.tif', path.join(DIR, 'foto/ndpi.jpg')], ['altro/note.txt', null]];
// Chrome vero: la versione ridotta di Chromium di Playwright si chiude salvando in IndexedDB una cartella OPFS
const b = await chromium.launch({ channel: 'chrome' }), ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' }), err = [];
await ctx.addInitScript(() => {
  try { localStorage.setItem('rq-cl-privacy-1', '1'); localStorage.setItem('rq-cl-guida-1', '1'); } catch {}
  // la cartella scelta è la cartella «prova» dello spazio privato del browser
  window.showDirectoryPicker = async () => (await navigator.storage.getDirectory()).getDirectoryHandle('prova', { create: true });
});
await ctx.route('**/__prova/**', (r) => { const i = +r.request().url().split('/__prova/')[1]; const [, fp] = FILE[i]; r.fulfill({ status: 200, body: fp ? fs.readFileSync(fp) : Buffer.from('nota di prova') }); });
const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); p.on('crash', () => console.log('PAGINA ANDATA IN CRASH')); p.on('close', () => console.log('pagina chiusa')); p.on('console', (m) => { if (/error/.test(m.type())) console.log('console', m.type(), m.text().slice(0, 200)); });
await p.goto(B + '/client/index.html'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
// riempie la cartella finta (OPFS) con i file di prova
await p.evaluate(async (elenco) => {
  const radice = await (await navigator.storage.getDirectory()).getDirectoryHandle('prova', { create: true });
  for (const [i, rel] of elenco.entries()) {
    const parti = rel.split('/'); let h = radice; for (const d of parti.slice(0, -1)) h = await h.getDirectoryHandle(d, { create: true });
    const w = await (await h.getFileHandle(parti.at(-1), { create: true })).createWritable(); await w.write(await (await fetch('/__prova/' + i)).blob()); await w.close();
  }
}, FILE.map(([rel]) => rel));
esito(await p.locator('#cl-vtc').isHidden(), 'spenta di base: nessun elenco dei vetrini');
await p.click('#cl-impostazioni summary'); await p.check('#cl-imp-vetrini');
esito(await p.locator('#cl-vtc').isVisible(), 'accesa: compare il riquadro «Vetrini della cartella»', await p.locator('#cl-vtc-lista').innerText());
await p.click('#cl-vtc-scegli'); await p.waitForFunction(() => /vetrin[oi] in/.test(document.querySelector('#cl-vtc-stato')?.textContent || ''), null, { timeout: 30000 });
const stato = await p.locator('#cl-vtc-stato').innerText();
const righe = await p.$$eval('#cl-vtc-lista tbody tr', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
esito(righe.length === 3, 'tre vetrini trovati (SVS, CZI, MRXS); il TIFF piccolo e il testo esclusi', `${stato} | ${righe.join(' || ')}`);
esito(righe.some((r) => /CMU-1-Saved-1_16.*MRXS/.test(r) && !/incompleto/.test(r)), 'MRXS con la sua cartella: un solo vetrino, completo');
await p.fill('#cl-vtc-cerca', 'aperio'); await p.waitForTimeout(300);
esito((await p.$$('#cl-vtc-lista tbody tr')).length === 1, 'ricerca «aperio»: solo l\'SVS');
await p.fill('#cl-vtc-cerca', ''); await p.waitForTimeout(300);
for (const [nome, re] of [['SVS', /Small-Region/], ['MRXS', /Saved-1_16/], ['CZI', /Zeiss/]]) {
  await p.goto(B + '/client/index.html'); await p.reload(); await p.waitForSelector('#cl-vtc tbody tr', { timeout: 30000 });
  const i = (await p.$$eval('#cl-vtc-lista tbody tr', (r) => r.map((x) => x.innerText))).findIndex((t) => re.test(t));
  await p.click(`#cl-vtc-lista [data-vtc="${i}"]`);
  const aperto = await p.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 60000 }).then(() => true, () => false);
  esito(aperto, `${nome}: «Apri» apre il vetrino dal disco`, aperto ? '' : await p.locator('#cl-stato').innerText());
  if (aperto) await p.screenshot({ path: `/tmp/cartella-vetrini-${nome}.png` });
}
await p.goto(B + '/client/index.html#/'); await p.reload(); await p.waitForSelector('#cl-vtc tbody tr', { timeout: 30000 }).catch(() => {});
esito((await p.$$('#cl-vtc-lista tbody tr')).length === 3, 'dopo il ricaricamento l\'elenco resta');
await p.screenshot({ path: '/tmp/cartella-vetrini-elenco.png' });
await p.evaluate(() => { document.querySelector('#cl-impostazioni').open = true; }); await p.uncheck('#cl-imp-vetrini'); await p.waitForTimeout(500);
esito(await p.locator('#cl-vtc').isHidden(), 'spenta di nuovo: elenco tolto');
esito(!err.length, 'nessun errore JavaScript', err.join(' | ').slice(0, 300));
console.log(`\n${ok} OK, ${ko} KO`); await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
