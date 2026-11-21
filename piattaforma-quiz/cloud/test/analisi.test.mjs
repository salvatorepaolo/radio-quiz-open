// Analisi didattica per i docenti (web/analisi.js): test di unità con una classe INVENTATA di 6 specializzandi
// su un caso con reperto principale P, secondario S e distrattore D. I valori attesi sono calcolati a mano.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '../web');
const AN = await import(pathToFileURL(path.join(WEB, 'analisi.js')).href);
const vicino = (a, b, msg) => assert.ok(a != null && Math.abs(a - b) < 1e-9, `${msg}: ${a} invece di ${b}`);

const caso = { id: 'c1', titolo: 'Caso di prova', distretto: 'Torace', modalita: 'TC', visibile: true, sezioni: ['Torace', 'Addome'],
  opzioni: [{ testo: 'P', tipo: 'principale', sezione: 0 }, { testo: 'S', tipo: 'secondario', sezione: 1 }, { testo: 'D', tipo: 'distrattore', sezione: 0 }] };
const opz = (p, s, d, conf = {}) => [{ t: 'P', tipo: 'principale', s: p, conf: conf.P }, { t: 'S', tipo: 'secondario', s, conf: conf.S }, { t: 'D', tipo: 'distrattore', s: d, conf: conf.D }];
const riga = (account, giorno, punteggio, o, extra = {}) => ({ account, nome: account.toUpperCase(), caso: 'c1', data: `2026-03-${giorno}`, punteggio, perfetta: punteggio === 100, opzioni: o, ruolo: 'specializzando', ...extra });
const risultati = [
  riga('u1', '01', 100, opz(true, true, false, { P: 'sicuro' }), { dettagli: { tempo: 100, mpr: true, misure: 2, serie: [{ descrizione: 'Assiale', viste: 5, totale: 10 }] } }),
  riga('u2', '02', 100, opz(true, true, false), { dettagli: { tempoAttivo: 200, tempo: 999, mpr: false, roi: 1 } }),
  riga('u3', '03', 50, opz(true, false, false)),
  riga('u4', '04', 0, opz(true, false, true, { D: 'sicuro' })),
  riga('u5', '05', 0, opz(false, false, true, { D: 'probabile' })),
  riga('u6', '06', 50, opz(false, true, false)),
  riga('u1', '20', 0, opz(false, false, true), { tentativo: 2 }),          // secondo tentativo: non conta
  riga('doc', '07', 100, opz(true, true, false), { ruolo: 'docente' }),    // docente: escluso di regola
];
const A = AN.calcola({ casi: [caso], risultati });
const C = A.casi[0], op = Object.fromEntries(C.opzioni.map((o) => [o.testo, o]));

test('analisi: solo primo tentativo degli specializzandi; punteggio medio, perfette, tempo e strumenti usati', () => {
  assert.equal(A.totale, 6); assert.equal(C.n, 6);
  vicino(C.punteggio, 50, 'punteggio medio'); vicino(C.perfette, 2 / 6, 'perfette');
  assert.equal(C.tempo, 150, 'mediana del tempo (tempoAttivo prima di tempo)');
  vicino(C.usoMpr, 0.5, 'MPR'); vicino(C.usoMisure, 0.5, 'misure'); vicino(C.usoRoi, 0.5, 'ROI');
  assert.deepEqual(C.serie, [{ descrizione: 'Assiale', aperta: 0.5, scorsa: 0.5 }]);
  assert.equal(AN.calcola({ casi: [caso], risultati }, { soloSpecializzandi: false }).totale, 7, 'con il docente');
  assert.equal(AN.calcola({ casi: [caso], risultati }, { primoSolo: false }).totale, 7, 'con il secondo tentativo');
});
test('analisi: difficoltà e discriminazione di ogni opzione (metà migliore − metà peggiore)', () => {
  vicino(op.P.scelta, 4 / 6, 'P scelta'); vicino(op.P.corretti, 4 / 6, 'P trattata bene');
  vicino(op.P.discriminazione, 2 / 3, 'P discriminazione');        // migliori u1 u2 u3: 3/3; peggiori u6 u4 u5: 1/3
  vicino(op.D.scelta, 2 / 6, 'D scelta'); vicino(op.D.corretti, 4 / 6, 'D evitato');
  vicino(op.D.discriminazione, 2 / 3, 'D discriminazione');
  assert.deepEqual(op.D.conf, { sicuro: 1, probabile: 1, ipotesi: 0 }); assert.equal(op.D.convinti, 1, 'distrattore scelto «sicuro»');
  assert.deepEqual(op.P.conf, { sicuro: 1, probabile: 0, ipotesi: 0 }); assert.equal(op.P.convinti, 0);
  // con meno di 4 persone la discriminazione non si calcola
  const pochi = AN.calcola({ casi: [caso], risultati: risultati.slice(0, 3) }).casi[0];
  assert.ok(pochi.opzioni.every((o) => o.discriminazione === null));
});
test('analisi: reperti secondari mancati da chi ha trovato il principale («satisfaction of search») e punteggio per distretto', () => {
  vicino(C.principaleTrovato, 4 / 6, 'principale trovato');
  assert.equal(C.secondari.length, 1); vicino(C.secondari[0].mancato, 0.5, 'S mancato da chi ha trovato P'); vicino(C.secondariMancatiAlmenoUno, 0.5, 'almeno un secondario mancato');
  assert.deepEqual(C.sezioni.map((s) => s.nome), ['Torace', 'Addome']);
  vicino(C.sezioni[0].punteggio, 50, 'Torace: (P giusta − D scelta) / reperti'); vicino(C.sezioni[1].punteggio, 50, 'Addome');
  assert.equal(C.chiavi.length, 0);
});
test('analisi: per ogni specializzando calibrazione, distrattori «sicuri», secondari trovati, aree', () => {
  const p = Object.fromEntries(A.persone.map((x) => [x.chi, x]));
  assert.deepEqual(A.persone.map((x) => x.nome), ['U1', 'U2', 'U3', 'U4', 'U5', 'U6'], 'ordinati per nome');
  assert.deepEqual(p.u1.calibrazione.sicuro, { n: 1, corrette: 1 });
  assert.deepEqual(p.u4.calibrazione.sicuro, { n: 1, corrette: 0 });
  assert.equal(p.u4.distrattoriConvinti, 1); assert.equal(p.u5.distrattoriConvinti, 0, '«probabile» non è «sicuro»');
  vicino(p.u3.secondariTrovati, 0, 'u3'); vicino(p.u6.secondariTrovati, 1, 'u6');
  assert.deepEqual(p.u1.aree, [{ area: 'Torace · TC', n: 1, punteggio: 100 }]);
  assert.equal(p.u1.curva.length, 1, 'il secondo tentativo non entra nella curva');
});
test('analisi: mappa degli errori per distretto, distrattori più scelti, reperti più mancati', () => {
  const ar = Object.fromEntries(A.errori.aree.map((a) => [a.area, a]));
  vicino(ar.Torace.mancati, 2 / 6, 'Torace: P mancato'); vicino(ar.Torace.scelti, 2 / 6, 'Torace: D scelto'); assert.equal(ar.Torace.convinti, 1);
  vicino(ar.Addome.mancati, 3 / 6, 'Addome: S mancato'); assert.equal(ar.Addome.distrattori, 0);
  assert.equal(ar.Torace.persone, 6);
  assert.deepEqual(A.errori.distrattori.map((d) => [d.testo, d.scelti, d.n]), [['D', 2, 6]]);
  assert.deepEqual(A.errori.mancati.map((m) => m.testo), ['S', 'P'], 'prima il più mancato');
});
test('analisi: risultati salvati senza l\'istantanea delle opzioni ricostruiti dalle scelte; casi senza risposte', () => {
  const vecchio = { account: 'v', caso: 'c1', data: '2026-01-01', punteggio: 50, scelte: 'P | D' };
  const B = AN.calcola({ casi: [caso, { ...caso, id: 'c2', opzioni: [] }], risultati: [vecchio] });
  const o = Object.fromEntries(B.casi[0].opzioni.map((x) => [x.testo, x]));
  assert.equal(o.P.scelta, 1); assert.equal(o.S.scelta, 0); assert.equal(o.D.scelta, 1);
  assert.equal(B.casi[1].n, 0); assert.equal(B.casi[1].punteggio, null); assert.equal(B.casi[1].tempo, null);
});
