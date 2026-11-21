// prova_v189.mjs: home rinnovata, sponsor (gestione e riquadri), esportazione JPEG nel client
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const ok = (c, m) => console.log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), TRAFFICO_FINTO: '1', CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
const LOGO = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" rx="8" fill="#0b5"/><text x="80" y="27" font-size="18" text-anchor="middle" fill="#fff" font-family="Arial">MedImaging</text></svg>').toString('base64');
try {
  // 1. amministratore: crea uno sponsor dalla pagina
  const p = await b.newPage({ viewport: { width: 1300, height: 900 } }); p.on('pageerror', (e) => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('quiz-tema', 'chiaro'); } catch {} });
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])'); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'home_admin_chiaro.png' });
  await p.goto(B + '/?prova#/sponsor'); await p.waitForSelector('#sp-gest:not([hidden])');
  ok(await p.locator('#mg-sponsor').count() === 1, 'voce di menu Sponsor');
  await p.click('#sp-nuovo'); await p.fill('#sp-form [name=nome]', 'MedImaging Srl'); await p.fill('#sp-form [name=link]', 'https://example.org');
  await p.fill('#sp-form [name=testo]', 'Workstation e software per l\'imaging');
  await p.evaluate((l) => { document.querySelector('#sp-form').dataset.logo = l; }, LOGO);
  await p.check('#sp-form [name=pos][value=caso]');
  await p.click('#sp-form button[type=submit]'); await p.waitForSelector('.sp-scheda'); await p.waitForTimeout(400);
  await p.locator('#sp-gest').screenshot({ path: OUT + 'sponsor_gestione.png' });
  const pub = await p.evaluate(() => fetch('/api/sponsor').then((r) => r.json()));
  ok(pub.length === 1 && pub[0].posizioni.length === 3, 'sponsor pubblico con 3 posizioni');
  // 2. pagina di accesso e home di un utente anonimo/iscritto
  const q = await b.newPage({ viewport: { width: 1300, height: 900 } }); q.on('pageerror', (e) => err.push(e.message));
  await q.goto(B + '/#/'); await q.waitForSelector('#sponsor-accesso:not([hidden]) .sp-logo', { timeout: 10000 });
  ok(true, 'sponsor sulla pagina di accesso'); await q.locator('#vista-accesso').screenshot({ path: OUT + 'sponsor_accesso.png' });
  const [vai] = await Promise.all([q.waitForEvent('popup'), q.click('#sponsor-accesso .sp-logo')]); await vai.waitForLoadState().catch(() => {});
  ok(/example\.org/.test(vai.url()), 'clic porta al sito dello sponsor: ' + vai.url()); await vai.close();
  const g = await p.evaluate(() => fetch('/api/sponsor/gestione').then((r) => r.json()));
  ok(g[0].stat.viste30 >= 1 && g[0].stat.clic30 === 1, `conteggi viste ${g[0].stat.viste30} clic ${g[0].stat.clic30}`);
  // 3. home in tre aspetti
  for (const [tema, w] of [['chiaro', 1300], ['scuro', 1300], ['chiaro', 390]]) {
    const h = await b.newPage({ viewport: { width: w, height: 900 } }); h.on('pageerror', (e) => err.push(e.message));
    await h.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
    await h.goto(B + '/?prova#/'); await h.click('[data-vai="codice"]'); await h.fill('#codice', 'admin-test-0000'); await h.press('#codice', 'Enter');
    await h.waitForSelector('#vista-elenco:not([hidden]) .home-hero'); await h.waitForTimeout(1200);
    await h.screenshot({ path: OUT + `home_${tema}_${w}.png`, fullPage: true });
    console.log(tema, w, 'largo', await h.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'sponsor home', await h.locator('#sponsor-home:not([hidden])').count());
    await h.close();
  }
  // 4. client: esportazione JPEG
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true }); const c = await ctx.newPage(); c.on('pageerror', (e) => err.push('client: ' + e.message));
  await c.goto(B + '/client/index.html'); await c.waitForSelector('#vista-client:not([hidden])', { timeout: 30000 });
  const dir = '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-018/serie';
  const tutti = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? tutti(path.join(d, e.name)) : /\.dcm$/i.test(e.name) ? [path.join(d, e.name)] : []);
  await c.setInputFiles('#cl-file', tutti(dir).slice(0, 60));
  await c.waitForFunction(() => window.__dbg?.V?.img && location.hash === '#/caso/locale', null, { timeout: 60000 }); await c.waitForTimeout(1200);
  ok(await c.locator('#sponsor-home').count() === 0 || !(await c.locator('#sponsor-home:not([hidden])').count()), 'nessuno sponsor nel client');
  const esporta = async (cosa) => {
    await c.click('#cl-esporta'); await c.check(`input[name="ex-cosa"][value="${cosa}"]`); await c.selectOption('#ex-formato', 'jpeg');
    if (cosa === 'zip') { await c.fill('#ex-da', '1'); await c.fill('#ex-a', '5'); }
    const [dl] = await Promise.all([c.waitForEvent('download', { timeout: 120000 }), c.click('#ex-vai')]);
    const f = OUT + 'client_' + dl.suggestedFilename(); await dl.saveAs(f); const buf = fs.readFileSync(f);
    console.log(cosa, dl.suggestedFilename(), buf.length, await c.locator('#ex-stato').innerText()); await c.click('#ex-chiudi'); return buf;
  };
  const j = await esporta('png'); ok(j[0] === 0xff && j[1] === 0xd8, 'immagine JPEG valida');
  const z = await esporta('zip'); ok(z.includes(Buffer.from('.jpg')), 'zip con file .jpg');
  await c.click('#cl-esporta'); await c.check('input[name="ex-cosa"][value="mp4"]');
  ok(await c.locator('#ex-formato-riga').isHidden(), 'formato nascosto per il video'); await c.check('input[name="ex-cosa"][value="png"]');
  ok(await c.locator('#ex-qualita-riga').isVisible(), 'qualità JPEG ricordata e visibile');
  await c.locator('#dlg-esporta').screenshot({ path: OUT + 'client_dlg_jpeg.png' });
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
