// prova_v192.mjs: fusione PET/TC (2D e MPR) con soglia, pagina iscritti, email ai nuovi docenti/autori
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const ok = (c, m) => console.log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] }); const err = [];
try {
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } }); p.on('pageerror', (e) => err.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('quiz-tema', 'chiaro'); } catch {} });
  await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])'); await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + 'v192_hero.png', clip: { x: 0, y: 0, width: 1500, height: 420 } });
  // account: un iscritto diventa docente e autore → due email
  const pers = await p.evaluate(async () => { const r = await fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Maria Rossi', ruolo: 'specializzando', email: 'maria@example.org' }) }); return r.json(); });
  await p.goto(B + '/?prova#/account'); await p.waitForSelector('#acc-lista tr'); await p.waitForTimeout(400);
  const riga = p.locator('#acc-lista tr', { hasText: 'Maria Rossi' });
  await riga.locator('button[data-az="docente"]').click(); await p.waitForTimeout(600); console.log('msg:', await p.locator('#acc-msg').innerText());
  await p.locator('#acc-lista tr', { hasText: 'Maria Rossi' }).locator('button[data-az="autore"]').click(); await p.waitForTimeout(600); console.log('msg:', await p.locator('#acc-msg').innerText());
  const posta = await (await fetch(B + '/__posta')).json(); console.log(JSON.stringify(posta.map((x) => [x.a, x.o])));
  ok(posta.some((x) => /docente/i.test(x.o)) && posta.some((x) => /autore/i.test(x.o)), 'email per docente e per autore');
  await p.screenshot({ path: OUT + 'v192_account.png', fullPage: true });
  // fusione
  await p.goto(B + '/?prova#/caso/caso-tcia-012'); await p.waitForFunction(() => window.V?.img, null, { timeout: 60000 }); await p.waitForTimeout(1500);
  await p.click('#btn-fusione'); await p.waitForTimeout(3000);
  await p.screenshot({ path: OUT + 'v192_fus2d.png' });
  await p.click('#modo-mpr'); await p.waitForTimeout(15000);
  await p.screenshot({ path: OUT + 'v192_fusmpr.png' });
  await p.fill('#fusione-soglia', '30'); await p.dispatchEvent('#fusione-soglia', 'input'); await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + 'v192_fusmpr30.png' }); console.log('scala:', await p.locator('#fusione-scala').innerText());
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
