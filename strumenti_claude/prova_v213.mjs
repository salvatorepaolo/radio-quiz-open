// prova_v213.mjs: nel referto a una colonna (finestra separata e piattaforma) la firma non copre il testo
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18100 + Math.floor(Math.random() * 100)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); let ko = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'OK ' : 'KO '} ${n} → ${JSON.stringify(x)}`); if (!c) ko++; };
const misura = (doc) => { doc.querySelector('#ref-prof').open = true; const e = doc.querySelector('#ref-testo').getBoundingClientRect(), f = doc.querySelector('#ref-firma').getBoundingClientRect(), s = doc.querySelector('.ref-sx').getBoundingClientRect(), c = doc.querySelector('.ref-corpo').getBoundingClientRect(); return { fondoEditor: Math.round(e.bottom), cimaFirma: Math.round(f.top), fondoIntestata: Math.round(s.bottom), cimaCorpo: Math.round(c.top) }; };
try {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 800 }, locale: 'it-IT' }); const p = await ctx.newPage();
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
  await p.goto(B + '/?prova#/caso/caso-tcia-001'); await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(800);
  await p.click('#cl-referto'); await p.waitForSelector('#dlg-referto[open]');
  await p.evaluate(() => { document.querySelector('#ref-testo').innerHTML = Array.from({ length: 30 }, (_, i) => `<h3>SEZIONE ${i + 1}:</h3><p>testo</p>`).join(''); });
  const m1 = await p.evaluate(`(${misura.toString()})(document)`); ok('1 nella pagina: la firma sta sotto l\'editor', m1.cimaFirma >= m1.fondoEditor && m1.cimaCorpo >= m1.fondoIntestata, m1);
  await p.click('#ref-finestra'); await p.waitForTimeout(1200);
  const m2 = await p.evaluate(`(() => { const w = window.__dbg?.FIN_REF?.win; return w ? (${misura.toString()})(w.document) : null; })()`);
  // dall'8/11 la finestra separata larga ha due colonne come la pagina del client: intestazione a sinistra, referto a destra
  ok('2 nella finestra separata: la firma sta sotto l\'editor', m2 && m2.cimaFirma >= m2.fondoEditor, m2);
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
