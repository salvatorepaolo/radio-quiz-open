// prova_v215.mjs: checklist di lettura (facoltativa e obbligatoria), confronto della misura con il docente,
// modalità esame senza aiuti, RM mammella ruotata di 180°, scheda RM cardiaca (risultati, limiti, referto, finestra)
import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
const T = '/Volumes/Caloggero/piattaforma-quiz/cloud/test/';
const { chromium } = createRequire(T + 'package.json')('playwright');
const PORTA = +process.env.PORTA_PROVA || (18700 + Math.floor(Math.random() * 300)), B = `http://localhost:${PORTA}`;
const sim = spawn(process.execPath, [T + 'simulatore.mjs'], { env: { ...process.env, PORTA: String(PORTA), CASI: '/Volumes/Caloggero/piattaforma-quiz/casi-free' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => sim.stdout.on('data', (d) => { if (/pronto/.test(d)) r(); }));
const b = await chromium.launch(); const errori = []; let ko = 0;
const ok = (n, cond, x = '') => { console.log(`${cond ? 'OK ' : 'KO '} ${n}${x !== '' ? ' → ' + JSON.stringify(x) : ''}`); if (!cond) ko++; };
const entra = async (p, cod) => { await p.goto(B + '/?prova#/'); await p.click('[data-vai="codice"]'); await p.fill('#codice', cod); await p.press('#codice', 'Enter'); await p.waitForSelector('#vista-elenco:not([hidden])'); };
const apri = async (p, id) => { await p.goto(B + '/?prova#/'); await p.waitForTimeout(1500); await p.goto(B + `/?prova#/caso/${id}`); await p.waitForFunction((id) => window.__dbg?.V?.img && window.__dbg.V.caso?.id === id, id, { timeout: 60000 }); await p.waitForTimeout(1200); };
try {
  const ca = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); const a = await ca.newPage(); a.on('pageerror', (e) => errori.push('admin: ' + e.message));
  await entra(a, 'admin-test-0000');
  const cod = await a.evaluate(() => fetch('/api/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'Studente Checklist', ruolo: 'specializzando' }) }).then((r) => r.json()).then((j) => j.codice));
  const cs = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'it-IT' }); await cs.addInitScript(() => setInterval(() => { const d = document.querySelector('#dlg-ann'); if (d?.open) d.close('no'); }, 50));
  const s = await cs.newPage(); s.on('pageerror', (e) => errori.push('studente: ' + e.message));
  await entra(s, cod);
  // 1. checklist facoltativa su una TC del torace
  await apri(s, 'caso-tcia-001');
  const c1 = await s.evaluate(() => ({ vis: !document.querySelector('#q-check').hidden, tit: document.querySelector('#q-check .qc-tit').textContent, conto: document.querySelector('#q-check .qc-conto').textContent, obbl: !document.querySelector('#q-check .qc-obbl').hidden }));
  ok('1 checklist visibile, facoltativa, lista adatta al caso', c1.vis && /Checklist di lettura · (Torace|Esame)/.test(c1.tit) && /^0\/\d+$/.test(c1.conto) && !c1.obbl, c1);
  // 2. il docente rende obbligatoria la checklist e salva la vista con la misura di riferimento
  await apri(a, 'caso-tcia-001');
  const rif = await a.evaluate(async () => {
    const d = window.__dbg, p = d.P(), s = d.V.serie[p.sIdx];
    const sp = [p.img.spCol, p.img.spRow], cx = p.img.cols / 2, cy = p.img.rows / 2;
    const completo = await fetch(`/api/casi/caso-tcia-001/completo`).then((r) => r.json());
    const vista = { serie: s._i, idx: p.idx, wc: -600, ww: 1500, zoom: 1, panX: 0, panY: 0, segno: { a: { x: cx - 15, y: cy - 10 }, b: { x: cx + 15, y: cy + 10 } },
      misura: { tipo: 'linea', a: { x: cx - 15, y: cy }, b: { x: cx + 15, y: cy }, sp }, nota: 'prova' };
    const r = await fetch(`/api/casi/caso-tcia-001`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...completo, vista, checklist: 'obbligatoria' }) });
    const dopo = await fetch(`/api/casi/caso-tcia-001/completo`).then((x) => x.json());
    return { stato: r.status, check: dopo.checklist, misura: dopo.vista?.misura, sIdx: p.sIdx, idx: p.idx, cx, cy, mm: 30 * sp[0] };
  });
  ok('2 il caso salva «checklist» e la misura di riferimento nella vista', rif.stato === 200 && rif.check === 'obbligatoria' && rif.misura?.sp?.length === 2, { stato: rif.stato, check: rif.check, misura: rif.misura });
  // 3. studente: checklist obbligatoria blocca la conferma finché non è completa
  await apri(s, 'caso-tcia-001');
  ok('3a checklist obbligatoria: aperta e segnata', await s.evaluate(() => document.querySelector('#q-check').open && !document.querySelector('#q-check .qc-obbl').hidden));
  await s.click('#q-modo-referto'); await s.waitForTimeout(300); await s.evaluate(() => { document.querySelector('#q-referto-box').open = true; });
  await s.fill('#q-referto', 'TC del torace. Nodulo polmonare solido nel lobo superiore destro a margini irregolari. Conclusione: nodulo sospetto da caratterizzare.');
  await s.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); await s.click('#btn-conferma'); await s.waitForTimeout(600);
  ok('3b conferma bloccata con la checklist incompleta', /Checklist obbligatoria/.test(await s.textContent('#q-esito')), (await s.textContent('#q-esito')).slice(0, 120));
  await s.evaluate(() => document.querySelectorAll('#q-check .qc-voci input').forEach((x) => { x.checked = true; x.dispatchEvent(new Event('change')); }));
  ok('3c conto aggiornato e checklist completa', await s.evaluate(() => document.querySelector('#q-check').classList.contains('completa')));
  // misura dello studente sulla stessa immagine: 28 px invece di 30 (≈ −7%)
  await s.evaluate((r) => { const d = window.__dbg; const k = `${r.sIdx}:${r.idx}`; (d.V.misure[k] = d.V.misure[k] || []).push({ tipo: 'linea', a: { x: r.cx - 14, y: r.cy + 1 }, b: { x: r.cx + 14, y: r.cy + 1 } }); }, rif);
  await s.evaluate(() => { const r = document.querySelector('#q-com-blocco:not([hidden]) input[name="com-liv"]'); if (r && !document.querySelector('input[name="com-liv"]:checked')) r.click(); }).catch(() => {}); await s.click('#btn-conferma'); await s.waitForSelector('#q-esito .punteggio', { timeout: 20000 }); await s.waitForTimeout(800);
  const es = await s.evaluate(() => ({ t: document.querySelector('#q-esito').textContent, cl: [...document.querySelectorAll('.cfr-misura li')].map((li) => li.className + ': ' + li.textContent) }));
  ok('4a esito: confronto della misura con il docente', /La tua misura e quella del docente/.test(es.t) && es.cl.some((x) => /Asse lungo: tu .* docente .* differenza −/.test(x)) && es.cl.some((x) => /^ok/.test(x)), es.cl);
  ok('4b esito: checklist completa', /Checklist completa/.test(es.t));
  ok('4c checklist bloccata dopo la risposta', await s.evaluate(() => [...document.querySelectorAll('#q-check input')].every((x) => x.disabled)));
  // 5. il docente vede la checklist nel referto dello studente
  await a.goto(B + '/?prova#/analisi'); await a.waitForSelector('#vista-analisi:not([hidden])'); await a.click('[data-scheda="referti"]'); await a.waitForSelector('.ref-card', { timeout: 15000 });
  const card = await a.evaluate(() => [...document.querySelectorAll('.ref-card')].find((x) => x.textContent.includes('Studente Checklist'))?.querySelector('.ref-check')?.textContent || '');
  ok('5 Analisi → Referti: checklist dello studente', /Checklist\s*\d+\/\d+/.test(card), card);
  // 6. modalità esame: niente aiuti (scheda nuova: sessionStorage pulito)
  const s2 = await cs.newPage(); s2.on('pageerror', (e) => errori.push('studente2: ' + e.message));
  await s2.goto(B + '/?prova#/'); await s2.waitForSelector('#vista-elenco:not([hidden])');
  await s2.evaluate(() => { const ora = Date.now(); sessionStorage.setItem('quiz-giro', JSON.stringify({ tipo: 'esame', id: 'esame-' + ora, titolo: 'Esame simulato', casi: ['caso-tcia-071', 'caso-tcia-056'], visti: [], inizio: ora, scadenza: ora + 20 * 60e3, minuti: 10, ambito: 'prova', risultati: {}, livello: 'libero' })); });
  await s2.goto(B + '/?prova#/caso/caso-tcia-071'); await s2.waitForFunction(() => window.__dbg?.V?.img && window.__dbg.V.caso?.id === 'caso-tcia-071', null, { timeout: 60000 }); await s2.waitForTimeout(1500);
  const ex = await s2.evaluate(() => ({ scale: document.querySelector('#btn-scale').hidden, radiomica: document.querySelector('#btn-radiomica')?.hidden, barra: document.querySelector('#q-casuale').textContent }));
  ok('6 esame: scale e radiomica spente, «senza aiuti» nella barra', ex.scale && ex.radiomica && /senza aiuti/.test(ex.barra), ex);
  await s2.close();
  await apri(s, 'caso-tcia-071');
  ok('6b fuori dall\'esame la radiomica torna', await s.evaluate(() => !document.querySelector('#btn-radiomica').hidden));
  // 7. RM mammella prona: assiali ruotate di 180°
  await apri(s, 'caso-tcia-056');
  const mg = await s.evaluate(() => { const d = window.__dbg; return d.V.pannelli.slice(0, d.V.n || 1).map((p) => ({ rot: p.rot, iop: p.img?.iop?.slice(3, 6).map((x) => Math.round(x)) })); });
  ok('7 RM mammella: assiali ruotate di 180°', mg.length && mg.filter((x) => x.iop).every((x) => x.rot === 2), mg);
  ok('7b testo del caso aggiornato', /ruotate di 180°/.test(await s.textContent('#q-anamnesi')));
  // 8. scheda RM cardiaca
  await apri(a, 'caso-tcia-071');
  await a.click('[data-tool="cmr"]'); await a.waitForSelector('#cmr-pannello:not([hidden]) .cmr-sez', { timeout: 15000 });
  ok('8a scheda ordinata: passi numerati e pulsanti in fondo', await a.evaluate(() => document.querySelectorAll('#cmr-pannello .cmr-sez').length >= 2 && !!document.querySelector('#cmr-pannello .cmr-azioni #cmr-copia')));
  await a.click('#cmr-auto');
  await a.waitForFunction(() => document.querySelector('#cmr-pannello .cmr-kpis'), null, { timeout: 120000 }).catch(() => {});
  await a.selectOption('#cmr-sesso', 'M'); await a.waitForTimeout(500);
  const k = await a.evaluate(() => ({ kpi: [...document.querySelectorAll('#cmr-pannello .cmr-kpi')].map((x) => x.className + ' ' + x.textContent.replace(/\s+/g, ' ')), righe: document.querySelectorAll('#cmr-pannello .cmr-ris-tab tbody tr').length, rif: document.querySelector('#cmr-pannello .cmr-risultati')?.textContent || '' }));
  ok('8b risultati: riquadri FE e volumi, tabella con i riferimenti per sesso', k.kpi.length >= 3 && k.righe >= 6 && /uomini/.test(k.rif) && k.kpi.every((x) => /cmr-kpi (ok|ko|dubbio)/.test(x)), k);
  await a.click('#cmr-copia'); await a.waitForTimeout(500);
  const ref = await a.inputValue('#q-referto');
  ok('8c «Misure nel referto»: elenco con riferimenti', /MISURE DI RM CARDIACA/.test(ref) && /riferimento \d+–\d+/.test(ref) && /Kawel-Boehm/.test(ref), ref.slice(0, 200));
  // finestra separata
  const [pop] = await Promise.all([a.waitForEvent('popup'), a.click('#cmr-finestra')]);
  await pop.waitForSelector('#cmr-pannello .cmr-sez', { timeout: 10000 });
  ok('8d scheda in una finestra separata', await pop.evaluate(() => !!document.querySelector('#cmr-pannello.in-finestra')) && await a.evaluate(() => !document.querySelector('#cmr-pannello')));
  await pop.selectOption('#cmr-sesso', 'F'); await pop.waitForTimeout(400);
  ok('8e la finestra separata funziona (cambio sesso → riferimenti donne)', /donne/.test(await pop.textContent('#cmr-pannello .cmr-risultati')));
  await pop.close(); await a.waitForTimeout(1500);
  ok('8f chiusa la finestra, la scheda torna nella pagina', await a.evaluate(() => !!document.querySelector('#cmr-pannello') && !document.querySelector('#cmr-pannello').classList.contains('in-finestra')));
  ok('9 nessun errore JavaScript', !errori.length, errori.slice(0, 5));
} catch (e) { console.log('ERRORE', e); ko++; } finally { await b.close(); sim.kill(); console.log(ko ? `FALLITI ${ko}` : 'TUTTO OK'); process.exit(ko ? 1 : 0); }
