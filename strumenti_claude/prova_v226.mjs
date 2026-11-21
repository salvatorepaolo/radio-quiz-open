// prova_v226.mjs: statistiche personali dello studente (per esame, per tipo di reperto, punti deboli) e ripasso mirato
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (19800 + Math.floor(Math.random() * 90)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
const js = async (p, url, corpo) => p.evaluate(async ([url, corpo]) => { const r = await fetch(url, corpo ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) } : {}); return { stato: r.status, j: await r.json().catch(() => null) }; }, [url, corpo]);
try {
  const a = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' })).newPage();
  await a.goto(B + '/?prova#/'); await js(a, '/api/accesso', { codice: 'admin-test-0000' });
  const acc = await js(a, '/api/account', { nome: 'Studente Statistiche', ruolo: 'studente' });
  ok('0 account di prova', acc.stato === 200 && !!acc.j?.codice, acc.stato);
  const s = await (await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'it-IT' })).newPage(); s.on('pageerror', (e) => errori.push(e.message));
  await s.goto(B + '/?prova#/'); await js(s, '/api/accesso', { codice: acc.j.codice });
  // risposte: nessuna scelta (tutti i reperti persi) su 10 casi TC a scelta multipla, e risposte esatte su 3
  const casi = (await js(s, '/api/casi')).j.filter((c) => c.visibile !== false && c.modo !== 'referto');
  const tc = casi.filter((c) => /TC/.test(c.modalita || '')).slice(0, 10);
  let fatti = 0; for (const c of tc) { const r = await js(s, `/api/casi/${c.id}/risposta`, { scelte: [], sicurezza: {}, dettagli: {} }); if (r.stato === 200) fatti++; }
  ok('1 risposte salvate', fatti >= 6, { fatti, tc: tc.length });
  await s.goto(B + '/?prova#/mie-statistiche'); await s.waitForSelector('#confronto-corpo .st-tab', { timeout: 30000 });
  const st = await s.evaluate(() => ({ sintesi: document.querySelector('.st-sintesi')?.textContent.replace(/\s+/g, ' '), esami: document.querySelectorAll('.st-tab')[0]?.querySelectorAll('tbody tr').length,
    temi: document.querySelectorAll('.st-tab')[1]?.querySelectorAll('tbody tr').length, deboli: document.querySelectorAll('.st-debole').length, esempi: document.querySelectorAll('.st-esempi li').length,
    btn: document.querySelector('[data-rip="insieme"]')?.textContent }));
  ok('2 sintesi: sensibilità bassa con tutti i reperti persi', /sensibilità/.test(st.sintesi) && /\b0%/.test(st.sintesi), st.sintesi);
  ok('3 tabelle per esame e per tipo di reperto', st.esami >= 1 && st.temi >= 2, st);
  ok('4 punti deboli con esempi delle frasi sbagliate', st.deboli >= 1 && st.esempi >= 1, st);
  await s.screenshot({ path: '/Volumes/Caloggero/strumenti_claude/_viste/statistiche_studente.png', fullPage: true });
  // ripasso mirato
  await s.click('[data-rip="insieme"]'); await s.waitForFunction(() => /#\/caso\//.test(location.hash), null, { timeout: 15000 }).catch(() => {});
  const [giro, hash] = await s.evaluate(() => { let g = null; try { g = JSON.parse(sessionStorage.getItem('quiz-giro')); } catch {} return [g, location.hash]; });
  ok('5 «Ripasso su tutti i punti deboli» avvia il giro', giro?.tipo === 'ripasso' && giro.casi?.length >= 1 && hash.includes(giro.casi[0]), { titolo: giro?.titolo, n: giro?.casi?.length });
  ok('6 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
