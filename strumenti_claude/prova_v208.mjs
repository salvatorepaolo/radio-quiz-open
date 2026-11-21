// prova_v208.mjs: annotazioni salvate a mano (Salva annotazioni esame/serie, avviso alla chiusura) e segni «A» sulla barra di scorrimento
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19300 + Math.floor(Math.random() * 400)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
const segni = (p) => p.evaluate(() => [...document.querySelectorAll('#slider-segni button')].map((x) => x.className + '@' + x.dataset.i));
const misura = async (p) => {
  await p.click('#barra-2d [data-tool="misura"]'); const r = await (await p.$('#canvas')).boundingBox();
  await p.mouse.move(r.x + r.width * 0.4, r.y + r.height * 0.45); await p.mouse.down(); await p.mouse.move(r.x + r.width * 0.55, r.y + r.height * 0.5, { steps: 6 }); await p.mouse.up();
  await p.click('#barra-2d [data-tool="misura"]'); await p.waitForTimeout(300); return r;
};
const scorri = async (p, r, n) => { await p.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.3); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, 120); await p.waitForTimeout(60); } await p.waitForTimeout(300); };
const chiudiC = async (c) => { await c.click('#cl-chiudi'); await c.waitForTimeout(300); if (await c.$('#cl-chiudi-menu')) await c.click('#cl-chiudi-menu [data-tutti]'); };
const idx = (p) => p.evaluate(() => window.__dbg.P().idx);
try {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' });
  // ---------------- client
  const c = await ctx.newPage(); c.on('pageerror', (e) => { errori.push('client: ' + e.message); console.log('   ERR', e.message); });
  await c.addInitScript(() => { try { localStorage.setItem('rq-cl-privacy-1', '1'); } catch {} });   // avviso privacy già accettato
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])');
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  const file = tutti('/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-001/serie');
  const apri = async () => { await c.setInputFiles('#cl-file', file); await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(1500); };
  await apri();
  const r = await misura(c); const i1 = await idx(c);
  let s = await segni(c); ok('1 A gialla (non salvata) sull\'immagine misurata', s.includes(`segno-a nuova@${i1}`), s);
  await c.waitForTimeout(1700); ok('2 pallino «non salvate»', await c.evaluate(() => !document.querySelector('#cl-ann-stato').hidden));
  await c.keyboard.press('Control+s'); await c.waitForTimeout(300);
  s = await segni(c); ok('3 Ctrl+S: A salvata', s.includes(`segno-a@${i1}`) && await c.evaluate(() => document.querySelector('#cl-ann-stato').hidden), s);
  await scorri(c, r, 6); const i2 = await idx(c); await misura(c);
  s = await segni(c); ok('4 seconda misura gialla, prima salvata', s.includes(`segno-a nuova@${i2}`) && s.includes(`segno-a@${i1}`), s);
  await c.click('#slider-segni button[data-i="' + i1 + '"]'); await c.waitForTimeout(500); ok('5 clic sulla A → immagine', (await idx(c)) === i1, await idx(c));
  await c.keyboard.press('k'); await c.waitForTimeout(500); s = await segni(c); ok('6 immagine chiave: numero sulla barra', s.some((x) => x.startsWith('segno-k') && x.endsWith('@' + i1)), s);
  await chiudiC(c); await c.waitForSelector('#dlg-ann[open]', { timeout: 3000 }).catch(() => {});
  ok('7 ✕ Chiudi con annotazioni non salvate → domanda', await c.evaluate(() => document.querySelector('#dlg-ann').open));
  await c.click('#dlg-ann button[value="annulla"]'); await c.waitForTimeout(300); ok('8 Annulla: l\'esame resta aperto', await c.evaluate(() => location.hash === '#/caso/locale'));
  await chiudiC(c); await c.waitForSelector('#dlg-ann[open]'); await c.click('#dlg-ann button[value="no"]'); await c.waitForTimeout(800);
  ok('9 Chiudi senza salvare → home', await c.evaluate(() => !document.querySelector('#vista-client').hidden));
  await apri(); const tot = await c.evaluate(() => Object.values(window.__dbg.V.misure).flat().filter((m) => !m.copia).length);
  s = await segni(c); ok('10 riaperto: solo la misura salvata', tot === 1 && s.filter((x) => x.startsWith('segno-a')).length === 1, { tot, s });
  // salva serie
  await scorri(c, r, 3); await misura(c); await c.click('#cl-ann summary'); await c.click('#cl-ann-serie'); await c.waitForTimeout(300);
  ok('11 Salva annotazioni serie', await c.evaluate(() => document.querySelector('#cl-ann-stato').hidden), await segni(c));
  // ---------------- piattaforma
  const a = await ctx.newPage(); await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Prova', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice)); await a.close();
  await ctx.clearCookies();
  const p = await ctx.newPage(); p.on('pageerror', (e) => errori.push('piattaforma: ' + e.message));
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  const caso = async (id) => { await p.goto(B + '/?prova#/caso/' + id); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(1200); };
  await caso('caso-tcia-001');
  ok('12 piattaforma: «Salva annotazioni» nella barra', await p.evaluate(() => !!document.querySelector('#cl-ann').offsetParent));
  const rp = await misura(p); const j1 = await idx(p);
  s = await segni(p); ok('13 A gialla', s.includes(`segno-a nuova@${j1}`), s);
  await p.click('#btn-indietro'); await p.waitForSelector('#dlg-ann[open]', { timeout: 3000 }).catch(() => {});
  ok('14 ← Elenco con annotazioni non salvate → domanda', await p.evaluate(() => document.querySelector('#dlg-ann').open && location.hash.startsWith('#/caso/')));
  await p.click('#dlg-ann button[value="salva"]'); await p.waitForTimeout(1200);
  ok('15 Salva e chiudi → elenco', await p.evaluate(() => !document.querySelector('#vista-elenco').hidden), await p.evaluate(() => location.hash));
  await caso('caso-tcia-001'); s = await segni(p);
  ok('16 riaperto il caso: annotazione ritrovata', s.includes(`segno-a@${j1}`), s);
  await scorri(p, rp, 5); await misura(p);
  await p.evaluate(() => { location.hash = '#/caso/caso-tcia-018'; }); await p.waitForSelector('#dlg-ann[open]', { timeout: 3000 }).catch(() => {});
  ok('17 passando a un altro caso → domanda', await p.evaluate(() => document.querySelector('#dlg-ann').open));
  await p.click('#dlg-ann button[value="no"]'); await p.waitForFunction(() => window.__dbg?.V?.caso?.id === 'caso-tcia-018', null, { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1000);
  ok('18 Chiudi senza salvare → si apre l\'altro caso, senza segni', await p.evaluate(() => window.__dbg.V.caso.id === 'caso-tcia-018' && !document.querySelectorAll('#slider-segni button').length));
  await caso('caso-tcia-001'); const n = await p.evaluate(() => Object.values(window.__dbg.V.misure).flat().filter((m) => !m.copia && !m.docente).length);
  ok('19 caso 001: solo la misura salvata', n === 1, n);
  await p.click('#cl-chiudi'); await p.waitForTimeout(800); ok('20 senza modifiche ✕ Chiudi non chiede nulla', await p.evaluate(() => !document.querySelector('#dlg-ann').open && !document.querySelector('#vista-elenco').hidden));
  await p.screenshot({ path: '/Volumes/Caloggero/_viste/v208.png' });
  await caso('caso-tcia-001'); await p.screenshot({ path: '/Volumes/Caloggero/_viste/v208_caso.png' });
  ok('21 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
