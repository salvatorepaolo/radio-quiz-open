// prova_layout_1111.mjs: layout personalizzati dei riquadri (editor con trascinamento, modelli, salvataggio, menu, client)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19600 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
const rett = (p) => p.evaluate(() => { const V = window.__dbg.V; return Array.from({ length: V.n }, (_, k) => window.__dbg.rett(k)).map((r) => [r.x, r.y, r.w, r.h].map(Math.round)); });
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
  const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-004'); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 });
  ok('1 menu dei riquadri con «＋ Nuovo layout…»', await a.evaluate(() => !!document.querySelector('#riquadri option[value="nuovo"]')));
  await a.selectOption('#riquadri', 'nuovo');
  ok('2 si apre l\'editor', await a.evaluate(() => document.querySelector('#dlg-layout').open));
  // modello «1 grande + 2», poi a mano: griglia 3×2, svuota e trascina il grande su 2×2 celle
  await a.click('#lay-svuota'); await a.selectOption('#lay-col', '3'); await a.selectOption('#lay-rig', '2');
  const cella = async (x, y) => (await a.$(`.lay-cella[data-x="${x}"][data-y="${y}"]`)).boundingBox();
  const c0 = await cella(0, 0), c1 = await cella(1, 1);
  await a.mouse.move(c0.x + 10, c0.y + 10); await a.mouse.down(); await a.mouse.move(c1.x + 20, c1.y + 20, { steps: 5 }); await a.mouse.up();
  const riq = await a.evaluate(() => document.querySelectorAll('#lay-griglia .lay-riq').length);
  ok('3 trascinando si crea un riquadro di 2×2 celle', riq === 1, riq);
  await a.fill('#lay-nome', 'Grande + 2'); await a.click('#lay-salva'); await a.waitForTimeout(1500);
  const st = await a.evaluate(() => ({ n: window.__dbg.V.n, v: document.querySelector('#riquadri').value, nome: document.querySelector('#riquadri').selectedOptions[0]?.textContent }));
  ok('4 salvato e applicato: 3 riquadri, nel menu', st.n === 3 && st.v.startsWith('L:') && /Grande \+ 2/.test(st.nome), st);
  const r = await rett(a);
  ok('5 A grande a sinistra (2/3 di larghezza, tutta l\'altezza), B e C impilati a destra', r[0][2] > r[1][2] * 1.8 && r[0][3] > r[1][3] * 1.8 && r[1][0] === r[2][0] && r[2][1] > r[1][1], r);
  await a.screenshot({ path: '/Volumes/Caloggero/_viste/layout_personalizzato.png' });
  // torna a 2 e poi di nuovo al layout dal menu
  await a.selectOption('#riquadri', '2'); await a.waitForTimeout(500);
  const r2 = await rett(a); ok('6 «2» torna alla griglia normale', r2.length === 2 && r2[0][3] === r2[1][3], r2);
  const id = await a.evaluate(() => [...document.querySelectorAll('#riquadri option')].find((o) => /Grande/.test(o.textContent)).value);
  await a.selectOption('#riquadri', id); await a.waitForTimeout(800);
  ok('7 di nuovo il layout personalizzato dal menu', (await rett(a))[0][2] > (await rett(a))[1][2] * 1.8);
  // modello 3×2 dall'editor
  await a.selectOption('#riquadri', 'nuovo'); await a.click('#lay-modelli button:has-text("3×2")'); await a.fill('#lay-nome', 'Sei'); await a.click('#lay-salva'); await a.waitForTimeout(1500);
  ok('8 modello 3×2: 6 riquadri', await a.evaluate(() => window.__dbg.V.n) === 6);
  await a.reload(); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 });
  const dopo = await a.evaluate(() => [...document.querySelectorAll('#riquadri optgroup option')].map((o) => o.textContent));
  ok('9 dopo il ricaricamento i layout restano nel menu', dopo.filter((x) => /Grande|Sei/.test(x)).length === 2, dopo);
  // elimina
  await a.selectOption('#riquadri', 'nuovo'); await a.click('#lay-salvati button[aria-label="Elimina Sei"]'); await a.click('#lay-chiudi');
  ok('10 eliminato', !(await a.evaluate(() => [...document.querySelectorAll('#riquadri option')].some((o) => /Sei/.test(o.textContent)))));
  // client: stesso menu e stesso editor
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50); });
  const c = await ctx.newPage(); c.on('pageerror', (e) => errori.push(e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  const D = '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-004/serie/';
  const files = fs.readdirSync(D).flatMap((s) => fs.readdirSync(D + s).filter((f) => f.endsWith('.dcm')).map((f) => D + s + '/' + f));
  await c.setInputFiles('#cl-file', files); await c.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await c.waitForTimeout(2000);
  const idc = await c.evaluate(() => [...document.querySelectorAll('#riquadri option')].find((o) => /Grande/.test(o.textContent))?.value);
  if (idc) { await c.selectOption('#riquadri', idc); await c.waitForTimeout(1500); }
  ok('11 client: il layout salvato c\'è e si applica', !!idc && await c.evaluate(() => window.__dbg.V.n) === 3, idc);
  ok('12 nessun errore JavaScript', errori.length === 0, errori.slice(0, 5));
} catch (e) { console.log('KO eccezione', e.message); ko++; }
finally { await b.close(); sim.kill(); }
console.log(ko ? `${ko} KO` : 'TUTTI OK'); process.exit(ko ? 1 : 0);
