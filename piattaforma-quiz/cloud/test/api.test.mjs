// Test di non regressione dell'API e delle regole di sicurezza (node --test). Avvia il simulatore su una porta
// libera con i casi veri della cartella casi/ e un database vuoto in memoria.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), B = `http://localhost:${PORTA}`;
const CASI = path.resolve(process.env.CASI || path.join(QUI, '../../casi-free'));
const WEB = path.resolve(process.env.WEB || path.join(QUI, '../web'));
let sim;

// un «browser» minimo: cookie conservati tra le richieste
function utente() {
  const jar = new Map();
  const f = async (u, { metodo = 'GET', corpo } = {}) => {
    const vai = () => fetch(B + u, { method: metodo, headers: { 'content-type': 'application/json', cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: corpo === undefined ? undefined : JSON.stringify(corpo), redirect: 'manual' });
    let r; for (let k = 0; ; k++) { try { r = await vai(); break; } catch (e) { if (k >= 4) throw e; await new Promise((ok) => setTimeout(ok, 500 * (k + 1))); } }
    for (const c of r.headers.getSetCookie?.() || []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/i.test(c)) jar.delete(k); else jar.set(k, v); }
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    return { stato: r.status, j, t };
  };
  return f;
}
const admin = utente();
const nuovoAccount = async (nome, ruolo) => { const r = await admin('/api/account', { metodo: 'POST', corpo: { nome, ruolo } }); assert.equal(r.stato, 200, r.t); const u = utente(); const a = await u('/api/accesso', { metodo: 'POST', corpo: { codice: r.j.codice } }); assert.equal(a.stato, 200, a.t); return { u, id: r.j.account.id }; };
let tutti = [], visibili = [], bozze = [];

before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA), CASI, WEB }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  const r = await admin('/api/accesso', { metodo: 'POST', corpo: { codice: 'admin-test-0000' } });   // CODICE_ADMIN del simulatore
  assert.equal(r.stato, 200, 'accesso amministratore: ' + r.t);
  tutti = (await admin('/api/casi')).j; visibili = tutti.filter((c) => c.visibile !== false); bozze = tutti.filter((c) => c.visibile === false);
});
after(() => { sim?.kill(); });

test('file del sito: JSON validi e app.js senza errori di sintassi', () => {
  for (const f of ['percorsi.json', 'aiuto.json']) assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(WEB, f), 'utf8')), f);
  execFileSync(process.execPath, ['--check', path.join(WEB, 'app.js')]);
  assert.ok(fs.statSync(path.join(WEB, 'lib/mpr3d.js')).size > 500000, 'lib/mpr3d.js mancante o troppo piccolo');
  for (const id of ['vista-elenco', 'vista-caso', 'vista-percorsi', 'vista-esame', 'q-form', 'btn-conferma']) assert.match(fs.readFileSync(path.join(WEB, 'index.html'), 'utf8'), new RegExp(`id="${id}"`), id);
  execFileSync(process.execPath, ['--check', path.join(WEB, 'ecosemi.js')]);
  assert.match(fs.readFileSync(path.join(WEB, 'licenze.html'), 'utf8'), /Licenze e crediti/);
  assert.match(fs.readFileSync(path.join(WEB, 'index.html'), 'utf8'), /href="licenze.html"/);
});

test('contorno semiautomatico del VS: ventricolo sintetico', async () => {
  const { contornoVS, segui, areaPoligono, battiti } = await import(path.join(WEB, 'ecosemi.js'));
  // cavità scura a mezza ellisse (semiassi 60 × 130 px) in una parete chiara, con rumore; 0,3 mm/pixel
  const cols = 400, rows = 400, M = { x: 200, y: 330 };
  const fot = (b, a, dy = 0) => { const pix = new Uint8Array(cols * rows); let r = 12345;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { r = (r * 1103515245 + 12345) & 0x7fffffff;
      const u = (M.y + dy - y) / a, v = (x - M.x) / b, dentro = u >= 0 && u * u + v * v <= 1;
      pix[y * cols + x] = Math.max(0, Math.min(255, (dentro ? 25 : 150) + ((r >> 8) % 60) - 30)); }
    return { cols, rows, pix, spCol: 0.3, spRow: 0.3 }; };
  const img = fot(60, 130), A1 = { x: 140, y: 330 }, Ap = { x: 200, y: 200 }, A2 = { x: 260, y: 330 };
  const r = contornoVS(img, { x: 150, y: 328 }, { x: 205, y: 210 }, { x: 252, y: 332 });      // clic imprecisi
  const atteso = Math.PI * 60 * 130 / 2, area = areaPoligono(r.punti);
  assert.ok(Math.abs(area - atteso) / atteso < 0.12, `area ${area.toFixed(0)} attesa ${atteso.toFixed(0)}`);
  // filmato: la cavità si restringe e si riallarga; fine diastole al fotogramma 0 e 10, fine sistole a metà
  const n = 11, im = Array.from({ length: n }, (_, k) => { const f = 1 - 0.25 * Math.sin(Math.PI * k / 10); return fot(60 * f, 130 * (0.9 + 0.1 * f)); });
  const r0 = contornoVS(im[0], A1, Ap, A2); let off = r0.off, a1 = A1, a2 = A2; const aree = [areaPoligono(r0.punti)];
  for (let k = 1; k < n; k++) { a1 = segui(im[0], im[k], A1, { da: a1 }); a2 = segui(im[0], im[k], A2, { da: a2 });
    const x = contornoVS(im[k], a1, Ap, a2, { prima: off }); off = x.off; aree.push(areaPoligono(x.punti)); }
  const b = battiti(aree)[0];
  assert.ok(Math.abs(b.es - 5) <= 1, `fine sistole al fotogramma ${b.es}`);
  assert.ok(aree[5] < aree[0] * 0.8, 'la cavità in sistole deve risultare più piccola');
});

test('correzione del referto nel browser: caso di riferimento solo se attiva e dopo la risposta', async () => {
  const c = visibili[0]; const s = await nuovoAccount('Prova Referto Locale', 'specializzando');
  assert.equal((await s.u(`/api/casi/${c.id}/atteso`)).stato, 403, 'spenta: niente caso di riferimento');
  let r = await admin('/api/impostazioni', { metodo: 'POST', corpo: { refertoLocale: true } });
  assert.equal(r.stato, 200); assert.equal(r.j.refertoLocale, true);
  assert.equal((await s.u('/api/impostazioni', { metodo: 'POST', corpo: { refertoLocale: false } })).stato, 403, 'solo l\'amministratore la cambia');
  assert.equal((await s.u(`/api/casi/${c.id}/atteso`)).stato, 403, 'prima della risposta niente soluzione');
  await s.u(`/api/casi/${c.id}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {}, dettagli: {} } });
  r = await s.u(`/api/casi/${c.id}/atteso`); assert.equal(r.stato, 200, r.t); assert.match(r.j.testo, /REPERTI PRESENTI/);
  assert.equal((await admin('/api/impostazioni', { metodo: 'POST', corpo: { refertoLocale: false } })).j.refertoLocale, false);
  const { nelTesto } = await import(path.join(WEB, 'refertolocale.js'));
  assert.equal(nelTesto('Diverticoli del sigma con infiltrazione del grasso', 'TC. Diverticoli del sigma con infiltrazione del grasso pericolico.'), true);
  assert.equal(nelTesto('Idronefrosi bilaterale di grado IV', 'Lieve idronefrosi sinistra. Non versamento.'), false, 'un distrattore non scritto dallo studente non è un suo errore');
  const { ripulisci } = await import(path.join(WEB, 'refertolocale.js'));
  const r2 = ripulisci({ voto: 3, trovati: ['Massa ipoecogena a margini non circoscritti', 'Formazione ovale circoscritta'], mancati: ['BI-RADS 3, controllo a 6 mesi', 'Studio del cavo ascellare'], errori: ['BI-RADS 3, controllo a 6 mesi'] }, 'Formazione ovale, circoscritta. BI-RADS 3, controllo a 6 mesi.');
  assert.deepEqual(r2.trovati, ['Formazione ovale circoscritta'], 'tra i trovati solo ciò che lo studente ha scritto');
  assert.deepEqual(r2.mancati, ['Studio del cavo ascellare'], 'tra i mancati non ciò che lo studente ha scritto');
  const att = 'Esame: X\nREPERTI PRESENTI (attesi nel referto):\n- [Reni] Angiomiolipoma renale sinistro con grasso macroscopico (reperto principale)\n- [Addome] Non versamento libero in addome\nAFFERMAZIONI SBAGLIATE (non devono comparire come presenti):\n- [Reni] Cisti renale semplice destra (Bosniak I)';
  const r3 = ripulisci({ voto: 9, trovati: ['Non versamento libero'], errori: ['Non versamento libero'] }, 'Non versamento libero. Cisti renale.', att);
  assert.equal(r3.voto, 5, 'reperto principale assente: voto al massimo 5');
  assert.deepEqual(r3.errori, [], 'un reperto atteso scritto bene non è un errore');
  const r4 = ripulisci({ voto: 3, trovati: ['Cisti renale semplice destra (Bosniak I)'], errori: ['Cisti renale semplice destra (Bosniak I)'] }, 'Cisti renale semplice destra (Bosniak I).', att);
  assert.deepEqual(r4.trovati, [], 'una voce non può essere insieme trovata e sbagliata');
});

test('percorsi del sito: casi esistenti, nessun doppione', (t) => {
  const p = JSON.parse(fs.readFileSync(path.join(WEB, 'percorsi.json'), 'utf8')), ids = new Set(tutti.map((c) => c.id));
  assert.equal(new Set(p.map((x) => x.id)).size, p.length, 'id di percorso ripetuto');
  for (const x of p) { assert.ok(x.titolo && Array.isArray(x.casi), x.id); for (const c of x.casi) assert.ok(ids.has(c), `${x.id}: ${c} non esiste`); if (!x.casi.some((c) => visibili.some((v) => v.id === c))) t.diagnostic(`avviso: il percorso «${x.titolo}» non ha casi visibili (gli studenti non lo vedono)`); }
});

test('accesso: codice sbagliato rifiutato, senza accesso niente API', async () => {
  const u = utente();
  assert.notEqual((await u('/api/accesso', { metodo: 'POST', corpo: { codice: 'sbagliato-0000' } })).stato, 200);
  assert.equal((await u('/api/casi')).stato, 401);
});

test('studente: vede solo i casi visibili, mai note, titolo interno e soluzione prima della risposta', async () => {
  const { u } = await nuovoAccount('Studente Test Uno', 'specializzando');
  const el = (await u('/api/casi')).j;
  assert.ok(el.length >= 1);
  assert.deepEqual(el.map((c) => c.id).sort(), visibili.map((c) => c.id).sort());
  for (const c of el) for (const k of ['nota_docente', 'titolo_interno', 'spiegazione', 'opzioni']) assert.ok(!(k in c), `${c.id}: ${k} nell'elenco`);
  for (const c of visibili.slice(0, 25)) {
    const r = await u(`/api/casi/${c.id}`); assert.equal(r.stato, 200, c.id);
    for (const k of ['nota_docente', 'titolo_interno', 'spiegazione', 'vista', 'scale']) assert.ok(!(k in r.j), `${c.id}: ${k} visibile prima della risposta`);
    assert.ok(r.j.opzioni.every((o) => !('corretta' in o) && !('tipo' in o) && !('nota' in o)), `${c.id}: soluzione nelle opzioni`);
  }
  for (const c of bozze.slice(0, 10)) assert.notEqual((await u(`/api/casi/${c.id}`)).stato, 200, `bozza ${c.id} aperta da uno studente`);
  assert.equal((await u(`/api/casi/${visibili[0].id}/completo`)).stato, 403);
  assert.notEqual((await u('/api/account')).stato, 200, 'elenco account a uno studente');
});

test('immagini: solo con il cookie del caso, mai caso.json né le cartelle «_»', async () => {
  const c = visibili.find((x) => x.id); const s = JSON.parse(fs.readFileSync(path.join(CASI, c.id, 'serie.json'), 'utf8'));
  const file = `/casi/${c.id}/${s[0].files[0]}`;
  // le immagini non sono in git: dove mancano (GitHub) se ne mette una finta per la durata del test
  const vero = path.join(CASI, c.id, s[0].files[0]), finta = !fs.existsSync(vero);
  if (finta) { fs.mkdirSync(path.dirname(vero), { recursive: true }); fs.writeFileSync(vero, 'immagine finta per il test'); }
  after(() => { if (finta) fs.rmSync(vero, { force: true }); });
  const { u } = await nuovoAccount('Studente Test Immagini', 'specializzando');
  assert.equal((await u(file)).stato, 403, 'immagine senza cookie del caso');
  await u(`/api/casi/${c.id}`);
  assert.equal((await u(file)).stato, 200, 'immagine dopo aver aperto il caso');
  assert.equal((await u(`/casi/${c.id}/caso.json`)).stato, 403);
  const altro = visibili.find((x) => x.id !== c.id);
  if (altro) { const s2 = JSON.parse(fs.readFileSync(path.join(CASI, altro.id, 'serie.json'), 'utf8')); assert.equal((await u(`/casi/${altro.id}/${s2[0].files[0]}`)).stato, 403, 'cookie di un caso usato per un altro'); }
});

test('correzione: tutte le corrette = 100, nessuna scelta < 100; dopo la risposta arriva la spiegazione', async () => {
  const { u } = await nuovoAccount('Studente Test Punteggi', 'specializzando');
  let provati = 0;
  for (const c of visibili.slice(0, 12)) {
    const comp = (await admin(`/api/casi/${c.id}/completo`)).j;
    if (comp.scelte === false || comp.localizza || !comp.opzioni?.length) continue;   // con la domanda sulla figura il 20% viene dal clic
    const giuste = comp.opzioni.map((o, i) => (o.corretta ? i : -1)).filter((i) => i >= 0);
    await u(`/api/casi/${c.id}`);
    const r = await u(`/api/casi/${c.id}/risposta`, { metodo: 'POST', corpo: { scelte: giuste, sicurezza: {}, dettagli: {} } });
    assert.equal(r.stato, 200, `${c.id}: ${r.t}`);
    assert.equal(r.j.punteggio, 100, `${c.id}: tutte le corrette danno ${r.j.punteggio}`);
    assert.ok('spiegazione' in r.j, `${c.id}: manca la spiegazione dopo la risposta`);
    const v = await u(`/api/casi/${c.id}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {}, dettagli: {} } });
    assert.ok(v.j.punteggio < 100, `${c.id}: nessuna scelta dà 100`);
    provati++;
  }
  assert.ok(provati >= 3, 'troppo pochi casi provati');
});

test('solo referto: i reperti attesi scritti come referto prendono la sufficienza', async () => {
  const { u } = await nuovoAccount('Studente Test Referto', 'specializzando');
  const punti = [];
  for (const c of visibili.slice(0, 15)) {
    const comp = (await admin(`/api/casi/${c.id}/completo`)).j;
    const testo = comp.opzioni.filter((o) => o.corretta).map((o) => o.testo).join('. ');
    if (testo.length < 60) continue;
    const r = await u(`/api/casi/${c.id}/risposta`, { metodo: 'POST', corpo: { modo: 'referto', scelte: [], sicurezza: {}, dettagli: { referto: testo } } });
    assert.equal(r.stato, 200, `${c.id}: ${r.t}`); punti.push(r.j.punteggio);
  }
  assert.ok(punti.length >= 3);
  assert.ok(punti.reduce((a, b) => a + b, 0) / punti.length >= 75, `media troppo bassa: ${punti.join(', ')}`);
});

test('funzioni del caso: «risposte multiple» spente = solo referto; le decide solo l\'amministratore', async () => {
  const c = visibili.find((x) => x.scelte !== false); const comp = (await admin(`/api/casi/${c.id}/completo`)).j;
  assert.equal((await admin(`/api/casi/${c.id}`, { metodo: 'POST', corpo: { ...comp, scelte: false, anatomia: false } })).stato, 200);
  const { u } = await nuovoAccount('Studente Test Funzioni', 'specializzando');
  const g = (await u(`/api/casi/${c.id}`)).j; assert.equal(g.scelte, false); assert.equal(g.anatomia, false);
  assert.equal((await u(`/api/casi/${c.id}/risposta`, { metodo: 'POST', corpo: { scelte: [0], sicurezza: {}, dettagli: {} } })).stato, 400);
  assert.equal((await admin(`/api/casi/${c.id}`, { metodo: 'POST', corpo: comp })).stato, 200);
  assert.ok(!('scelte' in (await admin(`/api/casi/${c.id}/completo`)).j), 'funzione non riattivata');
});

test('percorsi dei docenti: visibilità e permessi', async () => {
  const d = await nuovoAccount('Docente Test Percorsi', 'docente');
  const s1 = await nuovoAccount('Studente Con Docente', 'specializzando'), s2 = await nuovoAccount('Studente Senza Docente', 'specializzando');
  await s1.u('/api/io/profilo', { metodo: 'POST', corpo: { docenti: [d.id] } });
  const p = await d.u('/api/percorsi', { metodo: 'POST', corpo: { titolo: 'Percorso test', casi: [visibili[0].id], pubblico: true } });
  assert.equal(p.stato, 200, p.t); assert.equal(p.j.pubblico, false, 'un docente non può renderlo pubblico');
  assert.ok((await s1.u('/api/percorsi')).j.some((x) => x.id === p.j.id));
  assert.ok(!(await s2.u('/api/percorsi')).j.some((x) => x.id === p.j.id));
  assert.equal((await s2.u('/api/percorsi', { metodo: 'POST', corpo: { titolo: 'x', casi: [visibili[0].id] } })).stato, 403);
  assert.notEqual((await s1.u(`/api/percorsi/${p.j.id}/elimina`, { metodo: 'POST' })).stato, 200);
  assert.equal((await d.u(`/api/percorsi/${p.j.id}/elimina`, { metodo: 'POST' })).stato, 200);
});

test('esami di livello: il punteggio lo calcola il server; il docente vede solo i suoi studenti', async () => {
  const d = await nuovoAccount('Docente Test Esami', 'docente'), s = await nuovoAccount('Studente Test Esami', 'specializzando'), x = await nuovoAccount('Studente Estraneo', 'specializzando');
  await s.u('/api/io/profilo', { metodo: 'POST', corpo: { docenti: [d.id] } });
  const ids = visibili.filter((c) => c.scelte !== false).slice(0, 5).map((c) => c.id), t0 = new Date(Date.now() - 60e3).toISOString().slice(0, 16).replace('T', ' ');
  for (const id of ids.slice(0, 3)) await s.u(`/api/casi/${id}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {}, dettagli: {} } });
  const e = await s.u('/api/esami', { metodo: 'POST', corpo: { livello: 'Base', casi: ids, punteggio: 100, inizio: t0, minuti: 3 } });
  assert.equal(e.stato, 200, e.t); assert.ok(e.j.punteggio < 100, 'punteggio preso dal browser'); assert.equal(e.j.svolti, 3);
  assert.equal((await s.u('/api/esami')).j.length, 1);
  assert.equal((await x.u('/api/esami')).j.length, 0);
  assert.equal((await x.u('/api/esami/tutti')).stato, 403);
  assert.equal((await d.u('/api/esami/tutti')).j.length, 1);
});

test('controlli dei casi: nessun caso visibile con testi «da compilare» o senza risposte corrette', async () => {
  for (const c of visibili) {
    const comp = (await admin(`/api/casi/${c.id}/completo`)).j;
    assert.ok(!/da compilare/i.test(comp.anamnesi + comp.opzioni.map((o) => o.testo).join(' ')), `${c.id}: testo segnaposto`);
    assert.ok(comp.opzioni.some((o) => o.corretta), `${c.id}: nessuna risposta corretta`);
    (comp.sezioni || []).forEach((z, i) => { if (z.singola) assert.equal(comp.opzioni.filter((o) => o.sezione === i && o.corretta).length, 1, `${c.id}: sezione «${z.nome}» a risposta singola senza una sola corretta`); });
  }
});

test('statistiche d\'uso: solo amministratore, nessun dato personale', async () => {
  const s = await nuovoAccount('Persona Riservatissima', 'specializzando');
  await s.u(`/api/casi/${visibili[0].id}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {}, dettagli: {} } });
  assert.equal((await s.u('/api/statistiche')).stato, 403);
  const r = await admin('/api/statistiche'); assert.equal(r.stato, 200);
  assert.ok(r.j.iscritti.totale >= 1 && r.j.risposte.totale >= 1);
  assert.ok(!/Riservatissima|@|"account"|"nome"|"id"/.test(r.t), 'dati personali nelle statistiche');
});

test('correttezza dei casi visibili: domande, punteggi e scale (verifica_casi.mjs)', () => {
  const r = JSON.parse(execFileSync(process.execPath, [path.join(QUI, 'verifica_casi.mjs'), CASI, '--json'], { encoding: 'utf8', maxBuffer: 1 << 24 }));
  const errori = r.filter((x) => x.visibile).flatMap((x) => x.problemi.filter(([t]) => t === 'ERRORE').map(([, m]) => `${x.caso}: ${m}`));
  assert.deepEqual(errori, [], 'errori nei casi visibili');
});

test('formazione: temi, cerca l\'errore, test dei percorsi, riepilogo mensile, doppia lettura con note', async () => {
  const s = await nuovoAccount('Studente Formazione', 'specializzando');
  const t0 = await s.u('/api/io/temi'); assert.equal(t0.stato, 200, t0.t); assert.ok(Array.isArray(t0.j.temi));
  // cerca l'errore: solo dopo aver risposto al caso
  const adatti = [];
  for (const c of visibili) { const k = (await admin(`/api/casi/${c.id}/completo`)).j; if ((k.sezioni || []).length >= 3 && (k.opzioni || []).filter((o) => o.corretta).length >= 4) adatti.push(c.id); if (adatti.length >= 3) break; }
  assert.ok(adatti.length, 'nessun caso adatto all\'esercizio');
  const id = adatti[0];
  assert.equal((await s.u(`/api/casi/${id}/errore`)).stato, 403, 'esercizio prima della risposta');
  const r = await s.u(`/api/casi/${id}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {}, dettagli: { referto: 'Referto di prova scritto dallo studente per la doppia lettura del docente, abbastanza lungo.' } } });
  assert.equal(r.stato, 200, r.t);
  const e = await s.u(`/api/casi/${id}/errore`);
  assert.ok([200, 422].includes(e.stato), e.t);
  if (e.stato === 200) {
    assert.ok(e.j.frasi.length >= 2 && e.j.alternative.includes(e.j.giusta), 'esercizio incompleto');
    if (e.j.tipo === 'sbagliata') assert.equal(e.j.frasi.filter((f) => f.errata).length, 1);
    else assert.ok(!e.j.frasi.some((f) => f.testo === e.j.giusta), 'il reperto mancante è ancora nel referto');
  }
  // test d'ingresso di un percorso
  const pre = await s.u('/api/esami', { metodo: 'POST', corpo: { livello: 'pre', percorso: 'tsrm-rx', casi: [id], inizio: '2000-01-01 00:00', minuti: 3 } });
  assert.equal(pre.stato, 200, pre.t); assert.equal(pre.j.livello, 'pre'); assert.equal(pre.j.percorso, 'tsrm-rx');
  // riepilogo mensile: solo docenti
  assert.equal((await s.u('/api/riepilogo-mensile')).stato, 403);
  const m = await admin('/api/riepilogo-mensile'); assert.equal(m.stato, 200, m.t);
  assert.ok(Array.isArray(m.j.persone) && Array.isArray(m.j.facili) && Array.isArray(m.j.difficili));
  assert.ok(m.j.persone.some((p) => p.nome === 'Studente Formazione'));
  // doppia lettura: note sulle immagini nella revisione, le chiavi non valide si scartano
  const an = await admin('/api/analisi'); const riga = an.j.risultati.find((x) => x.account === s.id && x.caso === id);
  assert.ok(riga?.id, 'risposta non trovata in analisi');
  const rv = await admin('/api/referti/revisione', { metodo: 'POST', corpo: { id: riga.id, voto: 80, commento: 'Guarda qui', annotazioni: [
    { k: '0:3', tipo: 'nota', a: { x: 10, y: 20 }, b: { x: 30, y: 40 }, testo: 'reperto <b>qui</b>' }, { k: 'x', tipo: 'nota', a: { x: 1, y: 1 }, b: { x: 2, y: 2 } }, { k: '1:2', tipo: 'cerchio', a: { x: 1, y: 1 }, b: { x: 2, y: 2 } }] } });
  assert.equal(rv.stato, 200, rv.t); assert.equal(rv.j.revisione.annotazioni.length, 1); assert.doesNotMatch(rv.j.revisione.annotazioni[0].testo, /</);
  const pr = await s.u('/api/io/progressi'); assert.ok(pr.j.storico.some((x) => x.revisione?.annotazioni?.length === 1), 'lo studente non vede le note');
  // profilo didattico dalla categoria
  const io = await s.u('/api/io'); assert.equal(io.j.profilo, 'medico');
});

test('cerca l\'errore sul server, turno di guardia con discrepanze, confronto con i colleghi, esito del caso, proposte', async () => {
  const s = await nuovoAccount('Studente Guardia', 'specializzando');
  const ids = visibili.slice(0, 3).map((c) => c.id), id = ids[0];
  // cerca l'errore: risultato salvato solo dopo aver risposto, punti calcolati dal server
  assert.equal((await s.u(`/api/casi/${id}/errore`, { metodo: 'POST', corpo: { tipo: 'sbagliata', trovata: true, corretta: true } })).stato, 403);
  const inizio = new Date(Date.now() - 120e3).toISOString().slice(0, 16).replace('T', ' ');
  for (const c of ids) { const r = await s.u(`/api/casi/${c}/risposta`, { metodo: 'POST', corpo: { modo: 'referto', scelte: [], dettagli: { referto: 'Referto del turno di guardia: esame valutato con attenzione, nessun reperto acuto certo, si consiglia correlazione clinica.' } } }); assert.equal(r.stato, 200, r.t); }
  const er = await s.u(`/api/casi/${id}/errore`, { metodo: 'POST', corpo: { tipo: 'sbagliata', trovata: true, corretta: false, punti: 100 } });
  assert.equal(er.stato, 200, er.t); assert.equal(er.j.punti, 50, 'i punti li calcola il server');
  const mie = await s.u('/api/io/errori'); assert.equal(mie.j.n, 1); assert.equal(mie.j.media, 50);
  const m = await admin('/api/riepilogo-mensile'); assert.equal(m.j.persone.find((p) => p.nome === 'Studente Guardia')?.errore?.n, 1, 'il docente non vede l\'esercizio');
  // turno di guardia: salvato con l'inizio; la discrepanza del docente entra nell'esito del turno
  const g = await s.u('/api/esami', { metodo: 'POST', corpo: { livello: 'guardia', casi: ids, inizio, minuti: 60, durata_s: 900 } });
  assert.equal(g.stato, 200, g.t); assert.equal(g.j.livello, 'guardia'); assert.equal(g.j.minuti, 60); assert.equal(g.j.discrepanze.daRivedere, 3);
  const an = await admin('/api/analisi'); const riga = an.j.risultati.find((x) => x.account === s.id && x.caso === id);
  const rv = await admin('/api/referti/revisione', { metodo: 'POST', corpo: { id: riga.id, voto: 40, commento: 'Hai perso il reperto principale', discrepanza: 'maggiore' } });
  assert.equal(rv.stato, 200, rv.t); assert.equal(rv.j.revisione.discrepanza, 'maggiore');
  // salvando solo le note sulle immagini la discrepanza resta
  const rv2 = await admin('/api/referti/revisione', { metodo: 'POST', corpo: { id: riga.id, voto: 40, commento: 'Hai perso il reperto principale', annotazioni: [] } });
  assert.equal(rv2.j.revisione.discrepanza, 'maggiore');
  const mieE = await s.u('/api/esami'); const turno = mieE.j.find((e) => e.livello === 'guardia');
  assert.equal(turno.discrepanze.maggiori, 1); assert.equal(turno.discrepanze.daRivedere, 2);
  // il turno non entra negli esami di livello delle statistiche come livello sconosciuto
  // confronto con i colleghi: risposta valida, nessun nome, percentile solo con almeno 5 colleghi
  const cf = await s.u('/api/io/confronto'); assert.equal(cf.stato, 200, cf.t); assert.ok(Array.isArray(cf.j.aree));
  assert.doesNotMatch(cf.t, /Studente|account/);
  for (const a of cf.j.aree) if (a.percentile != null) assert.ok(a.colleghi >= 5);
  const st = await admin('/api/statistiche'); assert.ok(Array.isArray(st.j.lettura)); for (const l of st.j.lettura) assert.ok(l.persone >= 5);
  // esito del caso: nascosto prima della risposta, mostrato dopo
  const k = (await admin(`/api/casi/${ids[1]}/completo`)).j; const { id: _i, ...corpoCaso } = k;
  assert.equal((await admin(`/api/casi/${ids[1]}`, { metodo: 'POST', corpo: { ...corpoCaso, esito_clinico: { tipo: 'istologia', testo: 'Esito di prova' } } })).stato, 200);
  const s2 = await nuovoAccount('Studente Esito', 'specializzando');
  const v = await s2.u(`/api/casi/${ids[1]}`); assert.equal(v.j.esito_clinico, undefined, 'esito visibile prima della risposta');
  const rr = await s2.u(`/api/casi/${ids[1]}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {} } }); assert.equal(rr.j.esitoClinico?.testo, 'Esito di prova');
  // proposte: un iscritto carica, il caso resta in bozza, solo l'autore lo rifiuta o lo pubblica
  const pid = 'prop-abcd1234';
  assert.equal((await s.u(`/api/casi/caso-999/caricamento`, { metodo: 'POST', corpo: { proposta: true, files: ['serie.json'] } })).stato, 403, 'codice non da proposta');
  const up = await s.u(`/api/casi/${pid}/caricamento`, { metodo: 'POST', corpo: { proposta: true, files: ['serie/s1/a.dcm', 'serie.json'] } });
  assert.equal(up.stato, 200, up.t);
  await fetch(up.j.urls['serie.json'], { method: 'PUT', body: JSON.stringify([{ descrizione: 'TC', numero: 1, files: ['serie/s1/a.dcm'] }]) });
  assert.equal((await s.u(`/api/casi/${pid}`, { metodo: 'POST', corpo: { proposta: true, titolo: 'TC torace: dispnea', descrizione: 'troppo corta', dichiarazione: true } })).stato, 400);
  const cr = await s.u(`/api/casi/${pid}`, { metodo: 'POST', corpo: { proposta: true, titolo: 'TC torace: dispnea', descrizione: 'Embolia polmonare bilaterale dei rami lobari, nessun infarto.', dichiarazione: true, visibile: true } });
  assert.equal(cr.stato, 200, cr.t);
  assert.equal((await s.u(`/api/casi/${pid}`)).stato, 404, 'la proposta non è visibile agli studenti');
  const mieP = await s.u('/api/proposte'); assert.equal(mieP.j.length, 1); assert.equal(mieP.j[0].stato, 'in attesa'); assert.equal(mieP.j[0].descrizione, undefined);
  assert.equal((await s.u(`/api/proposte/${pid}`, { metodo: 'POST', corpo: { azione: 'rifiuta', motivo: 'x' } })).stato, 403);
  const tutte = await admin('/api/proposte'); assert.ok(tutte.j.some((p) => p.id === pid && p.nome === 'Studente Guardia'));
  const no = await admin(`/api/proposte/${pid}`, { metodo: 'POST', corpo: { azione: 'rifiuta', motivo: 'Immagini non complete' } });
  assert.equal(no.stato, 200, no.t);
  const dopo = await s.u('/api/proposte'); assert.equal(dopo.j[0].stato, 'rifiutata'); assert.equal(dopo.j[0].motivo, 'Immagini non complete');
  // pubblicazione di una proposta: solo dopo il controllo dell'anonimato registrato dal docente
  const p2 = 'prop-efgh5678';
  const up2 = await s.u(`/api/casi/${p2}/caricamento`, { metodo: 'POST', corpo: { proposta: true, files: ['serie/s1/a.dcm', 'serie.json'] } });
  await fetch(up2.j.urls['serie.json'], { method: 'PUT', body: JSON.stringify([{ descrizione: 'RX', numero: 1, files: ['serie/s1/a.dcm'] }]) });
  assert.equal((await s.u(`/api/casi/${p2}`, { metodo: 'POST', corpo: { proposta: true, titolo: 'RX torace: febbre', descrizione: 'Polmonite lobare inferiore destra con broncogramma aereo.', dichiarazione: true } })).stato, 200);
  const k2 = (await admin(`/api/casi/${p2}/completo`)).j; const { id: _k, ...c2 } = k2;
  const pubblica = () => admin(`/api/casi/${p2}`, { metodo: 'POST', corpo: { ...c2, visibile: true, opzioni: [{ testo: 'Polmonite lobare', tipo: 'principale' }, { testo: 'Pneumotorace', tipo: 'distrattore' }] } });
  const b1 = await pubblica(); assert.equal(b1.stato, 400, 'pubblicata senza controllo'); assert.match(b1.t, /anonimato/);
  assert.equal((await s.u(`/api/proposte/${p2}`, { metodo: 'POST', corpo: { azione: 'controllo', esito: 'ok', file: 1 } })).stato, 403, 'controllo registrato da uno studente');
  const ko = await admin(`/api/proposte/${p2}`, { metodo: 'POST', corpo: { azione: 'controllo', esito: 'problemi', file: 1, problemi: ['campo privato (x00091001)'] } });
  assert.equal(ko.j.controllo.esito, 'problemi'); assert.equal((await pubblica()).stato, 400, 'pubblicata con problemi');
  const okc = await admin(`/api/proposte/${p2}`, { metodo: 'POST', corpo: { azione: 'controllo', esito: 'ok', file: 1, immagini: 1, zone: 0 } });
  assert.equal(okc.j.controllo.esito, 'ok');
  const b2 = await pubblica(); assert.equal(b2.stato, 200, b2.t);
  const fine = await s.u('/api/proposte'); assert.equal(fine.j.find((p) => p.id === p2).stato, 'approvata');
});

test('iscritti: l\'amministratore assegna i docenti di riferimento, l\'iscritto può toglierli', async () => {
  const d = await nuovoAccount('Docente Prova Assegna', 'docente'), s = await nuovoAccount('Studente Prova Assegna', 'specializzando');
  const altro = await nuovoAccount('Altro Studente', 'specializzando');
  const r = await admin(`/api/account/${s.id}`, { metodo: 'POST', corpo: { docenti: [d.id, altro.id, 'inesistente'] } });
  assert.equal(r.stato, 200, r.t);
  assert.deepEqual(r.j.account.docenti, [d.id], 'solo docenti attivi tra i riferimenti');
  assert.deepEqual((await s.u('/api/io')).j.docenti.map((x) => x.id), [d.id], 'l\'iscritto vede il docente assegnato');
  const l = (await admin('/api/account')).j, a = l.find((x) => x.id === s.id);
  assert.ok(a.attivita && 'casi' in a.attivita && 'media' in a.attivita, 'attività nell\'elenco');
  assert.equal(l.find((x) => x.id === d.id).seguaci, 1);
  assert.notEqual((await s.u(`/api/account/${s.id}`, { metodo: 'POST', corpo: { docenti: [] } })).stato, 200, 'solo l\'amministratore');
  assert.equal((await s.u('/api/io/profilo', { metodo: 'POST', corpo: { docenti: [] } })).stato, 200);
  assert.deepEqual((await s.u('/api/io')).j.docenti, [], 'l\'iscritto toglie il docente dal profilo');
});

test('caso a tappe: regola e «stesso segno in altri casi» solo dopo la risposta, serie da scoprire salvata', async () => {
  if (!visibili.length) return;
  const c = visibili[0], altro = visibili.find((x) => x.id !== c.id) || c, bozza = bozze[0];
  const comp = (await admin(`/api/casi/${c.id}/completo`)).j;
  const nuovo = { ...comp, regola: 'Regola di prova', rassegna: [{ caso: altro.id, testo: 'stesso segno' }, ...(bozza ? [{ caso: bozza.id, testo: 'bozza' }] : []), { caso: '../x', testo: 'no' }],
    sezioni: [{ nome: 'Prima', domanda: 'a' }, { nome: 'Seconda', domanda: 'b', serie: 0, scopri: true }] };
  assert.equal((await admin(`/api/casi/${c.id}`, { metodo: 'POST', corpo: nuovo })).stato, 200);
  const salvato = (await admin(`/api/casi/${c.id}/completo`)).j;
  assert.equal(salvato.sezioni[1].scopri, true); assert.ok(!salvato.rassegna.some((x) => x.caso === '../x'));
  const { u } = await nuovoAccount('Studente Tappe', 'specializzando');
  const g = (await u(`/api/casi/${c.id}`)).j;
  assert.ok(!('regola' in g) && !('rassegna' in g), 'niente regola né rassegna prima della risposta');
  const r = (await u(`/api/casi/${c.id}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {}, dettagli: {} } })).j;
  assert.equal(r.regola, 'Regola di prova');
  assert.deepEqual(r.rassegna.map((x) => x.caso), [altro.id], 'solo casi pubblicati');
  assert.equal((await admin(`/api/casi/${c.id}`, { metodo: 'POST', corpo: comp })).stato, 200);
});

test('immagini da archivio pubblico (TCIA): prima della risposta solo archivio e licenza, poi collezione e DOI', async () => {
  if (!visibili.length) return;
  const c = visibili[0];
  const comp = (await admin(`/api/casi/${c.id}/completo`)).j;
  const fonte = { archivio: 'The Cancer Imaging Archive (TCIA)', collezione: 'TCGA-KIRC', soggetto: 'TCGA-XX-0000', doi: '10.7937/prova', licenza: 'CC BY 3.0',
    licenza_url: 'https://creativecommons.org/licenses/by/3.0/', citazione: 'Citazione di prova', url: 'javascript:alert(1)' };
  assert.equal((await admin(`/api/casi/${c.id}`, { metodo: 'POST', corpo: { ...comp, fonte } })).stato, 200);
  const salvato = (await admin(`/api/casi/${c.id}/completo`)).j;
  assert.equal(salvato.fonte.doi, '10.7937/prova'); assert.ok(!('url' in salvato.fonte), 'solo link https');
  assert.equal((await admin('/api/casi')).j.find((x) => x.id === c.id).origine, 'TCIA', 'nell\'elenco il caso risulta da archivio pubblico');
  const { u } = await nuovoAccount('Studente Fonte', 'specializzando');
  const g = (await u(`/api/casi/${c.id}`)).j;
  assert.deepEqual(g.fonte, { archivio: fonte.archivio, licenza: fonte.licenza, licenza_url: fonte.licenza_url }, 'prima della risposta niente collezione né DOI');
  const r = (await u(`/api/casi/${c.id}/risposta`, { metodo: 'POST', corpo: { scelte: [], sicurezza: {}, dettagli: {} } })).j;
  assert.equal(r.fonte.collezione, 'TCGA-KIRC'); assert.equal(r.fonte.doi, '10.7937/prova');
  assert.equal((await admin(`/api/casi/${c.id}`, { metodo: 'POST', corpo: comp })).stato, 200);
});

test('vetrina: istanza pubblica senza accesso', async () => {
  const r = await utente()('/api/istanza');
  assert.equal(r.stato, 200); assert.equal(r.j.modo, 'vetrina');
});

test('percorsi del sito personalizzati dall\'amministratore: casi, titolo, nascosto, ripristino', async () => {
  const fissi = JSON.parse(fs.readFileSync(path.join(WEB, 'percorsi.json'), 'utf8')), f = fissi[0];
  const { u } = await nuovoAccount('Studente Percorsi', 'specializzando'), d = await nuovoAccount('Docente Percorsi', 'docente');
  assert.equal((await d.u('/api/percorsi', { metodo: 'POST', corpo: { fisso: f.id, casi: [] } })).stato, 403, 'solo l\'amministratore');
  const r = await admin('/api/percorsi', { metodo: 'POST', corpo: { fisso: f.id, titolo: 'Titolo nostro', descrizione: 'x', casi: [visibili[0]?.id || 'caso-001', '../no'], nascosto: false } });
  assert.equal(r.stato, 200, r.t); assert.equal(r.j.id, 'f-' + f.id); assert.ok(!r.j.casi.includes('../no'));
  const vista = (await u('/api/percorsi')).j.find((p) => p.fisso === f.id);
  assert.ok(vista && vista.titolo === 'Titolo nostro' && !vista.modificabile, 'lo studente vede la personalizzazione');
  assert.equal((await admin('/api/percorsi', { metodo: 'POST', corpo: { fisso: f.id, titolo: '', casi: [], nascosto: true } })).j.nascosto, true);
  assert.equal((await admin(`/api/percorsi/f-${f.id}/elimina`, { metodo: 'POST' })).stato, 200);
  assert.ok(!(await u('/api/percorsi')).j.some((p) => p.fisso === f.id), 'ripristinato');
});

test('sponsor (vetrina): gestione dell\'amministratore, elenco pubblico, viste e clic; visite contate', async () => {
  const anonimo = utente();
  assert.deepEqual((await anonimo('/api/sponsor')).j, []);
  assert.equal((await anonimo('/api/sponsor/gestione')).stato, 401);
  const logo = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal((await admin('/api/sponsor', { metodo: 'POST', corpo: { nome: 'X', link: 'http://non-sicuro', logo } })).stato, 400);
  const x = (await admin('/api/sponsor', { metodo: 'POST', corpo: { nome: 'Ditta <b>X</b>', link: 'https://example.org', logo, posizioni: ['home', 'altro'] } })).j;
  assert.equal(x.nome, 'Ditta b X /b'); assert.deepEqual(x.posizioni, ['home']);
  const l = (await anonimo('/api/sponsor')).j; assert.equal(l.length, 1); assert.equal(l[0].link, true);
  await anonimo('/api/sponsor/viste', { metodo: 'POST', corpo: { ids: [x.id, 'inesistente'] } });
  const vai = await anonimo(`/api/sponsor/${x.id}/vai`); assert.equal(vai.stato, 302);
  const g = (await admin('/api/sponsor/gestione')).j[0]; assert.equal(g.stat.viste30, 1); assert.equal(g.stat.clic30, 1);
  await admin(`/api/sponsor/${x.id}`, { metodo: 'POST', corpo: { attivo: false } });
  assert.deepEqual((await anonimo('/api/sponsor')).j, []);
  await admin(`/api/sponsor/${x.id}/elimina`, { metodo: 'POST' });
  assert.equal((await admin('/api/sponsor/gestione')).j.length, 0);
  // traffico: pagine valide contate, le altre ignorate; solo l'amministratore legge
  for (const p of ['elenco', 'elenco', 'bogus']) await anonimo('/api/visita', { metodo: 'POST', corpo: { p, s: 1 } });
  await anonimo('/api/visita', { metodo: 'POST', corpo: { p: 'caso', c: 'caso-tcia-001' } });
  assert.equal((await anonimo('/api/statistiche/traffico')).stato, 401);
  const t = (await admin('/api/statistiche/traffico/7')).j;
  assert.equal(t.giorni.length, 7); assert.ok(t.pagine.find((v) => v.p === 'elenco').n >= 2); assert.ok(!t.pagine.find((v) => v.p === 'bogus'));
  assert.equal(t.casi[0].id, 'caso-tcia-001'); assert.ok(t.giorni.at(-1).sessioni >= 3);
});
