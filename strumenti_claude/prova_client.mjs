// prova_client.mjs: versione client (/client/index.html) — avvio con service worker, apertura di file dal disco, quiz nascosto,
// coronale, esportazioni (PNG, MP4, DICOM anonimizzato), nuova finestra sincronizzata, avvio senza rete
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const CARTELLA = process.argv[2] || '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-018/serie';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ok = (c, m) => log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok_, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok_(); } }); });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errori = []; const segui = (pg, nome) => { pg.on('pageerror', (e) => { errori.push(nome + ': ' + e.message); log('PAGEERROR', nome, e.message); }); pg.on('console', (m) => { if (m.type() === 'error' && !/status of 40/.test(m.text())) log('console', nome, m.text().slice(0, 200)); }); };
  segui(p, 'principale');
  const richieste = []; p.on('request', (r) => { if (/\/api\/|\/casi\//.test(r.url())) richieste.push(r.method() + ' ' + r.url().replace(B, '')); });
  await p.goto(B + '/client/index.html');
  await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'pagina controllata dal service worker');
  ok(await p.locator('.cl-avviso').isVisible(), 'avviso «non per uso medico» in evidenza');
  ok(await p.evaluate(() => !!document.querySelector('link[rel="manifest"]')), 'manifest presente');
  const files = tutti(CARTELLA); log('file', files.length);
  await p.setInputFiles('#cl-file', files);
  await p.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await p.waitForTimeout(1500);
  const st = await p.evaluate(() => { const { V } = window.__dbg; return { serie: V.serie.map((s) => s.descrizione + ' (' + s.files.length + ')'), n: V.n, quiz: getComputedStyle(document.querySelector('.caso > aside.quiz')).display, grp: !document.querySelector('#grp-client').hidden, titolo: document.querySelector('#titolo-caso').textContent }; });
  log(JSON.stringify(st)); ok(st.serie.length >= 1 && st.quiz === 'none' && st.grp, 'esame aperto dal disco, quiz nascosto, comandi del client visibili');
  await p.screenshot({ path: OUT + 'client_1.png' });
  // coronale nel riquadro
  await p.keyboard.press('c'); await p.waitForTimeout(2500);
  // esportazioni
  const esporta = async (cosa, prepara) => {
    await p.click('#cl-esporta'); await p.check(`input[name="ex-cosa"][value="${cosa}"]`); if (prepara) await prepara();
    const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 180000 }), p.click('#ex-vai')]);
    const f = OUT + 'client_' + dl.suggestedFilename(); await dl.saveAs(f); const b = fs.readFileSync(f);
    log(cosa, dl.suggestedFilename(), b.length, 'byte ·', await p.locator('#ex-stato').innerText()); await p.click('#ex-chiudi'); return b;
  };
  await p.evaluate(() => window.__dbg.mostra(0)); await p.waitForTimeout(800); await p.screenshot({ path: OUT + 'client_idx0.png' });
  await p.evaluate(() => window.__dbg.mostra(12)); await p.waitForTimeout(800); await p.screenshot({ path: OUT + 'client_idx12.png' });
  let b = await esporta('png'); ok(b.slice(1, 4).toString() === 'PNG', 'PNG');
  b = await esporta('mp4', async () => { await p.selectOption('#ex-fps', '5'); await p.fill('#ex-da', '240'); await p.fill('#ex-a', '264'); });
  ok(b.slice(4, 8).toString() === 'ftyp' && b.length > 20000, 'MP4 (ftyp, con contenuto)');
  b = await esporta('dicom'); ok(b.slice(0, 2).toString() === 'PK' && b.length > 10000, 'zip DICOM anonimizzato');
  // nuova finestra
  const [f2] = await Promise.all([ctx.waitForEvent('page'), p.click('#cl-finestra')]); segui(f2, 'finestra2');
  await f2.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await f2.waitForTimeout(1500);
  const s2 = await f2.evaluate(() => { const { V } = window.__dbg; return { serie: V.serie.length, sIdx: V.sIdx, idx: V.idx, titolo: document.querySelector('#titolo-caso').textContent }; });
  log('finestra 2', JSON.stringify(s2)); ok(s2.serie >= 1, 'la nuova finestra apre lo stesso esame');
  // sincronizzazione: stessa serie nelle due finestre, si scorre nella principale
  await p.keyboard.press('a'); await p.waitForTimeout(800);
  const si = await p.evaluate(() => window.__dbg.V.sIdx);
  await f2.evaluate((x) => window.__dbg.selezionaSerie(x, 0), si); await f2.waitForTimeout(1000);
  await p.evaluate(() => window.__dbg.mostra(3)); await p.waitForTimeout(1500);
  const i1 = await p.evaluate(() => window.__dbg.V.idx), i2 = await f2.evaluate(() => window.__dbg.V.idx);
  ok(i1 === i2, `finestre collegate: principale ${i1}, seconda ${i2}`);
  await f2.screenshot({ path: OUT + 'client_2.png' });
  // senza rete
  await ctx.setOffline(true);
  const p3 = await ctx.newPage(); segui(p3, 'offline');
  await p3.goto(B + '/client/index.html'); await p3.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  ok(true, 'avvio senza rete');
  await p3.setInputFiles('#cl-file', files.slice(0, 40));
  await p3.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); ok(true, 'esame aperto senza rete');
  await ctx.setOffline(false);
  log('richieste al server (attese nessuna su /casi/ con dati):', JSON.stringify([...new Set(richieste)].slice(0, 10)));
  ok(!richieste.some((r) => /^(PUT|POST)/.test(r)), 'nessun invio di dati al server');
  ok(!errori.length, 'nessun errore JavaScript ' + errori.join(' | '));
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
