// Avviso ai revisori dei casi per email (27/11): solo ai revisori, al più una volta a settimana, nota dell'amministratore.
// Persone, indirizzi e casi inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const L = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../api/logica.mjs')).href);

function prepara(account, casi) {
  const acc = new Map(account.map((a) => [a.id, { ...a }])), email = [];
  const cfg = { indirizzo: 'https://esempio.test/', inviaEmail: async (a, oggetto, corpo) => { email.push({ a, oggetto, ...corpo }); },
    magazzino: { elencoAccount: async () => [...acc.values()].map((a) => ({ ...a })), scriviAccount: async (a) => { acc.set(a.id, { ...a }); },
      elencoCasi: async () => casi, elencoClassi: async () => [], risultati: async () => [], eliminaAccount: async () => {} } };
  return { cfg, acc, email };
}
const doc = (id, extra = {}) => ({ id, nome: id, email: `${id}@esempio.test`, pw: 'x', ruolo: 'docente', autore: true, ...extra });
const CASI = [
  { id: 'caso-tcia-001', titolo: 'Uno', nota_docente: 'Caso scritto da Claude, NON ancora rivisto dal medico.' },
  { id: 'caso-tcia-002', titolo: 'Due', nota_docente: 'Rivisto.', revisione: { esito: 'confermato' } },
  { id: 'caso-tcia-003', titolo: 'Tre', nota_docente: 'Nota: da verificare la misura.' },
  { id: 'caso-tcia-004', titolo: 'Quattro', nota_docente: 'NON ancora rivisto dal medico', visibile: false },
];

test('avviso ai revisori: solo i revisori, elenco dei casi da rivedere, una volta a settimana, nota e invio forzato', async () => {
  const { cfg, acc, email } = prepara([doc('rev', { revisore: true }), doc('altro'), doc('rev-spento', { revisore: true, avvisi: false }),
    { ...doc('stud', { revisore: true }), ruolo: 'specializzando' }], CASI);
  const lun = new Date('2026-11-30T07:00:00Z');
  const r = await L.avvisoRevisori(cfg, lun);
  assert.deepEqual(r, { inviati: 1, casi: 2 });
  assert.equal(email.length, 1); assert.equal(email[0].a, 'rev@esempio.test');
  assert.match(email[0].oggetto, /2 casi da rivedere/);
  assert.match(email[0].testo, /n\. 001 · Uno \(non ancora rivisto dal medico\)/);
  assert.match(email[0].testo, /n\. 003 · Tre \(dubbi aperti nella nota\)/);
  assert.doesNotMatch(email[0].testo, /Due|Quattro/);
  assert.match(email[0].testo, /https:\/\/esempio\.test\/#\/revisione/);
  assert.ok(acc.get('rev').avvisoRevisore);
  // il giorno dopo: niente (una volta a settimana)
  assert.equal((await L.avvisoRevisori(cfg, new Date('2026-12-01T07:00:00Z'))).inviati, 0);
  // invio forzato dall'amministratore, con nota: anche a chi ha spento gli avvisi automatici
  const f = await L.avvisoRevisori(cfg, new Date('2026-12-01T08:00:00Z'), { forza: true, nota: 'Domande:\n– caso 031: Bosniak?' });
  assert.equal(f.inviati, 2);
  assert.match(email.at(-1).testo, /caso 031: Bosniak\?/);
  // nessun caso da rivedere: nessuna email
  const vuoto = prepara([doc('rev', { revisore: true })], [CASI[1]]);
  assert.deepEqual(await L.avvisoRevisori(vuoto.cfg, lun), { inviati: 0, casi: 0 });
  // promemoria del lunedì: parte l'avviso
  const p = prepara([doc('rev', { revisore: true })], CASI);
  assert.equal((await L.promemoria(p.cfg, lun)).revisori, 1);
  const p2 = prepara([doc('rev', { revisore: true })], CASI);
  assert.equal((await L.promemoria(p2.cfg, new Date('2026-12-02T07:00:00Z'))).revisori, undefined, 'solo il lunedì');
});
