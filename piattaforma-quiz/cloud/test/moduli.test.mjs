// Moduli del sito senza interfaccia: test di unità.
//   refertolocale.js  correzione del referto con l'IA nel browser (parti che non usano il modello)
//   ecosemi.js        area del poligono e battiti dalla curva delle aree (ecocardio)
//   analisi.js        analisi delle risposte (primo tentativo, risposta giusta)
//   referto.js        referto in HTML: il testo scritto dall'utente non diventa codice
//   gsps.js           oggetti DICOM prodotti (presentation state, SR, immagini chiave): leggibili e in ordine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '../web');
const carica = (f) => import(pathToFileURL(path.join(WEB, f)).href);
const RL = await carica('refertolocale.js'), ECO = await carica('ecosemi.js'), AN = await carica('analisi.js'), REF = await carica('referto.js'), G = await carica('gsps.js');
{ const m = { exports: {} }; new Function('module', 'exports', 'require', fs.readFileSync(path.join(WEB, 'lib/dicomParser.min.js'), 'utf8'))(m, m.exports, createRequire(import.meta.url)); globalThis.dicomParser = m.exports; }

// ---------------------------------------------------------------- refertolocale.js
test('nelTesto: riconosce la stessa affermazione con parole vicine, non quelle sparse o assenti', () => {
  assert.ok(RL.nelTesto('versamento pleurico sinistro', 'Si osserva modesto versamento pleurico a sinistra.'));
  assert.ok(RL.nelTesto('versamento pleurico sinistro', 'Versamenti pleurici sinistri.'));   // stessa radice (prime 6 lettere)
  assert.ok(!RL.nelTesto('versamento pleurico sinistro', 'Versamento pericardico. ' + 'Parenchima polmonare senza lesioni focali e trachea in asse. '.repeat(3) + 'Polmone sinistro normale.'));   // parole lontane
  assert.ok(!RL.nelTesto('pneumotorace iperteso', 'Parenchima polmonare normale, non lesioni.'));
  assert.ok(!RL.nelTesto('', 'qualunque testo'));
});
test('copertura: quota delle parole della voce presenti nel referto', () => {
  assert.equal(RL.copertura('nodulo polmonare spiculato', 'nodulo polmonare spiculato al lobo superiore'), 1);
  assert.equal(RL.copertura('nodulo polmonare spiculato', 'nodulo epatico'), 1 / 3);
  assert.equal(RL.copertura('a b c', 'a b c'), 0);   // parole corte ignorate
});
test('righeAtteso: legge reperti, principali e affermazioni sbagliate del caso di riferimento', () => {
  const r = RL.righeAtteso('REPERTI PRESENTI\n- [Torace] Nodulo spiculato (reperto principale)\n- Linfonodi ilari\nAFFERMAZIONI SBAGLIATE\n- Versamento pleurico\nDISCUSSIONE\n- non conta');
  assert.deepEqual(r, { giuste: ['Nodulo spiculato', 'Linfonodi ilari'], principali: ['Nodulo spiculato'], sbagliate: ['Versamento pleurico'] });
});
test('ripulisci: voto limitato senza il reperto principale o con due errori; voci incoerenti col testo tolte', () => {
  const atteso = 'REPERTI PRESENTI\n- Nodulo spiculato del lobo superiore (reperto principale)\nAFFERMAZIONI SBAGLIATE\n- Versamento pleurico bilaterale';
  const senza = RL.ripulisci({ voto: 9, trovati: ['Linfonodi ingranditi'], errori: [] }, 'Linfonodi ingranditi in sede ilare.', atteso);
  assert.equal(senza.voto, 5); assert.match(senza.notaVoto, /reperto principale/);
  const due = RL.ripulisci({ voto: 8, errori: ['versamento pleurico bilaterale', 'pneumotorace sinistro esteso'] },
    'Nodulo spiculato del lobo superiore. Versamento pleurico bilaterale. Pneumotorace sinistro esteso.', atteso);
  assert.equal(due.errori.length, 2); assert.equal(due.voto, 4);
  const inventati = RL.ripulisci({ voto: 7, trovati: ['Frattura costale'], errori: ['Embolia polmonare'] }, 'Nodulo spiculato del lobo superiore.', atteso);
  assert.deepEqual(inventati.trovati, []); assert.deepEqual(inventati.errori, []);
  assert.equal(RL.ripulisci({ voto: 'abc' }, 'x').voto, 0); assert.equal(RL.ripulisci({ voto: 99 }, 'x').voto, 10); assert.equal(RL.ripulisci({ voto: 7.3 }, 'x').voto, 7.5);
});
test('leggiJSON: risposta del modello con ragionamento, testo intorno e virgole finali', () => {
  assert.deepEqual(RL.leggiJSON('<think>penso {"no":1}</think> Ecco: {"voto": 7, "trovati": ["a",],} grazie'), { voto: 7, trovati: ['a'] });
  assert.equal(RL.leggiJSON('niente json'), null);
});

// ---------------------------------------------------------------- ecosemi.js
test('areaPoligono: quadrato, triangolo, verso orario o antiorario', () => {
  assert.equal(ECO.areaPoligono([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]), 100);
  assert.equal(ECO.areaPoligono([{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }]), 100);
  assert.equal(ECO.areaPoligono([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }]), 6);
});
test('battiti: tre cicli sintetici → fine diastole sui massimi, fine sistole sui minimi', () => {
  const n = 90, aree = Array.from({ length: n }, (_, i) => 30 + 10 * Math.cos((2 * Math.PI * i) / 30));   // massimi a 0, 30, 60
  const b = ECO.battiti(aree);
  assert.ok(b.length >= 2, JSON.stringify(b));
  for (const { ed, es } of b) { assert.ok(ed % 30 <= 1 || ed % 30 >= 29, `ed ${ed}`); assert.ok(Math.abs((es % 30) - 15) <= 1, `es ${es}`); assert.ok(es > ed); }
  const corto = ECO.battiti(Array.from({ length: 12 }, (_, i) => 30 + 10 * Math.cos((2 * Math.PI * i) / 24)));   // meno di un ciclo
  assert.equal(corto.length, 1); assert.ok(corto[0].es > corto[0].ed);
});

// ---------------------------------------------------------------- analisi.js
test('analisi: risposta giusta (anche i distrattori non scelti) e solo il primo tentativo per persona e caso', () => {
  assert.ok(AN.giusta({ tipo: 'distrattore', s: false })); assert.ok(!AN.giusta({ tipo: 'distrattore', s: true }));
  assert.ok(AN.giusta({ tipo: 'principale', s: true })); assert.ok(!AN.giusta({ tipo: 'principale', s: false }));
  const r = [{ account: 'a', caso: 'c1', data: '2026-01-02' }, { account: 'a', caso: 'c1', data: '2026-01-01' }, { account: 'b', caso: 'c1', data: '2026-01-03' }, { account: 'a', caso: 'c2', data: '2026-01-04' }];
  const p = AN.selezionaTentativi(r);
  assert.deepEqual(p.map((x) => `${x.account}${x.caso}${x.data.slice(-1)}`), ['ac11', 'bc13', 'ac24']);
  assert.equal(AN.selezionaTentativi(r, false).length, 4);
  const t = AN.selezionaTentativi([{ account: 'a', caso: 'c', data: '2', tentativo: 2 }, { account: 'a', caso: 'c', data: '1', tentativo: 1 }]);
  assert.equal(t.length, 1); assert.equal(t[0].tentativo, 1);
});

// ---------------------------------------------------------------- referto.js
test('htmlReferto: il testo dell\'utente è testo, mai HTML o script', () => {
  const cattivo = '<script>alert(1)</script><img src=x onerror=alert(2)>"&';
  const h = REF.htmlReferto({ titolo: cattivo, sottotitolo: cattivo, intestazione: [[cattivo, cattivo]], sezioni: [{ titolo: cattivo, testo: cattivo }], misure: [cattivo], firma: cattivo, piede: cattivo }, []);
  assert.ok(!h.includes('<script>alert') && !h.includes('<img src=x'), 'HTML dell\'utente non sfuggito');
  assert.ok(h.includes('&lt;script&gt;'));
});

// ---------------------------------------------------------------- gsps.js
const studio = { uid: '1.2.3.9', data: '', ora: '', id: 'ANONIMO', accesso: '', paziente: { nome: 'ANONIMO', id: 'caso-001', nascita: '', sesso: '' } };
// nel file (ordine dei byte) i tag devono essere crescenti, come vuole lo standard
const tagsInOrdine = (u8) => { const ds = dicomParser.parseDicom(u8); const t = Object.entries(ds.elements).sort((a, b) => a[1].dataOffset - b[1].dataOffset).map(([x]) => parseInt(x.slice(1), 16)); return t.every((v, i) => !i || v > t[i - 1]); };
test('gsps: presentation state leggibile, con i riferimenti alle immagini e tag in ordine crescente', () => {
  const im = { classe: '1.2.840.10008.5.1.4.1.1.2', uid: '1.2.3.9.1.1', serie: '1.2.3.9.1', cols: 512, rows: 512, wc: 40, ww: 400, grafici: [{ tipo: 'POLYLINE', punti: [1, 2, 30, 40] }], testi: [{ testo: 'nodulo', x: 10, y: 10 }] };
  const u8 = G.creaGSPS(studio, [im]); const ds = dicomParser.parseDicom(u8);
  assert.equal(ds.string('x00080016'), '1.2.840.10008.5.1.4.1.1.11.1'); assert.equal(ds.string('x0020000d'), studio.uid);
  assert.match(ds.string('x00080018'), /^2\.25\.\d+$/); assert.ok(Buffer.from(u8).toString('latin1').includes('1.2.3.9.1.1'));
  assert.ok(tagsInOrdine(u8), 'tag non in ordine crescente');
});
test('gsps: immagine chiave (secondary capture) e SR delle misure leggibili, in ordine', () => {
  const sc = G.creaSC({ rgb: new Uint8Array(3 * 4 * 4).fill(100), cols: 4, rows: 4, serie: '1.2.3.9.2', didascalia: 'Fig. 1' });
  const d = dicomParser.parseDicom(sc);
  assert.equal(d.string('x00280004'), 'RGB'); assert.equal(d.uint16('x00280010'), 4); assert.ok(tagsInOrdine(sc));
  const sr = G.creaSR(studio, [{ classe: '1.2.840.10008.5.1.4.1.1.2', uid: '1.2.3.9.1.1', serie: '1.2.3.9.1', sr: [{ nome: 'Lesione 1', valori: [{ codice: ['410668003', 'SCT', 'Length'], valore: 12.5, unita: ['mm', 'millimeter'] }], grafici: [{ tipo: 'POLYLINE', punti: [1, 2, 3, 4] }] }] }]);
  const s = dicomParser.parseDicom(sr);
  assert.equal(s.string('x00080016'), '1.2.840.10008.5.1.4.1.1.88.33'); assert.ok(tagsInOrdine(sr));
  assert.ok(Buffer.from(sr).toString('latin1').includes('12.5'));
});
test('gsps: nuovoUID valido (2.25., al massimo 64 caratteri) e ogni volta diverso', () => {
  const u = new Set(Array.from({ length: 200 }, G.nuovoUID));
  assert.equal(u.size, 200); for (const x of u) { assert.match(x, /^2\.25\.\d+$/); assert.ok(x.length <= 64); }
});
