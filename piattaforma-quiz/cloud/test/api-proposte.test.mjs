// Casi proposti dagli iscritti: il server non lascia pubblicare una proposta senza il controllo dell'anonimato
// fatto dal docente (intestazioni di tutti i file e testo impresso) con esito positivo. Attraverso il simulatore.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { portaLibera } from './porta.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const PORTA = await portaLibera(), BASE = `http://localhost:${PORTA}`;
let sim;
function persona() {
  let cookie = '';
  return async (url, corpo) => {
    const r = await fetch(BASE + url, { method: corpo ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    return { stato: r.status, j };
  };
}
const admin = persona(), studente = persona(), altro = persona();
before(async () => {
  sim = spawn(process.execPath, [path.join(QUI, 'simulatore.mjs')], { env: { ...process.env, PORTA: String(PORTA) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('simulatore non partito')), 90000); sim.stdout.on('data', (d) => { if (/pronto/.test(d)) { clearTimeout(t); ok(); } }); });
  assert.equal((await admin('/api/accesso', { codice: 'admin-test-0000' })).stato, 200);
  for (const [p, nome] of [[studente, 'Studente Proponente'], [altro, 'Altro Iscritto']]) {
    const r = await admin('/api/account', { nome, ruolo: 'specializzando' }); assert.equal(r.stato, 200);
    assert.equal((await p('/api/accesso', { codice: r.j.codice })).stato, 200);
  }
});
after(() => { sim?.kill(); });

const ID = 'prop-a1b2c3d4';
// proposta completa come la fa il browser: URL firmati, serie.json caricato, poi la descrizione con la dichiarazione
async function proponi(p, id) {
  const u = await p(`/api/casi/${id}/caricamento`, { proposta: true, files: ['serie.json', 'serie/s1/a.dcm'] });
  if (u.stato !== 200) return u;
  await fetch(u.j.urls['serie.json'], { method: 'PUT', body: JSON.stringify([{ descrizione: 'TC torace', files: ['serie/s1/a.dcm'] }]) });
  return p(`/api/casi/${id}`, { proposta: true, titolo: 'Nodulo polmonare', modalita: 'TC', distretto: 'Torace', descrizione: 'Nodulo di 8 mm nel lobo superiore destro, da confrontare.', dichiarazione: true });
}
const pubblica = (extra = {}) => admin(`/api/casi/${ID}`, { titolo: 'Nodulo polmonare', modalita: 'TC', distretto: 'Torace', visibile: true,
  domanda: 'Quali reperti?', opzioni: [{ testo: 'Nodulo polmonare', corretta: true }, { testo: 'Versamento pleurico' }], ...extra });

test('proposta: servono immagini, una descrizione e la dichiarazione su anonimato e autorizzazione', async () => {
  assert.equal((await studente(`/api/casi/prop-00000000`, { proposta: true, descrizione: 'x'.repeat(30), dichiarazione: true })).j.errore, 'carica prima le immagini');
  const u = await studente(`/api/casi/${ID}/caricamento`, { proposta: true, files: ['serie.json', 'serie/s1/a.dcm'] }); assert.equal(u.stato, 200);
  await fetch(u.j.urls['serie.json'], { method: 'PUT', body: JSON.stringify([{ descrizione: 'TC torace', files: ['serie/s1/a.dcm'] }]) });
  assert.equal((await studente(`/api/casi/${ID}`, { proposta: true, descrizione: 'corta', dichiarazione: true })).stato, 400);
  assert.equal((await studente(`/api/casi/${ID}`, { proposta: true, descrizione: 'Descrizione abbastanza lunga del caso.' })).stato, 400, 'senza dichiarazione');
  const r = await studente(`/api/casi/${ID}`, { proposta: true, titolo: 'Nodulo polmonare', descrizione: 'Nodulo di 8 mm nel lobo superiore destro, da confrontare.', dichiarazione: true });
  assert.deepEqual(r.j, { ok: true, creato: true, proposta: true });
  assert.equal((await studente(`/api/casi/${ID}/caricamento`, { proposta: true, files: ['serie.json'] })).stato, 409, 'codice già usato');
});

test('proposta: l\'iscritto vede solo le sue; non può registrare il controllo né pubblicare', async () => {
  assert.deepEqual((await studente('/api/proposte')).j.map((x) => [x.id, x.stato]), [[ID, 'in attesa']]);
  assert.deepEqual((await altro('/api/proposte')).j, [], 'le proposte degli altri non si vedono');
  assert.equal((await studente(`/api/proposte/${ID}`, { azione: 'controllo', esito: 'ok', file: 1 })).stato, 403);
  assert.equal((await studente(`/api/casi/${ID}`, { titolo: 'X', visibile: true, opzioni: [{ testo: 'a', corretta: true }, { testo: 'b' }] })).stato, 404, 'caso nascosto: per chi non è autore «non trovato», senza dire che esiste');
  const elenco = (await altro('/api/casi')).j; assert.ok(!elenco.some((c) => c.id === ID), 'la proposta non è visibile agli altri iscritti');
});

test('pubblicazione bloccata senza controllo, con un controllo con problemi, con un «ok» senza file o dopo l\'aggiunta di immagini; consentita dopo un controllo positivo', async () => {
  const lista = (await admin('/api/proposte')).j.find((x) => x.id === ID); assert.equal(lista.stato, 'in attesa'); assert.equal(lista.nome, 'Studente Proponente');
  let r = await pubblica(); assert.equal(r.stato, 400); assert.match(r.j.errore, /controlla l'anonimato/);
  r = await admin(`/api/proposte/${ID}`, { azione: 'controllo', esito: 'problemi', file: 1, immagini: 1, problemi: ['campo paziente (x00100030)'] });
  assert.equal(r.j.controllo.esito, 'problemi'); assert.deepEqual(r.j.controllo.problemi, ['campo paziente (x00100030)']);
  assert.equal((await pubblica()).stato, 400, 'controllo con problemi: niente pubblicazione');
  assert.equal((await admin(`/api/proposte/${ID}`, { azione: 'controllo', esito: 'ok', file: 0 })).stato, 400, '«ok» senza file controllati');
  assert.equal((await admin(`/api/proposte/${ID}`, { azione: 'controllo', esito: 'qualsiasi', file: 3 })).j.controllo.esito, 'problemi', 'un esito diverso da ok vale «problemi»');
  assert.equal((await pubblica()).stato, 400);
  r = await admin(`/api/proposte/${ID}`, { azione: 'controllo', esito: 'ok', file: 1, immagini: 1, zone: 0 }); assert.equal(r.j.controllo.esito, 'ok');
  assert.equal((await pubblica({ opzioni: [{ testo: 'Solo una', corretta: true }] })).stato, 400, 'anche dopo il controllo servono 2 opzioni');
  // immagini aggiunte dopo il controllo: il controllo si annulla e va rifatto (le immagini nuove non sono state guardate)
  assert.equal((await admin(`/api/casi/${ID}/immagini`, { aggiungi: [{ descrizione: 'RX torace', files: ['serie/s2/b.dcm'] }] })).stato, 200);
  r = await pubblica(); assert.equal(r.stato, 400, 'dopo l\'aggiunta di immagini il vecchio controllo non vale più'); assert.match(r.j.errore, /controlla l'anonimato/);
  assert.equal((await admin(`/api/proposte/${ID}`, { azione: 'controllo', esito: 'ok', file: 2, immagini: 2, zone: 0 })).j.controllo.esito, 'ok');
  r = await pubblica(); assert.equal(r.stato, 200, JSON.stringify(r.j));
  assert.deepEqual((await studente('/api/proposte')).j.map((x) => [x.id, x.stato]), [[ID, 'approvata']], 'chi ha proposto vede l\'esito');
  assert.ok((await altro('/api/casi')).j.some((c) => c.id === ID), 'ora il caso è visibile');
});

test('proposta rifiutata: serve un motivo, la vede chi l\'ha proposta, resta nascosta; al massimo 5 proposte in attesa per persona', async () => {
  const id = 'prop-e5f6a7b8'; assert.equal((await proponi(altro, id)).stato, 200);
  assert.equal((await admin(`/api/proposte/${id}`, { azione: 'rifiuta' })).stato, 400, 'senza motivo');
  assert.equal((await admin(`/api/proposte/${id}`, { azione: 'boh' })).stato, 400);
  assert.equal((await admin(`/api/proposte/${id}`, { azione: 'rifiuta', motivo: 'Si legge il nome nelle immagini.' })).stato, 200);
  const mia = (await altro('/api/proposte')).j.find((x) => x.id === id); assert.equal(mia.stato, 'rifiutata'); assert.equal(mia.motivo, 'Si legge il nome nelle immagini.');
  for (let i = 0; i < 5; i++) assert.equal((await proponi(altro, `prop-0000000${i}`)).stato, 200, `proposta ${i + 1}`);
  const sesta = await proponi(altro, 'prop-00000009'); assert.equal(sesta.stato, 429); assert.match(sesta.j.errore, /5 proposte in attesa/);
});
