// foto_persone.mjs: pagina «Iscritti e docenti» con persone di prova (simulatore)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module'; import fs from 'node:fs';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = 19300 + Math.floor(Math.random() * 90), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const OUT = process.env.OUT || "/Volumes/Caloggero/_viste/menu"; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const errori = [];
try {
  const W = +(process.env.LARG || 1400);
  const a = await (await b.newContext({ viewport: { width: W, height: 900 }, locale: process.env.LINGUA || 'it-IT' })).newPage(); a.on('pageerror', (e) => errori.push(e.message));
  if (process.env.TEMA) await a.addInitScript((t) => { try { localStorage.setItem('quiz-tema', t); } catch {} }, process.env.TEMA);
  await a.goto(B + '/?prova#/'); await a.click('[data-vai="codice"]'); await a.fill('#codice', 'admin-test-0000'); await a.press('#codice', 'Enter'); await a.waitForSelector('#vista-elenco:not([hidden])');
  await a.goto(B + '/?prova#/account'); await a.waitForTimeout(1500);
  await a.screenshot({ path: `${OUT}/p0_vuota.png` });
  await a.evaluate(async () => {
    const post = (u, d) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) }).then((r) => r.json());
    const p = [['Maria Rossi', 'specializzando', 'maria.rossi@example.org'], ['Luca Bianchi', 'specializzando', 'luca.bianchi@example.org'], ['Giulia Verdi', 'docente', 'giulia.verdi@example.org'],
      ['Paolo Neri', 'specializzando', 'paolo.neri@example.org'], ['Anna Gallo', 'docente', 'anna.gallo@example.org'], ['Marco Fontana', 'specializzando', ''], ['Sara Conti', 'admin', 'sara.conti@example.org']];
    const ids = {};
    for (const [nome, ruolo, email] of p) { const r = await post('/api/account', { nome, ruolo, email }); ids[nome] = r.account?.id; }
    await post(`/api/account/${ids['Maria Rossi']}`, { docenti: [ids['Giulia Verdi']] });
    await post(`/api/account/${ids['Luca Bianchi']}`, { docenti: [ids['Giulia Verdi'], ids['Anna Gallo']] });
    await post(`/api/account/${ids['Giulia Verdi']}`, { autore: true });
    await post(`/api/account/${ids['Paolo Neri']}`, { attivo: false });
  });
  await a.goto(B + '/?prova#/'); await a.goto(B + '/?prova#/account'); await a.waitForTimeout(1500);
  await a.screenshot({ path: `${OUT}/p1_elenco.png` });
  // menù azioni della seconda riga
  await a.click('#acc-lista tr:nth-child(2) details.acc-menu summary'); await a.waitForTimeout(300);
  await a.screenshot({ path: `${OUT}/p2_azioni.png` });
  await a.keyboard.press('Escape');
  await a.click('#acc-invita-apri'); await a.waitForTimeout(300);
  await a.screenshot({ path: `${OUT}/p3_invito.png` });
  await a.click('#acc-invita-apri');
  await a.click('.acc-pill[data-f="docenti"]'); await a.waitForTimeout(300);
  await a.screenshot({ path: `${OUT}/p4_docenti.png` });
  await a.fill('#acc-filtro', 'zzz'); await a.waitForTimeout(300);
  await a.screenshot({ path: `${OUT}/p5_vuoto.png` });
  console.log('ERRORI', JSON.stringify(errori));
} catch (e) { console.log('ERRORE', e); } finally { await b.close(); sim.kill(); console.log('FINE'); process.exit(0); }
