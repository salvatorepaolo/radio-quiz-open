// Accesso con Google, attraverso il simulatore: /__google fa la parte di accounts.google.com (stesso flusso del server vero:
// state e nonce nel cookie firmato, codice scambiato con le affermazioni). Indirizzi inventati.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const G = await import(pathToFileURL(path.join(QUI, '../api/google.mjs')).href);
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`;
let sim;
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
});
after(() => { sim?.kill(); });

// un «browser» che tiene i cookie per nome e non segue i rimandi da solo
function persona() {
  const biscotti = new Map();
  const tieni = (r) => { for (const sc of r.headers.getSetCookie()) { const [nv] = sc.split(';'); const i = nv.indexOf('='); const n = nv.slice(0, i), v = nv.slice(i + 1); if (!v || /Max-Age=0/.test(sc)) biscotti.delete(n); else biscotti.set(n, v); } };
  const chiama = async (url, corpo) => {
    const r = await fetch(url.startsWith('http') ? url : BASE + url, { method: corpo ? 'POST' : 'GET', redirect: 'manual',
      headers: { 'content-type': 'application/json', cookie: [...biscotti].map(([n, v]) => `${n}=${v}`).join('; ') }, body: corpo ? JSON.stringify(corpo) : undefined });
    tieni(r); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    return { stato: r.status, j, dove: r.headers.get('location') || '' };
  };
  // giro completo: inizia → Google finto (con i parametri dati) → ritorno; restituisce l'ultimo rimando
  chiama.google = async (opz = {}, dopo = '', prov = 'google', extra = '') => {
    const a = await chiama(`/api/${prov}/inizia` + (dopo ? '?dopo=' + encodeURIComponent(dopo) : extra));
    assert.equal(a.stato, 302); const u = new URL(a.dove);
    for (const [k, v] of Object.entries(opz)) u.searchParams.set(k, v);
    const g = await chiama(u.href); assert.equal(g.stato, 302);
    return chiama(g.dove);
  };
  chiama.linkedin = (opz = {}, dopo = '') => chiama.google(opz, dopo, 'linkedin');
  chiama.biscotti = biscotti;
  return chiama;
}
const PW = 'Radiologia2026!';
const modulo = { nome: 'Mario Rossi', categoria: 'radiologo', privacy: true, maggiorenne: true };
const posta = async () => (await (await fetch(BASE + '/__posta')).json());

test('controlli sulle affermazioni del gettone di Google', () => {
  const cfg = { google: { id: 'cli' } }, ok = { iss: 'https://accounts.google.com', aud: 'cli', exp: Date.now() / 1000 + 60, nonce: 'n', sub: '123', email: 'a@gmail.com', email_verified: true };
  assert.equal(G.controllaAffermazioni(ok, cfg, 'n'), '');
  assert.equal(G.controllaAffermazioni({ ...ok, iss: 'https://evil.example' }, cfg, 'n'), 'emittente');
  assert.equal(G.controllaAffermazioni({ ...ok, aud: 'altro' }, cfg, 'n'), 'destinatario');
  assert.equal(G.controllaAffermazioni({ ...ok, exp: Date.now() / 1000 - 1 }, cfg, 'n'), 'scaduto');
  assert.equal(G.controllaAffermazioni({ ...ok, nonce: 'x' }, cfg, 'n'), 'nonce');
  assert.equal(G.controllaAffermazioni({ ...ok, email_verified: false }, cfg, 'n'), 'email');
  assert.ok(G.emailAutorevole({ email: 'a@gmail.com' }) && G.emailAutorevole({ email: 'b@unime.it', hd: 'unime.it' }));
  assert.ok(!G.emailAutorevole({ email: 'c@libero.it' }) && !G.emailAutorevole({ email: 'c@libero.it', hd: 'unime.it' }));
  const f = G.firmato('s', 'qg', { a: 1, scad: Date.now() + 1000 });
  assert.deepEqual(G.leggiFirmato('s', 'qg', f).a, 1);
  assert.equal(G.leggiFirmato('s', 'qn', f), null, 'etichetta diversa');
  assert.equal(G.leggiFirmato('altro', 'qg', f), null, 'segreto diverso');
  assert.equal(G.leggiFirmato('s', 'qg', G.firmato('s', 'qg', { scad: Date.now() - 1 })), null, 'scaduto');
  assert.equal(G.dopoValido('https://evil.example'), '#/'); assert.equal(G.dopoValido('#/caso/caso-tcia-001'), '#/caso/caso-tcia-001');
});

test('istanza: il pulsante si mostra; inizia manda a Google con PKCE, state e nonce', async () => {
  assert.equal((await (await fetch(BASE + '/api/istanza')).json()).google, true);
  const p = persona(), a = await p('/api/google/inizia');
  const u = new URL(a.dove);
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('scope'), 'openid email profile');
  assert.ok(u.searchParams.get('state') && u.searchParams.get('nonce'));
  assert.equal(u.searchParams.get('redirect_uri'), BASE + '/api/google/ritorno');
  assert.ok(p.biscotti.get('qg'), 'cookie dello stato');
});

test('prima volta con Google: si completano condizioni e 18 anni, poi si è dentro senza email di conferma', async () => {
  const p = persona(), n = (await posta()).length;
  const r = await p.google({ email: 'mario.rossi@gmail.com' });
  assert.match(r.dove, /#\/google\/iscrizione$/);
  assert.deepEqual((await p('/api/google/nuovo')).j, { email: 'mario.rossi@gmail.com', nome: 'Mario Rossi' });
  assert.equal((await p('/api/io')).stato, 401, 'non ancora dentro');
  assert.equal((await p('/api/google/completa', { ...modulo, maggiorenne: false })).stato, 400);
  assert.equal((await p('/api/google/completa', { ...modulo, privacy: false })).stato, 400);
  const c = await p('/api/google/completa', modulo);
  assert.equal(c.stato, 200); assert.equal(c.j.email, 'mario.rossi@gmail.com'); assert.equal(c.j.conGoogle, true); assert.equal(c.j.conPassword, false);
  assert.equal((await p('/api/io')).j.categoria, 'radiologo');
  assert.ok(!p.biscotti.has('qn'), 'cookie dell\'iscrizione tolto');
  assert.equal((await posta()).length, n, 'nessuna email');
  // la volta dopo si entra direttamente, alla pagina da cui si era partiti
  const q = persona(), r2 = await q.google({ email: 'mario.rossi@gmail.com' }, '#/caso/caso-tcia-001');
  assert.equal(r2.dove, BASE + '/#/caso/caso-tcia-001'); assert.equal((await q('/api/io')).j.nome, 'Mario Rossi');
  // un secondo completamento con lo stesso account non ne crea un doppione
  assert.equal((await p('/api/google/completa', modulo)).stato, 400, 'cookie usato');
});

test('account già iscritto con email e password e indirizzo Gmail: Google entra nello stesso account', async () => {
  const p = persona(), email = 'giulia.bianchi@gmail.com';
  await p('/api/iscrizione', { nome: 'Giulia Bianchi', email, password: PW, privacy: true, maggiorenne: true, categoria: 'studente' });
  const codice = ((await posta()).filter((m) => m.a === email).pop().testo).match(/#\/conferma\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/)[1];
  await p('/api/conferma', { codice });
  const q = persona(), r = await q.google({ email, nome: 'Giulia B.' });
  assert.equal(r.dove, BASE + '/#/');
  const io = (await q('/api/io')).j; assert.equal(io.nome, 'Giulia Bianchi'); assert.equal(io.categoria, 'studente'); assert.equal(io.conGoogle, true);
  assert.equal((await persona()('/api/accesso', { email, password: PW })).stato, 200, 'la password vale ancora');
});

test('iscrizione in attesa di conferma: Google la attiva e toglie la password scelta da chi ha compilato il modulo', async () => {
  const email = 'luca.verdi@gmail.com';
  await persona()('/api/iscrizione', { nome: 'Intruso', email, password: PW, privacy: true, maggiorenne: true, categoria: 'altro' });
  const q = persona(), r = await q.google({ email });
  assert.equal(r.dove, BASE + '/#/');
  assert.equal((await q('/api/io')).j.conPassword, false);
  assert.equal((await persona()('/api/accesso', { email, password: PW })).stato, 401, 'la password dell\'intruso non vale più');
});

test('indirizzo non gestito da Google già iscritto: niente collegamento automatico', async () => {
  const email = 'anna@esempio.test';
  const p = persona(); await p('/api/iscrizione', { nome: 'Anna Neri', email, password: PW, privacy: true, maggiorenne: true, categoria: 'medico' });
  const codice = ((await posta()).filter((m) => m.a === email).pop().testo).match(/#\/conferma\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/)[1];
  await p('/api/conferma', { codice });
  const q = persona(), r = await q.google({ email });
  assert.match(r.dove, /#\/google\/collega$/);
  assert.equal((await q('/api/io')).stato, 401);
});

test('annullato, email non verificata, state sbagliato o cookie mancante: nessun accesso', async () => {
  assert.match((await persona().google({ annulla: '1' })).dove, /#\/google\/annullato$/);
  assert.match((await persona().google({ email: 'x@gmail.com', verificata: '0' })).dove, /#\/google\/email$/);
  const p = persona(), a = await p('/api/google/inizia'), u = new URL(a.dove);
  u.searchParams.set('state', 'falso'); const g = await p(u.href);
  assert.match((await p(g.dove)).dove, /#\/google\/scaduto$/);
  const q = persona(), b = await q('/api/google/inizia'), g2 = await q(b.dove);
  assert.match((await persona()(g2.dove)).dove, /#\/google\/scaduto$/, 'ritorno in un altro browser');
  assert.equal((await persona()('/api/google/completa', modulo)).stato, 400);
  assert.equal((await persona()('/api/google/nuovo')).stato, 404);
});

test('account disattivato: Google non lo riapre', async () => {
  const p = persona(); const r = await p.google({ email: 'spento@gmail.com' }); assert.match(r.dove, /iscrizione$/);
  await p('/api/google/completa', { ...modulo, nome: 'Account Spento' });
  const adm = persona(); await adm('/api/accesso', { codice: 'admin-test-0000' });
  const io = (await p('/api/io')).j;
  const s = await adm(`/api/account/${io.id}`, { attivo: false });
  assert.equal(s.stato, 200, JSON.stringify(s.j));
  assert.match((await persona().google({ email: 'spento@gmail.com' })).dove, /#\/google\/disattivato$/);
});

test('LinkedIn: istanza, niente PKCE, prima volta con completamento, poi rientro diretto', async () => {
  assert.equal((await (await fetch(BASE + '/api/istanza')).json()).linkedin, true);
  const p = persona(), a = await p('/api/linkedin/inizia'), u = new URL(a.dove);
  assert.equal(u.pathname, '/__linkedin'); assert.equal(u.searchParams.get('code_challenge'), null); assert.equal(u.searchParams.get('scope'), 'openid profile email');
  assert.equal(u.searchParams.get('redirect_uri'), BASE + '/api/linkedin/ritorno');
  const q = persona(), r = await q.linkedin({ email: 'chiara.medico@outlook.it', nome: 'Chiara Medico' });
  assert.match(r.dove, /#\/linkedin\/iscrizione$/);
  assert.deepEqual((await q('/api/linkedin/nuovo')).j, { email: 'chiara.medico@outlook.it', nome: 'Chiara Medico' });
  const c = await q('/api/linkedin/completa', { ...modulo, nome: 'Chiara Medico' });
  assert.equal(c.stato, 200); assert.equal(c.j.conLinkedin, true); assert.equal(c.j.conGoogle, false);
  const z = persona(), r2 = await z.linkedin({ email: 'chiara.medico@outlook.it' });
  assert.equal(r2.dove, BASE + '/#/'); assert.equal((await z('/api/io')).j.nome, 'Chiara Medico');
  // con il nonce nel gettone: deve coincidere (il simulatore lo mette con connonce=1)
  const w = persona(); assert.equal((await w.linkedin({ email: 'chiara.medico@outlook.it', connonce: '1' })).dove, BASE + '/#/');
});

test('LinkedIn non collega da solo un account esistente con la stessa email (anche Gmail): si collega dal profilo', async () => {
  const email = 'paolo.verdi@gmail.com', p = persona();
  await p('/api/iscrizione', { nome: 'Paolo Verdi', email, password: PW, privacy: true, maggiorenne: true, categoria: 'radiologo' });
  const codice = ((await posta()).filter((m) => m.a === email).pop().testo).match(/#\/conferma\/([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/)[1];
  await p('/api/conferma', { codice });
  assert.match((await persona().linkedin({ email })).dove, /#\/linkedin\/collega$/);
  // dal profilo, già dentro: «Collega LinkedIn»
  const r = await p.google({ email }, '', 'linkedin', '?collega=1');
  assert.match(r.dove, /#\/linkedin\/collegato$/);
  assert.equal((await p('/api/io')).j.conLinkedin, true);
  const q = persona(), r2 = await q.linkedin({ email });
  assert.equal(r2.dove, BASE + '/#/'); assert.equal((await q('/api/io')).j.nome, 'Paolo Verdi');
  // anche Google si collega dal profilo (qui sarebbe automatico, ma il collegamento esplicito funziona lo stesso)
  assert.match((await p.google({ email: 'altro.indirizzo@gmail.com' }, '', 'google', '?collega=1')).dove, /#\/google\/collegato$/);
  assert.equal((await p('/api/io')).j.conGoogle, true);
});

test('collega: senza sessione si torna al profilo; un account del fornitore già usato da un altro non si collega', async () => {
  const anon = persona(), a = await anon('/api/linkedin/inizia?collega=1');
  assert.equal(a.stato, 302); assert.equal(a.dove, BASE + '/#/profilo');
  // chiara.medico@outlook.it è già di Chiara: Paolo non può collegarlo
  const email = 'paolo.verdi@gmail.com', p = persona(); assert.equal((await p('/api/accesso', { email, password: PW })).stato, 200);
  assert.match((await p.google({ email: 'chiara.medico@outlook.it' }, '', 'linkedin', '?collega=1')).dove, /#\/linkedin\/gia-usato$/);
  // il cookie del collegamento non vale in un'altra sessione
  const b = await p('/api/linkedin/inizia?collega=1'), g = await p(b.dove);
  const altro = persona(); await altro('/api/accesso', { email: 'giulia.bianchi@gmail.com', password: PW });
  assert.match((await altro(g.dove)).dove, /#\/linkedin\/scaduto$/);
});
