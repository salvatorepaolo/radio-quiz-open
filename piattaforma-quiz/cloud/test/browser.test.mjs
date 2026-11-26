// Test di non regressione nel browser (Playwright + Chromium): le pagine principali si aprono senza errori
// JavaScript, un caso si risponde dall'inizio alla fine, MPR e 3D partono su una TC, il telefono non ha scorrimenti laterali.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), B = `http://localhost:${PORTA}/?prova`;
const CASI = path.resolve(process.env.CASI || path.join(QUI, '../../casi-free'));
let sim, browser, chromium;
// BROWSER=webkit (motore di Safari) o BROWSER=firefox: stessi test con un altro browser (qualita/browser-tutti.sh)
const MOTORE = process.env.BROWSER || 'chromium';
try { chromium = (await import('playwright'))[MOTORE]; } catch {}
const errori = [];
const pagina = async (opz = {}) => {
  const p = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 }, ...opz })).newPage();
  p.on('pageerror', (e) => errori.push(`${p.url()} → ${e.message}`));
  // i test passano da un caso all'altro con misure non salvate: alla domanda si risponde «Chiudi senza salvare»
  await p.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  return p;
};
const entra = async (p, codice) => {
  await p.goto(B + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
};
// il caso è caricato quando il riquadro 1 mostra un'immagine di quel caso (non quella del caso aperto prima)
const caricato = (p, id) => p.waitForFunction((id) => { const d = window.__dbg, q = d?.P(0); return d?.V?.caso?.id === id && q?.img && (q.frames?.[0]?.url || '').includes(`/casi/${id}/`); }, id, { timeout: 30000 });
const controllaErrori = (dove) => { const e = errori.splice(0); assert.deepEqual(e, [], `errori JavaScript in ${dove}`); };
let admin, studente, visibili = [];

before(async () => {
  if (!chromium) return;
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  browser = await chromium.launch(MOTORE === 'chromium' ? { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}) } : {});
  admin = await pagina(); await entra(admin, 'admin-test-0000');
  visibili = (await admin.evaluate(async () => (await (await fetch('/api/casi')).json()))).filter((c) => c.visibile !== false);
  const r = await admin.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Browser', ruolo: 'specializzando' }) })).json()));
  studente = await pagina(); await entra(studente, r.codice);
});
after(async () => { await browser?.close(); sim?.kill(); });
const salta = () => (!chromium ? 'Playwright non installato' : false);

test('pagina iniziale dello studente: sezioni, percorsi, nessun errore', { skip: salta() }, async () => {
  // 1.279: i percorsi sono nella pagina «Allenamento» del menu in alto
  await studente.waitForSelector('#nav-principale:not([hidden]) a[data-nav="allenamento"]', { timeout: 10000 });
  await studente.click('#nav-principale a[data-nav="allenamento"]');
  await studente.waitForSelector('#vista-allenamento:not([hidden]) #percorsi details.sezione-home', { timeout: 10000 });
  await studente.click('#nav-principale a[data-nav="elenco"]'); await studente.waitForSelector('#vista-elenco:not([hidden]) #lista-casi details.gruppo-metodica', { timeout: 10000 });
  // le schede dei casi si costruiscono quando si apre la metodica: qui basta che ci siano le metodiche con i loro casi
  assert.ok(await studente.$$eval('#lista-casi details.gruppo-metodica small', (l) => l.reduce((a, x) => a + (parseInt(x.textContent) || 0), 0)) > 0, 'nessun caso in elenco');
  controllaErrori('pagina iniziale');
});

test('lente d\'ingrandimento: compare sopra l\'immagine, segue il mouse, + cambia l\'ingrandimento', { skip: salta() }, async () => {
  const c = visibili.find((x) => x.modalita === 'TC') || visibili[0];
  await admin.goto(B + `#/caso/${c.id}`); await admin.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
  await admin.waitForFunction(() => { const cv = document.querySelector('#canvas'); return cv && cv.width > 50; }, null, { timeout: 30000 });
  await admin.waitForTimeout(800);
  await admin.evaluate(() => document.querySelector('#barra-2d [data-tool="lente"]').click());
  const r = await admin.$eval('#canvas', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  await admin.mouse.move(r.x + r.w / 4, r.y + r.h / 2); await admin.mouse.move(r.x + r.w / 4 + 5, r.y + r.h / 2 + 5);   // a un quarto: con due riquadri il centro cade sul bordo tra i due
  await admin.waitForTimeout(200);
  assert.equal(await admin.$eval('#lente', (e) => e.hidden), false, 'la lente non compare');
  const pieno = await admin.$eval('#lente', (e) => { const d = e.getContext('2d').getImageData(0, 0, e.width, e.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] > 10) n++; return n; });
  assert.ok(pieno > 50, 'la lente è vuota');
  await admin.keyboard.press('+'); await admin.waitForTimeout(100);
  await admin.mouse.move(r.x + 5, r.y - 30);   // fuori dall'immagine: la lente sparisce
  await admin.waitForTimeout(150);
  assert.equal(await admin.$eval('#lente', (e) => e.hidden), true, 'la lente resta visibile fuori dall\'immagine');
  await admin.evaluate(() => document.querySelector('#barra-2d [data-tool="wl"]').click());
  controllaErrori('lente');
});

test('strumenti di refertazione: tasti delle finestre, ruota, ROI poligonale, misure e modello nel referto', { skip: salta() }, async () => {
  const c = visibili.find((x) => x.modalita === 'TC') || visibili[0];
  await admin.goto(B + `#/caso/${c.id}`); await admin.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
  await admin.waitForFunction(() => { const cv = document.querySelector('#canvas'); return cv && cv.width > 50 && window.__dbg?.V?.img; }, null, { timeout: 30000 });
  await admin.waitForTimeout(500);
  await admin.evaluate(() => document.activeElement?.blur?.());
  // tasti scelti dal docente: 1 addome, 2 polmone … 0 automatica; R distanza, E ROI, Z zoom, Esc scorri
  await admin.keyboard.press('1'); await admin.waitForTimeout(100);
  assert.deepEqual(await admin.evaluate(() => [window.__dbg.V.wc, window.__dbg.V.ww]), [40, 400], 'tasto 1: finestra addome');
  await admin.keyboard.press('2'); await admin.waitForTimeout(100);
  assert.deepEqual(await admin.evaluate(() => [window.__dbg.V.wc, window.__dbg.V.ww]), [-600, 1500], 'tasto 2: finestra polmone');
  for (const [k, t] of [['r', 'misura'], ['e', 'roi'], ['z', 'zoom'], ['Escape', 'scroll']]) {
    await admin.keyboard.press(k); await admin.waitForTimeout(80);
    assert.equal(await admin.evaluate(() => window.__dbg.V.tool), t, `tasto ${k}: strumento ${t}`);
  }
  // coronale ricostruita nel riquadro (C) e ritorno all'assiale (A)
  if (await admin.evaluate(() => { const i = window.__dbg.V.img.iop; return Math.abs(i[0] * i[4] - i[1] * i[3]) > 0.9 && window.__dbg.V.frames.length >= 8; })) {
    await admin.keyboard.press('c');
    await admin.waitForFunction(() => window.__dbg.P().piano === 'coronale' && window.__dbg.V.img?.riformattata, null, { timeout: 60000 });
    assert.ok(await admin.evaluate(() => Math.abs(window.__dbg.V.img.iop[5]) > 0.9), 'coronale: righe lungo l\'asse cranio-caudale');
    await admin.keyboard.press('a');
    await admin.waitForFunction(() => window.__dbg.P().piano == null && window.__dbg.V.img && !window.__dbg.V.img.riformattata, null, { timeout: 30000 });
  }
  await admin.click('#btn-ruota'); await admin.waitForTimeout(100);
  const giro = await admin.evaluate(() => { const d = window.__dbg, g = d.geometriaDi(d.V.attivo), s = d.aSchermo(g, { x: 40, y: 70 }), b = d.aImmagine(g, s.x, s.y); return { rot: d.V.rot, x: Math.round(b.x), y: Math.round(b.y) }; });
  assert.deepEqual(giro, { rot: 1, x: 40, y: 70 }, 'rotazione: andata e ritorno delle coordinate');
  await admin.click('#btn-reset');
  await admin.evaluate(() => document.querySelector('#barra-2d [data-tool="roi-libera"]').click());
  const r = await admin.$eval('#canvas', (e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const x0 = r.x + r.w * 0.4, y0 = r.y + r.h * 0.4;
  for (const [dx, dy] of [[0, 0], [50, 0], [25, 40]]) { await admin.mouse.click(x0 + dx, y0 + dy); await admin.waitForTimeout(60); }
  await admin.keyboard.press('Enter'); await admin.waitForTimeout(200);
  const roi = await admin.evaluate(() => Object.values(window.__dbg.V.misure).flat().find((m) => m.forma === 'poligono'));
  assert.ok(roi && roi.pts.length === 3, 'ROI poligonale non salvata');
  await admin.evaluate(() => { const s = document.querySelector('#q-modello'); document.querySelector('#q-referto-box').open = true; s.value = s.options[1].value; s.dispatchEvent(new Event('change')); });
  assert.match(await admin.inputValue('#q-referto'), /TECNICA: …/, 'modello di referto non inserito');
  await admin.click('#btn-al-referto'); await admin.waitForTimeout(100);
  assert.match(await admin.inputValue('#q-referto'), /ROI di|densità media/, 'misura non portata nel referto');
  await admin.evaluate(() => { document.querySelector('#q-referto').value = ''; document.querySelector('#barra-2d [data-tool="wl"]').click(); });
  controllaErrori('strumenti di refertazione');
});

test('T2* e ferro: ROI sul setto, fit sugli echi (108 grave < 10 ms, 109 normale > 20 ms)', { skip: salta() }, async () => {
  // casi CHMMOTv1: fetta medioventricolare = serie 2 (indice 1), setto attorno a (108-110, 128) nel 108 e (116-118, 128) nel 109
  for (const [id, cx, cy, prova] of [['caso-tcia-108', 109, 128, (t) => t < 10], ['caso-tcia-109', 117, 128, (t) => t > 20]]) {
    if (!fs.existsSync(path.join(CASI, id))) continue;
    await admin.goto(B + `#/caso/${id}`); await admin.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
    await admin.waitForFunction(() => { const cv = document.querySelector('#canvas'); return cv && cv.width > 50 && window.__dbg?.V?.img; }, null, { timeout: 30000 });
    await admin.waitForTimeout(800);   // il caso si apre sulla vista (fetta medioventricolare): la si cambia solo se serve
    await admin.evaluate(async () => { const d = window.__dbg, si = d.V.serie.findIndex((x) => /fetta 2\/3/.test(x.descrizione || '') && /Cuore/.test(x.descrizione));
      if (d.P(d.V.attivo).sIdx !== si) await d.selezionaSerie(si, d.V.attivo, { idx: 0 }); });
    await admin.waitForFunction(() => { const d = window.__dbg, p = d.P(d.V.attivo); return p.img && /fetta 2\/3/.test(d.V.serie[p.sIdx]?.descrizione || ''); }, null, { timeout: 15000 });
    await admin.waitForTimeout(600);
    assert.equal(await admin.evaluate(() => document.querySelector('#barra-2d [data-tool="t2s"]').hidden), false, `${id}: strumento T2* nascosto`);
    await admin.evaluate(() => document.querySelector('#barra-2d [data-tool="t2s"]').click());
    assert.equal(await admin.evaluate(() => document.querySelector('#t2s-pannello').hidden), false, 'pannello T2* non aperto');
    const [a, b] = await admin.evaluate(([x, y]) => { const d = window.__dbg, g = d.geometriaDi(d.V.attivo), r = g.r;
      return [d.aSchermo(g, { x: x - 2.5, y: y - 5 }), d.aSchermo(g, { x: x + 2.5, y: y + 5 })].map((q) => ({ x: r.left + q.x, y: r.top + q.y })); }, [cx, cy]);
    await admin.mouse.move(a.x, a.y); await admin.mouse.down(); await admin.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await admin.mouse.move(b.x, b.y, { steps: 4 }); await admin.mouse.up();
    await admin.waitForFunction(() => /ms/.test(document.querySelector('#t2s-pannello table')?.textContent || ''), null, { timeout: 20000 });
    const testo = await admin.$eval('#t2s-pannello', (e) => e.textContent);
    const t2 = +testo.match(/T2\* miocardico[^0-9>]*([\d,]+) ms/)[1].replace(',', '.');
    assert.ok(prova(t2), `${id}: T2* ${t2} ms fuori dall'atteso (${testo.slice(0, 200)})`);
    assert.match(await admin.$eval('#t2s-pannello', (e) => e.innerHTML), /<svg/, 'grafico segnale/TE mancante');
    await admin.evaluate(() => { document.querySelector('#t2s-chiudi').click(); });
    controllaErrori(`T2* ${id}`);
  }
});

test('RM cardiaca: niente volumetria sulle serie T2* multi-eco (109), volumetria sulle cine di asse corto (070)', { skip: salta() }, async () => {
  const apri = async (id) => {
    // se il caso è già aperto non si «va» di nuovo allo stesso indirizzo: WebKit (Safari) ricaricherebbe tutta la pagina,
    // interrompendo gli scaricamenti in corso (errori della pagina vecchia che si chiude, non del sito)
    if (!admin.url().endsWith(`#/caso/${id}`)) await admin.goto(B + `#/caso/${id}`);
    await admin.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
    // il caso nuovo, non l'immagine rimasta del caso precedente; poi tutti i riquadri della disposizione del docente caricati
    await caricato(admin, id);
    await admin.waitForFunction(() => { const d = window.__dbg; return d.V.pannelli.slice(0, d.V.n).every((p) => p.img); }, null, { timeout: 30000 });
    await admin.waitForTimeout(600);
  };
  const scegli = async (re) => {
    await admin.evaluate(async (src) => { const d = window.__dbg, r = new RegExp(src), si = d.V.serie.findIndex((x) => r.test(x.descrizione || '')); await d.selezionaSerie(si, d.V.attivo, { idx: 0 }); }, re);
    await admin.waitForFunction((src) => { const d = window.__dbg, p = d.P(d.V.attivo); return p.img && new RegExp(src).test(d.V.serie[p.sIdx]?.descrizione || '') && d.ME.has(p.sIdx); }, re, { timeout: 30000 }).catch(async (e) => { console.log('STATO', JSON.stringify(await admin.evaluate(() => { const d = window.__dbg, p = d.P(d.V.attivo); return { caso: d.V.caso?.id, att: d.V.attivo, n: d.V.n, sIdx: p.sIdx, desc: d.V.serie[p.sIdx]?.descrizione, img: !!p.img, me: [...d.ME.keys()], hash: location.hash, nserie: d.V.serie.length }; }))); throw e; });
  };
  if (fs.existsSync(path.join(CASI, 'caso-tcia-109'))) {
    await apri('caso-tcia-109');
    await scegli('Cuore.*fetta 2/3');
    const st = await admin.evaluate(() => { const d = window.__dbg, p = d.P(d.V.attivo); return { eco: d.isMultiEco(p), cine: d.isCine(p) }; });
    assert.deepEqual(st, { eco: true, cine: false }, '109: la serie T2* deve risultare multi-eco e non cine');
    await admin.evaluate(() => document.querySelector('#barra-2d [data-tool="cmr"]').click());
    assert.equal(await admin.evaluate(() => document.querySelector('#cmr-pannello').hidden), false, 'pannello RM cardiaca non aperto');
    assert.match(await admin.$eval('#cmr-pannello', (e) => e.textContent), /T2\* multi-eco: le immagini sono echi/, '109: manca l\'avviso sulla serie multi-eco');
    assert.equal(await admin.$eval('#cmr-auto', (e) => e.disabled), false, '109: «Traccia» resta attivo (senza asse corto passa all\'asse lungo)');
    // senza pila di asse corto cine: niente volumetria Simpson, si passa alla cine in asse lungo (area-lunghezza)
    await admin.evaluate(async () => { await window.__dbg.autoCmr(); });
    const c = await admin.evaluate(() => { const C = window.__dbg.CMR, d = window.__dbg; return { vs: C.semi.vs, ed: C.ed, sax: C.sax, modo: C.modo, serie: d.V.serie[d.P().sIdx].descrizione }; });
    assert.ok(c.vs === null && c.ed === null && c.sax === null && c.modo === 'al' && /^Cine/.test(c.serie), `109: senza asse corto doveva passare all'asse lungo (${JSON.stringify(c).slice(0, 160)})`);
    assert.match(await admin.$eval('#cmr-pannello', (e) => e.textContent), /Asse lungo \(area-lunghezza\)/, '109: manca la sezione dell\'asse lungo');
    await admin.evaluate(() => { document.querySelector('#cmr-chiudi').click(); });
    controllaErrori('RM cardiaca 109');
  }
  if (fs.existsSync(path.join(CASI, 'caso-tcia-070'))) {
    await apri('caso-tcia-070');
    await scegli('asse corto 5/10');
    const st = await admin.evaluate(() => { const d = window.__dbg, p = d.P(d.V.attivo); return { eco: d.isMultiEco(p), cine: d.isCine(p) }; });
    assert.deepEqual(st, { eco: false, cine: true }, '070: la cine di asse corto deve restare una cine');
    await admin.evaluate(() => document.querySelector('#barra-2d [data-tool="cmr"]').click());
    assert.equal(await admin.$eval('#cmr-auto', (e) => e.disabled), false, '070: «Traccia» disattivato su una cine');
    await admin.evaluate(async () => { await window.__dbg.autoCmr(); });
    const c = await admin.evaluate(() => { const C = window.__dbg.CMR; return { vs: !!C.semi.vs, ed: C.ed, es: C.es, fette: C.sax?.length }; });
    assert.ok(c.vs && c.ed != null && c.es != null && c.ed !== c.es && c.fette === 10, `070: volumetria non riuscita (${JSON.stringify(c)})`);
    assert.match(await admin.$eval('#cmr-pannello', (e) => e.textContent), /frazione di eiezione/i, '070: manca la frazione di eiezione');
    await admin.evaluate(() => { document.querySelector('#cmr-chiudi').click(); });
    controllaErrori('RM cardiaca 070');
  }
});

test('RX ed ecografie: il caso si apre sulla serie iniziale scelta dal docente', { skip: salta() }, async () => {
  // nelle RX e nelle ecografie si vede un solo riquadro: deve mostrare serie_iniziale, non la prima serie o la disposizione
  const scelti = fs.readdirSync(CASI).filter((d) => d.startsWith('caso-')).map((d) => { try { return JSON.parse(fs.readFileSync(path.join(CASI, d, 'caso.json'), 'utf8')); } catch { return null; } })
    .filter((c) => c && ['RX', 'Ecografia'].includes(c.modalita) && Number.isInteger(c.serie_iniziale) && c.serie_iniziale > 0
      && !(c.sezioni || []).some((s) => s.scopri))
    .slice(0, 3);
  for (const c of scelti) {
    await admin.goto(B + `#/caso/${c.id}`); await admin.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
    await caricato(admin, c.id);
    const i = await admin.evaluate(() => { const d = window.__dbg; return d.V.serie[d.P(0).sIdx]?._i; });
    assert.equal(i, c.serie_iniziale, `${c.id}: aperto sulla serie ${i} invece della serie iniziale ${c.serie_iniziale}`);
    controllaErrori(`serie iniziale ${c.id}`);
  }
  // cambio rapido di caso: se si apre un altro caso mentre il primo sta ancora caricando, il secondo deve caricarsi
  if (scelti.length >= 2) {
    const [x, y] = scelti;
    await admin.goto(B + `#/caso/${x.id}`); await admin.goto(B + `#/caso/${y.id}`);
    await caricato(admin, y.id);
    controllaErrori(`cambio rapido ${x.id} → ${y.id}`);
  }
});

test('un caso dall\'inizio alla fine: immagine, risposta, esito', { skip: salta() }, async () => {
  const c = visibili.find((x) => ['RX', 'Mammografia', 'TC'].includes(x.modalita)) || visibili[0];
  await studente.goto(B + `#/caso/${c.id}`);
  await studente.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
  await studente.waitForFunction(() => { const cv = document.querySelector('#vista-caso canvas'); return cv && cv.width > 50; }, null, { timeout: 30000 });
  // tutte le sezioni: una scelta per sezione, poi conferma
  for (let k = 0; k < 15; k++) {
    await studente.evaluate(() => { const i = [...document.querySelectorAll('#q-form input[type=checkbox], #q-form input[type=radio]')].find((x) => x.offsetParent); if (i && !i.checked) i.click(); i?.closest('.opz')?.querySelector('button[data-conf]')?.click(); });
    await studente.waitForTimeout(300);
    // 1.246: all'ultimo passo la comunicazione dell'esito è obbligatoria
    await studente.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
    const b = await studente.$('#btn-conferma:not([hidden])'); if (b && await b.isVisible()) { await b.evaluate((e) => e.click()); break; }
    if (b) { await studente.waitForTimeout(300); if (await b.isVisible()) { await b.evaluate((e) => e.click()); break; } }
    const av = await studente.$('#q-succ:not([hidden])'); if (av) await av.evaluate((e) => e.click()); else break;
    await studente.waitForTimeout(200);
  }
  await studente.waitForSelector('#q-esito:not([hidden])', { timeout: 15000 });
  assert.match(await studente.$eval('#q-esito', (e) => e.textContent), /\d+\s*%/);
  controllaErrori(`caso ${c.id}`);
});

test('MPR e 3D su una TC', { skip: salta() }, async () => {
  const c = visibili.find((x) => x.modalita === 'TC' && fs.existsSync(path.join(CASI, x.id, 'serie.json'))
    && JSON.parse(fs.readFileSync(path.join(CASI, x.id, 'serie.json'))).some((s) => s.files.length >= 60 && s.files.length <= 400));
  if (!c) return;
  await admin.goto(B + `#/caso/${c.id}`); await admin.waitForSelector('#vista-caso:not([hidden])');
  const s = JSON.parse(fs.readFileSync(path.join(CASI, c.id, 'serie.json'))).findIndex((x) => x.files.length >= 60 && x.files.length <= 400);
  // con il Mac molto carico la prima apertura del 3D può bloccarsi: si riprova una volta ricaricando la pagina
  for (let prova = 1; ; prova++) {
    await admin.evaluate((i) => window.__dbg?.selezionaSerie?.(i), s); await admin.waitForTimeout(1500);
    await admin.click('#modo-mpr');
    try { await admin.waitForFunction(() => window.__dbg?.MPR?.attivo && document.querySelectorAll('#mpr canvas').length >= 3, null, { timeout: prova === 1 ? 60000 : 90000 }); break; }
    catch (e) { if (prova >= 2) throw e; await admin.reload(); await admin.waitForSelector('#vista-caso:not([hidden])'); }
  }
  // disposizione (10/11): riquadro grande (assiale) a sinistra, tre viste piccole a destra; doppio clic su una piccola → scambio
  const box = (id) => admin.evaluate((x) => { const r = document.getElementById(x).closest('.mpr-cella').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, id);
  // 11/11: all'apertura niente 3D (assiale, coronale, sagittale); il pulsante «3D» lo aggiunge come quarta vista
  assert.ok(await admin.evaluate(() => document.querySelector('#vp-3d').closest('.mpr-cella').classList.contains('nascosta-3d')), '3D visibile all\'apertura');
  // 14/11: il 3D si sceglie dal menu (prima voce «MPR»): il preset scelto va nel riquadro grande
  await admin.waitForSelector('#mpr-preset optgroup option', { state: 'attached', timeout: 120000 }); await admin.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 120000 });
  await admin.selectOption('#mpr-preset', await admin.evaluate(() => document.querySelector('#mpr-preset optgroup option').value));
  await admin.waitForFunction(() => document.querySelector('#mpr-stato').hidden, null, { timeout: 120000 }); await admin.waitForTimeout(800);
  const tre = await box('vp-3d'), ass = await box('vp-assiale');
  assert.ok(tre.x < ass.x && tre.w > ass.w * 1.5, `3D scelto dal menu non nel riquadro grande (${JSON.stringify({ tre, ass })})`);
  assert.equal(await admin.evaluate(() => [...document.querySelectorAll('[data-mpr-tool].on')].map((x) => x.dataset.mprTool).join()), 'scorri');
  const tela = () => admin.evaluate(() => document.querySelector('#vp-assiale canvas')?.width || 0);
  const prima = await tela();
  await admin.mouse.click(ass.x + ass.w / 2, ass.y + ass.h / 2); await admin.waitForTimeout(500);
  assert.ok((await box('vp-3d')).w > (await box('vp-assiale')).w * 1.5, 'il clic singolo su una vista piccola non deve scambiare');
  await admin.mouse.dblclick(ass.x + ass.w / 2, ass.y + ass.h / 2); await admin.waitForTimeout(800);
  const ass2 = await box('vp-assiale'), tre2 = await box('vp-3d');
  assert.ok(ass2.x < tre2.x && ass2.w > tre2.w * 1.5, `assiale non portata nel riquadro grande (${JSON.stringify({ ass2, tre2 })})`);
  assert.ok(Math.abs(tre2.x - ass.x) < 2, `3D non andato al posto dell'assiale (${JSON.stringify({ ass, tre2 })})`);
  // «MPR» nel menu: il 3D sparisce
  await admin.selectOption('#mpr-preset', 'mpr'); await admin.waitForTimeout(500);
  assert.ok(await admin.evaluate(() => document.querySelector('#vp-3d').closest('.mpr-cella').classList.contains('nascosta-3d')), '«MPR» non toglie il 3D');
  // il ridisegno alla nuova misura arriva dopo il ResizeObserver: si aspetta fino a 5 s invece di un tempo fisso (26/11, Cornerstone 5.19)
  await admin.waitForFunction((p) => (document.querySelector('#vp-assiale canvas')?.width || 0) > p, prima, { timeout: 5000 }).catch(() => {});
  assert.ok(await tela() > prima, '3D non ridisegnato alla nuova misura');
  controllaErrori(`MPR ${c.id}`);
});

test('pagine dello studente: confronto con i colleghi e proposta di un caso', { skip: salta() }, async () => {
  for (const [h, sel] of [['#/confronto', '#confronto-corpo h1'], ['#/proponi', '#nc-proposta:not([hidden])'], ['#/esame', '#gu-storico'], ['#/esame', '#li-tipo'], ['#/esame', '#gu-amb'], ['#/esame/protocollo', '#pr-form .pr-domanda']]) {
    await studente.goto(B + h); await studente.waitForSelector(sel, { timeout: 15000 });
  }
  assert.match(await studente.inputValue('#nc-id').catch(() => ''), /^$|^prop-/);
  await studente.goto(B + '#/esame'); await studente.waitForSelector('#li-tipo');
  assert.deepEqual(await studente.$$eval('#li-tipo option', (o) => o.map((x) => x.value)), ['ps', 'reparto', 'nm']);
  controllaErrori('pagine dello studente');
});

test('pagine di gestione e analisi dell\'amministratore', { skip: salta() }, async () => {
  for (const [h, sel] of [['#/gestione-casi', '#vista-gestione-casi:not([hidden]) .gc-tab tbody tr'], ['#/percorsi', '#pd-lista .pd-gruppo'], ['#/revisione', '#rv-lista .rv-caso, #rv-lista .vuoto'], ['#/statistiche', '#sp-stat-calcola'], ['#/esame', '.es-liv'], ['#/aiuto', '#aiuto-corpo h2, #aiuto-corpo section'], ['#/account', '#vista-account:not([hidden])'], ['#/errore', '#errore-corpo h1'], ['#/confronto', '#confronto-corpo h1'], ['#/esame', '#gu-via']]) {
    await admin.goto(B + h); await admin.waitForSelector(sel, { timeout: 15000 });
  }
  await admin.goto(B + '#/analisi'); await admin.waitForSelector('#vista-analisi:not([hidden])', { timeout: 15000 });
  for (const s of ['casi', 'persone', 'errori', 'referti', 'esami', 'mensile']) { await admin.click(`[data-scheda="${s}"]`); await admin.waitForTimeout(500); }
  await admin.waitForSelector('#mensile, #an-corpo .vuoto', { timeout: 15000 });
  controllaErrori('gestione e analisi');
});

test('telefono: pagina iniziale e caso senza scorrimento orizzontale', { skip: salta() }, async () => {
  const t = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await entra(t, 'admin-test-0000');
  const largo = async () => t.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(await largo() <= 2, 'pagina iniziale più larga dello schermo');
  await t.goto(B + `#/caso/${visibili[0].id}`); await t.waitForSelector('#vista-caso:not([hidden])'); await t.waitForTimeout(1500);
  assert.ok(await largo() <= 2, 'caso più largo dello schermo');
  controllaErrori('telefono');
});

test('versione client: avvio offline-ready, esame dal disco, coronale, PNG e DICOM anonimizzato, niente invii', { skip: salta() }, async () => {
  const caso = visibili.find((c) => c.modalita === 'TC') || visibili[0];
  const dir = path.join(CASI, caso.id, 'serie'), files = [];
  const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro(dir);
  const ctx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 }, acceptDownloads: true }), c = await ctx.newPage();
  c.on('pageerror', (e) => errori.push(`client → ${e.message}`));
  const invii = []; c.on('request', (r) => { if (r.method() !== 'GET') invii.push(r.method() + ' ' + r.url()); });
  await c.goto(B.replace('/?prova', '') + '/client/index.html');
  await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  assert.ok(await c.evaluate(() => !!navigator.serviceWorker.controller), 'service worker non attivo');
  assert.ok(await c.locator('.cl-avviso').isVisible(), 'avviso «non per uso medico» assente');
  // avviso privacy alla prima apertura: va accettato, poi non ricompare
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 });
  await c.click('#pr-accetto');
  assert.equal(await c.evaluate(() => document.querySelector('#dlg-privacy-cl').open), false, 'avviso privacy non chiuso');
  assert.equal(await c.evaluate(() => localStorage.getItem('rq-cl-privacy-1')), '1', 'accettazione non salvata');
  await c.click('#cl-privacy-leggi'); await c.click('#pr-accetto');
  await c.setInputFiles('#cl-file', files.slice(0, 120));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 });
  assert.equal(await c.evaluate(() => getComputedStyle(document.querySelector('.caso > aside.quiz')).display), 'none', 'quiz visibile nel client');
  await c.click('#cl-esporta'); await c.check('input[name="ex-cosa"][value="png"]');
  const [png] = await Promise.all([c.waitForEvent('download', { timeout: 60000 }), c.click('#ex-vai')]);
  assert.match(png.suggestedFilename(), /\.png$/); await c.click('#ex-chiudi');
  await c.click('#cl-esporta'); await c.check('input[name="ex-cosa"][value="dicom"]');
  const [zip] = await Promise.all([c.waitForEvent('download', { timeout: 120000 }), c.click('#ex-vai')]);
  assert.match(zip.suggestedFilename(), /_anonimo\.zip$/); await c.click('#ex-chiudi');
  assert.deepEqual(invii, [], 'il client ha inviato dati al server');
  await ctx.close();
  controllaErrori('versione client');
});

// PRIVACY: un esame FINTO con dati paziente inventati (marcatori) aperto nel client. Si registrano TUTTE le richieste
// (service worker spento, così passano tutte dalla pagina): solo letture dei file del programma, nessuna /api, nessun
// marcatore negli indirizzi o nei corpi, nessun tentativo fermato dal blocco del client (window.__rqBloccati vuoto).
const PHI = '/Volumes/Caloggero/_viste/dicom_prova/phi_finto';
test('privacy del client: i dati del paziente non lasciano il computer', { skip: salta() || (!fs.existsSync(PHI) && 'esame finto assente (strumenti_claude/genera_phi.py)') }, async () => {
  const files = fs.readdirSync(PHI).filter((f) => f.endsWith('.dcm')).map((f) => path.join(PHI, f));
  const MARCATORI = /PHI|778899|RSSMRA|ZZPROVA|DOTTPHI|19470315/i;
  const ctx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 }, acceptDownloads: true, serviceWorkers: 'block' }), c = await ctx.newPage();
  c.on('pageerror', (e) => errori.push(`client privacy → ${e.message}`));
  const richieste = []; ctx.on('request', (r) => richieste.push({ m: r.method(), u: r.url(), corpo: r.postData() || '' }));
  const base = new URL(B).origin;
  await c.goto(base + '/?client');
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 30000 }); await c.click('#pr-accetto');
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 });
  // referto con i dati letti dalle immagini, immagine chiave, esportazioni, nuova apertura della pagina (esami recenti)
  await c.click('#cl-referto'); await c.waitForSelector('#dlg-referto[open]', { timeout: 15000 });
  assert.match(await c.inputValue('#ref-nome'), /ZZPROVAPHI/i, 'il referto non legge il nome dalle immagini');
  const [pdf] = await Promise.all([c.waitForEvent('download', { timeout: 30000 }), c.click('#ref-pdf')]); assert.match(pdf.suggestedFilename(), /\.pdf$/);
  await c.click('#ref-chiudi').catch(() => {});
  await c.keyboard.press('Escape'); await c.mouse.click(700, 450); await c.keyboard.press('k'); await c.waitForTimeout(500);
  await c.click('#cl-esporta'); await c.check('input[name="ex-cosa"][value="dicom"]');
  const [zip] = await Promise.all([c.waitForEvent('download', { timeout: 120000 }), c.click('#ex-vai')]); assert.match(zip.suggestedFilename(), /_anonimo\.zip$/); await c.click('#ex-chiudi');
  await c.goto(base + '/?client#/'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 }); await c.waitForTimeout(1500);
  const bloccati = await c.evaluate(() => window.__rqBloccati || null);
  // il blocco funziona davvero: una richiesta alle API dalla pagina del client viene fermata
  const prova = await c.evaluate(async () => { try { await fetch('/api/io', { method: 'POST', body: 'x' }); return 'passata'; } catch (e) { return 'bloccata'; } });
  await ctx.close();
  assert.deepEqual(bloccati, [], 'il client ha tentato invii (fermati dal blocco)');
  assert.ok(richieste.filter((r) => /\/(app|i18n)\.js/.test(r.u)).length >= 2, `richieste non registrate (${richieste.length}): la prova non vede la rete`);
  assert.ok(richieste.some((r) => /\/api\/io$/.test(r.u)) === false, 'la richiesta di prova alle API è uscita dal browser');
  assert.equal(prova, 'bloccata', 'il blocco delle richieste del client non funziona');
  const fuori = richieste.filter((r) => !(r.u.startsWith('blob:') || r.u.startsWith('data:') || (new URL(r.u).origin === base && /^(GET|HEAD)$/.test(r.m) && !new URL(r.u).pathname.startsWith('/api'))));
  assert.deepEqual(fuori.filter((r) => !/\/api\/io$/.test(r.u)), [], 'richieste non permesse dal client');
  assert.deepEqual(richieste.filter((r) => MARCATORI.test(decodeURIComponent(r.u) + r.corpo)).map((r) => r.u), [], 'dati del paziente in una richiesta');
  controllaErrori('privacy del client');
});

test('versione client: DICOM compressi (JPEG 2000, RLE) e multi-frame, se ci sono i file di prova', { skip: salta() || (!fs.existsSync('/Volumes/Caloggero/_viste/dicom_prova/ct_j2k') && 'file di prova assenti') }, async () => {
  const D = '/Volumes/Caloggero/_viste/dicom_prova/';
  const c = await (await browser.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage();
  c.on('pageerror', (e) => errori.push(`client formati → ${e.message}`));
  const medie = [];
  for (const files of [fs.readdirSync(D + 'ct_j2k').map((f) => D + 'ct_j2k/' + f), fs.readdirSync(D + 'ct_rle').map((f) => D + 'ct_rle/' + f), [D + 'ct_enhanced_mf.dcm']]) {
    await c.goto(B.replace('/?prova', '') + '/client/index.html#/'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
    await c.evaluate(() => { if (window.__dbg) window.__dbg.V.img = null; });
    await c.setInputFiles('#cl-file', files);
    await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 });
    medie.push(await c.evaluate(() => { const im = window.__dbg.P().img; let s = 0; for (let i = 0; i < im.pix.length; i += 97) s += im.pix[i] * im.slope + im.inter; return Math.round(s); }));
  }
  assert.equal(new Set(medie).size, 1, `JPEG 2000, RLE e multi-frame danno immagini diverse: ${medie}`);
  await c.context().close();
  controllaErrori('client formati');
});
