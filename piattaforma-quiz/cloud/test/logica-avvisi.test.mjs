// Conservazione dei dati, promemoria e riepiloghi per email (api/logica.mjs), con un magazzino in memoria e
// un invio di email finto che registra i messaggi. Sono gli impegni scritti nell'informativa sulla privacy:
//  - le iscrizioni mai confermate si cancellano dopo una settimana;
//  - un account inattivo da 24 mesi si cancella, ma SOLO dopo l'avviso inviato al 23° mese; le risposte restano anonime;
//  - nella piattaforma di un'azienda non si cancella nulla da soli (decide l'amministratore).
// Persone, indirizzi e casi inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const L = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../api/logica.mjs')).href);

const MERCOLEDI = new Date('2026-06-10T08:00:00Z'), LUNEDI = new Date('2026-06-15T08:00:00Z'), PRIMO_LUNEDI = new Date('2026-06-01T08:00:00Z');
const fa = (oggi, giorni) => new Date(oggi.getTime() - giorni * 86400000).toISOString().slice(0, 16).replace('T', ' ');
const giorno = (oggi, n) => new Date(oggi.getTime() + n * 86400000).toISOString().slice(0, 10);
function prepara({ account = [], risultati = [], classi = [], casi = [], azienda = false } = {}) {
  const acc = new Map(account.map((a) => [a.id, { ...a }])), ris = risultati.map((r) => ({ ...r })), email = [];
  const magazzino = {
    elencoAccount: async () => [...acc.values()].map((a) => ({ ...a })), scriviAccount: async (a) => { acc.set(a.id, { ...a }); },
    eliminaAccount: async (id) => { acc.delete(id); },
    anonimizzaRisultati: async (id) => { for (const r of ris) if (r.account === id) { r.account = 'eliminato'; r.nome = 'Account eliminato'; } },
    elencoClassi: async () => classi, risultati: async () => ris, elencoCasi: async () => casi,
  };
  const cfg = { magazzino, indirizzo: 'https://esempio.test/', inviaEmail: async (a, oggetto, corpo) => { email.push({ a, oggetto, ...corpo }); },
    ...(azienda ? { istanza: { modo: 'azienda', nome: 'Azienda di prova' } } : {}) };
  return { cfg, acc, ris, email };
}
const persona = (id, extra = {}) => ({ id, nome: id.toUpperCase(), email: `${id}@esempio.test`, pw: 'impronta', ruolo: 'specializzando', ...extra });

test('conservazione: iscrizioni non confermate cancellate dopo una settimana, account inattivi solo dopo l\'avviso, risposte anonime', async () => {
  const oggi = MERCOLEDI, ms = (g) => oggi.getTime() - g * 86400000;
  const { cfg, acc, ris, email } = prepara({
    account: [
      persona('attesa-vecchia', { stato: 'attesa', pw: '', conferma: { scad: ms(6) } }),     // link scaduto da 6 giorni (iscritta da 8)
      persona('attesa-recente', { stato: 'attesa', pw: '', conferma: { scad: ms(4) } }),
      persona('inattivo-avvisato', { ultimoAccesso: fa(oggi, 25 * 30.44), avvisoInattivo: fa(oggi, 35) }),
      persona('inattivo-mai-avvisato', { ultimoAccesso: fa(oggi, 25 * 30.44) }),           // oltre 24 mesi ma senza avviso: NON si cancella
      persona('quasi-inattivo', { ultimoAccesso: fa(oggi, 23.5 * 30.44) }),
      persona('attivo', { ultimoAccesso: fa(oggi, 10) }),
      persona('invitato', { pw: '', creato: fa(oggi, 900) }),                                  // senza password: non si tocca
    ],
    risultati: [{ account: 'inattivo-avvisato', nome: 'INATTIVO-AVVISATO', caso: 'c1', punteggio: 80 }, { account: 'attivo', nome: 'ATTIVO', caso: 'c1', punteggio: 50 }],
  });
  const esito = await L.promemoria(cfg, oggi);
  assert.equal(esito.cancellati, 2);
  assert.deepEqual([...acc.keys()].sort(), ['attesa-recente', 'attivo', 'inattivo-mai-avvisato', 'invitato', 'quasi-inattivo']);
  assert.deepEqual(ris.map((r) => [r.account, r.nome]), [['eliminato', 'Account eliminato'], ['attivo', 'ATTIVO']], 'risposte rese anonime, le altre intatte');
  assert.deepEqual(email.map((e) => e.a).sort(), ['inattivo-mai-avvisato@esempio.test', 'quasi-inattivo@esempio.test'], 'avviso prima della cancellazione');
  assert.ok(email.every((e) => /verrà cancellato/.test(e.testo) && /forma anonima/.test(e.testo)));
  assert.ok(acc.get('quasi-inattivo').avvisoInattivo && acc.get('inattivo-mai-avvisato').avvisoInattivo, 'avviso registrato');
  // il mese dopo, chi è stato avvisato e non è rientrato viene cancellato
  const dopo = new Date(oggi.getTime() + 31 * 86400000);
  const ancora = await L.promemoria(cfg, dopo);
  assert.ok(!acc.has('inattivo-mai-avvisato') && ancora.cancellati >= 1);
});
test('conservazione: nella piattaforma di un\'azienda nessun account si cancella da solo per inattività', async () => {
  const { cfg, acc, email } = prepara({ azienda: true, account: [persona('vecchio', { ultimoAccesso: fa(MERCOLEDI, 30 * 30.44), avvisoInattivo: fa(MERCOLEDI, 60) })] });
  const esito = await L.promemoria(cfg, MERCOLEDI);
  assert.equal(esito.cancellati, 0); assert.ok(acc.has('vecchio')); assert.equal(email.length, 0);
});
test('promemoria: due giorni prima della scadenza, solo a chi non ha finito, segue il docente e vuole gli avvisi', async () => {
  const oggi = MERCOLEDI, scad = giorno(oggi, 2);
  const casi = [{ id: 'c1', titolo: 'Polmonite lobare' }, { id: 'c2', titolo: 'Pneumotorace' }, { id: 'c3', titolo: 'Versamento' }];
  const classi = [{ id: 'k', nome: 'Torace 1', proprietario: 'doc', membri: ['finito', 'a-meta', 'senza-avvisi', 'ha-cambiato-docente'],
    compiti: [{ titolo: 'Urgenze del torace', casi: ['c1', 'c2', 'c3'], scadenza: scad }, { titolo: 'Altro', casi: ['c1'], scadenza: giorno(oggi, 5) }] }];
  const recente = { ultimoAccesso: fa(oggi, 1), docenti: ['doc'] };
  const { cfg, email } = prepara({ casi, classi,
    account: [persona('finito', recente), persona('a-meta', recente), persona('senza-avvisi', { ...recente, avvisi: false }), persona('ha-cambiato-docente', { ultimoAccesso: fa(oggi, 1), docenti: ['altro'] })],
    risultati: [...['c1', 'c2', 'c3'].map((c) => ({ account: 'finito', caso: c, punteggio: 90, data: fa(oggi, 3) })), { account: 'a-meta', caso: 'c2', punteggio: 40, data: fa(oggi, 2) }] });
  const esito = await L.promemoria(cfg, oggi);
  assert.equal(esito.inviati, 1); assert.equal(email.length, 1);
  const [m] = email;
  assert.equal(m.a, 'a-meta@esempio.test');
  assert.equal(m.oggetto, `Promemoria: «Urgenze del torace» scade il ${scad.split('-').reverse().join('/')}`);
  assert.match(m.testo, /hai svolto 1 casi su 3/); assert.match(m.testo, /Polmonite lobare/); assert.match(m.testo, /Versamento/); assert.doesNotMatch(m.testo, /Pneumotorace/);
});
test('riepilogo del lunedì ai docenti: attività della settimana, chi è fermo, compiti in scadenza; il primo lunedì del mese anche il mese', async () => {
  const dati = (oggi) => prepara({
    casi: [{ id: 'c1', titolo: 'Caso uno', visibile: true }, { id: 'c2', titolo: 'Caso due', visibile: true }],
    classi: [{ id: 'k', nome: 'Gruppo A', proprietario: 'doc', membri: ['s1', 's2'], compiti: [{ titolo: 'Ripasso', casi: ['c1'], scadenza: giorno(oggi, 3) }] }],
    account: [persona('doc', { ruolo: 'docente' }), persona('doc-muto', { ruolo: 'docente', avvisi: false }), persona('doc-solo', { ruolo: 'docente' }),
      persona('s1', { docenti: ['doc', 'doc-muto'] }), persona('s2', { docenti: ['doc'] })],
    risultati: [{ account: 's1', caso: 'c1', punteggio: 100, data: fa(oggi, 2) }, { account: 's1', caso: 'c2', punteggio: 50, data: fa(oggi, 1) }, { account: 's2', caso: 'c2', punteggio: 10, data: fa(oggi, 40) }] });
  const a = dati(LUNEDI);
  assert.equal(await L.riepilogoDocenti(a.cfg, LUNEDI), 1, 'solo il docente con studenti e avvisi attivi');
  const t = a.email[0].testo;
  assert.equal(a.email[0].a, 'doc@esempio.test');
  assert.match(t, /• S1: 2 casi, punteggio medio 75%\./); assert.match(t, /Nessun caso questa settimana: S2\./);
  assert.match(t, /«Ripasso» \(Gruppo A\) scade il .*: completato da 1 su 2\./);
  assert.doesNotMatch(t, /Il mese in breve/);
  const b = dati(PRIMO_LUNEDI);
  await L.riepilogoDocenti(b.cfg, PRIMO_LUNEDI);
  assert.match(b.email[0].testo, /Il mese in breve/); assert.match(b.email[0].testo, /Fermi da 30 giorni: S2/);
  // promemoria del lunedì: include il riepilogo
  assert.equal((await L.promemoria(dati(LUNEDI).cfg, LUNEDI)).riepiloghi, 1);
});
test('email: nomi e titoli scritti dagli utenti restano testo anche nell\'HTML; link, scadenze e conteggi giusti', () => {
  const [ogg, c] = L.testoConferma('<b>Mario</b>', 'https://esempio.test///', 'COD123');
  assert.equal(ogg, 'Conferma la tua iscrizione a Quiz Radiologia');
  assert.ok(c.html.includes('Ciao &lt;b&gt;Mario&lt;/b&gt;,') && !c.html.includes('<b>Mario'));
  assert.ok(c.testo.includes('https://esempio.test/#/conferma/COD123') && /48 ore/.test(c.testo));
  const titoli = new Map(Array.from({ length: 10 }, (_, i) => [`c${i}`, `Caso «${i}» <script>`]));
  const [o1, e1] = L.testoAssegnazione({ nome: 'Ada' }, { nome: 'Classe "A"' }, [{ titolo: 'Torace', casi: [...titoli.keys()], scadenza: '2026-07-01' }], titoli, 'https://esempio.test', 'Dr. Rossi');
  assert.equal(o1, 'Nuovo compito: Torace');
  assert.match(e1.testo, /Dr\. Rossi ti ha assegnato un nuovo compito nella classe «Classe "A"»/);
  assert.match(e1.testo, /10 casi, da completare entro il 01\/07\/2026/); assert.match(e1.testo, /… e altri 2/);
  assert.ok(!e1.html.includes('<script>') && e1.html.includes('&lt;script&gt;'));
  const [o2] = L.testoAssegnazione({ nome: 'Ada' }, { nome: 'K' }, [{ titolo: 'A', casi: ['c1'] }, { titolo: 'B', casi: ['c2'] }], titoli);
  assert.equal(o2, '2 nuovi compiti');
});
test('statoCompito: casi svolti, svolti entro la scadenza (primo tentativo) e media dei migliori punteggi', () => {
  const k = { casi: ['a', 'b', 'c'], scadenza: '2026-06-10' };
  const st = L.statoCompito(k, [{ caso: 'a', punteggio: 40, data: '2026-06-09 10:00' }, { caso: 'a', punteggio: 90, data: '2026-06-12 10:00' }, { caso: 'b', punteggio: 60, data: '2026-06-11 09:00' }]);
  assert.deepEqual({ ...st, fatti_ids: st.fatti_ids.sort() }, { fatti: 2, totale: 3, inTempo: 1, media: 75, fatti_ids: ['a', 'b'] });
  assert.deepEqual(L.statoCompito({ casi: [] }, []), { fatti: 0, totale: 0, inTempo: 0, media: null, fatti_ids: [] });
});
test('statistiche dello studente: solo primi tentativi, sensibilità e specificità, per esame e per mese', () => {
  const casi = { c1: { id: 'c1', modalita: 'TC', distretto: 'Torace', sezioni: [] }, c2: { id: 'c2', modalita: 'RX', distretto: 'Torace', sezioni: [] } };
  const o = (vp, fn, fp, vn) => [...Array(vp).fill({ tipo: 'principale', s: true, t: 'nodulo' }), ...Array(fn).fill({ tipo: 'secondario', s: false, t: 'linfonodo' }),
    ...Array(fp).fill({ tipo: 'distrattore', s: true, t: 'versamento' }), ...Array(vn).fill({ tipo: 'distrattore', s: false, t: 'pneumotorace' })];
  const mie = [{ caso: 'c1', data: '2026-05-02', punteggio: 50, opzioni: o(1, 1, 1, 1) }, { caso: 'c1', data: '2026-05-20', punteggio: 100, perfetta: true, opzioni: o(2, 0, 0, 2) },
    { caso: 'c2', data: '2026-06-01', punteggio: 100, perfetta: true, opzioni: o(1, 0, 0, 3) }];
  const s = L.statisticheStudente(mie, casi, Object.values(casi).map((c) => ({ ...c, visibile: true })));
  assert.equal(s.risposte, 3); assert.equal(s.casi, 2); assert.equal(s.media, 75);
  assert.equal(s.sens, 67, '2 trovati su 3 reperti (solo primi tentativi)'); assert.equal(s.spec, 80, '4 distrattori evitati su 5');
  assert.equal(s.mancati, 1); assert.equal(s.inventati, 1);
  assert.deepEqual(s.perEsame.map((e) => [e.zona, e.media]), [['TC Torace', 50], ['RX Torace', 100]], 'dal più debole');
  assert.deepEqual(s.andamento, [{ mese: '2026-05', casi: 1, media: 50 }, { mese: '2026-06', casi: 1, media: 100 }]);
  // ripasso: casi dello stesso esame non ancora svolti o sotto 90; c1 (100 al secondo tentativo) non si ripropone
  const s2 = L.statisticheStudente(mie, casi, [...Object.values(casi), { id: 'c3', modalita: 'TC', distretto: 'Torace', difficolta: 'Base', sezioni: [] }]);
  assert.deepEqual(s2.perEsame.find((e) => e.zona === 'TC Torace').ripasso, ['c3']);
});
