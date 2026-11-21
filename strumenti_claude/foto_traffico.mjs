import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), TRAFFICO_FINTO: '1', CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const post = (b) => fetch(B + '/api/visita', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const voci = [['elenco', 40], ['caso', 25], ['esame', 9], ['aiuto', 4], ['errore', 6], ['accesso', 12], ['profilo', 3], ['bogus', 5]];
for (const [p, n] of voci) for (let i = 0; i < n; i++) await post({ p, s: i % 4 === 0 ? 1 : 0, m: i % 8 === 0 ? 1 : 0, c: p === 'caso' ? `caso-tcia-00${1 + (i % 4)}` : '' });
await post({ p: 'caso', c: '../../x' });
const b = await chromium.launch(); const err = [];
for (const [tema, w] of [['chiaro', 1300], ['scuro', 1300], ['chiaro', 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 }); p.on('pageerror', (e) => err.push(e.message));
  const viste = []; p.on('request', (r) => { if (r.url().includes('/api/visita')) viste.push(r.postData()); });
  await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
  await p.goto(B + '/?prova#/'); await p.waitForSelector('[data-vai="codice"]'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
  await p.waitForSelector('#vista-elenco:not([hidden])'); await p.goto(B + '/?prova#/statistiche'); await p.waitForSelector('.tr-tiles'); await p.waitForTimeout(600);
  await p.screenshot({ path: `/Volumes/Caloggero/_viste/prova3d/traffico_${tema}_${w}.png`, fullPage: true });
  console.log(tema, w, 'largo', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'visite inviate', JSON.stringify(viste));
}
const d = await (await fetch(B + '/api/statistiche/traffico/30')).json(); console.log('senza login:', JSON.stringify(d).slice(0, 80));
console.log('errori', JSON.stringify(err)); await b.close(); sim.kill();
