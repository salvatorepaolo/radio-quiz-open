// Proprietà della correzione (api/logica.mjs) verificate su migliaia di casi e risposte generati a caso (fast-check, MIT).
// Non si controlla un esempio scritto a mano ma una regola che deve valere SEMPRE; se una regola si rompe, fast-check
// riduce il controesempio al caso più semplice possibile e lo stampa. Ripetibile: FC_SEME=n, FC_GIRI=n.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fc from 'fast-check';
const L = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), '../api/logica.mjs')).href);
const opz = { numRuns: Number(process.env.FC_GIRI || 2000), ...(process.env.FC_SEME ? { seed: Number(process.env.FC_SEME) } : {}) };

// caso: da 2 a 12 opzioni, almeno una corretta, sezioni facoltative; scelte: indici (anche ripetuti, fuori intervallo, non interi)
const caso = fc.record({
  opzioni: fc.array(fc.record({ corretta: fc.boolean(), sezione: fc.option(fc.integer({ min: 0, max: 3 }), { nil: undefined }), testo: fc.string({ maxLength: 20 }) }), { minLength: 2, maxLength: 12 }),
  sezioni: fc.option(fc.array(fc.record({ nome: fc.constantFrom('Polmoni', 'Mediastino', 'Ossa', 'Addome') }), { minLength: 1, maxLength: 4 }), { nil: undefined }),
}).filter((c) => c.opzioni.some((o) => o.corretta));
const conScelte = caso.chain((c) => fc.tuple(fc.constant(c), fc.subarray([...c.opzioni.keys()])));
const giuste = (c) => c.opzioni.map((o, i) => (o.corretta ? i : -1)).filter((i) => i >= 0);

test('valuta: punteggio intero tra 0 e 100, un esito per opzione, stati coerenti con scelte e risposte', () => {
  fc.assert(fc.property(conScelte, ([c, s]) => {
    const r = L.valuta(c, s);
    assert.ok(Number.isInteger(r.punteggio) && r.punteggio >= 0 && r.punteggio <= 100);
    assert.equal(r.esito.length, c.opzioni.length);
    r.esito.forEach((e, i) => assert.equal(e.stato, s.includes(i) ? (c.opzioni[i].corretta ? 'corretta' : 'errata') : (c.opzioni[i].corretta ? 'mancata' : 'neutra')));
    for (const z of r.sezioni || []) assert.ok(z.punteggio >= 0 && z.punteggio <= 100);
  }), opz);
});
test('valuta: perfetta se e solo se si scelgono esattamente le corrette, e allora vale 100', () => {
  fc.assert(fc.property(conScelte, ([c, s]) => {
    const r = L.valuta(c, s), esatte = JSON.stringify([...s].sort((a, b) => a - b)) === JSON.stringify(giuste(c));
    assert.equal(r.perfetta, esatte); if (esatte) assert.equal(r.punteggio, 100);
    assert.equal(L.valuta(c, giuste(c)).punteggio, 100); assert.equal(L.valuta(c, []).punteggio, 0);
  }), opz);
});
test('valuta: aggiungere una risposta giusta non abbassa mai il punteggio, aggiungere una sbagliata non lo alza mai', () => {
  fc.assert(fc.property(conScelte, fc.nat(), ([c, s], k) => {
    const fuori = [...c.opzioni.keys()].filter((i) => !s.includes(i)); if (!fuori.length) return;
    const j = fuori[k % fuori.length], prima = L.valuta(c, s).punteggio, dopo = L.valuta(c, [...s, j]).punteggio;
    if (c.opzioni[j].corretta) assert.ok(dopo >= prima, `giusta: ${prima} → ${dopo}`); else assert.ok(dopo <= prima, `sbagliata: ${prima} → ${dopo}`);
  }), opz);
});
test('valuta: ordine, doppioni, indici non validi e numeri scritti come testo non cambiano il risultato', () => {
  fc.assert(fc.property(conScelte, fc.array(fc.oneof(fc.integer({ min: -5, max: -1 }), fc.integer({ min: 12, max: 99 }), fc.double({ noNaN: false }), fc.constant('x'), fc.constant(null))), ([c, s], rumore) => {
    const base = L.valuta(c, s);
    const altro = L.valuta(c, [...[...s].reverse(), ...s, ...s.map(String), ...rumore.filter((x) => !(Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) < c.opzioni.length))]);
    assert.equal(altro.punteggio, base.punteggio); assert.equal(altro.perfetta, base.perfetta); assert.deepEqual(altro.scelteTesti, base.scelteTesti);
  }), opz);
});
test('valuta: rimescolare l\'ordine delle opzioni (con le scelte corrispondenti) non cambia il punteggio', () => {
  fc.assert(fc.property(conScelte.chain(([c, s]) => fc.tuple(fc.constant(c), fc.constant(s), fc.shuffledSubarray([...c.opzioni.keys()], { minLength: c.opzioni.length, maxLength: c.opzioni.length }))), ([c, s, perm]) => {
    const c2 = { ...c, opzioni: perm.map((i) => c.opzioni[i]) }, s2 = s.map((i) => perm.indexOf(i));
    assert.equal(L.valuta(c2, s2).punteggio, L.valuta(c, s).punteggio);
    assert.equal(L.valuta(c2, s2).perfetta, L.valuta(c, s).perfetta);
  }), opz);
});

// punto sulla figura: il segno del docente è un rettangolo (a, b); il punto dello studente è (x, y) con serie e immagine
const vista = fc.record({ serie: fc.nat(5), idx: fc.nat(200), segno: fc.record({ a: fc.record({ x: fc.integer({ min: 0, max: 500 }), y: fc.integer({ min: 0, max: 500 }) }), b: fc.record({ x: fc.integer({ min: 0, max: 500 }), y: fc.integer({ min: 0, max: 500 }) }) }) });
const ORDINE = { centrato: 2, vicino: 1, mancato: 0 };
test('valutaPunto: il centro è sempre «centrato»; allontanarsi lungo una direzione non migliora mai l\'esito; a e b scambiati danno lo stesso esito', () => {
  fc.assert(fc.property(vista, fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), fc.double({ min: 0, max: 400, noNaN: true }), fc.double({ min: 0, max: 400, noNaN: true }), fc.integer({ min: -10, max: 10 }),
    (v, ang, r1, r2, dz) => {
      const cx = (v.segno.a.x + v.segno.b.x) / 2, cy = (v.segno.a.y + v.segno.b.y) / 2;
      assert.equal(L.valutaPunto(v, { x: cx, y: cy, serie: v.serie, idx: v.idx }).esito, 'centrato');
      const p = (r) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang), serie: v.serie, idx: v.idx + dz });
      const [vicino, lontano] = r1 <= r2 ? [r1, r2] : [r2, r1];
      assert.ok(ORDINE[L.valutaPunto(v, p(lontano)).esito] <= ORDINE[L.valutaPunto(v, p(vicino)).esito]);
      const scambiato = { ...v, segno: { a: v.segno.b, b: v.segno.a } };
      assert.equal(L.valutaPunto(scambiato, p(r1)).esito, L.valutaPunto(v, p(r1)).esito);
    }), opz);
});
test('valutaPunto: un\'altra serie è sempre «mancato»; le immagini lontane più di 6 non contano; senza punto «assente»', () => {
  fc.assert(fc.property(vista, fc.integer({ min: 1, max: 5 }), fc.integer({ min: 7, max: 100 }), (v, ds, dz) => {
    const cx = (v.segno.a.x + v.segno.b.x) / 2, cy = (v.segno.a.y + v.segno.b.y) / 2;
    const r = L.valutaPunto(v, { x: cx, y: cy, serie: v.serie + ds, idx: v.idx }); assert.equal(r.esito, 'mancato'); assert.ok(r.altraSerie);
    assert.equal(L.valutaPunto(v, { x: cx, y: cy, serie: v.serie, idx: v.idx + dz }).esito, 'mancato');
    for (const x of [null, {}, { x: 'a', y: 1 }, { x: Infinity, y: 0 }]) assert.equal(L.valutaPunto(v, x).esito, 'assente');
    assert.equal(L.valutaPunto({ serie: 0 }, { x: 1, y: 1 }), null, 'senza segno del docente nessuna valutazione');
  }), opz);
});

// referto libero: casi con reperti e distrattori fatti di parole mediche vere
const PAROLE = ['nodulo', 'polmonare', 'versamento', 'pleurico', 'linfonodi', 'ingranditi', 'frattura', 'costale', 'consolidamento', 'lobare', 'pneumotorace', 'enfisema', 'atelettasia', 'calcificazione', 'stenosi', 'aneurisma'];
const frase = fc.array(fc.constantFrom(...PAROLE), { minLength: 2, maxLength: 4 }).map((p) => p.join(' '));
const casoReferto = fc.record({ giuste: fc.array(frase, { minLength: 1, maxLength: 4 }), sbagliate: fc.array(frase, { maxLength: 4 }) })
  .map(({ giuste, sbagliate }) => ({ opzioni: [...giuste.map((t) => ({ testo: t, corretta: true })), ...sbagliate.map((t) => ({ testo: t }))] }));
test('valutaReferto: punteggio tra 0 e 100; senza il reperto principale al massimo 50; testo vuoto 0; ripetere il testo, maiuscole e intestazioni «SEZIONE:» non cambiano nulla', () => {
  fc.assert(fc.property(casoReferto, fc.array(fc.constantFrom(...PAROLE), { maxLength: 12 }), (c, parole) => {
    const testo = parole.join(' '), r = L.valutaReferto(c, testo);
    assert.ok(r.punteggio >= 0 && r.punteggio <= 100 && Number.isInteger(r.punteggio));
    if (r.voci.some((v) => v.principale && !v.ok)) assert.ok(r.punteggio <= 50);
    assert.equal(L.valutaReferto(c, '').punteggio, 0);
    const p = r.punteggio;
    assert.equal(L.valutaReferto(c, `${testo}\n${testo}`).punteggio, p, 'testo ripetuto');
    assert.equal(L.valutaReferto(c, testo.toUpperCase()).punteggio, p, 'maiuscole');
    assert.equal(L.valutaReferto(c, `REPERTI: ${testo}`).punteggio, p, 'intestazione del modello');
  }), opz);
});
test('valutaReferto: scrivere esattamente i reperti attesi, senza affermazioni sbagliate, dà 100', () => {
  fc.assert(fc.property(casoReferto, (c) => {
    const pulito = { opzioni: c.opzioni.filter((o) => o.corretta) };   // nessun distrattore che condivida parole
    assert.equal(L.valutaReferto(pulito, pulito.opzioni.map((o) => o.testo).join('. ')).punteggio, 100);
  }), opz);
});
// 1.259: trovato con questi test. Scrivere SOLO l'affermazione sbagliata che condivide una parola con il reperto atteso
// («versamento pericardico» al posto di «versamento pleurico») valeva 85: il reperto atteso risultava citato.
test('valutaReferto: scrivere solo l\'affermazione sbagliata che somiglia al reperto atteso non lo fa risultare citato', () => {
  const tre = fc.uniqueArray(fc.constantFrom(...PAROLE), { minLength: 3, maxLength: 3 });
  fc.assert(fc.property(tre, fc.boolean(), ([comune, giusta, sbagliata], ordine) => {
    const atteso = ordine ? `${comune} ${giusta}` : `${giusta} ${comune}`, errata = ordine ? `${comune} ${sbagliata}` : `${sbagliata} ${comune}`;
    const c = { opzioni: [{ testo: atteso, corretta: true }, { testo: errata }] };
    const r = L.valutaReferto(c, `Si osserva ${errata}.`);
    assert.equal(r.citati, 0, `«${errata}» ha fatto citare «${atteso}»`); assert.equal(r.punteggio, 0);
    // scritti entrambi: l'atteso è citato e quello sbagliato è un errore
    const e = L.valutaReferto(c, `${atteso}. ${errata}.`); assert.equal(e.citati, 1); assert.deepEqual(e.errori, [errata]);
    // l'atteso con la negazione di quello sbagliato: 100
    assert.equal(L.valutaReferto(c, `${atteso}, non ${errata}.`).punteggio, 100);
  }), opz);
});
