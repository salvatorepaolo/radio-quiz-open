#!/usr/bin/env python3
"""27/11: email ai revisori dei casi.
- avvisoRevisori(cfg, oggi, {forza, nota}): a ogni revisore (docente autore con revisore: true, email, attivo, avvisi non spenti)
  l'elenco dei casi da rivedere con il link alla pagina «Casi da rivedere»; al più una volta ogni 7 giorni (campo avvisoRevisore),
  salvo forza. Nessuna email se non ci sono casi da rivedere.
- promemoria: il lunedì manda l'avviso automatico.
- POST /api/revisione/avvisa (solo amministratore) {nota?}: invio subito, con una nota facoltativa (domande per il medico).
- lambda: avvisoRevisore tra i campi salvati dell'account."""
import pathlib
B = pathlib.Path('/Volumes/Caloggero/piattaforma-quiz/cloud')
L = B / 'api/logica.mjs'; s = L.read_text()
if 'avvisoRevisori' in s: print('gia'); raise SystemExit

def sost(v, n, c=1):
    global s
    k = s.count(v)
    if k != c: raise SystemExit(f'atteso {c}, trovato {k}: {v[:80]!r}')
    s = s.replace(v, n)

# 1) funzione, dopo emailSettimana
sost("const PIEDE_DOCENTE = 'Ricevi questo messaggio perché sei docente su Quiz Radiologia.",
"""/** Avviso ai revisori dei casi (27/11): elenco dei casi da rivedere (stesso criterio della pagina «Casi da rivedere»),
 *  al più una volta ogni 7 giorni per revisore salvo forza; nota facoltativa dell'amministratore (domande per il medico). */
export async function avvisoRevisori(cfg, oggi = new Date(), { forza = false, nota = '' } = {}) {
  const M = cfg.magazzino;
  if (!cfg.inviaEmail) return { inviati: 0, casi: 0 };
  const casi = (await M.elencoCasi()).filter((c) => c.visibile !== false).map((c) => ({ c, motivo: motivoRevisione(c) }))
    .filter((x) => x.motivo && x.c.revisione?.esito !== 'confermato').sort((a, b) => (a.c.id < b.c.id ? -1 : 1));
  if (!casi.length) return { inviati: 0, casi: 0 };
  const sito = radice(cfg.indirizzo), soglia = new Date(oggi.getTime() - 6.5 * 86400000).toISOString().slice(0, 16).replace('T', ' ');
  const testoNota = String(nota || '').slice(0, 4000).split('\\n').map((r) => r.trimEnd());
  let inviati = 0;
  for (const a of await M.elencoAccount()) {
    if (!a.revisore || !a.autore || a.ruolo !== 'docente' || !a.email || a.attivo === false || a.stato === 'attesa') continue;
    if (!forza && (a.avvisi === false || (a.avvisoRevisore && a.avvisoRevisore > soglia))) continue;
    const r = [`Ciao ${a.nome},`, casi.length === 1 ? 'c\\'è 1 caso in attesa della tua revisione medica su Quiz Radiologia:'
      : `ci sono ${casi.length} casi in attesa della tua revisione medica su Quiz Radiologia:`];
    casi.slice(0, 25).forEach((x) => r.push(`   – n. ${x.c.id.replace(/^caso-tcia-/, '')} · ${x.c.titolo || x.c.id} (${x.motivo})`));
    if (casi.length > 25) r.push(`   – … e altri ${casi.length - 25}`);
    if (testoNota.some(Boolean)) r.push('', ...testoNota);
    r.push('', 'Per ogni caso: aprilo dalla pagina «Casi da rivedere», controlla immagini, risposte e spiegazione, poi «Confermo» oppure «Da correggere» con una nota.');
    try {
      await cfg.inviaEmail(a.email, `Quiz Radiologia: ${casi.length} ${casi.length === 1 ? 'caso' : 'casi'} da rivedere`, corpoEmail(r, `${sito}/#/revisione`,
        { pulsante: 'Apri i casi da rivedere', piede: 'Ricevi questo messaggio perché sei revisore dei casi di Quiz Radiologia. Puoi disattivare gli avvisi per email dal tuo profilo («Il mio profilo»).' }));
      await M.scriviAccount({ ...a, avvisoRevisore: oggi.toISOString().slice(0, 16).replace('T', ' ') }); inviati++;
    } catch (e) { console.error('revisori', e?.message || e); }
  }
  return { inviati, casi: casi.length };
}
const PIEDE_DOCENTE = 'Ricevi questo messaggio perché sei docente su Quiz Radiologia.""")

# 2) promemoria: il lunedì
sost("""  const riepiloghi = oggi.getUTCDay() === 1 ? await riepilogoDocenti(cfg, oggi) : 0;
  return { inviati, cancellati, riepiloghi, settimana };""",
"""  const riepiloghi = oggi.getUTCDay() === 1 ? await riepilogoDocenti(cfg, oggi) : 0;
  const revisori = oggi.getUTCDay() === 1 ? (await avvisoRevisori(cfg, oggi).catch((e) => { console.error('revisori', e?.message || e); return { inviati: 0 }; })).inviati : 0;
  return { inviati, cancellati, riepiloghi, settimana, ...(revisori ? { revisori } : {}) };""")

# 3) endpoint
sost("""  // ---------------- casi
  if (parti[1] !== 'casi') return json(404, { errore: 'non trovato' });""",
"""  // avviso ai revisori per email, subito (solo amministratore), con nota facoltativa
  if (parti[1] === 'revisione' && parti[2] === 'avvisa' && parti.length === 3 && metodo === 'POST') {
    if (!admin) return json(403, { errore: 'solo l\\'amministratore' });
    return json(200, await avvisoRevisori(cfg, new Date(), { forza: true, nota: String(dati?.nota || '') }));
  }

  // ---------------- casi
  if (parti[1] !== 'casi') return json(404, { errore: 'non trovato' });""")
L.write_text(s)

# 4) lambda
F = B / 'api/lambda.mjs'; t = F.read_text()
v = "'settimana', 'settimanaInviata'];"
assert t.count(v) == 1
F.write_text(t.replace(v, "'settimana', 'settimanaInviata', 'avvisoRevisore'];"))

# 5) test
T = B / 'test/api-revisori.test.mjs'
T.write_text(r"""// Avviso ai revisori dei casi per email (27/11): solo ai revisori, al più una volta a settimana, nota dell'amministratore.
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
""")
print('ok')
