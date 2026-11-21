// prova_v246.mjs: menù più semplici — «Iscritti e docenti» (invito a scomparsa, filtri a pillola, menù Azioni),
// menù della barra e ⋯ con titolo e spiegazioni, menu Gestione con la tastiera
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19200 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0; const errori = [];
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  // menu Gestione con la tastiera
  await a.click('#menu-gestione summary'); await a.keyboard.press('ArrowDown'); await a.keyboard.press('ArrowDown');
  const foc = await a.evaluate(() => document.activeElement?.closest('.menu-voci') ? document.activeElement.textContent.trim().slice(0, 30) : null);
  await a.keyboard.press('Escape');
  ok('1 menu Gestione: ↓ scorre le voci, Esc chiude', !!foc && !(await a.evaluate(() => document.querySelector('#menu-gestione').open)), foc);
  await a.goto(B + '/?prova#/account'); await a.waitForTimeout(1200);
  ok('2 pagina vuota: il modulo dell\'invito è già aperto', await a.evaluate(() => !document.querySelector('#form-invito').hidden));
  // invito con la scheda del ruolo
  await a.fill('#inv-nome', 'Giulia Verdi'); await a.fill('#inv-email', 'giulia@example.org'); await a.click('.inv-ruolo:has(input[value="docente"])');
  ok('3 la scheda del ruolo imposta il ruolo', (await a.evaluate(() => document.querySelector('#inv-ruolo').value)) === 'docente');
  await a.click('#form-invito button[type=submit]'); await a.waitForTimeout(1000);
  const dopo = await a.evaluate(() => ({ chiuso: document.querySelector('#form-invito').hidden, msg: document.querySelector('#acc-msg').textContent, righe: document.querySelectorAll('#acc-lista tr').length }));
  ok('4 invito inviato: modulo chiuso, messaggio, persona nell\'elenco', dopo.chiuso && /Invito inviato/.test(dopo.msg) && dopo.righe >= 1, dopo);
  await a.evaluate(async () => { const post = (u, d) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
    for (const [n, e] of [['Maria Rossi', 'maria@example.org'], ['Luca Bianchi', 'luca@example.org']]) await post('/api/account', { nome: n, ruolo: 'specializzando', email: e }); });
  await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/account'); await a.waitForTimeout(1200);
  // pillole
  const pil = await a.evaluate(() => [...document.querySelectorAll('.acc-pill')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()));
  ok('5 filtri a pillola con il numero', pil.some((t) => /Tutti\s*\d+/.test(t)) && pil.some((t) => /Docenti\s*1$/.test(t)) && pil.some((t) => /Iscritti\s*2$/.test(t)), pil);
  await a.click('.acc-pill[data-f="docenti"]'); await a.waitForTimeout(300);
  const filt = await a.evaluate(() => [...document.querySelectorAll('#acc-lista tr')].map((r) => r.querySelector('.acc-nome b').textContent));
  ok('6 pillola «Docenti»: solo i docenti', filt.length === 1 && filt[0] === 'Giulia Verdi', filt);
  await a.click('.acc-pill[data-f=""]'); await a.waitForTimeout(300);
  // menù Azioni: rendi docente
  const riga = a.locator('#acc-lista tr', { hasText: 'Maria Rossi' });
  await riga.locator('details.acc-menu summary').click(); await a.waitForTimeout(200);
  const voci = await riga.locator('.acc-menu-pop button').allTextContents();
  ok('7 menù Azioni con le voci raggruppate', voci.some((t) => /Rendi docente/.test(t)) && voci.some((t) => /Elimina/.test(t)) && (await riga.locator('.acc-menu-pop .mg-tit').count()) >= 2, voci);
  const vis = await riga.locator('.acc-menu-pop').evaluate((p) => { const r = p.getBoundingClientRect(); return r.width > 150 && r.bottom <= innerHeight && r.right <= innerWidth; });
  ok('8 il menù si apre intero nello schermo', vis);
  await riga.locator('button[data-az="docente"]').click(); await a.waitForTimeout(800);
  ok('9 «Rendi docente» dal menù', /ora è docente/.test(await a.locator('#acc-msg').innerText()));
  // elimina: due pressioni
  const r2 = a.locator('#acc-lista tr', { hasText: 'Luca Bianchi' });
  await r2.locator('details.acc-menu summary').click(); await r2.locator('button[data-az="elimina"]').click(); await a.waitForTimeout(200);
  const conf = await r2.locator('button[data-az="elimina"]').innerText();
  await r2.locator('button[data-az="elimina"]').click(); await a.waitForTimeout(800);
  ok('10 «Elimina» chiede conferma, poi elimina', /Confermi/.test(conf) && !(await a.locator('#acc-lista tr', { hasText: 'Luca Bianchi' }).count()), conf);
  // ricerca senza risultati
  await a.fill('#acc-filtro', 'zzzz'); await a.waitForTimeout(300);
  ok('11 nessun risultato: messaggio chiaro', await a.evaluate(() => !document.querySelector('#acc-vuoto').hidden));
  await a.fill('#acc-filtro', '');
  // menù del visualizzatore
  await a.goto(B + '/?prova#/caso/caso-tcia-001'); await a.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await a.waitForTimeout(1000);
  const menu = await a.evaluate(() => ({ misure: document.querySelector('#menu-misure .mg-tit')?.textContent, desc: [...document.querySelectorAll('#menu-misure .et small')].length, altro: document.querySelector('#cl-altro .mg-tit')?.textContent }));
  ok('12 menù della barra e ⋯ con titolo e spiegazioni', menu.misure === 'Altre misure' && menu.desc >= 4 && menu.altro === 'Altre funzioni', menu);
  // inglese
  const e = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'en-US' })).newPage(); e.on('pageerror', (x) => errori.push(x.message));
  await e.goto(B + '/?prova&lang=en#/'); await e.click('[data-vai="codice"]'); await e.fill('#codice', 'admin-test-0000'); await e.press('#codice', 'Enter'); await e.waitForSelector('#vista-elenco:not([hidden])');
  await e.goto(B + '/?prova&lang=en#/account'); await e.waitForTimeout(1500);
  const en = await e.evaluate(() => ({ btn: document.querySelector('#acc-invita-apri').textContent, pill: document.querySelector('.acc-pill')?.textContent, th: document.querySelector('#vista-account th')?.textContent }));
  ok('13 inglese', /Invite a person/.test(en.btn) && /All/.test(en.pill || '') && /Person/.test(en.th || ''), en);
  ok('14 nessun errore JavaScript', !errori.length, errori.slice(0, 4));
} catch (x) { console.log('ERRORE', x); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
