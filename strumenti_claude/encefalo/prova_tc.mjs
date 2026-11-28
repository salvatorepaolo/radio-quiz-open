// prova 28/11: atlante dell'encefalo sulla TC — sito (caso 177, calcolo nel browser) e visualizzatore gratuito
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const CL = '/Volumes/Caloggero/piattaforma-quiz/cloud', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free', OUT = '/Volumes/Caloggero/strumenti_claude/encefalo/prove';
const { chromium } = createRequire(CL + '/test/package.json')('playwright');
const P = 8933, sim = spawn(process.execPath, [CL + '/test/simulatore.mjs'], { cwd: CL, env: { ...process.env, PORTA: String(P), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const B = `http://localhost:${P}`, err = [], esito = (n, ok, x = '') => console.log(ok ? '✓' : '✖', n, x);
const b = await chromium.launch();
const testo = async (p) => (await p.textContent('#atl-pannello')).replace(/\s+/g, ' ');
try {
  const s = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage();
  s.on('pageerror', (e) => err.push('sito ' + e.message));
  await s.goto(B + '/?prova#/'); await s.waitForSelector('[data-vai="codice"]'); await s.click('[data-vai="codice"]'); await s.fill('#codice', 'admin-test-0000'); await s.press('#codice', 'Enter');
  await s.waitForSelector('#vista-elenco:not([hidden])');
  await s.goto(B + '/?prova#/caso/caso-tcia-177'); await s.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 30000 }); await s.waitForTimeout(2500);
  esito('sito: bottone atlante sulla TC', await s.isVisible('#btn-atlante'));
  await s.click('#btn-atlante'); await s.waitForSelector('#atl-serie', { timeout: 10000 });
  esito('sito: serie TC proposta', true, JSON.stringify(await s.$$eval('#atl-serie option', (o) => o.map((x) => x.textContent))));
  await s.click('#atl-avvia'); await s.waitForSelector('#atl-pannello .atl-qual', { timeout: 120000 });
  const t = await testo(s); esito('sito: atlante TC calcolato', /Qualità: (discreta|buona)/.test(t), t.slice(100, 420));
  await s.click('[data-atl-modo="lobi"]'); await s.waitForTimeout(800); await s.screenshot({ path: OUT + '/tc-sito-lobi.png' });
  await s.click('[data-atl-modo="arterie"]'); await s.waitForTimeout(800); await s.screenshot({ path: OUT + '/tc-sito-arterie.png' });
  // nome sotto il puntatore al centro del riquadro
  const nome = await s.evaluate(() => { const A = window.__atl, d = A.atlanteDi(window.__dbg.P(0).sIdx), g = d.geo;
    const c = [0, 1, 2].map((r) => g.origine[r] + g.assi[0][r] * g.sp[0] * g.dim[0] * 0.35 + g.assi[1][r] * g.sp[1] * g.dim[1] * 0.5 + g.assi[2][r] * g.sp[2] * g.dim[2] * 0.6);
    return A.nomeAtlante(d, c); });
  esito('sito: nome di una struttura in un punto dell\'encefalo', !!nome, nome);
  // client
  const files = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) giro(f); else if (/\.dcm$/i.test(e.name)) files.push(f); } };
  giro(path.join(CASI, 'caso-tcia-177', 'serie'));
  const c = await (await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 } })).newPage();
  c.on('pageerror', (e) => err.push('client ' + e.message));
  const invii = []; c.on('request', (r) => { if (r.method() !== 'GET') invii.push(r.url()); });
  await c.goto(B + '/client/index.html?prova'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  await c.waitForSelector('#dlg-privacy-cl[open]', { timeout: 10000 }); await c.click('#pr-accetto');
  await c.setInputFiles('#cl-file', files);
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 90000 }); await c.waitForTimeout(3000);
  esito('client: bottone atlante sulla TC', await c.isVisible('#btn-atlante'));
  if (await c.isVisible('#btn-atlante')) {
    await c.click('#btn-atlante'); await c.waitForSelector('#atl-serie', { timeout: 10000 }); await c.click('#atl-avvia');
    await c.waitForSelector('#atl-pannello .atl-qual', { timeout: 120000 });
    const t2 = await testo(c); esito('client: atlante TC calcolato', /TC:/.test(t2), t2.slice(100, 420));
    await c.click('#atl-contorni'); await c.waitForTimeout(800); await c.screenshot({ path: OUT + '/tc-client-contorni.png' });
  }
  esito('client: nessun invio', invii.length === 0, invii.join(' '));
} finally { esito('errori JS', err.length === 0, err.join(' | ')); await b.close(); sim.kill(); }
