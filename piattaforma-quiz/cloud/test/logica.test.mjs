// Logica del server (api/logica.mjs, api/firma.mjs): test di unità diretti, senza simulatore.
// Correzione e punteggi, comunicazione dell'esito, referto libero, punto sulla figura, controlli dei casi,
// password, gettoni di accesso e cookie delle immagini, URL firmati S3 (vettore ufficiale AWS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '../api');
const L = await import(pathToFileURL(path.join(API, 'logica.mjs')).href), F = await import(pathToFileURL(path.join(API, 'firma.mjs')).href);

const caso = { opzioni: [
  { testo: 'Nodulo spiculato del lobo superiore destro', corretta: true, tipo: 'principale', sezione: 0 },
  { testo: 'Linfonodi ilari ingranditi', corretta: true, tipo: 'secondario', sezione: 0 },
  { testo: 'Versamento pleurico bilaterale', corretta: false, sezione: 0 },
  { testo: 'Lesione sospetta per neoplasia: completare con PET-TC', corretta: true, sezione: 1 },
  { testo: 'Reperto benigno, nessun controllo', corretta: false, sezione: 1 },
], sezioni: [{ nome: 'Torace' }, { nome: 'Conclusioni' }], spiegazione: 'Discussione.' };

test('valuta: punteggio (giuste − sbagliate) / giuste, mai sotto zero; sezioni; indici non validi ignorati', () => {
  assert.equal(L.valuta(caso, [0, 1, 3]).punteggio, 100); assert.ok(L.valuta(caso, [0, 1, 3]).perfetta);
  assert.equal(L.valuta(caso, [0]).punteggio, 33);
  assert.equal(L.valuta(caso, [0, 1, 3, 2]).punteggio, 67);
  assert.equal(L.valuta(caso, [2, 4]).punteggio, 0); assert.equal(L.valuta(caso, []).punteggio, 0);
  assert.equal(L.valuta(caso, [0, '1', 3, 99, -1, 'x', 1.5]).punteggio, 100, 'indici fuori intervallo o non interi devono essere ignorati');
  const r = L.valuta(caso, [0, 2, 3]);
  assert.deepEqual(r.esito.map((e) => e.stato), ['corretta', 'mancata', 'errata', 'corretta', 'neutra']);
  assert.deepEqual(r.sezioni.map((s) => [s.nome, s.punteggio, s.perfetta]), [['Torace', 0, false], ['Conclusioni', 100, true]]);
  assert.equal(L.valuta({ opzioni: [{ testo: 'a', corretta: false }] }, [0]).punteggio, 0, 'caso senza risposte giuste');
});
test('tipoOpzione: principale, secondario, distrattore (anche per i casi vecchi senza tipo)', () => {
  const vecchi = [{ corretta: false }, { corretta: true }, { corretta: true }];
  assert.deepEqual(vecchi.map((_, i) => L.tipoOpzione(vecchi, i)), ['distrattore', 'principale', 'secondario']);
  assert.deepEqual(caso.opzioni.map((_, i) => L.tipoOpzione(caso.opzioni, i)), ['principale', 'secondario', 'distrattore', 'secondario', 'distrattore']);
});
test('valutaComunicazione: urgenza, destinatario, mezzo, contenuto, tempo e traccia nel referto', () => {
  const atteso = { livello: 'urgente', accettabili: ['immediata'], destinatari: ['richiedente'], parole: ['dissezione'], motivo: 'm' };
  const perfetta = L.valutaComunicazione(atteso, { livello: 'urgente', a: 'richiedente', come: 'telefono', testo: 'Dissezione aortica tipo A', dopo_s: 600 }, 'Comunicato telefonicamente al richiedente alle 10:15.');
  assert.equal(perfetta.punteggio, 100); assert.ok(perfetta.righe.every((r) => r.ok));
  assert.equal(L.valutaComunicazione(atteso, { livello: 'nessuna' }).punteggio, 0);
  assert.equal(L.valutaComunicazione({ ...atteso, accettabili: ['nessuna'] }, { livello: 'nessuna' }).punteggio, 50);
  const lenta = L.valutaComunicazione(atteso, { livello: 'urgente', a: 'richiedente', come: 'telefono', testo: 'dissezione', dopo_s: 7200 }, 'comunicato');
  assert.equal(lenta.punteggio, 95);
  assert.equal(L.valutaComunicazione({ livello: 'nessuna', accettabili: [], destinatari: [], parole: [] }, { livello: 'nessuna' }).punteggio, 100);
  assert.equal(L.valutaComunicazione({ livello: 'nessuna', accettabili: [], destinatari: [], parole: [] }, { livello: 'urgente' }).punteggio, 60);
  assert.equal(L.valutaComunicazione(null, {}), null);
});
test('valutaReferto: reperti citati, negazioni, errori, reperto principale mancante → al massimo 50', () => {
  const tutto = L.valutaReferto(caso, 'Nodulo spiculato del lobo superiore destro. Linfonodi ilari ingranditi. Lesione sospetta per neoplasia, completare con PET-TC.');
  assert.equal(tutto.punteggio, 100); assert.equal(tutto.errori.length, 0);
  const senzaPrincipale = L.valutaReferto(caso, 'Linfonodi ilari ingranditi. Lesione sospetta per neoplasia, completare con PET-TC.');
  assert.ok(senzaPrincipale.punteggio <= 50); assert.ok(senzaPrincipale.mancati.some((m) => /Nodulo/.test(m)));
  const conErrore = L.valutaReferto(caso, 'Nodulo spiculato del lobo superiore destro. Linfonodi ilari ingranditi. Lesione sospetta per neoplasia: PET-TC. Versamento pleurico bilaterale.');
  assert.equal(conErrore.errori.length, 1); assert.equal(conErrore.punteggio, 85);
  const negato = L.valutaReferto(caso, 'Nodulo spiculato del lobo superiore destro. Linfonodi ilari ingranditi. Lesione sospetta per neoplasia: PET-TC. Non versamento pleurico.');
  assert.equal(negato.errori.length, 0, 'un errore negato non è un errore');
  assert.equal(L.valutaReferto(caso, '').punteggio, 0);
});
test('togliModello: i titoli del referto strutturato e i segnaposto non contano', () => {
  assert.equal(L.togliModello('PARENCHIMA POLMONARE: …\nMEDIASTINO: linfonodi ingranditi\n...'), 'linfonodi ingranditi');
});
test('valutaPunto: centrato, vicino, mancato, altra serie, assente', () => {
  const vista = { serie: 2, idx: 50, segno: { a: { x: 100, y: 100 }, b: { x: 120, y: 120 } } };
  assert.equal(L.valutaPunto(vista, { serie: 2, idx: 51, x: 110, y: 112 }).esito, 'centrato');
  assert.equal(L.valutaPunto(vista, { serie: 2, idx: 55, x: 135, y: 110 }).esito, 'vicino');
  assert.equal(L.valutaPunto(vista, { serie: 2, idx: 50, x: 300, y: 300 }).esito, 'mancato');
  assert.deepEqual(L.valutaPunto(vista, { serie: 3, idx: 50, x: 110, y: 110 }), { esito: 'mancato', altraSerie: true });
  assert.equal(L.valutaPunto(vista, null).esito, 'assente'); assert.equal(L.valutaPunto({ serie: 1 }, { x: 1, y: 1 }), null);
});
test('controlliCaso: segnala ciò che manca prima di pubblicare', () => {
  assert.deepEqual(L.controlliCaso(caso), []);
  const p = L.controlliCaso({ opzioni: [{ testo: 'a', corretta: false, sezione: 0 }], sezioni: [{ nome: 'Torace' }], nota_docente: 'DA CONTROLLARE', localizza: true });
  for (const x of ['meno di 2 risposte', 'nessun reperto principale', '«Torace» senza risposta corretta', 'manca la sezione Conclusioni', 'manca la spiegazione', 'nota: DA CONTROLLARE', 'domanda sulla figura senza segno'])
    assert.ok(p.includes(x), x);
  assert.deepEqual(L.controlliCaso({ ...caso, nota_docente: 'da verificare, confermato dal docente' }), []);
});
test('difficoltà dalla media', () => { assert.equal(L.difficoltaDa(80), 'Base'); assert.equal(L.difficoltaDa(60), 'Intermedio'); assert.equal(L.difficoltaDa(30), 'Avanzato'); });
test('password: regola, impronta con sale (mai in chiaro), verifica resistente', () => {
  assert.ok(L.passwordValida('radiologia1')); assert.ok(!L.passwordValida('corta1')); assert.ok(!L.passwordValida('soloLettereLunghe')); assert.ok(!L.passwordValida('1234567890'));
  const h = L.improntaPassword('radiologia1'), h2 = L.improntaPassword('radiologia1');
  assert.match(h, /^s1\$[0-9a-f]{32}\$[0-9a-f]{64}$/); assert.notEqual(h, h2, 'stesso sale: impronte uguali'); assert.ok(!h.includes('radiologia1'));
  assert.ok(L.verificaPassword('radiologia1', h)); assert.ok(!L.verificaPassword('radiologia2', h));
  for (const x of ['', null, 's1$$', 'md5$aa$bb', 'testo']) assert.ok(!L.verificaPassword('radiologia1', x));
});
test('gettone di accesso: valido, scaduto, alterato, firmato con altro segreto, ruolo o id non ammessi', () => {
  const ora = 1_800_000_000, g = L.creaGettone('segreto', 'docente', 'abc_123', ora);
  assert.deepEqual(L.leggiGettone('segreto', g, ora + 10), { ruolo: 'docente', id: 'abc_123', scad: ora + 60 * 60 * 24 * 30 });
  assert.equal(L.leggiGettone('segreto', g, ora + 60 * 60 * 24 * 31), null, 'scaduto');
  assert.equal(L.leggiGettone('altro', g, ora), null);
  assert.equal(L.leggiGettone('segreto', g.replace('docente', 'admin'), ora), null, 'ruolo cambiato');
  const p = g.split('.'); assert.equal(L.leggiGettone('segreto', [p[0], p[1], String(+p[2] + 999999), p[3]].join('.'), ora), null, 'scadenza allungata');
  assert.equal(L.leggiGettone('segreto', L.creaGettone('segreto', 'root', 'x', ora), ora), null);
  assert.equal(L.leggiGettone('segreto', L.creaGettone('segreto', 'docente', '../x', ora), ora), null);
  for (const x of [null, '', 'a.b.c', 'a.b.c.d.e']) assert.equal(L.leggiGettone('segreto', x, ora), null);
});
test('cookie del caso e cartelle nascoste: solo nomi sicuri, firma presente; cartelle condivise mai nascoste', () => {
  const c = L.cookieCaso('s', 'caso-1', ['0003_TC', '../segreto', 'a b', 'ok.1'], 1000);
  const [id, , lista, firma] = c.split('~'); assert.equal(id, 'caso-1'); assert.equal(lista, '0003_TC*ok.1'); assert.match(firma, /^[0-9a-f]{64}$/);
  const serie = [{ files: ['serie/A/1.dcm'] }, { files: ['serie/B/1.dcm'] }, { files: ['serie/A/2.dcm'] }];
  assert.deepEqual(L.cartelleNascoste(serie, [1]), ['B']); assert.deepEqual(L.cartelleNascoste(serie, [2]), [], 'A è anche in una serie visibile');
});
test('codici di accesso: formato e caratteri senza ambiguità (niente l, 0, 1)', () => {
  for (let i = 0; i < 200; i++) { const c = L.generaCodice(); assert.match(c, /^[a-km-z2-9]{4}-[a-km-z2-9]{4}-[a-km-z2-9]{4}$/); }
  assert.equal(L.impronta('AB-cd ef'), L.impronta('abcdef'));
});
test('URL firmato S3 (SigV4): vettore di prova ufficiale AWS', () => {
  const u = F.urlFirmato({ bucket: 'examplebucket', regione: 'us-east-1', chiave: 'test.txt', metodo: 'GET', scadenza: 86400, host: 'examplebucket.s3.amazonaws.com',
    credenziali: { accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }, ora: new Date('2013-05-24T00:00:00Z') });
  assert.equal(u, 'https://examplebucket.s3.amazonaws.com/test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
});

test('1.303 domanda sul vetrino: pulisciZonaVetrino e valutaPuntoVetrino', () => {
  assert.equal(L.pulisciZonaVetrino(null), null);
  assert.equal(L.pulisciZonaVetrino({ i: 0, r: [10, 10, 11, 11] }), null);   // troppo piccola
  const z = L.pulisciZonaVetrino({ i: '1', r: [2000, 3000, 1000, 1000], nota: 'x'.repeat(400), domanda: 'si' });
  assert.deepEqual(z.r, [1000, 1000, 2000, 3000]); assert.equal(z.i, 1); assert.equal(z.nota.length, 300); assert.equal(z.domanda, undefined);
  const zona = { i: 0, r: [1000, 1000, 2000, 2000] };
  assert.equal(L.valutaPuntoVetrino(zona, { vt: 0, x: 1500, y: 1500 }).esito, 'centrato');
  assert.equal(L.valutaPuntoVetrino(zona, { vt: 0, x: 2100, y: 1500 }).esito, 'centrato');   // margine del 15%
  assert.equal(L.valutaPuntoVetrino(zona, { vt: 0, x: 2600, y: 1500 }).esito, 'vicino');
  assert.equal(L.valutaPuntoVetrino(zona, { vt: 0, x: 4000, y: 4000 }).esito, 'mancato');
  assert.deepEqual(L.valutaPuntoVetrino(zona, { vt: 1, x: 1500, y: 1500 }), { esito: 'mancato', altroVetrino: true });
  assert.equal(L.valutaPuntoVetrino(zona, null).esito, 'assente');
  assert.equal(L.valutaPuntoVetrino(zona, { x: 1500, y: 1500 }).esito, 'assente');
  assert.deepEqual(L.controlliCaso({ opzioni: [], localizza: true, zona_vetrino: { ...zona, domanda: true } }).filter((x) => /figura/.test(x)), []);
  assert.ok(L.controlliCaso({ opzioni: [], localizza: true, zona_vetrino: zona }).includes('domanda sulla figura senza segno'));
});
