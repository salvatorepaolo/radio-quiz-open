// 28/11: fotografie del cruscotto dei revisori (simulatore, casi di casi-free, account inventato)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 18500 + Math.floor(Math.random() * 400), BASE = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) ok(); }));
const entra = async (corpo) => (await fetch(BASE + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })).headers.get('set-cookie').split(';')[0];
const adm = await entra({ codice: 'admin-test-0000' });
const api = async (ck, url, corpo) => (await fetch(BASE + url, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie: ck }, body: corpo ? JSON.stringify(corpo) : undefined })).json();
const doc = await api(adm, '/api/account', { nome: 'Dora Revisora', ruolo: 'docente', autore: true });
const id = (await api(adm, '/api/account')).find((a) => a.nome === 'Dora Revisora').id;
await api(adm, `/api/account/${id}`, { revisore: true });
const ck = await entra({ codice: doc.codice });
await api(ck, '/api/casi/caso-tcia-166/revisione', { esito: 'confermato' });
await api(ck, '/api/casi/caso-tcia-031/revisione', { esito: 'da-correggere', nota: 'Bosniak: rivedere il valore di 21-30 HU' });
const [n, v] = ck.split('=');
const b = await chromium.launch(); const err = [];
for (const [nome, w, h, tema] of [['desk', 1440, 900, 'chiaro'], ['scuro', 1440, 900, 'scuro'], ['tel', 390, 844, 'chiaro']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: n, value: v, url: BASE }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
  await p.goto(BASE + '/#/revisione'); await p.waitForSelector('#rv-casi h2', { timeout: 30000 }); await p.waitForTimeout(800);
  await p.screenshot({ path: `/Volumes/Caloggero/_viste/revisione/cruscotto_${nome}.png`, fullPage: false });
  console.log(nome, await p.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.querySelectorAll('.rvd-tab tbody tr').length, document.querySelector('#rv-casi .cmr-kpis')?.innerText.replace(/\n/g, ' ')]));
  if (nome === 'desk') {
    await p.selectOption('#rvd-mod', 'RX'); await p.waitForTimeout(200);
    console.log('filtro RX', await p.evaluate(() => document.querySelectorAll('.rvd-tab tbody tr').length));
    await p.fill('#rvd-cerca', 'n. 031'); await p.selectOption('#rvd-mod', ''); await p.waitForTimeout(200);
    console.log('cerca 031', await p.evaluate(() => [...document.querySelectorAll('.rvd-tab tbody tr')].map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 160))));
  }
  await ctx.close();
}
console.log('errori', JSON.stringify(err)); await b.close(); sim.kill();
