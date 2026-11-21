// T2*: fit con offset e troncato su segnali sintetici (rumore e pavimento del rumore)
import test from 'node:test'; import assert from 'node:assert/strict';
import * as T2 from '../web/t2star.js';
let seme = 7; const rnd = () => { seme = (seme * 16807) % 2147483647; return seme / 2147483647; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const TE = Array.from({ length: 12 }, (_, i) => 1.8 + i * 1.46);   // 1,8-17,9 ms come nel cuore
test('risultato principale: errore < 10% con T2* 3, 6 e 15 ms; con 40 ms (oltre gli echi) classe giusta', () => {
  for (const vero of [3, 6, 15, 40]) {
    for (let r = 0; r < 5; r++) {
      const S = TE.map((t) => 1000 * Math.exp(-t / vero) + 40 + 8 * gauss());   // pavimento 40, rumore 8
      const f = T2.fitOffset(TE, S), a = T2.analizza(TE, S);
      if (vero <= 15) {
        assert.ok(Math.abs(f.t2 - vero) / vero < 0.1, `offset: T2* vero ${vero}, stimato ${f.t2.toFixed(2)}`);
        assert.ok(Math.abs(a.principale.t2 - vero) / vero < 0.1, `principale: T2* vero ${vero}, stimato ${a.principale.t2.toFixed(2)} (${a.principale.modello})`);
      } else assert.match(a.classe, /nessun/, `T2* vero ${vero}, stimato ${a.principale.t2.toFixed(1)}`);
      assert.ok(Math.abs(f.r2star - 1000 / f.t2) < 1e-9);
    }
  }
});
test('troncato: toglie gli echi nel rumore; senza offset è vicino al vero', () => {
  const S = TE.map((t) => 1000 * Math.exp(-t / 3) + 30);
  const tr = T2.fitTroncato(TE, S);
  assert.ok(tr.echi < 12 && tr.echi >= 3, `echi ${tr.echi}`);
  assert.ok(tr.t2 > 2.7 && tr.t2 < 4, `${tr.t2}`);
  const pulito = T2.fitTroncato(TE, TE.map((t) => 800 * Math.exp(-t / 25)));
  assert.equal(pulito.echi, 12); assert.ok(Math.abs(pulito.t2 - 25) < 0.01);
});
test('classi e ferro epatico (Garbowski 2014)', () => {
  assert.match(T2.classeCuore(42), /nessun/); assert.match(T2.classeCuore(15), /lieve/); assert.match(T2.classeCuore(6), /grave/);
  const lic = T2.licDaR2(1000 / 1.4);   // T2* 1,4 ms: la collezione CHMMOT dà LIC 22,5 mg/g
  assert.ok(Math.abs(lic - 22.5) < 1, `${lic}`);
  assert.match(T2.classeFegato(lic), /grave/); assert.match(T2.classeFegato(1), /norma/);
  const a = T2.analizza([5, 1, 3, 2, 4], [10, 500, 120, 300, 40], 'fegato');
  assert.deepEqual(a.te, [1, 2, 3, 4, 5]); assert.ok(a.lic > 0);
  assert.equal(T2.analizza([1, 1, 1], [3, 2, 1]), null);
});
test('cuore normale: il modello con offset non deve inventare un T2* basso (segnale quasi piatto e rumoroso)', () => {
  for (let r = 0; r < 40; r++) {
    const vero = 30 + 30 * rnd();
    const S = TE.map((t) => 120 * Math.exp(-t / vero) + 4 * gauss());   // come il setto del caso 109: cala del 20-30%
    const a = T2.analizza(TE, S);
    assert.match(a.classe, /nessun/, `T2* vero ${vero.toFixed(0)}: stimato ${a.principale.t2.toFixed(1)} (${a.principale.modello})`);
  }
});
