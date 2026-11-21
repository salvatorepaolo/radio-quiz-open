// Anonimizzazione «a caso» (fuzz): centinaia di DICOM sintetici con dati del paziente INVENTATI, messi in campi,
// formati e combinazioni diverse a ogni giro, e file rovinati (tagliati, byte cambiati). Proprietà che devono valere sempre:
//  - nessun dato fuori dalla lista bianca sopravvive, nemmeno cercandolo nei byte del file prodotto;
//  - gli UID originali spariscono, i pixel restano identici;
//  - se un nome finisce in un campo tenuto (descrizione della serie), la verifica finale lo ferma;
//  - un file rovinato non blocca il programma, e se produce un risultato i dati non escono senza che la verifica lo fermi.
// Generatore deterministico: un errore indica il seme, e lo stesso seme riproduce lo stesso file (FUZZ_SEME=n per ripeterlo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dicomFinto, PIXEL } from './aiuti/dicom-finto.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url)), WEB = path.join(QUI, '../web');
{ const m = { exports: {} }; new Function('module', 'exports', 'require', fs.readFileSync(path.join(WEB, 'lib/dicomParser.min.js'), 'utf8'))(m, m.exports, createRequire(import.meta.url)); globalThis.dicomParser = m.exports; }
const A = await import(pathToFileURL(path.join(WEB, 'anonimizza.js')).href);
const GIRI = Number(process.env.FUZZ_GIRI || 1000), SOLO = process.env.FUZZ_SEME ? Number(process.env.FUZZ_SEME) : null;
const semi = SOLO != null ? [SOLO] : Array.from({ length: GIRI }, (_, i) => i + 1);

// mulberry32: numeri pseudo-casuali riproducibili
function caso(seme) { let a = seme >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const LETTERE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// campi identificativi (tutti fuori dalla lista bianca) con il loro VR; i privati (gruppo dispari) vanno sempre tolti
const CAMPI = [['00100010', 'PN'], ['00100020', 'LO'], ['00101000', 'LO'], ['00101040', 'LO'], ['00102154', 'SH'], ['00080050', 'SH'], ['00080080', 'LO'],
  ['00080081', 'ST'], ['00080090', 'PN'], ['00080092', 'ST'], ['00081010', 'SH'], ['00081030', 'LO'], ['00081040', 'LO'], ['00081050', 'PN'], ['00081070', 'PN'],
  ['00321032', 'PN'], ['00204000', 'LT'], ['00400254', 'LO'], ['00181000', 'LO'], ['00200010', 'SH'], ['00102000', 'LT'], ['00104000', 'LT'],
  ['00091010', 'LO'], ['00191010', 'LO'], ['00291010', 'LO'], ['00431027', 'SH']];
const DATE = [['00100030', 'DA'], ['00080020', 'DA'], ['00080021', 'DA'], ['00080030', 'TM']];

function generaFile(seme) {
  const r = caso(seme), n = (k) => Math.floor(r() * k), parola = () => Array.from({ length: 7 + n(5) }, () => LETTERE[n(26)]).join('');
  const parole = [], campi = {};
  for (const [tag, vr] of CAMPI) {
    if (r() < 0.5) continue;
    const a = parola(), b = parola(); parole.push(a, b);
    const forme = vr === 'PN' ? [`${a}^${b}`, `${a}^${b}^^DR`, `${a}=${b}`] : [`${a} ${b}`, `${a}\\${b}`, ` ${a}-${b} `, `${a.toLowerCase()} ${b}`];
    campi[tag] = [vr, forme[n(forme.length)]];
  }
  if (!parole.length) { const a = parola(), b = parola(); parole.push(a, b); campi['00100010'] = ['PN', `${a}^${b}`]; }
  const date = [];
  for (const [tag, vr] of DATE) if (r() < 0.6) { const d = vr === 'DA' ? `${1930 + n(80)}${String(1 + n(12)).padStart(2, '0')}${String(1 + n(28)).padStart(2, '0')}` : `${String(n(24)).padStart(2, '0')}${String(n(60)).padStart(2, '0')}${String(n(60)).padStart(2, '0')}`; campi[tag] = [vr, d]; date.push(d); }
  const uid = () => `1.2.826.0.1.3680043.${n(1e6)}.${n(1e6)}.${n(1e6)}`, uids = {};
  for (const t of ['00080018', '0020000d', '0020000e', '00200052']) { uids[t] = uid(); campi[t] = ['UI', uids[t]]; }
  campi['00080016'] = ['UI', '1.2.840.10008.5.1.4.1.1.2'];
  return { file: dicomFinto(campi), parole, date, uids: Object.values(uids), r };
}
const contiene = (u8, s) => Buffer.from(u8).includes(Buffer.from(s, 'latin1'));
const opz = (s) => ({ idCaso: `caso-fuzz-${s}`, sale: `sale-${s}` });
// testo di tutti i campi tranne gli UID (rigenerati: lunghe cifre casuali dove 6 cifre di un orario possono capitare per caso)
const testiNonUID = (u8) => { const d = dicomParser.parseDicom(u8, { untilTag: 'x7fe00010' }); return Object.entries(d.elements).filter(([, e]) => e.vr !== 'UI').map(([t]) => d.string(t) || '').join('|'); };
const pixel = (u8) => { const d = dicomParser.parseDicom(u8), e = d.elements.x7fe00010; return Buffer.from(u8.buffer, u8.byteOffset + e.dataOffset, e.length); };

test(`fuzz: ${semi.length} file con dati inventati in campi e forme diverse — niente esce, UID rigenerati, pixel identici`, async () => {
  for (const s of semi) {
    const { file, parole, date, uids } = generaFile(s), out = await A.anonimizza(file.buffer, opz(s));
    for (const p of parole) { assert.ok(!contiene(out, p) && !contiene(out, p.toLowerCase()), `seme ${s}: «${p}» rimasto nel file`); }
    const testi = testiNonUID(out);
    for (const d of date) assert.ok(!testi.includes(d), `seme ${s}: data o ora ${d} rimasta`);
    for (const u of uids) assert.ok(!contiene(out, u), `seme ${s}: UID originale rimasto`);
    assert.deepEqual(A.controllaIntestazione(out, opz(s).idCaso), [], `seme ${s}: intestazione sospetta`);
    assert.equal(A.verifica(out, A.paroleVietate(file.buffer)), null, `seme ${s}: la verifica trova ancora qualcosa`);
    assert.ok(pixel(out).equals(Buffer.from(PIXEL)), `seme ${s}: pixel cambiati`);
  }
});

test('fuzz: un nome scritto anche nella descrizione della serie (campo tenuto) viene fermato dalla verifica finale', async () => {
  for (const s of semi.slice(0, 100)) {
    const r = caso(s * 7919), a = Array.from({ length: 8 }, () => LETTERE[Math.floor(r() * 26)]).join('');
    const file = dicomFinto({ '00100010': ['PN', `${a}^MARIO`], '0008103e': ['LO', `TC TORACE ${r() < 0.5 ? a : a.toLowerCase()}`] });
    const out = await A.anonimizza(file.buffer, opz(s));
    assert.match(A.verifica(out, A.paroleVietate(file.buffer)) || '', /trovato in x0008103e/, `seme ${s}: nome nella descrizione non fermato`);
  }
});

test('fuzz: file rovinati (tagliati o con byte cambiati) non bloccano il programma e non fanno uscire dati senza che la verifica li fermi', async () => {
  let rifiutati = 0, prodotti = 0;
  for (const s of semi) {
    const { file, parole, r } = generaFile(s), n = (k) => Math.floor(r() * k);
    const rovinato = file.slice(0, r() < 0.4 ? 132 + n(file.length - 132) : file.length);
    if (rovinato.length === file.length) for (let k = 1 + n(12); k > 0; k--) rovinato[132 + n(rovinato.length - 132)] = n(256);
    const info = A.analizza(rovinato.buffer.slice(0));          // non deve mai lanciare eccezioni
    assert.equal(typeof info, 'object', `seme ${s}`);
    let out;
    try { out = await A.anonimizza(rovinato.buffer.slice(0), opz(s)); } catch { rifiutati++; continue; }
    prodotti++;
    const fuori = parole.filter((p) => contiene(out, p));
    if (!fuori.length) continue;
    // se qualcosa è rimasto, la verifica che il sito fa prima dell'invio deve fermare il file
    let fermato; try { fermato = A.verifica(out, A.paroleVietate(file.buffer)); } catch { fermato = 'file illeggibile'; }
    assert.ok(fermato, `seme ${s}: «${fuori[0]}» nel file prodotto da un DICOM rovinato e la verifica non lo ferma`);
  }
  assert.ok(rifiutati + prodotti === semi.length);
});
