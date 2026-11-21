// prova_3d.mjs: apre un caso TC in MPR+3D e prova «senza lettino / senza osso / gabbia»; screenshot del riquadro 3D
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const N = process.argv[2] || '048';
const PORTA = 18500 + Math.floor(Math.random() * 400), R = (n) => `http://localhost:${PORTA}/?prova&r=${n}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const p = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  p.on('pageerror', (e) => log('PAGEERROR', e.message)); p.on('console', (m) => { if (['error', 'warning'].includes(m.type()) || /MPR|3D/.test(m.text())) log('console', m.type(), m.text().slice(0, 300)); });
  await p.goto(R(N) + '#/'); await p.waitForSelector('[data-vai="codice"]', { timeout: 15000 });
  await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])', { timeout: 15000 });
  await p.goto(R(N) + `#/caso/caso-tcia-${N}`); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 15000 });
  await p.waitForFunction(() => window.__dbg?.V?.img, null, { timeout: 40000 });
  await p.click('#modo-mpr');
  await p.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  const foto = async (nome) => { await p.locator('#vp-3d').screenshot({ path: OUT + N + '_' + nome + '.png' }); log('foto', nome, await p.locator('#mpr-info').innerText().catch(() => '')); };
  await foto('0base');
  for (const [id, nome] of [['#vr-lettino', '1lettino'], ['#vr-osso', '2lettino_osso'], ['#vr-lettino', '3solo_osso'], ['#vr-osso', '4niente']]) {
    const t0 = Date.now(); await p.click(id); await p.waitForTimeout(500);
    await p.waitForFunction(() => document.querySelector('#mpr-stato')?.hidden, null, { timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(4000); log(nome, 'ms', Date.now() - t0); await foto(nome);
  }
} catch (e) { log('ERRORE', e.message); } finally { await browser.close(); sim.kill(); log('FINE'); }
