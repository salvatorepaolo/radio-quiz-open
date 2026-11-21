// controllo_generale.mjs: giro di tutte le pagine (amministratore, studente, client) a caccia di errori JavaScript,
// richieste fallite, pagine più larghe dello schermo ed elementi che si sovrappongono nella barra in alto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18500 + Math.floor(Math.random() * 400)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const problemi = [];
const segui = (p, dove) => {
  p.on('pageerror', (e) => problemi.push(`[${dove()}] ERRORE JS: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 40[134]|Failed to load resource/.test(m.text())) problemi.push(`[${dove()}] console: ${m.text().slice(0, 160)}`); });
  p.on('response', (r) => { if (r.status() >= 500 || (r.status() === 404 && !/\/api\//.test(r.url()))) problemi.push(`[${dove()}] ${r.status()} ${r.url().replace(B, '')}`); });
};
const controlla = async (p, dove) => {
  const r = await p.evaluate(() => {
    const largo = document.documentElement.scrollWidth - innerWidth;
    const top = [...document.querySelectorAll('header.top > *')].filter((e) => e.offsetParent && getComputedStyle(e).display !== 'none').map((e) => e.getBoundingClientRect());
    let sovr = 0; for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) { const a = top[i], c = top[j]; if (a.width && c.width && a.left < c.right - 2 && c.left < a.right - 2 && a.top < c.bottom - 2 && c.top < a.bottom - 2) sovr++; }
    return { largo, sovr, h: document.querySelector('header.top')?.getBoundingClientRect().height };
  });
  if (r.largo > 2) problemi.push(`[${dove}] pagina più larga dello schermo di ${r.largo}px`);
  if (r.sovr) problemi.push(`[${dove}] ${r.sovr} elementi sovrapposti nella barra in alto (altezza ${Math.round(r.h)})`);
};
const OUT = '/Volumes/Caloggero/_viste/schemi/';
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'it-IT' }); const c = await ctx.newPage(); segui(c, () => 'v206');
  await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });   // avviso privacy già accettato
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-051/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1500);
  const cur = () => c.evaluate(() => document.querySelector('#canvas').style.cursor);
  console.log('1 cursore scorri:', await cur());
  await c.click('#barra-2d [data-tool="misura"]'); console.log('2 misura on:', await c.evaluate(() => window.__dbg.V.tool), await cur());
  await c.click('#barra-2d [data-tool="misura"]'); console.log('3 secondo clic →', await c.evaluate(() => window.__dbg.V.tool), await cur());
  await c.click('#barra-2d [data-tool="wl"]'); await c.click('#barra-2d [data-tool="wl"]'); console.log('4 wl due clic →', await c.evaluate(() => window.__dbg.V.tool));
  await c.keyboard.press('r'); await c.keyboard.press('r'); console.log('5 tasto R due volte →', await c.evaluate(() => window.__dbg.V.tool));
  await c.keyboard.press('Escape');
  // strato solo nel riquadro attivo
  await c.evaluate(() => window.__dbg.impostaRiquadri?.(2)); await c.waitForTimeout(1500);
  console.log('6 riquadri', await c.evaluate(() => window.__dbg.V.n), 'strato visibile:', await c.isVisible('#slab'), 'gruppo:', await c.evaluate(() => document.querySelector('#slab').closest('.grp').id));
  await c.selectOption('#slab', '10'); await c.waitForTimeout(800);
  console.log('7 strato per riquadro:', JSON.stringify(await c.evaluate(() => window.__dbg.V.pannelli.slice(0, 2).map((p) => p.slabMM || 0))));
  { const r = await c.locator('#canvas').boundingBox(); await c.mouse.click(r.x + r.width * 0.75, r.y + r.height * 0.5); } console.log('8 menu sul riquadro B:', await c.inputValue('#slab'));
  { const r = await c.locator('#canvas').boundingBox(); await c.mouse.click(r.x + r.width * 0.25, r.y + r.height * 0.5); } console.log('9 menu sul riquadro A:', await c.inputValue('#slab'));
  await c.selectOption('#slab', '0');
  // esportazione: dialogo, intervallo, anonimizza, PNG ritagliato
  await c.click('#cl-esporta'); await c.waitForTimeout(300);
  await c.check('#dlg-esporta input[value="mp4"]');
  console.log('10 intervallo video:', await c.inputValue('#ex-da'), '→', await c.inputValue('#ex-a'), '/', await c.evaluate(() => window.__dbg.P().frames.length), '| anonimizza visibile e spuntato:', await c.isVisible('#ex-anonimo'), await c.isChecked('#ex-anonimo'));
  await c.uncheck('#ex-anonimo'); console.log('11 avviso senza anonimizzazione:', await c.isVisible('#ex-anonimo-avviso')); await c.check('#ex-anonimo');
  await c.check('#dlg-esporta input[value="png"]');
  const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 20000 }), c.click('#ex-vai')]); await dl.saveAs(OUT + 'esporta.png');
  await c.check('#dlg-esporta input[value="mp4"]'); await c.fill('#ex-a', '12');
  const [dv] = await Promise.all([c.waitForEvent('download', { timeout: 60000 }), c.click('#ex-vai')]); await dv.saveAs(OUT + 'esporta.mp4');
  await c.click('#ex-chiudi');
  // immagini chiave: niente stella, didascalia senza età, striscia richiudibile, referto
  console.log('12 stella nascosta:', await c.isHidden('#btn-chiave'));
  await c.click('#cl-chiave'); await c.waitForTimeout(500);
  console.log('13 didascalia proposta:', await c.getAttribute('#ic-lista .ic-did', 'placeholder'));
  await c.click('#ic-chiudi'); console.log('14 striscia chiusa:', await c.isHidden('#ic-striscia'));
  await c.click('#cl-chiave-n'); console.log('15 riaperta dal numero:', await c.isVisible('#ic-striscia'));
  await c.click('#cl-referto'); await c.waitForTimeout(1000);
  console.log('16 referto: immagini chiave nel referto', await c.locator('#ref-ic figure').count(), '| elenco misure tolto:', !(await c.locator('#ref-con-misure').count()), '| finestra separata API:', await c.evaluate(() => 'documentPictureInPicture' in window));
  await c.fill('#ref-ic .ref-ic-did', 'Didascalia scritta nel referto');
  console.log('17 didascalia sincronizzata nella striscia:', await c.inputValue('#ic-lista .ic-did'));
  await c.click('#ref-finestra'); await c.waitForTimeout(800);
  const modo = await c.evaluate(() => { const d = document.querySelector('#dlg-referto'); return d ? (d.classList.contains('affiancato') ? 'affiancato' : d.classList.contains('in-finestra') ? 'finestra' : 'modale') : 'in un\'altra finestra'; });
  console.log('18 dopo «Finestra separata»:', modo);
  // con il referto aperto si scorrono le immagini
  const i0 = await c.evaluate(() => window.__dbg.P().idx); await c.mouse.move(300, 450); await c.mouse.wheel(0, 300); await c.waitForTimeout(500);
  console.log('19 scorre le immagini con il referto aperto:', i0, '→', await c.evaluate(() => window.__dbg.P().idx));
  await c.screenshot({ path: OUT + 'referto_affiancato.png' });
  await c.evaluate(() => window.__dbg?.FIN_REF?.win?.close()); await c.waitForTimeout(500);
  console.log('19b referto tornato nella pagina:', await c.evaluate(() => !!document.querySelector('#dlg-referto')));
  // chiudere un esame tra più esami
  console.log('20 esami aperti:', await c.evaluate(() => window.__dbg.V.studi?.length));
  c.on('dialog', (d) => d.accept());
  const nx = await c.locator('#tab-studi .tab-chiudi').count(); console.log('21 ✕ sulle linguette:', nx);
  if (nx) { await c.locator('#tab-studi .tab-chiudi').first().click(); await c.waitForFunction(() => location.hash === '#/caso/locale' && window.__dbg.V.img, null, { timeout: 60000 }); await c.waitForTimeout(1500);
    console.log('22 dopo la chiusura di un esame:', await c.evaluate(() => `${window.__dbg.V.studi.length} studi, ${window.__dbg.V.serie.length} serie`)); }
  await c.click('#cl-chiudi'); await c.waitForTimeout(800);
  if (await c.locator('#cl-chiudi-menu').count()) await c.click('#cl-chiudi-menu [data-tutti]');
  await c.waitForTimeout(800); console.log('23 dopo ✕ Chiudi:', await c.evaluate(() => location.hash), 'home client visibile:', await c.isVisible('#vista-client'));
  // MPR: strumento scorri
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie'));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1000);
  await c.click('#modo-mpr'); await c.waitForTimeout(9000);
  await c.click('[data-mpr-tool="scorri"]'); console.log('24 MPR scorri attivo:', await c.evaluate(() => document.querySelector('[data-mpr-tool="scorri"]').classList.contains('on')));
  // dal 10/11 «Scorri» è lo strumento di partenza e il secondo clic su un altro strumento torna a «Scorri»
  await c.click('[data-mpr-tool="pan"]'); await c.click('[data-mpr-tool="pan"]'); console.log('25 secondo clic su «Sposta» → scorri:', await c.evaluate(() => document.querySelector('[data-mpr-tool="scorri"]').classList.contains('on')));
} finally { console.log(problemi.length ? [...new Set(problemi)].join('\n') : 'nessun problema trovato'); await b.close(); sim.kill(); }
