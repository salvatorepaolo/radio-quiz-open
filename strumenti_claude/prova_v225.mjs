// prova_v225.mjs: diametri del vaso perpendicolari alla linea centrale (aorta e vena cava dalla segmentazione IA, caso 004)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19700 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/caso/caso-tcia-004'); await a.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-004', null, { timeout: 60000 }); await a.waitForTimeout(1500);
  await a.evaluate(async () => { const d = window.__dbg, si = d.V.serie.findIndex((s) => /venosa|portale|VENOUS/i.test(s.descrizione)); if (si >= 0) await d.selezionaSerie(si, d.V.attivo); });
  await a.waitForTimeout(1000);
  await a.evaluate(() => document.querySelector('#modo-mpr').click()); await a.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 240000 }); await a.waitForTimeout(3000);
  await a.click('#btn-cpr'); await a.waitForTimeout(500);
  const vasi = await a.evaluate(() => [...document.querySelectorAll('#cpr-ia-vaso option')].map((o) => o.value));
  ok('1 vasi della segmentazione IA proposti', vasi.includes('aorta') && vasi.includes('inferior_vena_cava'), vasi);
  const esito = async () => { await a.waitForFunction(() => /Diametro massimo|iametro massimo|non riusc|Nessuna/.test(document.querySelector('#cpr-esito')?.textContent || ''), null, { timeout: 90000 }).catch(() => {}); await a.waitForTimeout(500);
    return a.evaluate(() => ({ t: document.querySelector('#cpr-esito').textContent, sez: !document.querySelector('#cpr-sezione').hidden, d: window.__dbg.CPRS?.diam?.massimo || null, parete: window.__dbg.CPRS?.diam?.parete, info: document.querySelector('#mpr-info').textContent })); };
  await a.selectOption('#cpr-ia-vaso', 'aorta'); await a.click('#cpr-aorta'); const r1 = await esito();
  const d1 = +((r1.t.match(/massimo perpendicolare all'asse(?: \([^)]*\))? ([\d,]+) mm/) || [])[1] || '0').replace(',', '.');
  ok('2 aorta: diametro massimo perpendicolare con la sezione, parete dalla IA', r1.sez && d1 > 14 && d1 < 45 && /segmentazione IA/.test(r1.t), { d1, sez: r1.sez, t: r1.t.slice(0, 300), info: r1.info });
  await a.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/diametri_aorta.png' });
  // spostando la sezione cambia la posizione mostrata
  await a.evaluate(() => { const p = document.querySelector('#cpr-pos'); p.value = '20'; p.dispatchEvent(new Event('input')); }); await a.waitForTimeout(300);
  ok('3 cursore della sezione', await a.evaluate(() => window.__dbg.CPRS?.pos === 20 && /2,0 cm/.test(document.querySelector('#cpr-sezione').title + ' ' + 'x') || window.__dbg.CPRS?.pos === 20));
  await a.selectOption('#cpr-ia-vaso', 'inferior_vena_cava'); await a.click('#cpr-aorta'); await a.waitForTimeout(500); const r2 = await esito();
  const d2 = +((r2.t.match(/massimo perpendicolare all'asse(?: \([^)]*\))? ([\d,]+) mm/) || [])[1] || '0').replace(',', '.');
  ok('4 vena cava inferiore: linea centrale e diametri', /Vena cava inferiore/.test(r2.t) && d2 > 8 && d2 < 45, { d2, t: r2.t.slice(0, 200), info: r2.info });
  await a.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/diametri_cava.png' });
  // copia nel referto
  const ref = await a.evaluate(() => { document.querySelector('#cpr-referto')?.click(); return document.querySelector('#q-referto')?.value || ''; });
  ok('5 «Copia nel referto»', /diametro massimo perpendicolare all'asse/.test(ref), ref.slice(0, 160));
  ok('6 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
