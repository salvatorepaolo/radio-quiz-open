// prova_v235.mjs: confronto IA con il precedente (casi 110 e 111): pulsante, pannello dopo la risposta, vai al nodulo, copia nel referto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19350 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const W = +(process.env.LARG || 1000);
try {
  const a = await (await b.newContext({ viewport: { width: W, height: 900 }, deviceScaleFactor: 1, locale: 'it-IT' })).newPage();
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!c) ko++; };
  const errori = []; a.on('pageerror', (e) => errori.push(e.message));
  const apri = async (id) => { await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/caso/' + id);
    await a.waitForFunction((c) => { const d = window.__dbg; return d?.V?.caso?.id === c && d.V.img && d.CFIA?.caso === c; }, id, { timeout: 60000 }); await a.waitForTimeout(2500); };
  await apri('caso-tcia-110');
  ok('1 caso 110: pulsante «🤖» visibile (c\'è confronto.json)', await a.evaluate(() => !document.querySelector('#btn-confronto-ia').hidden && !!window.__dbg.CFIA.dati));
  await a.click('#btn-confronto-ia'); await a.waitForTimeout(300);
  const t1 = await a.$eval('#cfia-pannello', (e) => e.innerText);
  ok('2 pannello con coppie, Lung-RADS proposto 4B e RECIST', /4B/.test(t1) && /RECIST/.test(t1) && /crescita/.test(t1) && /nuovo/.test(t1), t1.slice(0, 400));
  // vai al nodulo in crescita (lobo superiore destro, 9,4 → 12,8 mm)
  await a.evaluate(() => { const r = [...document.querySelectorAll('#cfia-pannello tr')].find((x) => /crescita/.test(x.innerText)); r.querySelector('[data-cfia]').click(); });
  await a.waitForTimeout(3000);
  const v = await a.evaluate(() => { const d = window.__dbg; return d.V.pannelli.slice(0, 2).map((p) => ({ s: d.V.serie[p.sIdx]?.descrizione, img: p.idx + 1 })); });
  ok('3 «vai»: precedente a sinistra, attuale a destra, sulle immagini del nodulo', v.length === 2 && /T0/.test(v[0].s) && /T1/.test(v[1].s) && v[0].img > 1 && v[1].img > 1, v);
  await a.evaluate(() => { const b = document.querySelector('#cfia-pannello'); if (b.hidden) document.querySelector('#btn-confronto-ia').click(); });
  await a.waitForTimeout(500); await a.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/cfia_110.png' });
  await a.evaluate(() => { const q = document.querySelector('#q-referto'); if (q) q.value = ''; });
  await a.click('#cfia-referto'); await a.waitForTimeout(300);
  const ref = await a.evaluate(() => document.querySelector('#q-referto')?.value || document.querySelector('#referto-editor, .ref-editor, [contenteditable]')?.innerText || '');
  ok('4 «Copia nel referto»: frase del confronto', /Confronto con l'esame precedente/.test(ref) && /Lung-RADS al controllo proposto: 4B/.test(ref), ref.slice(0, 300));
  await apri('caso-tcia-111');
  await a.click('#btn-confronto-ia'); await a.waitForTimeout(300);
  const t2 = await a.$eval('#cfia-pannello', (e) => e.innerText);
  ok('5 caso 111: nodulo del lobo inferiore destro stabile, proposta 2', /stabile/.test(t2) && /proposta\)?:?\s*2/.test(t2.replace(/\n/g, ' ')), t2.slice(0, 400));
  await apri('caso-tcia-001');
  ok('6 caso senza precedente: niente pulsante', await a.evaluate(() => document.querySelector('#btn-confronto-ia').hidden));
  // studente prima della risposta: il pannello non mostra i risultati
  const s2 = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage(); s2.on('pageerror', (e) => errori.push(e.message));
  await s2.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await s2.goto(B + '/?prova#/'); await s2.click('[data-vai="codice"]'); await s2.fill('#codice', 'admin-test-0000'); await s2.press('#codice', 'Enter'); await s2.waitForSelector('#vista-elenco:not([hidden])');
  const cod = (await s2.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Confronto', ruolo: 'specializzando' }) })).json()))).codice;
  await s2.evaluate(async () => { await fetch('/api/esci', { method: 'POST' }).catch(() => {}); });
  const s3 = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: 'it-IT' })).newPage(); s3.on('pageerror', (e) => errori.push(e.message));
  await s3.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await s3.goto(B + '/?prova#/'); await s3.click('[data-vai="codice"]'); await s3.fill('#codice', cod); await s3.press('#codice', 'Enter'); await s3.waitForSelector('#vista-elenco:not([hidden])');
  await s3.goto(B + '/?prova#/caso/caso-tcia-110'); await s3.waitForFunction(() => { const d = window.__dbg; return d?.V?.caso?.id === 'caso-tcia-110' && d.CFIA?.dati; }, null, { timeout: 60000 });
  await s3.click('#btn-confronto-ia'); await s3.waitForTimeout(300);
  const t3 = await s3.$eval('#cfia-pannello', (e) => e.innerText);
  ok('7 studente prima della risposta: niente risultati, solo l\'avviso', /dopo la risposta/.test(t3) && !/4B/.test(t3), t3.slice(0, 200));
  ok('8 nessun errore JavaScript', !errori.length, errori.slice(0, 3));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
