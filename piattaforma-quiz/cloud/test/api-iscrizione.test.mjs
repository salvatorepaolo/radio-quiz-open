// Iscrizione, conferma dell'email, nuova password e blocco dopo i tentativi sbagliati, attraverso il simulatore
// (stessa logica del server). Le email non partono: il simulatore le registra e il test segue i link come farebbe
// una persona. Indirizzi inventati (@esempio.test). Prima di questo test nessuno provava questi percorsi.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`;
let sim;
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
});
after(() => { sim?.kill(); });

// un «browser» con i suoi cookie
function persona() {
  let cookie = '';
  return async (url, corpo) => {
    const r = await fetch(BASE + url, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0].endsWith('=') ? '' : sc.split(';')[0];
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    return { stato: r.status, j, cookie };
  };
}
const posta = async () => (await (await fetch(BASE + '/__posta')).json());
const ultimaA = async (email) => (await posta()).filter((m) => m.a === email).pop();
const codiceDa = (m, tipo) => (m?.testo || '').match(new RegExp(`#/${tipo}/([A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+)`))?.[1];
const PW = 'Radiologia2026!', modulo = (email, extra = {}) => ({ nome: 'Ada Lovelace', email, password: PW, privacy: true, maggiorenne: true, categoria: 'specializzando', ...extra });

test('iscrizione: dati mancanti o non validi rifiutati con un messaggio chiaro; il campo trappola per i programmi non crea nulla', async () => {
  const p = persona(), email = 'verifiche@esempio.test';
  for (const [extra, motivo] of [[{ nome: 'A' }, /nome e cognome/], [{ email: 'non-una-email' }, /email non valido/], [{ password: 'corta1' }, /almeno 10 caratteri/],
    [{ password: 'solamentelettere' }, /numero o simbolo/], [{ privacy: false }, /condizioni d'uso/], [{ maggiorenne: false }, /18 anni/]]) {
    const r = await p('/api/iscrizione', modulo(email, extra)); assert.equal(r.stato, 400, JSON.stringify(extra)); assert.match(r.j.errore, motivo);
  }
  const prima = (await posta()).length;
  const r = await p('/api/iscrizione', modulo('robot@esempio.test', { sito: 'http://spam.example' }));
  assert.equal(r.stato, 200); assert.equal((await posta()).length, prima, 'nessuna email al robot');
  assert.equal((await p('/api/accesso', { email: 'robot@esempio.test', password: PW })).stato, 401, 'nessun account creato');
});

test('iscrizione → email con il link → conferma → dentro; prima della conferma non si entra; il link vale una volta', async () => {
  const p = persona(), email = 'ada@esempio.test';
  const r = await p('/api/iscrizione', modulo(email)); assert.equal(r.stato, 200); assert.match(r.j.messaggio, /ada@esempio\.test/);
  const m = await ultimaA(email); assert.match(m.o, /Conferma la tua iscrizione/); const codice = codiceDa(m, 'conferma'); assert.ok(codice, 'link di conferma nell\'email');
  const prima = await p('/api/accesso', { email, password: PW }); assert.equal(prima.stato, 403); assert.ok(prima.j.daConfermare);
  assert.equal((await p('/api/iscrizione', modulo(email))).stato, 429, 'seconda iscrizione subito dopo: si aspetta');
  assert.equal((await p('/api/conferma', { codice: codice.replace(/\.(.)/, '.x$1') })).stato, 400, 'codice alterato');
  const c = await p('/api/conferma', { codice }); assert.equal(c.stato, 200); assert.ok(c.cookie, 'dopo la conferma si è dentro');
  assert.equal((await p('/api/io')).j?.nome, 'Ada Lovelace');
  assert.deepEqual((await persona()('/api/conferma', { codice })).j, { giaAttivo: true }, 'il link riusato non rientra');
  assert.equal((await persona()('/api/accesso', { email, password: PW })).stato, 200, 'con email e password');
});

test('iscrizione con un indirizzo già iscritto: stessa risposta (non si scopre chi è iscritto), ma il titolare riceve un avviso', async () => {
  const email = 'ada@esempio.test', n = (await posta()).length;
  const r = await persona()('/api/iscrizione', modulo(email, { nome: 'Qualcun Altro', password: 'AltraPassword9' }));
  assert.equal(r.stato, 200); assert.match(r.j.messaggio, /Ti abbiamo inviato un'email/);
  const nuove = (await posta()).slice(n); assert.equal(nuove.length, 1); assert.equal(nuove[0].a, email); assert.match(nuove[0].o, /Hai già un account/);
  assert.equal((await persona()('/api/accesso', { email, password: 'AltraPassword9' })).stato, 401, 'la password dell\'altro non vale');
});

test('nuovo invio della conferma: solo per chi aspetta, non più di uno ogni 2 minuti, stessa risposta per indirizzi sconosciuti', async () => {
  const email = 'bruno@esempio.test'; assert.equal((await persona()('/api/iscrizione', modulo(email, { nome: 'Bruno Bianchi' }))).stato, 200);
  const n = (await posta()).length;
  assert.deepEqual((await persona()('/api/conferma/invia', { email })).j, { ok: true });
  assert.equal((await posta()).length, n, 'appena inviata: niente doppione');
  assert.deepEqual((await persona()('/api/conferma/invia', { email: 'nessuno@esempio.test' })).j, { ok: true }, 'indirizzo sconosciuto: stessa risposta');
  assert.equal((await posta()).length, n);
});

test('password dimenticata: link via email valido una volta, la vecchia password non vale più, le altre sessioni si chiudono', async () => {
  const email = 'ada@esempio.test', vecchia = persona();
  assert.equal((await vecchia('/api/accesso', { email, password: PW })).stato, 200);
  // il server tollera 2 secondi (il gettone ha la data in secondi): la sessione «vecchia» deve essere più vecchia di così
  await new Promise((ok) => setTimeout(ok, 2500));
  const sconosciuto = await persona()('/api/password/dimenticata', { email: 'nessuno@esempio.test' });
  const r = await persona()('/api/password/dimenticata', { email });
  assert.equal(r.stato, 200); assert.equal(r.j.messaggio, sconosciuto.j.messaggio, 'stessa risposta per indirizzi iscritti e no');
  const m = await ultimaA(email); assert.match(m.o, /Nuova password/); const codice = codiceDa(m, 'nuova-password'); assert.ok(codice);
  const p = persona();
  assert.equal((await p('/api/password/nuova', { codice, password: 'corta' })).stato, 400, 'password debole');
  const nuova = await p('/api/password/nuova', { codice, password: 'NuovaPassword7' }); assert.equal(nuova.stato, 200); assert.ok(nuova.cookie);
  assert.equal((await persona()('/api/password/nuova', { codice, password: 'AncoraUna8888' })).stato, 400, 'link già usato');
  assert.equal((await persona()('/api/accesso', { email, password: PW })).stato, 401, 'la vecchia password non vale più');
  assert.equal((await persona()('/api/accesso', { email, password: 'NuovaPassword7' })).stato, 200);
  assert.equal((await vecchia('/api/io')).stato, 401, 'la sessione aperta prima del cambio è chiusa');
});

test('diritti dell\'utente: profilo, cambio della password, scelta del docente, «scarica i miei dati» senza impronte né gettoni, cancellazione', async () => {
  const email = 'carla@esempio.test', p = persona();
  assert.equal((await p('/api/iscrizione', modulo(email, { nome: 'Carla Verdi' }))).stato, 200);
  assert.equal((await p('/api/conferma', { codice: codiceDa(await ultimaA(email), 'conferma') })).stato, 200);
  // profilo
  const pr = await p('/api/io/profilo', { nome: 'Carla Verdi Rossi', sede: 'Bari', anno: 3 }); assert.equal(pr.stato, 200);
  assert.equal((await p('/api/io')).j.nome, 'Carla Verdi Rossi');
  assert.equal((await p('/api/io/profilo', { nome: 'C' })).stato, 400, 'nome troppo corto');
  // cambio della password: serve quella attuale
  assert.equal((await p('/api/io/password', { attuale: 'Sbagliata123', password: 'CarlaNuova2026' })).stato, 400);
  assert.equal((await p('/api/io/password', { attuale: PW, password: 'debole' })).stato, 400);
  assert.equal((await p('/api/io/password', { attuale: PW, password: 'CarlaNuova2026' })).stato, 200);
  assert.equal((await persona()('/api/accesso', { email, password: 'CarlaNuova2026' })).stato, 200);
  // diventa docente (nuovo gettone con il nuovo ruolo); un'altra persona la sceglie e lei riceve un avviso
  const d = await p('/api/io/profilo', { docente: true }); assert.equal(d.stato, 200); assert.equal((await p('/api/io')).j.ruolo, 'docente');
  const ada = persona(); assert.equal((await ada('/api/accesso', { email: 'ada@esempio.test', password: 'NuovaPassword7' })).stato, 200);
  const idCarla = (await p('/api/io')).j.id;
  assert.deepEqual((await ada('/api/io/profilo', { docenti: [idCarla, 'inesistente'] })).j.docenti.map((x) => x.id), [idCarla], 'solo docenti veri');
  assert.match((await ultimaA(email)).o, /ti ha scelto come docente/);
  // statistiche personali e confronto anonimo
  assert.equal((await p('/api/io/statistiche')).stato, 200); assert.equal((await p('/api/io/confronto')).stato, 200);
  // i miei dati: file da scaricare, con il profilo e senza nulla di segreto
  const r = await fetch(BASE + '/api/io/dati', { headers: { cookie: (await p('/api/io')).cookie } });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-disposition') || '', /attachment; filename="i-miei-dati/);
  const testo = await r.text(), dati = JSON.parse(testo);
  assert.equal(dati.profilo.email, email); assert.ok(Array.isArray(dati.risposte));
  for (const chiave of ['"pw"', '"hash"', '"conferma"', '"reset"', '"errori"', '"bloccatoFino"', '"sessioneDa"']) assert.ok(!testo.includes(chiave), `il file contiene ${chiave}`);
  // cancellazione: serve la password; poi non si entra più e l'account non esiste
  assert.equal((await p('/api/io/elimina', { password: 'Sbagliata123' })).stato, 400);
  const el = await p('/api/io/elimina', { password: 'CarlaNuova2026' }); assert.equal(el.stato, 200);
  assert.equal((await persona()('/api/accesso', { email, password: 'CarlaNuova2026' })).stato, 401);
  assert.deepEqual((await ada('/api/io')).j.docenti, [], 'il docente cancellato sparisce da chi lo aveva scelto');
});

test('accesso: dopo 5 password sbagliate l\'account si blocca per 15 minuti, anche con la password giusta', async () => {
  const email = 'ada@esempio.test', p = persona();
  for (let i = 0; i < 5; i++) assert.equal((await p('/api/accesso', { email, password: `Sbagliata${i}xx` })).stato, 401);
  const r = await p('/api/accesso', { email, password: 'NuovaPassword7' }); assert.equal(r.stato, 429); assert.match(r.j.errore, /Troppi tentativi/);
  assert.equal((await p('/api/accesso', { email: 'nessuno@esempio.test', password: 'Qualsiasi123' })).stato, 401, 'indirizzo sconosciuto: errore normale');
});
