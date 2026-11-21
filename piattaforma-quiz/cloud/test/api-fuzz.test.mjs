// Robustezza dell'API con richieste assurde o malevole (fast-check): percorsi, metodi, corpi e identità a caso
// (nessun accesso, studente, amministratore) su tutte le rotte, attraverso il simulatore. Regole che devono valere sempre:
//  - mai un errore del server (5xx): ogni richiesta sbagliata ha una risposta chiara;
//  - mai pezzi di codice o errori interni nella risposta (percorsi .mjs, TypeError…);
//  - mai impronte di password, mai l'indirizzo email privato di un'altra persona a chi non deve vederlo.
// Se una regola si rompe, fast-check riduce la richiesta al caso più semplice e la stampa. API_GIRI=n, FC_SEME=n.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`;
const GIRI = Number(process.env.API_GIRI || 400), opz = { numRuns: GIRI, ...(process.env.FC_SEME ? { seed: Number(process.env.FC_SEME) } : {}) };
const RISERVATA = 'riservata.zeta@esempio.test';
let sim; const cookie = { nessuno: '' };
const chiama = async (chi, metodo, url, corpo) => {
  const r = await fetch(BASE + url, { method: metodo, headers: { 'content-type': 'application/json', ...(cookie[chi] ? { cookie: cookie[chi] } : {}) }, body: metodo === 'GET' || metodo === 'HEAD' ? undefined : corpo });
  return { stato: r.status, testo: await r.text(), tipo: r.headers.get('content-type') || '' };
};
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'ignore'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  const entra = async (corpo) => { const r = await fetch(BASE + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }); return r.headers.get('set-cookie')?.split(';')[0] || ''; };
  cookie.admin = await entra({ codice: 'admin-test-0000' });
  const nuovo = async (nome, extra) => { const r = await fetch(BASE + '/api/account', { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie.admin }, body: JSON.stringify({ nome, ruolo: 'specializzando', ...extra }) }); return (await r.json()).codice; };
  cookie.studente = await entra({ codice: await nuovo('Studente Fuzz') });
  await nuovo('Persona Riservata Zeta', { email: RISERVATA });
  assert.ok(cookie.admin && cookie.studente);
});
after(() => { sim?.kill(); });

const ROTTE = ['accesso', 'account', 'analisi', 'classi', 'conferma', 'docenti', 'esami', 'esci', 'impostazioni', 'io', 'iscrizione', 'istanza', 'password', 'percorsi',
  'proposte', 'referti', 'riepilogo-mensile', 'risultati', 'specializzandi', 'sponsor', 'statistiche', 'tenant', 'visita', 'casi'];
const SEGMENTI = ['confronto', 'dati', 'dimenticata', 'elimina', 'email', 'errori', 'gestione', 'invia', 'nuova', 'password', 'profilo', 'progressi', 'revisione', 'statistiche',
  'temi', 'traffico', 'tutti', 'viste', 'caso-tcia-001', 'caso-tcia-002', 'prop-a1b2c3d4', 'admin', '..', '%2e%2e', '%00', 'a'.repeat(300), 'caso-tcia-001;drop', '<script>', 'ñ€😀'];
const AZIONI = ['atteso', 'caricamento', 'completo', 'controllo', 'elimina', 'errore', 'immagini', 'risposta', 'scala', 'smonta', 'esito', 'vai'];
const percorso = fc.tuple(fc.constantFrom(...ROTTE), fc.option(fc.oneof(fc.constantFrom(...SEGMENTI), fc.string({ maxLength: 12 })), { nil: null }), fc.option(fc.constantFrom(...AZIONI), { nil: null }))
  .map(([r, s, a]) => '/api/' + [r, s, a].filter((x) => x != null).map((x) => (/^[\w.%-]*$/.test(x) ? x : encodeURIComponent(x))).join('/'));
// valori plausibili nei campi che il server legge davvero, e valori assurdi
const strano = fc.oneof(fc.string({ maxLength: 30 }), fc.integer(), fc.double(), fc.boolean(), fc.constant(null), fc.constant('x'.repeat(20000)), fc.array(fc.jsonValue(), { maxLength: 4 }),
  fc.dictionary(fc.string({ maxLength: 8 }), fc.jsonValue(), { maxKeys: 4 }), fc.constantFrom('__proto__', 'constructor', '../../etc/passwd', '<img src=x onerror=1>', "' OR 1=1 --", 'caso-tcia-001'));
const CAMPI = ['codice', 'email', 'password', 'attuale', 'nome', 'ruolo', 'scelte', 'testo', 'files', 'dati', 'casi', 'opzioni', 'visibile', 'azione', 'esito', 'motivo', 'conferma',
  'proposta', 'descrizione', 'dichiarazione', 'docenti', 'docente', 'membri', 'compiti', 'livello', 'punto', 'dettagli', 'privacy', 'maggiorenne', 'aggiungi', 'togli', 'id', 'token'];
const corpo = fc.oneof(
  fc.dictionary(fc.constantFrom(...CAMPI), strano, { maxKeys: 6 }).map((o) => JSON.stringify(o)),
  fc.jsonValue().map((v) => JSON.stringify(v)),
  fc.constantFrom('', '{', 'non json', '{"a":', '[1,2', 'null', '"testo"', '{"__proto__":{"admin":true}}', '{"constructor":{"prototype":{"admin":true}}}'),
);
const richiesta = fc.record({ chi: fc.constantFrom('nessuno', 'studente', 'admin'), metodo: fc.constantFrom('GET', 'POST', 'POST', 'PUT', 'DELETE'), url: percorso, corpo });

test(`API: ${GIRI} richieste a caso — mai errori del server né dettagli interni, sempre una risposta JSON`, async () => {
  await fc.assert(fc.asyncProperty(richiesta, async ({ chi, metodo, url, corpo: c }) => {
    const r = await chiama(chi, metodo, url, c);
    assert.ok(r.stato < 500, `${r.stato} per ${chi} ${metodo} ${url} ${String(c).slice(0, 200)} → ${r.testo.slice(0, 200)}`);
    assert.doesNotMatch(r.testo, /\.mjs:\d+|TypeError|ReferenceError|SyntaxError: |at async |Cannot read propert/, `dettagli interni in ${url}`);
    if (r.testo) assert.match(r.tipo, /json|text\/csv/, `${url}: risposta né JSON né CSV (${r.tipo})`);   // CSV: esportazione dei risultati
    assert.doesNotMatch(r.testo, /"(pw|hash|sessioneDa|bloccatoFino)"\s*:/, `${url}: campi segreti dell'account nella risposta`);
    assert.doesNotMatch(r.testo, /scrypt\$|\$scrypt|[a-f0-9]{64}:[a-f0-9]{32,}/, `${url}: impronta di una password`);
    if (chi !== 'admin') assert.ok(!r.testo.includes(RISERVATA), `${chi} ${metodo} ${url}: email privata di un'altra persona`);
  }), opz);
});
test('API: le richieste dopo il giro a caso funzionano ancora (il server non è rimasto in uno stato rotto)', async () => {
  assert.equal((await chiama('nessuno', 'GET', '/api/istanza')).stato, 200);
  assert.equal((await chiama('nessuno', 'GET', '/api/casi')).stato, 401);
  const a = await chiama('admin', 'GET', '/api/casi'); assert.ok([200, 401].includes(a.stato));
});
// 1.259: trovato con questo test. Un corpo JSON valido ma non un oggetto («null») faceva fallire l'accesso con un errore del server.
test('API: corpi «null», numeri, testi ed elenchi su accesso, iscrizione, password e risposta: errore chiaro, mai del server', async () => {
  for (const c of ['null', '5', '"testo"', '[]', '[{"codice":"admin-test-0000"}]', 'true'])
    for (const [chi, url] of [['nessuno', '/api/accesso'], ['nessuno', '/api/iscrizione'], ['nessuno', '/api/password/dimenticata'], ['nessuno', '/api/conferma'],
      ['studente', '/api/casi/caso-tcia-001/risposta'], ['studente', '/api/io/profilo'], ['admin', '/api/account']]) {
      const r = await chiama(chi, 'POST', url, c);
      assert.ok(r.stato >= 200 && r.stato < 500, `${r.stato} per ${url} con ${c}`);
      if (url === '/api/accesso') assert.notEqual(r.stato, 200, 'un elenco o un valore non è un accesso valido');
    }
});
