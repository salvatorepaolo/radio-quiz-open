// Cruscotto dei revisori (28/11/2026): totali, priorità, dubbio dalla nota, casi corretti da riconfermare. Dati inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const { cruscottoRevisione } = await import(pathToFileURL(path.join(QUI, '../api/logica.mjs')).href);

test('cruscotto dei revisori', () => {
  const casi = [
    { id: 'caso-tcia-001', titolo: 'A', modalita: 'TC', nota_docente: 'Caso preparato. NON ancora rivisto dal medico.\nDa verificare: stadio FIGO.' },
    { id: 'caso-tcia-002', titolo: 'B', modalita: 'RM', revisione: { esito: 'confermato', da: 'Dora', data: '2026-11-27 10:00' } },
    { id: 'caso-tcia-003', titolo: 'C', modalita: 'RX', aggiornato: '2026-11-28 09:00', revisione: { esito: 'da-correggere', da: 'Dora', data: '2026-11-27 11:00', nota: 'seno libero' } },
    { id: 'caso-tcia-004', titolo: 'D', modalita: 'TC', nota_docente: 'Tutto a posto.' },
    { id: 'caso-tcia-005', titolo: 'E', visibile: false, nota_docente: 'NON ancora rivisto dal medico.' },
    { id: 'caso-tcia-006', titolo: 'F', modalita: 'TC', aggiornato: '2026-11-27 08:00', revisione: { esito: 'da-correggere', da: 'Ugo', data: '2026-11-27 12:00', nota: 'x' } },
  ];
  const r = cruscottoRevisione(casi, { 'caso-tcia-001': { n: 12, media: 35 } });
  assert.deepEqual(r.totali, { visibili: 5, daRivedere: 3, confermati: 1, daCorreggere: 2, corretti: 1 });
  assert.deepEqual(r.daRivedere.map((c) => c.id), ['caso-tcia-001', 'caso-tcia-003', 'caso-tcia-006'], 'le bozze nascoste non contano');
  const a = r.daRivedere[0];
  assert.equal(a.risposte, 12); assert.equal(a.media, 35); assert.equal(a.dubbio, 'Da verificare: stadio FIGO.');
  assert.equal(r.daRivedere[1].corretto, '2026-11-28 09:00', 'salvato dopo la richiesta');
  assert.equal(r.daRivedere[2].corretto, undefined, 'salvato prima della richiesta');
  assert.equal(r.daRivedere[1].risposte, 0); assert.equal(r.daRivedere[1].media, undefined); assert.equal(r.daRivedere[1].dubbio, undefined);
  assert.deepEqual(r.perRevisore, { Dora: { confermati: 1, daCorreggere: 1 }, Ugo: { confermati: 0, daCorreggere: 1 } });
  assert.equal(r.rivisti[0].id, 'caso-tcia-006', 'i più recenti prima');
});
