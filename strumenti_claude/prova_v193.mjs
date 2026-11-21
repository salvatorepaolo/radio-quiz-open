// prova_v193.mjs: clienti e piattaforme (tenant), barra in alto
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const OUT = '/Volumes/Caloggero/_viste/prova3d/';
const PORTA = 18500 + Math.floor(Math.random() * 400), B = `http://localhost:${PORTA}`;
const ok = (c, m) => console.log(c ? 'OK  ' : 'FAIL', m);
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const err = [];
try {
  for (const [tema, w] of [['chiaro', 1300], ['scuro', 1300], ['chiaro', 390]]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } }); p.on('pageerror', (e) => err.push(e.message));
    await p.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, tema);
    await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', 'admin-test-0000'); await p.press('#codice', 'Enter');
    await p.waitForSelector('#vista-elenco:not([hidden])');
    await p.goto(B + '/?prova#/tenant'); await p.waitForSelector('#vista-tenant:not([hidden])'); await p.waitForTimeout(300);
    if (tema === 'chiaro' && w === 1300) {
      ok(await p.locator('.tn-vuoto').count() === 1, 'elenco vuoto');
      await p.click('#tn-nuovo'); await p.fill('#tn-form [name=cliente]', 'AOU Policlinico G. Martino'); await p.fill('#tn-form [name=referenteNome]', 'Mario Bianchi');
      await p.fill('#tn-form [name=referenteEmail]', 'formazione@polime.example'); await p.fill('#tn-form [name=utentiMax]', '80'); await p.fill('#tn-form [name=scadenza]', '2027-06-30');
      console.log('id proposto:', await p.inputValue('#tn-form [name=id]'), await p.locator('#tn-anteprima').innerText());
      await p.locator('#tn-form').screenshot({ path: OUT + 'v193_form.png' });
      await p.click('#tn-form button[type=submit]'); await p.waitForSelector('.tn-scheda');
      const r = await p.evaluate(() => fetch('/api/tenant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'unime-scuola', cliente: 'Scuola di specializzazione UniMe', referenteEmail: 'x@unime.example', piano: 'base' }) }).then((x) => x.json()));
      ok(r.stato === 'da_creare' && r.dominio === 'unime-scuola.localhost', 'secondo cliente: ' + r.dominio);
      const s = await p.evaluate(() => fetch('/api/tenant/unime-scuola/stato', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stato: 'attiva', versione: '1.193', invitato: true }) }).then((x) => x.json()));
      ok(s.stato === 'attiva', 'stato segnato dallo script');
      const d = await p.evaluate(() => fetch('/api/tenant/unime-scuola/elimina', { method: 'POST' }).then((x) => x.status)); ok(d === 400, 'non si toglie una piattaforma già creata');
      const bad = await p.evaluate(() => fetch('/api/tenant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'www', cliente: 'X', referenteEmail: 'a@b.it' }) }).then((x) => x.status)); ok(bad === 400, 'identificativo riservato rifiutato');
      await p.goto(B + '/?prova#/'); await p.goto(B + '/?prova#/tenant'); await p.waitForSelector('.tn-scheda'); await p.waitForTimeout(3500);
    }
    await p.screenshot({ path: OUT + `v193_tenant_${tema}_${w}.png`, fullPage: true });
    console.log(tema, w, 'largo', await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)); await p.close();
  }
} finally { console.log('errori', JSON.stringify(err)); await b.close(); sim.kill(); }
