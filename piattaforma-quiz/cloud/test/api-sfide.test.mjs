// Sfide tra amici (22/11/2026), attraverso il simulatore: creazione, anteprima pubblica e pagina per i social, adesione con
// nome scelto e classifica facoltativa, punteggi solo dalle risposte date dopo l'adesione, limiti, chiusura, uscita e
// cancellazione dell'account. Nomi inventati.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(QUI, '../api/logica.mjs')).href);
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`;
let sim; const ck = { nessuno: '' };
const chiama = async (chi, url, corpo, metodo) => {
  const r = await fetch(BASE + url, { method: metodo || (corpo ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(ck[chi] ? { cookie: ck[chi] } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { stato: r.status, j, t, tipo: r.headers.get('content-type') || '' };
};
const CASI = ['caso-tcia-001', 'caso-tcia-002', 'caso-tcia-003', 'caso-tcia-004'];
const rispondi = (chi, caso, tempo = 30) => chiama(chi, `/api/casi/${caso}/risposta`, { scelte: [0], dettagli: { tempo } });
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  const entra = async (corpo) => { const r = await fetch(BASE + '/api/accesso', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }); return r.headers.get('set-cookie')?.split(';')[0] || ''; };
  ck.admin = await entra({ codice: 'admin-test-0000' });
  const nuovo = async (nome) => (await chiama('admin', '/api/account', { nome, ruolo: 'specializzando' })).j.codice;
  for (const [k, n] of [['ada', 'Ada Prova'], ['bea', 'Bea Prova'], ['cleo', 'Cleo Prova'], ['dino', 'Dino Prova']]) ck[k] = await entra({ codice: await nuovo(n) });
});
after(() => { sim?.kill(); });

test('regole pure: codici, fine della sfida, punteggi dalla prima risposta dopo l\'adesione', () => {
  const codici = new Set(Array.from({ length: 2000 }, L.codiceSfida));
  assert.equal(codici.size, 2000); for (const c of codici) assert.match(c, L.CODICE_SFIDA);
  const s = { codice: 'ABCDEFGH', casi: ['a', 'b'], creata: '2026-11-22 10:00', scadenza: '' };
  assert.equal(L.fineSfida(s), '2027-02-20 10:00', '90 giorni senza scadenza');
  assert.equal(L.fineSfida({ ...s, scadenza: '2026-11-30' }), '2026-11-30 22:59', 'fine del giorno in Italia (ora solare)');
  assert.equal(L.sfidaAperta({ ...s, chiusa: true }, '2026-11-23 00:00'), false);
  const righe = [
    { account: 'x', caso: 'a', data: '2026-11-22 09:00', punteggio: 100 },            // prima dell'adesione: non conta
    { account: 'x', caso: 'a', data: '2026-11-22 11:00', punteggio: 40, dettagli: { tempo: 50 } },
    { account: 'x', caso: 'a', data: '2026-11-22 12:00', punteggio: 100 },            // secondo tentativo: non conta
    { account: 'x', caso: 'b', data: '2027-03-01 00:00', punteggio: 100 },            // dopo la fine: non conta
    { account: 'y', caso: 'a', data: '2026-11-22 11:00', punteggio: 80, dettagli: { tempo: 20 } },
    { account: 'y', caso: 'b', data: '2026-11-22 11:05', punteggio: 60, dettagli: { tempo: 20 } }];
  const p = L.punteggiSfida(s, [{ account: 'x', nome: 'X', dal: '2026-11-22 10:30' }, { account: 'y', nome: 'Y', classifica: true, dal: '2026-11-22 10:30' }], righe);
  assert.deepEqual(p.map((x) => [x.account, x.fatti, x.media, x.tempo, x.finito]), [['y', 2, 70, 40, true], ['x', 1, 20, 50, false]]);
  assert.deepEqual(p[1].casi, { a: 40 });
});

test('durata in ore o in giorni: da 1 ora a 90 giorni', () => {
  assert.equal(L.minutiDurata(1, 'ore'), 60); assert.equal(L.minutiDurata(3, 'giorni'), 4320); assert.equal(L.minutiDurata(2160, 'ore'), 129600);
  for (const [d, u] of [[0, 'ore'], [2161, 'ore'], [91, 'giorni'], [1.5, 'ore'], ['x', 'giorni'], [3, 'settimane']]) assert.equal(L.minutiDurata(d, u), null, `${d} ${u}`);
  const s = { casi: ['a'], creata: '2026-11-22 10:00', fine: '2026-11-22 13:00' };
  assert.equal(L.fineSfida(s), '2026-11-22 13:00'); assert.equal(L.sfidaAperta(s, '2026-11-22 12:59'), true); assert.equal(L.sfidaAperta(s, '2026-11-22 13:00'), false);
});

test('senza accesso: anteprima pubblica senza dati di chi gioca, pagina per i social; le altre rotte chiedono l\'accesso', async () => {
  assert.equal((await chiama('nessuno', '/api/sfide')).stato, 401);
  assert.equal((await chiama('nessuno', '/api/sfide', { titolo: 'x', casi: CASI })).stato, 401);
  assert.equal((await chiama('nessuno', '/api/sfide/ABCDEFGH/anteprima')).stato, 404);
  const s404 = await chiama('nessuno', '/s/ABCDEFGH'); assert.equal(s404.stato, 404); assert.match(s404.tipo, /text\/html/);
  assert.equal((await chiama('admin', '/api/sfide', { titolo: 'Sfida admin', casi: CASI.slice(0, 3) })).stato, 403, 'l\'amministratore non gioca');
});

test('creazione, adesione, classifica facoltativa, punteggi, chiusura, uscita', async () => {
  assert.equal((await chiama('ada', '/api/sfide', { titolo: 'Torace', casi: CASI.slice(0, 2) })).stato, 400, 'meno di 3 casi');
  assert.equal((await chiama('ada', '/api/sfide', { titolo: 'x', casi: CASI.slice(0, 3) })).stato, 400, 'titolo troppo corto');
  assert.equal((await chiama('ada', '/api/sfide', { titolo: 'Torace', casi: [...CASI.slice(0, 2), 'caso-che-non-esiste'] })).stato, 400, 'casi inesistenti scartati');
  assert.equal((await chiama('ada', '/api/sfide', { titolo: 'Torace', casi: CASI.slice(0, 3), scadenza: '2020-01-01' })).stato, 400, 'scadenza passata');
  assert.equal((await chiama('ada', '/api/sfide', { titolo: 'Torace', casi: CASI.slice(0, 3), durata: 91, unita: 'giorni' })).stato, 400, 'più di 90 giorni');
  const breve = await chiama('ada', '/api/sfide', { titolo: 'Sfida lampo', casi: CASI.slice(0, 3), durata: 2, unita: 'ore' });
  assert.equal(breve.stato, 200); const ms = Date.parse(breve.j.fine.replace(' ', 'T') + ':00Z') - Date.now();
  assert.ok(ms > 118 * 60000 && ms <= 120 * 60000, 'chiude tra 2 ore');
  assert.equal((await chiama('nessuno', '/s/' + breve.j.codice, null, 'HEAD')).stato, 200, 'HEAD sulla pagina per i social');
  const cr = await chiama('ada', '/api/sfide', { titolo: 'Sfida "torace" & addome di Ada <b>', casi: [...CASI.slice(0, 3), CASI[0]] });
  assert.equal(cr.stato, 200); const c = cr.j.codice; assert.match(c, L.CODICE_SFIDA); assert.equal(cr.j.n, 3, 'casi doppi tolti');
  assert.ok(cr.j.link.endsWith('/s/' + c));
  // anteprima: titolo ripulito, esami senza diagnosi, nessun nome
  const an = await chiama('nessuno', `/api/sfide/${c.toLowerCase()}/anteprima`);
  assert.equal(an.stato, 200); assert.equal(an.j.casi.length, 3); assert.equal(an.j.partecipanti, 0); assert.ok(!/<b>/.test(an.j.titolo));
  assert.deepEqual(Object.keys(an.j).sort(), ['aperta', 'casi', 'codice', 'fine', 'partecipanti', 'titolo']);
  for (const x of an.j.casi) assert.deepEqual(Object.keys(x).sort(), ['distretto', 'modalita', 'titolo']);
  const og = await chiama('nessuno', '/s/' + c);
  assert.equal(og.stato, 200); assert.match(og.t, /<meta property="og:title" content="Sfida: Sfida &quot;torace&quot; &amp; addome di Ada b">/);
  assert.match(og.t, /og:image" content="[^"]+\/img\/sfida\.jpg"/); assert.match(og.t, new RegExp(`url=[^"]+/#/sfida/${c}"`)); assert.ok(!/Ada Prova/.test(og.t));
  // (le risposte date prima di accettare non contano: vedi le regole pure; l'ora delle risposte ha la precisione del minuto)
  assert.equal((await chiama('bea', `/api/sfide/${c}/partecipa`, { nome: '', classifica: true })).stato, 400, 'in classifica serve un nome');
  const pb = await chiama('bea', `/api/sfide/${c}/partecipa`, { nome: 'Bea la Rossa', classifica: true }); assert.equal(pb.stato, 200);
  assert.equal((await chiama('cleo', `/api/sfide/${c}/partecipa`, { nome: 'Cleo', classifica: false })).stato, 200);
  let b = (await chiama('bea', '/api/sfide/' + c)).j;
  assert.equal(b.io.fatti, 0); assert.equal(b.partecipanti, 2);
  for (const k of CASI.slice(0, 2)) assert.equal((await rispondi('bea', k, 40)).stato, 200);
  await rispondi('cleo', CASI[0]);
  b = (await chiama('bea', '/api/sfide/' + c)).j;
  assert.equal(b.io.fatti, 2); assert.equal(b.io.tempo, 80); assert.equal(b.io.finito, false);
  assert.deepEqual(Object.keys(b.io.casi).sort(), CASI.slice(0, 2));
  const a = (await chiama('ada', '/api/sfide/' + c)).j;
  assert.equal(a.creatore, true); assert.equal(a.io, null, 'chi crea non partecipa finché non accetta');
  assert.deepEqual(a.classifica.map((x) => x.nome), ['Bea la Rossa'], 'in classifica solo chi lo ha scelto');
  assert.deepEqual(Object.keys(a.classifica[0]).sort(), ['fatti', 'media', 'nome', 'tempo'], 'niente risposte né account');
  assert.ok(!JSON.stringify(a).includes('Cleo'));
  const c2 = (await chiama('cleo', '/api/sfide/' + c)).j; assert.equal(c2.io.fatti, 1); assert.equal(c2.io.classifica, false);
  // elenco delle mie sfide
  assert.deepEqual((await chiama('ada', '/api/sfide')).j.map((x) => [x.codice, x.creatore]).sort(), [[c, true], [breve.j.codice, true]].sort());
  assert.deepEqual((await chiama('bea', '/api/sfide')).j.map((x) => [x.codice, x.creatore, x.mio.fatti]), [[c, false, 2]]);
  // i miei dati: la partecipazione c'è
  const dati = await chiama('bea', '/api/io/dati'); assert.match(dati.t, /Bea la Rossa/);
  // chiusura: solo chi l'ha creata; poi nessuno entra più, chi c'è può cambiare nome
  assert.equal((await chiama('bea', `/api/sfide/${c}/chiudi`, {})).stato, 403);
  assert.equal((await chiama('ada', `/api/sfide/${c}/chiudi`, {})).stato, 200);
  assert.equal((await chiama('nessuno', `/api/sfide/${c}/anteprima`)).j.aperta, false);
  assert.equal((await chiama('dino', `/api/sfide/${c}/partecipa`, { nome: 'Dino', classifica: true })).stato, 400);
  assert.equal((await chiama('bea', `/api/sfide/${c}/partecipa`, { nome: 'B.', classifica: true })).stato, 200);
  // uscita: via dalla classifica e dall'elenco
  assert.equal((await chiama('bea', `/api/sfide/${c}/lascia`, {})).stato, 200);
  assert.deepEqual((await chiama('ada', '/api/sfide/' + c)).j.classifica, []);
  assert.deepEqual((await chiama('bea', '/api/sfide')).j, []);
});

test('limite di sfide al giorno; cancellazione dell\'account: fuori dalle classifiche', async () => {
  const fatte = []; let r;
  for (let i = 0; i < L.SFIDE_AL_GIORNO + 1; i++) { r = await chiama('dino', '/api/sfide', { titolo: 'Prova ' + i, casi: CASI.slice(0, 3) }); if (r.stato === 200) fatte.push(r.j.codice); }
  assert.equal(fatte.length, L.SFIDE_AL_GIORNO); assert.equal(r.stato, 429);
  const c = fatte[0];
  assert.equal((await chiama('cleo', `/api/sfide/${c}/partecipa`, { nome: 'Cleo C', classifica: true })).stato, 200);
  assert.deepEqual((await chiama('dino', '/api/sfide/' + c)).j.classifica.map((x) => x.nome), ['Cleo C']);
  assert.equal((await chiama('cleo', '/api/io/elimina', { password: '' })).stato, 200);
  const d = (await chiama('dino', '/api/sfide/' + c)).j; assert.deepEqual(d.classifica, []); assert.equal(d.partecipanti, 0);
});
