// prova_barra_tutti.mjs: il pulsante ⚙ «Tutti gli strumenti / Solo gli essenziali» funziona per docente/amministratore e per lo studente
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23931, B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, m, d = '') => { c ? ok++ : ko++; console.log(`${c ? 'OK' : 'KO'}  ${m}${d !== '' ? ' → ' + d : ''}`); };
const entra = async (codice) => (await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice }) })).headers.get('set-cookie').split(';')[0];
const admin = await entra('admin-test-0000');
const nuovo = async (ruolo) => entra((await (await fetch(B + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', cookie: admin }, body: JSON.stringify({ nome: 'Prova ' + ruolo, ruolo }) })).json()).codice);
const b = await chromium.launch(), err = [];
for (const [nome, ck, attesoIniziale] of [['amministratore', admin, false], ['docente', await nuovo('docente'), false], ['specializzando', await nuovo('specializzando'), true]]) {
  const ctx = await b.newContext({ viewport: { width: 1300, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('rq-guida-vista', '1'); } catch {} });
  const [n, v] = ck.split('='); await ctx.addCookies([{ name: n, value: v, url: B }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/#/caso/caso-tcia-062'); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 }); await p.waitForTimeout(1500);
  const stato = () => p.evaluate(() => ({ ess: document.body.classList.contains('barra-essenziale'), vis: !!document.querySelector('#btn-barra-tutti')?.offsetParent, lente: !!document.querySelector('#barra-2d [data-tool="lente"]')?.offsetParent }));
  const s0 = await stato(); esito(s0.vis && s0.ess === attesoIniziale, `${nome}: all'apertura barra ${attesoIniziale ? 'essenziale' : 'completa'}`, JSON.stringify(s0));
  await p.click('#btn-barra-tutti'); await p.waitForTimeout(300); const s1 = await stato();
  esito(s1.ess !== s0.ess && s1.lente === !s1.ess, `${nome}: il clic sul ⚙ cambia la barra`, JSON.stringify(s1));
  await p.click('#btn-barra-tutti'); await p.waitForTimeout(300); const s2 = await stato();
  esito(s2.ess === s0.ess, `${nome}: secondo clic, torna com'era`, JSON.stringify(s2));
  await p.click('#btn-barra-tutti'); await p.reload(); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 }); await p.waitForTimeout(1200);
  const s3 = await stato(); esito(s3.ess !== s0.ess, `${nome}: la scelta resta dopo aver ricaricato`, JSON.stringify(s3));
  await ctx.close();
}
esito(!err.length, 'nessun errore JavaScript', err.join(' | '));
console.log(`\n${ok} OK, ${ko} KO`); await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
