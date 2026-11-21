// Scale e classificazioni (web/scale-dati.js, web/scale-indice.js): test di unità e di non regressione.
// - unità: casi clinici con il risultato atteso dalle linee guida (RENAL, TI-RADS, Fleischner, Bosniak, Fazekas,
//   Genant, steatosi, RECIST);
// - non regressione: tutti i risultati devono coincidere con la fotografia presa da app.js prima della divisione
//   (fixture/scale-fotografia.json, circa 4000 combinazioni di risposte);
// - coerenza: l'indice usato da app.js coincide con le scale vere; scale.js importa solo ciò che app.js esporta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fotografia } from './scale-fotografia.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url)), WEB = path.join(QUI, '../web');
const M = await import(pathToFileURL(path.join(WEB, 'scale-dati.js')).href);
const { SCALE_INDICE } = await import(pathToFileURL(path.join(WEB, 'scale-indice.js')).href);
const testo = (k, v) => M.SCALE[k].calcola(v)?.testo || '';

test('RENAL: punteggio e classe di complessità', () => {
  assert.match(testo('renal', { r: 30, e: '1', n: 8, l: '1' }), /^RENAL 4: bassa complessità/);
  assert.match(testo('renal', { r: 50, e: '2', n: 5, l: '2' }), /^RENAL 8: complessità intermedia/);
  assert.match(testo('renal', { r: 80, e: '3', n: 3, l: '3', a: 'p', h: 'h' }), /^RENAL 12ph: alta complessità/);
  assert.equal(M.SCALE.renal.calcola({ r: 30, e: '1', n: 8 }), null, 'senza L il calcolo non si fa');
});
test('ACR TI-RADS: punti, categoria e agoaspirato', () => {
  assert.match(testo('tirads', { c: '0', e: '0', s: '0', m: '0', f: [], d: 30 }), /TR1 \(0 punti.*nessun agoaspirato/);
  assert.match(testo('tirads', { c: '1', e: '1', s: '0', m: '0', f: [], d: 20 }), /TR2 \(2 punti.*nessun agoaspirato/);
  assert.match(testo('tirads', { c: '2', e: '2', s: '0', m: '0', f: [], d: 20 }), /TR4 \(4 punti.*: agoaspirato/);
  assert.match(testo('tirads', { c: '2', e: '3', s: '3', m: '0', f: ['3'], d: 12 }), /TR5 \(11 punti.*: agoaspirato/);
});
test('Fleischner 2017: nodulo singolo solido e a vetro smerigliato', () => {
  assert.match(testo('fleischner', { t: 'solido', num: '1', d: 4, r: 'basso' }), /nessun controllo di routine/);
  assert.match(testo('fleischner', { t: 'solido', num: '1', d: 7, r: 'basso' }), /TC a 6-12 mesi/);
  assert.match(testo('fleischner', { t: 'solido', num: '1', d: 10, r: 'basso' }), /TC a 3 mesi, PET-TC o campionamento/);
  assert.match(testo('fleischner', { t: 'vetro', num: '1', d: 4 }), /nessun controllo di routine/);
  assert.match(testo('fleischner', { t: 'vetro', num: '1', d: 8 }), /ogni 2 anni fino a 5 anni/);
});
test('Bosniak 2019', () => {
  assert.match(testo('bosniak', { q: 'I' }), /benigna, nessun controllo/);
  assert.match(testo('bosniak', { q: 'IIF' }), /6 e 12 mesi/);
  assert.match(testo('bosniak', { q: 'IV' }), /chirurgia \(malignità circa 90%\)/);
});
test('Fazekas', () => {
  assert.match(testo('fazekas', { pv: '0', dp: '0' }), /nessuna leucoencefalopatia/);
  assert.match(testo('fazekas', { pv: '1', dp: '1' }), /lieve/);
  assert.match(testo('fazekas', { pv: '3', dp: '3' }), /grave/);
});
test('Genant: riduzione di altezza e grado', () => {
  assert.match(testo('genant', { liv: 'L1', ha: 17, hm: 20, hp: 20 }), /15%.*Genant 0/);
  assert.match(testo('genant', { liv: 'L1', ha: 13, hm: 20, hp: 20 }), /35%.*cuneo.*Genant 2/);
  assert.match(testo('genant', { liv: 'L1', ha: 10, hm: 20, hp: 20 }), /50%.*Genant 3/);
});
test('Steatosi in TC senza mdc', () => {
  assert.match(testo('steatosi', { f: 30 }), /moderata-grave/);
  assert.match(testo('steatosi', { f: 60, m: 50 }), /nessuna steatosi significativa/);
});
test('RECIST 1.1: CR, PR, SD, PD', () => {
  const r = (v) => testo('recist', { cr: 'no', nt: 'nessuna', nu: 'no', ...v });
  assert.match(r({ sa: 70, sb: 100 }), /risposta parziale \(PR\)/);
  assert.match(r({ sa: 95, sb: 100, nt: 'presenti' }), /malattia stabile \(SD\)/);
  assert.match(r({ sa: 120, sb: 100, sn: 100 }), /progressione di malattia \(PD\) per somma \+20%/);
  assert.match(r({ sa: 95, sb: 100, nu: 'si' }), /PD\) per nuove lesioni/);
  assert.match(r({ sa: 0, sb: 100, cr: 'si', nt: 'scomparse' }), /risposta completa \(CR\)/);
});
test('non regressione: risultati identici alla fotografia presa prima della divisione', () => {
  const atteso = JSON.parse(fs.readFileSync(path.join(QUI, 'fixture/scale-fotografia.json'), 'utf8'));
  const ora = fotografia(M);
  assert.deepEqual(Object.keys(ora).sort(), Object.keys(atteso).sort(), 'scale aggiunte o tolte');
  for (const k of Object.keys(atteso)) assert.deepEqual(ora[k], atteso[k], `la scala «${k}» dà risultati diversi`);
});
test('nessun calcolo va in errore con le risposte della fotografia', () => {
  for (const [k, v] of Object.entries(fotografia(M))) if (!k.startsWith('_'))
    for (const [r, x] of v.risultati) assert.ok(typeof x !== 'string', `${k} ${JSON.stringify(r)}: ${x}`);
});
test('indice delle scale (app.js) coerente con le scale vere', () => {
  assert.deepEqual(Object.keys(SCALE_INDICE), Object.keys(M.SCALE));
  for (const [k, S] of Object.entries(M.SCALE)) assert.deepEqual(SCALE_INDICE[k], { nome: S.nome, metodiche: S.metodiche }, k);
});
test('moduli: app.js non carica le scale all\'avvio; ogni modulo esiste ed è nella cache del client offline', () => {
  const app = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8'), sw = fs.readFileSync(path.join(WEB, 'client/sw.js'), 'utf8');
  const statici = [...app.matchAll(/^import .*? from '\.\/([\w-]+\.js)'/gm)].map((m) => m[1]);
  assert.ok(!statici.includes('scale.js') && !statici.includes('scale-dati.js'), 'le scale devono restare a richiesta');
  assert.match(app, /import\('\.\/scale\.js'\)/);
  const usati = new Set([...statici, 'scale.js']);
  for (const f of ['scale.js', 'scale-dati.js']) for (const m of fs.readFileSync(path.join(WEB, f), 'utf8').matchAll(/^import .*? from '\.\/([\w-]+\.js)'/gm)) usati.add(m[1]);
  for (const f of usati) {
    assert.ok(fs.existsSync(path.join(WEB, f)), `manca ${f}`);
    assert.ok(sw.includes(`'/${f}'`), `${f} non è nella cache del client (client/sw.js): senza rete non si aprirebbe`);
  }
});
test('scale.js non importa app.js e riceve dal ponte tutti i nomi che usa', async () => {
  // nel client offline un import './app.js' da un modulo caricato a richiesta rieseguirebbe app.js (pagina azzerata)
  const app = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8'), ui = fs.readFileSync(path.join(WEB, 'scale.js'), 'utf8');
  assert.doesNotMatch(ui, /from '\.\/app\.js'|import\('\.\/app\.js'\)/);
  const ponte = app.match(/const PONTE_SCALE = \{(.*)\};/)[1];
  const nomi = JSON.parse(ui.match(/export const NOMI_APP = (\[.*\]);/)[1]);
  for (const n of nomi) assert.ok(ponte.includes(`get ${n}() { return ${n}; }`), `il ponte non passa ${n}`);
  // e nel modulo non resta nessun uso «nudo» di quei nomi fuori dal ponte (A.nome)
  const corpo = ui.slice(ui.indexOf('export const NOMI_APP'));
  for (const n of nomi.filter((x) => /^[A-Za-z_]\w{3,}$/.test(x))) assert.ok(!new RegExp(`(?<![\\w.$'"])${n}\\(`).test(corpo.replace(/A\.\w+/g, '')), `${n} usato senza A.`);
});
test('scale.js e scale-dati.js non fanno nulla al caricamento (niente pulsanti legati né osservatori)', () => {
  // ciò che va fatto all'avvio deve stare in app.js: questi moduli arrivano solo quando si aprono le scale
  for (const f of ['scale.js', 'scale-dati.js']) {
    const righe = fs.readFileSync(path.join(WEB, f), 'utf8').split('\n');
    const strane = righe.map((l, i) => [i + 1, l]).filter(([, l]) => l && !/^(\s|\/\/|import |export |const |let |function |async function |[}\])])/.test(l));
    assert.deepEqual(strane, [], `${f}: istruzioni eseguite al caricamento`);
  }
});
