import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const CASO = process.env.CASO || 'caso-tcia-071', RE = process.env.RE || 'asse corto|SAX|sa\\b|short';
const PORTA = 19050 + Math.floor(Math.random() * 40), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])');
await p.goto(B + `/?prova#/caso/${CASO}`); await p.waitForFunction((c) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === c, CASO, { timeout: 60000 }); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => window.__dbg.V.serie.map((s, i) => `${i}: ${s.descrizione} (${s.files.length})`).join('\n')));
await p.evaluate(async (src) => { const d = window.__dbg, r = new RegExp(src, 'i'), si = d.V.serie.findIndex((x) => r.test(x.descrizione || '')); await d.selezionaSerie(Math.max(0, si), d.V.attivo); }, RE);
await p.waitForTimeout(2000);
await p.evaluate(() => document.querySelector('#barra-2d [data-tool="cmr"]').click()); await p.waitForTimeout(500);
await p.evaluate(async (a) => { if (a !== '') window.__dbg.CMR.apriVd = +a; await window.__dbg.autoCmr(); }, process.env.APRI ?? ''); await p.waitForTimeout(2000);
const r = await p.evaluate(() => { const d = window.__dbg, C = d.CMR; const area = (v, si, f) => C.seg[`${v}|${si}|${f}`]?.area ?? null;
  const fette = (C.sax || []).map(({ si }) => ({ si, vsED: area('vs', si, C.ed), vsES: area('vs', si, C.es), vdED: area('vd', si, C.ed), vdES: area('vd', si, C.es), inclVd: C.auto?.vd?.incl?.[si], inclVs: C.auto?.vs?.incl?.[si] }));
  return { ed: C.ed, es: C.es, cifre: d.cifreCmr?.(), fette, testo: document.querySelector('#cmr-pannello')?.textContent.replace(/\s+/g, ' ').slice(0, 600) }; });
console.log(JSON.stringify(r, null, 0));
for (const [si, nome] of [[10, 'a'], [12, 'b']]) for (const f of ['es', 'ed']) {
  await p.evaluate(async ([si, f]) => { const d = window.__dbg; await d.selezionaSerie(si, d.V.attivo, { idx: d.CMR[f] }); }, [si, f]); await p.waitForTimeout(800);
  await p.screenshot({ path: `/Volumes/Caloggero/strumenti_claude/_viste/rv_${nome}_${f}.png`, clip: { x: 620, y: 165, width: 610, height: 615 } }); }
await b.close(); sim.kill(); process.exit(0);
