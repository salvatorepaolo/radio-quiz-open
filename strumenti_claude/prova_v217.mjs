// prova_v217.mjs: RM cardiaca senza asse corto (FE dall'asse lungo, caso 108), VD da verificare (caso 071), RECIST dal volume (caso 001)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19100 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' });
await ctx.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
const a = await ctx.newPage(); a.on('pageerror', (e) => errori.push(e.message));
const apri = async (id) => { await a.goto(B + '/?prova#/'); await a.waitForTimeout(1200); await a.goto(B + `/?prova#/caso/${id}`); await a.waitForFunction((id) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === id, id, { timeout: 60000 }); await a.waitForTimeout(1200); };
try {
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  // 1. caso 108: niente asse corto in cine → area-lunghezza sulla cine 2 camere
  await apri('caso-tcia-108');
  await a.click('[data-tool="cmr"]'); await a.waitForSelector('#cmr-pannello:not([hidden])');
  await a.click('#cmr-auto'); await a.waitForFunction(() => window.__dbg.CMR.modo === 'al', null, { timeout: 20000 }); await a.waitForTimeout(800);
  const s1 = await a.evaluate(() => { const d = window.__dbg, p = d.P(); return { serie: d.V.serie[p.sIdx].descrizione, sez: !!document.querySelector('#cmr-pannello .cmr-al-stato') }; });
  ok('1 senza asse corto: passa all\'asse lungo e apre la cine', /Cine/.test(s1.serie) && s1.sez, s1);
  const clic = async (punti) => { for (const q of punti) { await a.evaluate((q) => window.__dbg.puntoCmr(window.__dbg.V.attivo, q), q); await a.waitForTimeout(150); } };
  const pts = [{ x: 126, y: 106 }, { x: 130, y: 137 }, { x: 103, y: 127 }];
  await clic(pts); await a.waitForTimeout(500);
  const ed = await a.evaluate(() => { const d = window.__dbg, t = d.CMR.al.tracce[d.P().sIdx]; return { area: t.fasi.ed?.area, L: t.fasi.ed?.L }; });
  ok('2 fine diastole: contorno dal lato del ventricolo e lunghezza', ed.area > 1000 && ed.L > 40 && ed.L < 140, ed);
  await a.click('#cmr-al-vai-es'); await a.waitForTimeout(800);
  await clic(pts); await a.waitForTimeout(600);
  const k = await a.evaluate(() => { const K = window.__dbg.cifreCmr(); return { metodo: K.vs?.metodo, fe: K.vs?.fe, edv: K.vs?.edv, kpi: !!document.querySelector('#cmr-pannello .cmr-kpi') }; });
  ok('3 FE e volumi del VS con il metodo area-lunghezza', /area-lunghezza/.test(k.metodo || '') && k.fe > 0 && k.fe < 95 && k.edv > 20 && k.kpi, k);
  await a.click('#cmr-copia'); await a.waitForTimeout(500);
  ok('4 nel referto il metodo usato', /area-lunghezza/.test(await a.inputValue('#q-referto')));
  // 2. caso 071: FE del VD implausibile → «da verificare»
  await apri('caso-tcia-071');
  await a.evaluate(() => document.querySelector('[data-tool="wl"]')?.click()); await a.waitForTimeout(300);
  await a.click('[data-tool="cmr"]'); await a.waitForSelector('#cmr-pannello:not([hidden])');
  await a.click('#cmr-auto'); await a.waitForFunction(() => document.querySelector('#cmr-pannello .cmr-kpis'), null, { timeout: 120000 }); await a.waitForTimeout(800);
  const vd = await a.evaluate(() => { const K = window.__dbg.cifreCmr(); return { sv: [K.vs?.sv, K.vd?.sv].map(Math.round), dubbio: K.vd?.dubbio || '', tile: [...document.querySelectorAll('#cmr-pannello .cmr-kpi')].map((x) => x.className + ' ' + x.textContent.replace(/\s+/g, ' ')), avviso: !!document.querySelector('#cmr-pannello .cmr-dubbio') }; });
  const coerente = Math.abs(vd.sv[1] - vd.sv[0]) / vd.sv[0] <= 0.3;
  ok('5 VD: gittate coerenti oppure valori «da verificare» con l\'avviso', coerente ? !vd.dubbio : (vd.avviso && vd.tile.some((x) => /dubbio FE VD/.test(x)) && !vd.tile.some((x) => /ko FE VD/.test(x))), vd);
  // 3. caso 001: volume semiautomatico → RECIST automatico
  await apri('caso-tcia-001');
  const rc = await a.evaluate(async () => {
    const d = window.__dbg; await d.selezionaSerie(d.V.serie.findIndex((s) => s._i === 0), d.V.attivo, { idx: 24 }); await new Promise((r) => setTimeout(r, 1500));
    const im = d.P().img, hu = (x, y) => im.pix[y * im.cols + x] * im.slope + im.inter; let best = null;
    for (let y = 327; y < 355; y++) for (let x = 159; x < 186; x++) { let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m += hu(x + dx, y + dy); if (!best || m > best.m) best = { x, y, m }; }
    await d.volumeDa(d.V.attivo, { x: best.x, y: best.y }); await new Promise((r) => setTimeout(r, 500));
    const v = d.V.volumi[d.V.volumi.length - 1]; if (!v) return { errore: 'nessun volume' };
    const mis = Object.entries(d.V.misure).flatMap(([k, l]) => l.filter((m) => m.tipo === 'recist' && m.auto).map(() => k));
    return { vol: v.vol, diam: v.diametro, lung: v.recist?.lung, corto: v.recist?.corto, j: v.recist?.j, mis, lista: document.querySelector('#volumi')?.textContent || '' };
  });
  ok('6 RECIST dal volume: asse lungo ≈ diametro massimo, asse corto minore, misura aggiunta', rc.lung > 3 && rc.corto > 1 && rc.corto <= rc.lung && Math.abs(rc.lung - rc.diam) < 2.5 && rc.mis.length === 1 && /RECIST/.test(rc.lista), rc);
  ok('7 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
