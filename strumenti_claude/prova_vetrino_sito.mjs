// prova_vetrino_sito.mjs: vetrino di anatomia patologica in un caso del sito (caso 003, TCGA-KIRC, vetrino FFPE 40× da
// IDC, 1,7 GB al livello pieno). Lo studente lo vede solo dopo la risposta, il docente sempre; si apre, le tessere si
// vedono (anche al livello pieno), le misure sono in µm, si scaricano solo pezzi (richieste parziali, pochi MB), nessun errore.
// Uso: node prova_vetrino_sito.mjs   (BROWSER=webkit|firefox)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const pw = createRequire(T + 'package.json')('playwright'), motore = pw[process.env.BROWSER || 'chromium'];
const PORTA = +process.env.PORTA_PROVA || (19360 + Math.floor(Math.random() * 15)), B = `http://localhost:${PORTA}/?prova`, ID = 'caso-tcia-003';
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await motore.launch(process.env.BROWSER ? {} : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
let ok = 0, ko = 0; const esito = (c, msg, d = '') => { if (c) ok++; else ko++; console.log(`${c ? 'OK' : 'KO'}  ${msg}${d !== '' ? ' → ' + d : ''}`); };
const entra = async (p, codice) => { await p.goto(B + '#/'); await p.reload(); await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 }); };
const apri = async (p) => { await p.goto(B + `#/caso/${ID}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 }); await p.waitForFunction((id) => window.__dbg?.V?.caso?.id === id && window.__dbg.P(window.__dbg.V.attivo).img, ID, { timeout: 60000 }); await p.waitForTimeout(800); };
const visibile = (p) => p.evaluate(() => { const x = document.querySelector('#btn-vetrini'); return !!x && !x.hidden; });
try {
  const ctxA = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } }), adm = await ctxA.newPage();
  await entra(adm, 'admin-test-0000');
  const { codice } = await adm.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Vetrino', ruolo: 'specializzando' }) })).json()));
  await apri(adm);
  esito(await visibile(adm), 'docente: il pulsante del vetrino c\'è subito');
  esito(await adm.evaluate(() => !window.__dbg.V.serie.some((s) => s.tipo === 'vetrino')), 'il vetrino non compare tra le serie da sfogliare');

  const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } }), p = await ctx.newPage(), errori = [], richieste = [];
  p.on('pageerror', (e) => errori.push(e.message));
  p.on('response', async (r) => { if (/\/vetrino\//.test(r.url())) richieste.push({ st: r.status(), n: +(r.headers()['content-length'] || 0), range: !!r.request().headers().range }); });
  await p.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await entra(p, codice); await apri(p);
  esito(!(await visibile(p)), 'studente: prima della risposta il vetrino non si vede (non suggerisce la diagnosi)');
  for (let k = 0; k < 15; k++) {
    const scelta = p.locator('#q-form .sezione:not([hidden]) .opz input').first();
    if (await scelta.count() && !(await scelta.isChecked())) { await scelta.check({ force: true }); await p.locator('#q-form .sezione:not([hidden]) .opz button[data-conf]').first().click({ force: true }).catch(() => {}); }
    await p.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
    await p.waitForTimeout(250);
    if (await p.locator('#btn-conferma').isVisible()) { await p.locator('#btn-conferma').evaluate((e) => e.click()); break; }
    const av = p.locator('#q-succ:not([hidden])'); if (await av.count()) await av.evaluate((e) => e.click()); else break;
  }
  await p.waitForSelector('#q-esito:not([hidden])', { timeout: 20000 }); await p.waitForTimeout(500);
  esito(await visibile(p), 'studente: dopo la risposta compare «🔬 Vetrino»');
  await p.click('#btn-vetrini');
  const aperto = await p.waitForFunction(() => window.__dbg?.VT?.viewer?.world?.getItemCount() === 1, null, { timeout: 60000 }).then(() => true, () => false);
  esito(aperto, 'il vetrino si apre', await p.evaluate(() => document.querySelector('.vt-info')?.textContent || document.querySelector('#vista-vetrino')?.textContent?.slice(0, 120)));
  if (aperto) {
    const pieno = () => p.waitForFunction(() => window.__dbg.VT.viewer.world.getItemAt(0).getFullyLoaded(), null, { timeout: 90000 }).then(() => true, () => false);
    const contenuto = () => p.evaluate(() => { const cv = document.querySelector('.vt-osd canvas'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0, t = 0; for (let i = 0; i < d.length; i += 40) { t++; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 25) n++; } return n / t; });
    await pieno(); await p.waitForTimeout(600);
    const c0 = await contenuto();
    esito(c0 > 0.05, 'vetrino intero: tessuto colorato visibile', `${(c0 * 100).toFixed(0)}% di pixel colorati`);
    await p.evaluate(() => { const v = window.__dbg.VT.viewer, cv = document.querySelector('.vt-osd canvas'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data, r = cv.width / cv.clientWidth;
      let best = null, bv = -1; for (let y = 0; y + 32 <= cv.height; y += 32) for (let x = 0; x + 32 <= cv.width; x += 32) { let sm = 0; for (let yy = 0; yy < 32; yy += 4) for (let xx = 0; xx < 32; xx += 4) { const i = ((y + yy) * cv.width + x + xx) * 4; sm += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); } if (sm > bv) { bv = sm; best = [(x + 16) / r, (y + 16) / r]; } }
      const pt = v.viewport.viewerElementToViewportCoordinates(new OpenSeadragon.Point(best[0], best[1])); v.viewport.zoomTo(v.viewport.imageToViewportZoom(1), null, true); v.viewport.panTo(pt, true); v.viewport.applyConstraints(true); });
    await pieno(); await p.waitForTimeout(600);
    const c1 = await contenuto();
    esito(c1 > 0.05, 'al livello pieno (40×) le tessere JPEG 2000 si vedono', `${(c1 * 100).toFixed(0)}% di pixel colorati`);
    await p.screenshot({ path: '/tmp/vetrino_sito_40x.png' });
    const sp = await p.evaluate(() => window.__dbg.VT.sp);
    esito(sp > 0.2 && sp < 0.3, 'calibrazione del vetrino (circa 0,25 µm per pixel a 40×)', sp?.toFixed(4));
    // rete lenta (o telefono): mentre ci si muove arrivano solo i livelli più grossolani; il dettaglio quando ci si ferma
    await p.evaluate(() => { localStorage.setItem('rq-risparmio', '1'); window.__dbg.VT.chiudi(); return window.__dbg.apriVetrinoClient(0); });
    await p.waitForFunction(() => window.__dbg.VT?.stato?.lento === true && window.__dbg.VT.viewer.world.getItemCount() === 1, null, { timeout: 60000 });
    await pieno(); await p.evaluate(() => window.__dbg.VT.vaiIngr(10)); await pieno(); await p.waitForTimeout(500);
    const rinv = await p.evaluate(async () => { const VT = window.__dbg.VT, vp = VT.viewer.viewport; let max = 0;
      for (let k = 0; k < 6; k++) { vp.panBy(new OpenSeadragon.Point(vp.getBounds().width * 0.7, 0)); for (let t = 0; t < 6; t++) { await new Promise((r) => setTimeout(r, 60)); max = Math.max(max, VT.stato.rinviate.size); } }
      return max; });
    esito(rinv > 0, 'rete lenta: mentre ci si sposta le tessere fini aspettano', `fino a ${rinv} in attesa`);
    const fermo = await pieno(); await p.waitForTimeout(400); const c2 = await contenuto();
    esito(fermo && c2 > 0.02, 'rete lenta: fermandosi il dettaglio arriva', `${(c2 * 100).toFixed(0)}% di pixel colorati`);
    await p.evaluate(() => localStorage.removeItem('rq-risparmio'));
  }
  const tot = richieste.reduce((t, r) => t + r.n, 0);
  esito(richieste.length > 0 && richieste.every((r) => r.st === 206 && r.range), 'solo richieste parziali al vetrino', `${richieste.length} richieste, ${(tot / 1e6).toFixed(1)} MB in tutto`);
  esito(tot < 80e6, 'scaricati pochi MB, non il file intero (1,7 GB)', `${(tot / 1e6).toFixed(1)} MB`);
  esito(!errori.length, 'nessun errore JavaScript', errori.slice(0, 3).join(' | ').slice(0, 250));
} finally { await b.close(); sim.kill(); }
console.log(`ℹ pass ${ok}\nℹ fail ${ko}`);
process.exit(ko ? 1 : 0);
