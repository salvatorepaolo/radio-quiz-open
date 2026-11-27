// Prova senza registrazione, revisione dei casi, caso della settimana per email e visite senza robot (27/11/2026),
// attraverso il simulatore (casi veri di casi-free in memoria: niente viene scritto sui file). Nomi inventati.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(QUI, '../api/logica.mjs')).href);
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`, SEG = 'segreto-dei-test';
let sim; const ck = { nessuno: '' };
const chiama = async (chi, url, corpo, extra = {}) => {
  const r = await fetch(BASE + url, { method: corpo ? 'POST' : 'GET', redirect: 'manual', headers: { 'content-type': 'application/json', ...(ck[chi] ? { cookie: ck[chi] } : {}), ...extra }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { stato: r.status, j, t, cookie: r.headers.get('set-cookie') || '' };
};
const PROVA = 'caso-tcia-001', ALTRO = 'caso-tcia-005', DA_RIVEDERE = 'caso-tcia-166';
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  const entra = async (corpo) => { const r = await fetch(BASE + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }); return r.headers.get('set-cookie')?.split(';')[0] || ''; };
  ck.admin = await entra({ codice: 'admin-test-0000' });
  const nuovo = async (nome, extra = {}) => (await chiama('admin', '/api/account', { nome, ...extra })).j;
  const doc = await nuovo('Dora Prova', { ruolo: 'docente', autore: true }); ck.doc = await entra({ codice: doc.codice }); ck.docId = (await chiama('admin', '/api/account')).j.find((a) => a.nome === 'Dora Prova').id;
  ck.spec = await entra({ codice: (await nuovo('Spe Prova', { ruolo: 'specializzando' })).codice });
});
after(() => { sim?.kill(); });

test('regole pure: robot, motivo della revisione, nota dopo la revisione', () => {
  for (const ua of ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36', 'Googlebot/2.1', 'curl/8.4.0'])
    assert.ok(L.ROBOT.test(ua), ua);
  for (const ua of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1', 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Safari/537.36', ''])
    assert.ok(!L.ROBOT.test(ua), ua);
  assert.equal(L.motivoRevisione({ nota_docente: 'Caso creato da Claude. NON ancora rivisto dal medico.' }), 'non ancora rivisto dal medico');
  assert.equal(L.motivoRevisione({ nota_docente: 'Misura da verificare.' }), 'dubbi aperti nella nota');
  assert.equal(L.motivoRevisione({ nota_docente: 'Misura da verificare. Confermato dal docente.' }), '');
  assert.equal(L.motivoRevisione({ nota_docente: 'NON ancora rivisto dal medico.', revisione: { esito: 'confermato' } }), '');
  assert.equal(L.motivoRevisione({ nota_docente: '', revisione: { esito: 'da-correggere' } }), 'correzioni chieste dal revisore');
  const n = L.notaDopoRevisione('Creato da Claude. NON ancora rivisto dal medico. Fonte X.', 'confermato', 'Dora Prova', '2026-11-27 18:05');
  assert.match(n, /Rivisto dal medico \(Dora Prova\) il 27\/11\/2026\. Fonte X\./); assert.doesNotMatch(n, /NON ancora/);
  assert.match(n, /\[revisione 27\/11\/2026\] Confermato dal docente Dora Prova\./);
  assert.equal(L.controlliCaso({ opzioni: [{ testo: 'a', corretta: true, tipo: 'principale' }, { testo: 'b', corretta: false }], nota_docente: 'da verificare\n' + n.split('\n').pop() }).includes('nota: da verificare'), false);
  const c = L.notaDopoRevisione('NON ancora rivisto dal medico.', 'da-correggere', 'Dora Prova', '2026-11-27 18:05', 'il lato è sbagliato');
  assert.match(c, /NON ancora rivisto/); assert.match(c, /da correggere: il lato è sbagliato$/);
});

test('DynamoDB: i campi nuovi dell\'account si salvano davvero (EXTRA in lambda.mjs; il simulatore salva tutto)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(path.join(QUI, '../api/lambda.mjs'), 'utf8'), m = src.match(/const EXTRA = \[([^\]]*)\]/);
  const extra = m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
  for (const k of ['revisore', 'settimana', 'settimanaInviata', 'avvisi', 'sfide']) assert.ok(extra.includes(k), k);
});

test('caso della settimana per email: solo a chi lo chiede, una volta per caso, solo nella sua settimana', async () => {
  const acc = [{ id: 'a1', nome: 'Ada', email: 'a@x.it', settimana: true }, { id: 'a2', nome: 'Bea', email: 'b@x.it' },
    { id: 'a3', nome: 'Cleo', email: 'c@x.it', settimana: true, settimanaInviata: '2026-11-23' }, { id: 'a4', nome: 'Dino', email: 'd@x.it', settimana: true, stato: 'attesa' }];
  const posta = [], scritti = [];
  const cfg = { segreto: SEG, indirizzo: 'https://radio-quiz.it', inviaEmail: async (a, o, c) => { posta.push({ a, o, c }); },
    magazzino: { elencoAccount: async () => acc, scriviAccount: async (a) => { scritti.push(a); } } };
  const sett = async () => [{ da: '2026-11-16', id: 'caso-tcia-001', titolo: 'Vecchio' }, { da: '2026-11-23', id: 'caso-tcia-005', titolo: 'TC del torace' }, { da: '2026-11-30', id: 'caso-tcia-007', titolo: 'Futuro' }];
  assert.equal(await L.emailSettimana(cfg, new Date('2026-11-27T08:00:00Z'), sett), 1);
  assert.equal(posta.length, 1); assert.equal(posta[0].a, 'a@x.it'); assert.match(posta[0].o, /TC del torace/);
  assert.match(posta[0].c.testo, /#\/caso\/caso-tcia-005/); assert.match(posta[0].c.testo, new RegExp(`/api/settimana/esci\\?u=a1&t=${L.firmaSettimana(SEG, 'a1')}`));
  assert.equal(scritti[0].settimanaInviata, '2026-11-23');
  posta.length = 0;
  assert.equal(await L.emailSettimana(cfg, new Date('2026-12-07T08:00:00Z'), async () => [{ da: '2026-11-23', id: 'caso-tcia-005', titolo: 'x' }]), 0, 'dopo la sua settimana: niente');
  assert.equal(await L.emailSettimana({ ...cfg, istanza: { modo: 'azienda' } }, new Date('2026-11-27T08:00:00Z'), sett), 0, 'mai nelle aziende');
  assert.equal(posta.length, 0);
});

test('senza accesso: solo i casi di prova, correzione senza salvataggio, nient\'altro', async () => {
  const p0 = (await chiama('nessuno', '/api/prova')).j;
  assert.ok(!p0.casi.some((c) => c.id === PROVA)); assert.ok(p0.casi.some((c) => c.id === p0.giorno) || !p0.casi.length);
  assert.equal((await chiama('nessuno', `/api/casi/${PROVA}`)).stato, 401, 'prima di essere segnato è chiuso');
  // l'amministratore lo segna come caso di prova
  const completo = (await chiama('admin', `/api/casi/${PROVA}/completo`)).j;
  assert.equal((await chiama('admin', `/api/casi/${PROVA}`, { ...completo, prova: true })).stato, 200);
  const p = (await chiama('nessuno', '/api/prova')).j;
  assert.ok(p.casi.some((c) => c.id === PROVA)); assert.equal(p.casi.length, p0.casi.length + 1); assert.ok(p.casi.some((c) => c.id === p.giorno));
  assert.ok(p.casi.every((c) => !('spiegazione' in c) && !('opzioni' in c)));
  const c = await chiama('nessuno', `/api/casi/${PROVA}`);
  assert.equal(c.stato, 200); assert.equal(c.j.id, PROVA);
  for (const k of ['spiegazione', 'vista', 'titolo_interno', 'nota_docente', 'esito_clinico']) assert.ok(!(k in c.j), k);
  assert.ok(c.j.opzioni.every((o) => !('corretta' in o)));
  assert.match(c.cookie, new RegExp(`^qo=.*Path=/casi/${PROVA}`), 'cookie «qo» delle immagini del solo caso');
  // guardia delle immagini (la stessa di CloudFront): «qo» apre il caso di prova senza accesso, nient'altro
  const qo = c.cookie.split(';')[0];
  const img = async (caso, cookie) => (await fetch(`${BASE}/casi/${caso}/serie.json`, { headers: cookie ? { cookie } : {} })).status;
  assert.equal(await img(PROVA, qo), 200); assert.equal(await img(PROVA, ''), 403);
  assert.equal(await img(ALTRO, qo.replace(PROVA, ALTRO)), 403, 'il cookie non vale per un altro caso');
  const qcStudente = (await chiama('spec', `/api/casi/${ALTRO}`)).cookie.split(';')[0];
  assert.match(qcStudente, /^qc=/); assert.equal(await img(ALTRO, qcStudente), 403, 'il «qc» di uno studente senza la sessione non apre');
  assert.equal(await img(ALTRO, `${qcStudente}; ${ck.spec}`), 200);
  assert.equal(await img(ALTRO, qcStudente.replace(/^qc=/, 'qo=')), 403, 'un «qc» rinominato «qo» non vale (firma diversa)');
  const prima = (await chiama('admin', '/api/statistiche')).j.risposte.totale;
  const r = await chiama('nessuno', `/api/casi/${PROVA}/risposta`, { scelte: [0], dettagli: { tempo: 40 } });
  assert.equal(r.stato, 200); assert.equal(r.j.ospite, true); assert.ok(Number.isFinite(r.j.punteggio)); assert.ok(!r.j.gioco);
  assert.equal((await chiama('admin', '/api/statistiche')).j.risposte.totale, prima, 'la risposta dell\'ospite non si salva');
  for (const [u, corpo] of [[`/api/casi/${ALTRO}`], [`/api/casi/${ALTRO}/risposta`, { scelte: [0] }], ['/api/casi'], [`/api/casi/${PROVA}/completo`],
    [`/api/casi/${PROVA}`, { ...completo, titolo: 'cambiato' }], [`/api/casi/${PROVA}/atteso`], [`/api/casi/${PROVA}/errore`], ['/api/io'], ['/api/io/progressi'], ['/api/revisione/casi']])
    assert.equal((await chiama('nessuno', u, corpo)).stato, 401, u);
  // un autore che salva il caso non toglie la prova (la decide l'amministratore)
  const perAutore = (await chiama('doc', `/api/casi/${PROVA}/completo`)).j;
  assert.equal((await chiama('doc', `/api/casi/${PROVA}`, { ...perAutore, prova: false })).stato, 200);
  assert.equal((await chiama('admin', `/api/casi/${PROVA}/completo`)).j.prova, true);
  // dashboard: casi di prova aperti e risolti nell'imbuto
  const t = (await chiama('admin', '/api/statistiche/traffico/7')).j;
  assert.ok(t.imbuto.provaApri >= 1 && t.imbuto.prova >= 1, JSON.stringify(t.imbuto));
  for (const k of ['visite', 'iscrizioni', 'primoCaso', 'tornati']) assert.ok(Number.isInteger(t.imbuto[k]), k);
});

test('visite: i browser automatici non si contano', async () => {
  const sess = async () => (await chiama('admin', '/api/statistiche/traffico/7')).j.imbuto.visite;
  const v0 = await sess();
  assert.equal((await chiama('nessuno', '/api/visita', { p: 'elenco', s: 1 }, { 'user-agent': 'Mozilla/5.0 HeadlessChrome/131.0' })).j.robot, true);
  assert.equal(await sess(), v0);
  await chiama('nessuno', '/api/visita', { p: 'elenco', s: 1 }, { 'user-agent': 'Mozilla/5.0 (iPhone) Safari/604.1' });
  assert.equal(await sess(), v0 + 1);
});

test('revisione dei casi: solo il revisore, conferma e richiesta di correzione restano nel caso', async () => {
  assert.equal((await chiama('doc', '/api/revisione/casi')).stato, 403, 'autore ma non revisore');
  assert.equal((await chiama('spec', '/api/revisione/casi')).stato, 403);
  assert.equal((await chiama('spec', `/api/casi/${DA_RIVEDERE}/revisione`, { esito: 'confermato' })).stato, 403);
  assert.equal((await chiama('admin', `/api/account/${ck.docId}`, { revisore: true })).stato, 200);
  assert.equal((await chiama('admin', '/api/account')).j.find((a) => a.id === ck.docId).revisore, true);
  assert.equal((await chiama('doc', '/api/io')).j.revisore, true);
  const l = (await chiama('doc', '/api/revisione/casi')).j;
  const voce = l.daRivedere.find((c) => c.id === DA_RIVEDERE);
  assert.ok(voce, 'il 166 è da rivedere'); assert.equal(voce.motivo, 'non ancora rivisto dal medico'); assert.ok(voce.titolo_interno);
  assert.equal((await chiama('doc', `/api/casi/${DA_RIVEDERE}/revisione`, { esito: 'da-correggere' })).stato, 400, 'serve la nota');
  assert.equal((await chiama('doc', `/api/casi/${DA_RIVEDERE}/revisione`, { esito: 'boh' })).stato, 400);
  assert.equal((await chiama('doc', `/api/casi/${DA_RIVEDERE}/revisione`, { esito: 'da-correggere', nota: 'Il seno costofrenico è <b>libero</b>' })).stato, 200);
  let c = (await chiama('admin', `/api/casi/${DA_RIVEDERE}/completo`)).j;
  assert.equal(c.revisione.esito, 'da-correggere'); assert.equal(c.revisione.da, 'Dora Prova'); assert.doesNotMatch(c.revisione.nota, /</);
  assert.equal((await chiama('doc', '/api/revisione/casi')).j.daRivedere.find((x) => x.id === DA_RIVEDERE).motivo, 'correzioni chieste dal revisore');
  assert.equal((await chiama('doc', `/api/casi/${DA_RIVEDERE}/revisione`, { esito: 'confermato' })).stato, 200);
  c = (await chiama('admin', `/api/casi/${DA_RIVEDERE}/completo`)).j;
  assert.equal(c.revisione.esito, 'confermato'); assert.match(c.nota_docente, /Rivisto dal medico \(Dora Prova\)/); assert.doesNotMatch(c.nota_docente, /NON ancora rivist/);
  const dopo = (await chiama('doc', '/api/revisione/casi')).j;
  assert.ok(!dopo.daRivedere.some((x) => x.id === DA_RIVEDERE)); assert.equal(dopo.rivisti[0].id, DA_RIVEDERE);
  // la revisione resta quando un autore salva il caso
  assert.equal((await chiama('doc', `/api/casi/${DA_RIVEDERE}`, { ...c, revisione: { esito: 'falso' } })).stato, 200);
  assert.equal((await chiama('admin', `/api/casi/${DA_RIVEDERE}/completo`)).j.revisione.esito, 'confermato');
  // tolto il ruolo di autore, niente più revisore
  assert.equal((await chiama('admin', `/api/account/${ck.docId}`, { autore: false })).stato, 200);
  assert.equal((await chiama('admin', '/api/account')).j.find((a) => a.id === ck.docId).revisore, false);
});

test('caso della settimana: scelta nel profilo e disiscrizione dal link', async () => {
  assert.equal((await chiama('spec', '/api/io')).j.settimana, false, 'spento di base');
  assert.equal((await chiama('spec', '/api/io/profilo', { settimana: true })).stato, 200);
  const io = (await chiama('spec', '/api/io')).j; assert.equal(io.settimana, true);
  assert.equal((await chiama('nessuno', `/api/settimana/esci?u=${io.id}&t=${'0'.repeat(24)}`)).stato, 400);
  const r = await chiama('nessuno', `/api/settimana/esci?u=${io.id}&t=${L.firmaSettimana(SEG, io.id)}`);
  assert.equal(r.stato, 200); assert.match(r.t, /Non riceverai più/);
  assert.equal((await chiama('spec', '/api/io')).j.settimana, false);
});
