// prove dell'interfaccia dell'atlante sulla TC (28/11): studente prima/dopo la risposta, modi, opacità, contorni, piani
// ricostruiti, inglese; client: TC del torace (niente bottone), senza rete, TC con gantry inclinato (CQ500, solo locale).
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const CL = '/Volumes/Caloggero/piattaforma-quiz/cloud', CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free', OUT = '/Volumes/Caloggero/strumenti_claude/encefalo/prove';
const { chromium } = createRequire(CL + '/test/package.json')('playwright');
const P = 8935, sim = spawn(process.execPath, [CL + '/test/simulatore.mjs'], { cwd: CL, env: { ...process.env, PORTA: String(P), CASI }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const B = `http://localhost:${P}`, err = [], esito = (n, ok, x = '') => console.log(ok ? '✓' : '✖', n, x);
const b = await chromium.launch();
const testo = async (p) => (await p.textContent('#atl-pannello')).replace(/\s+/g, ' ');
const dcm = (dir) => { const f = []; const giro = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const x = path.join(d, e.name); if (e.isDirectory()) giro(x); else if (/\.dcm$/i.test(e.name) || !/\./.test(e.name)) f.push(x); } }; giro(dir); return f; };
const pagina = async (o = {}) => { const ctx = await b.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 900 }, ...o }), p = await ctx.newPage(); p.on('pageerror', (e) => err.push(p.url().slice(0, 40) + ' ' + e.message)); return { ctx, p }; };
const entra = async (p, codice) => { await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', codice); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])'); };
const client = async (files, { offline = false } = {}) => {
  const { ctx, p } = await pagina(); const invii = []; p.on('request', (r) => { if (r.method() !== 'GET') invii.push(r.url()); });
  await p.goto(B + '/client/index.html?prova'); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  if (offline) { await p.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 }); await p.waitForTimeout(4000); await ctx.setOffline(true); await p.reload(); await p.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 }); }
  if (await p.isVisible('#dlg-privacy-cl[open]').catch(() => false) || await p.waitForSelector('#dlg-privacy-cl[open]', { timeout: 5000 }).catch(() => null)) await p.click('#pr-accetto').catch(() => {});
  await p.setInputFiles('#cl-file', files);
  await p.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 120000 }); await p.waitForTimeout(3000);
  return { ctx, p, invii };
};
try {
  if (!process.env.SOLO_CLIENT) {
  // 1. studente: prima della risposta l'atlante non si calcola, dopo sì
  const { p: adm } = await pagina(); await entra(adm, 'admin-test-0000');
  const r = await adm.evaluate(async () => (await (await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Atlante', ruolo: 'specializzando' }) })).json()));
  const { p: s } = await pagina(); await entra(s, r.codice);
  await s.goto(B + '/?prova#/caso/caso-tcia-177'); await s.waitForFunction(() => window.__dbg?.P(0)?.img, null, { timeout: 30000 }); await s.waitForTimeout(2000);
  esito('studente: bottone atlante presente', await s.isVisible('#btn-atlante'));
  await s.click('#btn-atlante'); await s.waitForSelector('#atl-pannello:not([hidden])');
  const prima = await testo(s); esito('studente: prima della risposta niente calcolo', /dopo la risposta/.test(prima) && !(await s.$('#atl-avvia')), prima.slice(0, 120));
  await s.click('#atl-chiudi');
  await s.evaluate(() => { const c = document.querySelector('#q-check'); if (c) c.open = true; document.querySelectorAll('#q-check input[type=checkbox]').forEach((x) => { if (!x.checked) x.click(); }); });
  for (let k = 0; k < 15; k++) {
    await s.evaluate(() => { const i = [...document.querySelectorAll('#q-form input[type=checkbox], #q-form input[type=radio]')].find((x) => x.offsetParent); if (i && !i.checked) i.click(); i?.closest('.opz')?.querySelector('button[data-conf]')?.click(); });
    await s.waitForTimeout(300);
    await s.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); });
    const bc = await s.$('#btn-conferma:not([hidden])'); if (bc && await bc.isVisible()) { await bc.evaluate((e) => e.click()); break; }
    const av = await s.$('#q-succ:not([hidden])'); if (av) await av.evaluate((e) => e.click()); else break; await s.waitForTimeout(200);
  }
  await s.waitForSelector('#q-esito:not([hidden])', { timeout: 15000 }).catch(() => {});
  await s.click('#btn-atlante'); await s.waitForSelector('#atl-avvia', { timeout: 10000 }).catch(() => {});
  esito('studente: dopo la risposta si può calcolare', !!(await s.$('#atl-avvia')), 'esito visibile: ' + await s.isVisible('#q-esito') + ' · ' + (await testo(s)).slice(0, 160) + ' · stato ' + await s.evaluate(() => document.querySelector('#btn-conferma')?.dataset.stato + ' | ' + document.querySelector('#q-esito')?.textContent.slice(0, 150)));
  await s.screenshot({ path: OUT + '/tc-ui-dopo.png' });
  await s.click('#atl-avvia'); await s.waitForSelector('#atl-pannello .atl-qual', { timeout: 60000 });
  // 2. modi, legenda, opacità, contorni, piani ricostruiti
  const leg = {};
  for (const m of ['giri', 'lobi', 'arterie', 'dettaglio']) { await s.click(`[data-atl-modo="${m}"]`); await s.waitForTimeout(400); leg[m] = await s.$$eval('#atl-pannello .atl-voce', (v) => v.length); }
  esito('modi e legende', leg.lobi === 7 && leg.arterie === 5 && leg.dettaglio > 10, JSON.stringify(leg));
  await s.click('[data-atl-modo="lobi"]'); await s.fill('#atl-opac', '0.8').catch(() => {}); await s.$eval('#atl-opac', (e) => { e.value = '0.8'; e.dispatchEvent(new Event('input')); });
  esito('opacità', await s.evaluate(() => window.__atl.ATL.opac) === 0.8);
  await s.click('#atl-contorni'); await s.waitForTimeout(300); await s.click('#atl-contorni'); esito('contorni acceso/spento', await s.evaluate(() => window.__atl.ATL.contorni === false));
  await s.click('#atl-chiudi');
  for (const piano of ['Sag', 'Cor', 'Ax']) {
    await s.click(`text="${piano}"`).catch(() => {}); await s.waitForTimeout(1500);
    // colore dell'atlante nella tela: pixel con tinta dei lobi (non grigi) al centro dell'immagine
    const col = await s.evaluate(() => { const c = [...document.querySelectorAll('#vista-caso canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; const x = c.getContext('2d').getImageData(c.width * 0.25, c.height * 0.25, c.width * 0.5, c.height * 0.5).data; let n = 0; for (let i = 0; i < x.length; i += 16) if (Math.max(x[i], x[i + 1], x[i + 2]) - Math.min(x[i], x[i + 1], x[i + 2]) > 40) n++; return n; });
    esito(`piano ${piano}: atlante disegnato`, col > 200, col + ' pixel colorati');
    await s.screenshot({ path: `${OUT}/tc-ui-${piano}.png` });
  }
  // 3. inglese
  await s.click('text="EN"').catch(() => {}); await s.waitForTimeout(1500); await s.click('#btn-atlante').catch(() => {}); await s.waitForTimeout(800);
  const en = await testo(s).catch(() => ''); esito('inglese: pannello', !!en, en.slice(0, 200));
  }
  // 4. client: TC del torace → nessun bottone
  { const { p, ctx } = await client(dcm(path.join(CASI, 'caso-tcia-001', 'serie')));
    esito('client: TC del torace senza bottone atlante', !(await p.isVisible('#btn-atlante'))); await ctx.close(); }
  // 5. client senza rete (dopo la prima visita): TC dell'encefalo
  { const { p, ctx, invii } = await client(dcm(path.join(CASI, 'caso-tcia-177', 'serie')), { offline: true });
    await p.click('#btn-atlante'); await p.waitForSelector('#atl-avvia'); await p.click('#atl-avvia');
    const ok = await p.waitForSelector('#atl-pannello .atl-qual', { timeout: 60000 }).then(() => true).catch(() => false);
    esito('client senza rete: atlante sulla TC', ok, ok ? '' : await testo(p)); esito('client senza rete: nessun invio', invii.length === 0); await ctx.close(); }
  // 6. client: CQ500 con gantry inclinato di 18° (solo locale, niente schermate)
  const cq = '/Volumes/Caloggero/_tcia_grezzi/testa/cq3/CQ500CT3 CQ500CT3/Unknown Study/CT PLAIN THIN';
  if (fs.existsSync(cq)) { const { p, ctx, invii } = await client(dcm(cq));
    await p.click('#btn-atlante'); await p.waitForSelector('#atl-avvia'); const t0 = Date.now(); await p.click('#atl-avvia');
    await p.waitForSelector('#atl-pannello .atl-qual', { timeout: 120000 });
    const info = await p.evaluate(() => { const d = window.__atl.atlanteDi(window.__dbg.P(0).sIdx); return { dim: d.geo.dim, tc: { dice: d.tc.dice.toFixed(3), ventr: (d.tc.huBianca - d.tc.huVentricoli).toFixed(1), tagliato: d.tc.tagliato }, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) + ' MB' : '' }; });
    esito('client: CQ500 gantry 18°', true, `${Date.now() - t0} ms ${JSON.stringify(info)} · ${(await testo(p)).match(/Qualità: \w+/)?.[0]}`);
    esito('client CQ500: nessun invio', invii.length === 0); await ctx.close(); }
} finally { esito('errori JS', err.length === 0, err.join(' | ')); await b.close(); sim.kill(); }
