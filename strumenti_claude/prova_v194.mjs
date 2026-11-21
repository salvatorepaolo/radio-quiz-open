// prova_v194.mjs: client — immagini chiave, Secondary Capture, PDF, referto (PDF, Word, stampa), bollino
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/v194_';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const ok = (c, m) => console.log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
try {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true }); const c = await ctx.newPage();
  c.on('pageerror', (e) => err.push(e.message)); c.on('console', (m) => { if (m.type() === 'error') err.push('console: ' + m.text()); });
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-018/serie').slice(0, 60));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await c.waitForTimeout(1000);
  // una misura e due immagini chiave
  await c.keyboard.press('r'); const bx = await c.locator('#canvas').boundingBox();
  await c.mouse.move(bx.x + bx.width * 0.4, bx.y + bx.height * 0.5); await c.mouse.down(); await c.mouse.move(bx.x + bx.width * 0.55, bx.y + bx.height * 0.55, { steps: 5 }); await c.mouse.up();
  await c.keyboard.press('k'); await c.waitForTimeout(400); await c.keyboard.press('ArrowDown'); await c.keyboard.press('ArrowDown'); await c.click('#cl-chiave'); await c.waitForTimeout(400);
  ok(await c.locator('.ic-voce').count() === 2, 'due immagini chiave'); await c.fill('.ic-voce:first-child .ic-did', 'Lesione principale');
  await c.screenshot({ path: OUT + 'striscia.png' });
  const scarica = async (fn) => { const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 60000 }), fn()]); const f = OUT + dl.suggestedFilename(); await dl.saveAs(f); return { f, nome: dl.suggestedFilename(), buf: fs.readFileSync(f) }; };
  // Secondary Capture
  await c.click('#ic-esporta'); let r = await scarica(() => c.click('#ex-vai')); console.log(r.nome, r.buf.length, await c.locator('#ex-stato').innerText()); await c.click('#ex-chiudi');
  ok(r.nome.endsWith('.zip') && r.buf.includes(Buffer.from('1.2.840.10008.5.1.4.1.1.7')) && r.buf.includes(Buffer.from('ANONIMO')), 'zip di Secondary Capture anonimi');
  await c.click('#cl-esporta'); await c.check('input[value="chiave-pdf"]'); r = await scarica(() => c.click('#ex-vai')); await c.click('#ex-chiudi');
  ok(r.buf.slice(0, 5).toString() === '%PDF-' && r.buf.includes(Buffer.from('/DCTDecode')), 'PDF delle immagini chiave ' + r.buf.length);
  // referto
  await c.click('#cl-referto'); await c.waitForSelector('#dlg-referto[open]'); await c.waitForTimeout(500);
  console.log('paziente:', await c.inputValue('#ref-nome'), '| esame:', await c.inputValue('#ref-esame'), '| modello:', await c.inputValue('#ref-modello'));
  await c.fill('#ref-quesito', 'Controllo dopo trattamento'); await c.click('#ref-misure-ins');
  await c.click('#ref-testo'); await c.keyboard.press('Control+End'); await c.keyboard.press('Meta+ArrowDown');
  await c.keyboard.type(' Quadro stabile rispetto al precedente.');
  await c.keyboard.press('Enter'); await c.click('[data-cmd="bold"]'); await c.keyboard.type('Conclusione in grassetto'); await c.click('[data-cmd="bold"]');
  await c.keyboard.press('Enter'); await c.click('[data-cmd="insertUnorderedList"]'); await c.keyboard.type('primo punto'); await c.keyboard.press('Enter'); await c.keyboard.type('secondo punto');
  await c.fill('#ref-firma', 'Dott. Mario Rossi'); await c.fill('#ref-cf', 'rssmra85t10a562s');
  console.log('cf:', await c.locator('#ref-cf-esito').innerText(), '| blocchi:', await c.evaluate(() => document.querySelector('#ref-testo').innerHTML.slice(-260)));
  await c.click('#ref-pieno'); await c.waitForTimeout(300); await c.screenshot({ path: OUT + 'referto_pieno.png' }); await c.click('#ref-pieno');
  await c.screenshot({ path: OUT + 'referto.png' });
  r = await scarica(() => c.click('#ref-pdf')); ok(r.buf.slice(0, 5).toString() === '%PDF-', 'referto PDF ' + r.nome + ' ' + r.buf.length);
  r = await scarica(() => c.click('#ref-word')); ok(r.buf.slice(0, 2).toString() === 'PK' && r.buf.includes(Buffer.from('word/document.xml')), 'referto Word ' + r.nome + ' ' + r.buf.length);
  // anteprima del PDF e della stampa
  const pdf = fs.readdirSync('/Volumes/Caloggero/_viste/prova3d/').filter((x) => /^v194_referto.*\.pdf$/.test(x))[0];
  const html = await c.evaluate(async () => { const R = await import('/referto.js'); const d = await (window.__doc ||= null); return null; });
  await c.click('#ref-stampa'); await c.waitForTimeout(800); console.log('stampa:', await c.locator('#ref-stato').innerText());
  const v = await b.newPage(); await v.goto('file:///Volumes/Caloggero/_viste/prova3d/' + pdf).catch(() => {}); await v.waitForTimeout(1500); await v.screenshot({ path: OUT + 'pdf_anteprima.png' }); await v.close();
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
