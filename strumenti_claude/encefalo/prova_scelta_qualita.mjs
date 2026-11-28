// prova 28/11: atlante — qualità e «Controlla l'allineamento» nel sito (caso 062), scelta della serie e calcolo nel client
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const CL = '/Volumes/Caloggero/piattaforma-quiz/cloud', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free', OUT = '/Volumes/Caloggero/strumenti_claude/encefalo/prove';
const { chromium } = createRequire(CL + '/test/package.json')('playwright');
const P = 8931, sim = spawn(process.execPath, [CL + '/test/simulatore.mjs'], { cwd: CL, env: { ...process.env, PORTA: String(P), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const B = `http://localhost:${P}`, err = [], esito = (n, ok, x = '') => console.log(ok ? '✓' : '✖', n, x);
const b = await chromium.launch(process.env.GPU ? { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } : { args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--enable-unsafe-webgpu'] });
try {
  const s = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage();
  s.on('pageerror', (e) => err.push('sito ' + e.message));
  await s.goto(B + '/?prova#/'); await s.waitForSelector('[data-vai="codice"]'); await s.click('[data-vai="codice"]'); await s.fill('#codice', 'admin-test-0000'); await s.press('#codice', 'Enter');
  await s.waitForSelector('#vista-elenco:not([hidden])');
  await s.goto(B + '/?prova#/caso/caso-tcia-062'); await s.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 30000 }); await s.waitForTimeout(2500);
  await s.click('#btn-atlante'); await s.waitForSelector('#atl-pannello .atl-qual', { timeout: 20000 });
  const q = await s.textContent('#atl-pannello .atl-qual'); esito('sito: qualità', /Qualità: (buona|discreta)/.test(q), q + ' · ' + await s.getAttribute('#atl-pannello .atl-qual', 'title'));
  await s.screenshot({ path: OUT + '/q-sito-pieno.png' });
  await s.click('#atl-contorni'); await s.waitForTimeout(800);
  esito('sito: contorni accesi', await s.evaluate(() => window.__atl.ATL.contorni === true));
  await s.screenshot({ path: OUT + '/q-sito-contorni.png' });
  // client
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro(path.join(CASI, 'caso-tcia-062', 'serie'));
  const c = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage();
  c.on('pageerror', (e) => err.push('client ' + e.message));
  const invii = []; c.on('request', (r) => { if (r.method() !== 'GET') invii.push(r.url()); });
  await c.goto(B + '/client/index.html?prova'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }); await c.click('#pr-accetto');
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(3000);
  esito('client: bottone atlante visibile', await c.isVisible('#btn-atlante'));
  await c.click('#btn-atlante'); await c.waitForSelector('#atl-serie', { timeout: 10000 });
  const opz = await c.$$eval('#atl-serie option', (o) => o.map((x) => x.textContent));
  esito('client: serie proposte', opz.length >= 1 && /consigliata/.test(opz[0]) && /T1/i.test(opz[0]), JSON.stringify(opz));
  await c.screenshot({ path: OUT + '/q-client-scelta.png' });
  await c.click('#atl-avvia');
  const tic = setInterval(async () => { try { console.log('  …', (await c.textContent('#atl-pannello')).replace(/\s+/g, ' ').slice(25, 140)); } catch {} }, 30000);
  await c.waitForSelector('#atl-pannello .atl-qual, #atl-pannello #atl-serie + #atl-avvia', { timeout: 400000 });
  clearInterval(tic); const t = await c.textContent('#atl-pannello');
  esito('client: atlante calcolato', /Qualità:/.test(t), t.replace(/\s+/g, ' ').slice(0, 300));
  // vale anche sulle altre serie: la FLAIR assiale (24 immagini) ha il nome sotto il puntatore
  const altre = await c.evaluate(() => { const V = window.__dbg.V; return V.serie.map((s, i) => [i, s.descrizione, !!window.__atl.atlanteDi(i)]); });
  esito('client: atlante su tutte le serie dell\'esame', altre.every((x) => x[2]), JSON.stringify(altre));
  await c.screenshot({ path: OUT + '/q-client-fatto.png' });
  // un'altra serie (T2 3D): la qualità dice che non è una T1
  await c.click('#atl-rifai'); await c.waitForSelector('#atl-serie'); await c.selectOption('#atl-serie', { label: '3D_AX_T2_SPACE' }); await c.click('#atl-avvia');
  await c.waitForSelector('#atl-pannello .atl-qual', { timeout: 300000 });
  const t2 = (await c.textContent('#atl-pannello')).replace(/\s+/g, ' ');
  esito('client: ricalcolo su T2 con motivo', /SPACE/.test(t2) && /non pesata in T1|scarsa/.test(t2), t2.slice(120, 420));
  await c.click('#atl-contorni'); await c.waitForTimeout(800); await c.screenshot({ path: OUT + '/q-client-t2-contorni.png' });
  esito('client: nessun invio', invii.length === 0, invii.join(' '));
} finally { esito('errori JS', err.length === 0, err.join(' | ')); await b.close(); sim.kill(); }
