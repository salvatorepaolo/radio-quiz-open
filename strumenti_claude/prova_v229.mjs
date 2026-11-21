// prova_v229.mjs: disposizioni automatiche per tipo di esame (TC torace mediastino · polmone, TC fasi, RM prostata)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19250 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
try {
  const a = await (await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  await a.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  const apri = async (id) => { await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/caso/' + id); await a.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, id, { timeout: 60000 }); await a.waitForTimeout(3500);
    return a.evaluate(() => { const d = window.__dbg; return { n: d.V.n, sincro: d.V.sincro, pannelli: d.V.pannelli.slice(0, d.V.n).map((p) => ({ s: p.sIdx, wc: p.wc, ww: p.ww, d: d.V.serie[p.sIdx]?.descrizione })), ws: [...document.querySelectorAll('#ws-fasi button')].map((x) => x.textContent) }; }); };
  // dal 11/11 l'esame si apre 1×1: la disposizione si sceglie col pulsante
  const t0 = await apri('caso-tcia-001');
  ok('0 all\'apertura un solo riquadro', t0.n === 1, t0);
  await a.evaluate(() => [...document.querySelectorAll('#ws-fasi button')].find((b) => /polmone · mediastino/.test(b.textContent))?.click()); await a.waitForTimeout(2500);
  const t1 = await a.evaluate(() => { const d = window.__dbg; return { n: d.V.n, sincro: d.V.sincro, pannelli: d.V.pannelli.slice(0, d.V.n).map((p) => ({ s: p.sIdx, wc: p.wc, ww: p.ww, d: d.V.serie[p.sIdx]?.descrizione })) }; });
  ok('1 TC torace con la disposizione dal pulsante: polmone e mediastino affiancati, sincronizzati', t1.n === 2 && t1.pannelli[0].wc === -600 && t1.pannelli[1].ww === 400 && t1.pannelli.every((p) => /TC/.test(p.d)), t1);
  const t2 = await apri('caso-tcia-004');
  ok('2 TC fegato: le quattro fasi affiancate e sincronizzate', t2.n === 4 && t2.sincro && /basale/.test(t2.pannelli[0].d) && /tardiva/.test(t2.pannelli[3].d), t2.pannelli.map((p) => p.d));
  const t3 = await apri('caso-tcia-022');
  ok('3 RM prostata: disposizione del distretto proposta; quella del docente (2 riquadri) resta', t3.ws.includes('RM prostata: T2 · DWI · ADC · DCE') && t3.n === 2, t3);
  await a.evaluate(() => [...document.querySelectorAll('#ws-fasi button')].find((x) => /prostata/.test(x.textContent)).click()); await a.waitForTimeout(2500);
  const t4 = await a.evaluate(() => { const d = window.__dbg; return d.V.pannelli.slice(0, d.V.n).map((p) => d.V.serie[p.sIdx]?.descrizione); });
  ok('4 clic: T2, DWI e ADC affiancate', t4.length >= 3 && /T2/.test(t4[0]) && /diffusion|DWI/i.test(t4[1]) && /ADC/.test(t4[2]), t4);
  const t5 = await apri('caso-tcia-020');
  ok('3b RM encefalo con disposizione del docente: resta la sua', t5.n === 2, t5.pannelli.map((p) => p.d));
  ok('5 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
