// prova_manichino.mjs: filtro per parte del corpo con il manichino nell'elenco dei casi (1.319)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/', { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || 23947, B = `http://localhost:${PORTA}`, OUT = '/Volumes/Caloggero/strumenti_claude/schermate_manichino/';
(await import('node:fs')).mkdirSync(OUT, { recursive: true });
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
let ok = 0, ko = 0; const esito = (c, m, d = '') => { c ? ok++ : ko++; console.log(`${c ? 'OK' : 'KO'}  ${m}${d !== '' ? ' → ' + d : ''}`); };
const entra = async (codice) => (await fetch(B + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codice }) })).headers.get('set-cookie').split(';')[0];
const admin = await entra('admin-test-0000');
const stud = await entra((await (await fetch(B + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', cookie: admin }, body: JSON.stringify({ nome: 'Prova manichino', ruolo: 'specializzando' }) })).json()).codice);
const b = await chromium.launch(), err = [];
const pagina = async (vp, lingua) => {
  const ctx = await b.newContext({ viewport: vp, locale: lingua === 'en' ? 'en-GB' : 'it-IT' });
  await ctx.addInitScript((l) => { try { localStorage.setItem('rq-guida-vista', '1'); if (l) localStorage.setItem('rq-lingua', l); } catch {} }, lingua);
  const [n, v] = stud.split('='); await ctx.addCookies([{ name: n, value: v, url: B }]);
  const p = await ctx.newPage(); p.on('pageerror', (e) => err.push(e.message));
  await p.goto(B + '/#/'); await p.waitForSelector('#manichino', { timeout: 30000 }); await p.waitForTimeout(1500);
  return [ctx, p];
};
const stato = (p) => p.evaluate(() => ({
  tot: +(document.querySelector('#filtro-metodica button[data-m="Tutte"] small')?.textContent || 0),
  met: [...document.querySelectorAll('#filtro-metodica button[data-m]')].map((b) => b.dataset.m).filter((m) => m !== 'Tutte'),
  dis: [...document.querySelectorAll('#corpo-distretti button[data-d]')].map((b) => b.dataset.d),
  on: document.querySelector('#manichino .on')?.dataset.p || '', scelta: document.querySelector('#corpo-scelta')?.textContent || '',
  cas: document.querySelector('#btn-casuale')?.textContent || '' }));
const casiApi = await (await fetch(B + '/api/casi', { headers: { cookie: stud } })).json();
let [ctx, p] = await pagina({ width: 1300, height: 950 });
const s0 = await stato(p); esito(s0.tot > 0 && !s0.on, 'all\'inizio nessuna parte scelta', JSON.stringify(s0));
await p.screenshot({ path: OUT + '1-iniziale.png', fullPage: false });
await p.click('#manichino [data-p="torace"]'); await p.waitForTimeout(400);
const s1 = await stato(p);
esito(s1.on === 'torace' && s1.tot < s0.tot && s1.tot > 0, 'clic sul torace: meno casi, parte evidenziata', JSON.stringify(s1));
esito(['Mammella', 'Cuore'].every((d) => s1.dis.includes(d)), 'distretti del torace proposti (Mammella, Cuore…)', s1.dis.join(', '));
esito(s1.met.length >= 3, 'il torace si vede in più metodiche', s1.met.join(', '));
esito(/Torace/.test(s1.cas), 'l\'allenamento casuale dice la parte', s1.cas);
await p.screenshot({ path: OUT + '2-torace.png' });
await p.click('#corpo-distretti button[data-d="Mammella"]'); await p.waitForTimeout(400);
const s2 = await stato(p); const nMam = casiApi.filter((c) => c.distretto === 'Mammella' && c.visibile !== false && c.origine).length;
esito(s2.tot === nMam && s2.met.includes('Ecografia') && s2.met.includes('Mammografia'), 'Mammella: tutti i casi di mammella, in mammografia, RM ed ecografia', `${s2.tot}/${nMam} ${s2.met.join(', ')}`);
await p.screenshot({ path: OUT + '3-mammella.png' });
// l'allenamento casuale resta nella scelta
await p.click('#btn-casuale'); await p.waitForSelector('#vista-caso:not([hidden])', { timeout: 30000 });
const id = p.url().split('/').pop(); esito(casiApi.find((c) => c.id === id)?.distretto === 'Mammella', 'l\'allenamento casuale apre un caso di mammella', id);
await p.goto(B + '/#/'); await p.waitForSelector('#manichino'); await p.waitForTimeout(800);
const s3 = await stato(p); esito(s3.on === 'torace' && s3.scelta === 'Mammella', 'tornando all\'elenco la scelta resta', JSON.stringify(s3));
await p.click('#manichino [data-p="torace"]'); await p.waitForTimeout(400);
const s4 = await stato(p); esito(!s4.on && s4.tot === s0.tot, 'secondo clic sulla stessa parte: tutto il corpo', JSON.stringify(s4));
await p.click('#manichino [data-p="rachide"]'); await p.waitForTimeout(400);
const s5 = await stato(p); esito(s5.on === 'rachide' && s5.met.includes('TC') && s5.met.includes('RM'), 'colonna: TC e RM', JSON.stringify(s5));
await p.click('#corpo-parti button[data-p=""]'); await p.waitForTimeout(300);
await p.keyboard.press('Tab'); await p.focus('#manichino [data-p="testa"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
esito((await stato(p)).on === 'testa', 'tastiera: Invio sulla testa');
await p.click('#manichino [data-p="pelvi"]'); await p.waitForTimeout(300);
const s6 = await stato(p); esito(s6.dis.includes('Ostetricia') && s6.met.includes('Ecografia'), 'pelvi: anche le ecografie ostetriche', JSON.stringify(s6));
await p.screenshot({ path: OUT + '4-pelvi.png' });
// tema chiaro, telefono, inglese
await p.evaluate(() => document.querySelector('#btn-tema, [data-tema], .tema')?.click()); await p.waitForTimeout(300); await p.screenshot({ path: OUT + '5-pelvi-tema.png' });
await ctx.close();
[ctx, p] = await pagina({ width: 390, height: 844 }); await p.click('#manichino [data-p="addome"]'); await p.waitForTimeout(400);
await p.evaluate(() => document.querySelector('#corpo-box').scrollIntoView()); await p.screenshot({ path: OUT + '6-telefono.png' });
esito((await stato(p)).on === 'addome', 'telefono: il manichino funziona'); await ctx.close();
[ctx, p] = await pagina({ width: 1300, height: 950 }, 'en'); await p.waitForTimeout(800);
const txt = await p.evaluate(() => document.querySelector('#corpo-box').innerText);
esito(/Body part/.test(txt) && /Whole body/.test(txt), 'in inglese', txt.slice(0, 120).replace(/\n/g, ' | '));
await p.evaluate(() => document.querySelector('#corpo-box').scrollIntoView()); await p.screenshot({ path: OUT + '7-inglese.png' }); await ctx.close();
esito(!err.length, 'nessun errore JavaScript', err.join(' | '));
console.log(`\n${ok} OK, ${ko} KO`); await b.close(); sim.kill(); process.exit(ko ? 1 : 0);
