// Correzione di ogni caso (casi-free) con risposte tipo: proprietà che devono valere sempre e non regressione rispetto
// alla fotografia (fixture/casi-fotografia.json, fatta con casi-fotografia.mjs). Se un caso o il codice di correzione
// cambia di proposito, si rifà la fotografia; se cambia per sbaglio, il test lo dice caso per caso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fotografia, CASI } from './casi-fotografia.mjs';
const QUI = path.dirname(fileURLToPath(import.meta.url));
const salta = !fs.existsSync(CASI) && 'cartella dei casi assente';

test('ogni caso: tutte le giuste = 100 e perfetta, nessuna = 0, aggiungere un distrattore abbassa il punteggio', { skip: salta }, () => {
  for (const [id, x] of Object.entries(fotografia())) {
    assert.equal(x.tutteGiuste.p, 100, id); assert.ok(x.tutteGiuste.ok, id); assert.equal(x.nessuna.p, 0, id);
    assert.ok(x.conDistrattore.p < 100 || x.tutte.p === 100, `${id}: un distrattore scelto non toglie punti`);
    assert.ok(x.soloPrincipale.p > 0 && x.soloPrincipale.p <= 100, id);
  }
});
test('ogni caso: il referto con i reperti attesi passa, quello con le affermazioni sbagliate no', { skip: salta }, () => {
  for (const [id, x] of Object.entries(fotografia())) {
    assert.ok(x.refertoGiusto.p >= 70, `${id}: referto giusto ${x.refertoGiusto.p}`);
    assert.ok(x.refertoSbagliato.p <= 40, `${id}: referto sbagliato ${x.refertoSbagliato.p}`);
  }
});
test('ogni caso: comunicazione dell\'esito fatta come atteso = 100; segno sulla figura colpito al centro', { skip: salta }, () => {
  for (const [id, x] of Object.entries(fotografia())) {
    if (x.comGiusta !== undefined) assert.equal(x.comGiusta, 100, id);
    if (x.punto) assert.equal(x.punto, 'centrato', id);
  }
});
test('non regressione: correzione di ogni caso uguale alla fotografia', { skip: salta }, () => {
  const atteso = JSON.parse(fs.readFileSync(path.join(QUI, 'fixture/casi-fotografia.json'), 'utf8')), ora = fotografia();
  assert.deepEqual(Object.keys(ora).sort(), Object.keys(atteso).sort(), 'casi aggiunti o tolti: rifare la fotografia');
  for (const id of Object.keys(atteso)) assert.deepEqual(ora[id], atteso[id], `${id}: la correzione è cambiata`);
});
