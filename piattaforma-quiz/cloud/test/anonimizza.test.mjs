// Anonimizzazione DICOM nel browser (web/anonimizza.js): test di unità e di non regressione.
// È la parte più delicata per la privacy: i dati del paziente non devono mai lasciare il computer.
// Si usano DICOM sintetici con dati inventati (aiuti/dicom-finto.mjs) e un'immagine vera e anonima di TCIA.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dicomFinto, PAZIENTE_FINTO, PIXEL, voce } from './aiuti/dicom-finto.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url)), WEB = path.join(QUI, '../web');
// dicomParser come nel browser (script classico): eseguito con module/exports finti, come lo leggerebbe CommonJS
{ const m = { exports: {} }; new Function('module', 'exports', 'require', fs.readFileSync(path.join(WEB, 'lib/dicomParser.min.js'), 'utf8'))(m, m.exports, createRequire(import.meta.url)); globalThis.dicomParser = m.exports; }
const A = await import(pathToFileURL(path.join(WEB, 'anonimizza.js')).href);
const leggi = (u8) => dicomParser.parseDicom(u8);
const testo = (ds, t) => (ds.string(t) || '').trim();
const opz = { idCaso: 'caso-prova-001', sale: 'sale-di-prova' };
const conPaziente = () => dicomFinto(PAZIENTE_FINTO);

test('analizza: un file con dati del paziente è riconosciuto (TC, serie, posizione) senza modificarlo', () => {
  const f = conPaziente(), copia = f.slice(), i = A.analizza(f.buffer);
  assert.equal(i.escluso, null); assert.equal(i.modalita, 'CT'); assert.equal(i.serieNum, 3); assert.equal(i.istanza, 12); assert.equal(i.posizione, -50);
  assert.deepEqual(f, copia, 'analizza non deve toccare il file');
});
test('analizza: esclude ciò che non si può anonimizzare con certezza', () => {
  const casi = [
    [{ '00280301': ['CS', 'YES'] }, /testo impresso/],
    [{ '00080016': ['UI', '1.2.840.10008.5.1.4.1.1.7'] }, /secondary capture/],
    [{ '00080016': ['UI', '1.2.840.10008.5.1.4.1.1.88.22'] }, /referto strutturato/],
    [{ '00080008': ['CS', 'DERIVED\\SECONDARY\\SCREEN SAVE'] }, /schermata/],
    [{ '00280004': ['CS', 'RGB'] }, /colori/],
    [{ '00080068': ['CS', 'FOR PROCESSING'] }, /for processing/],
  ];
  for (const [campi, motivo] of casi) assert.match(A.analizza(dicomFinto(campi).buffer).escluso || '', motivo, JSON.stringify(campi));
  assert.match(A.analizza(dicomFinto({}, { senzaPixel: true }).buffer).escluso, /senza immagine/);
  assert.match(A.analizza(new Uint8Array(300).buffer).escluso, /non è un file DICOM/);
});
test('paroleVietate: raccoglie nome, codice, struttura, medici (parole di almeno 4 lettere)', () => {
  const v = A.paroleVietate(conPaziente().buffer);
  for (const p of ['ROSSIGNOLI', 'MARCELLO', 'RSSMRC80A01H501Z', 'SANTACROCE', 'BIANCHERI', 'VERDOLINI', 'GARIBALDI', 'PALERMO', 'ACC9988776']) assert.ok(v.has(p), p);
  assert.ok(![...v].some((p) => p.length < 4));
  assert.ok(!A.paroleVietate(dicomFinto({ '00100010': ['PN', 'ANONIMO^CASO12'] }).buffer).has('ANONIMO'));
});
test('anonimizza: nessun dato del paziente nel file prodotto (verifica e controllo dell\'intestazione)', async () => {
  const f = conPaziente(), vietate = A.paroleVietate(f.buffer);
  const out = await A.anonimizza(f.buffer, opz);
  assert.equal(A.verifica(out, vietate), null);
  assert.deepEqual(A.controllaIntestazione(out, opz.idCaso), []);
  // anche cercando i byte grezzi in tutto il file, non solo nei campi letti
  const grezzo = Buffer.from(out).toString('latin1');
  for (const p of vietate) assert.ok(!grezzo.includes(p), `«${p}» ancora nel file`);
  const ds = leggi(out);
  assert.match(testo(ds, 'x00100010'), /^ANONIMO/); assert.equal(testo(ds, 'x00100020'), opz.idCaso);
  for (const t of ['x00100030', 'x00080020', 'x00080030', 'x00080080', 'x00080090', 'x00321032', 'x00091010', 'x00204000', 'x00101040'])
    assert.equal(ds.elements[t], undefined, `${t} non tolto`);
});
test('anonimizza: i campi tecnici e i pixel restano identici', async () => {
  const f = conPaziente(), ds0 = leggi(f), ds = leggi(await A.anonimizza(f.buffer, opz));
  for (const t of ['x00080060', 'x0008103e', 'x00200011', 'x00200013', 'x00200032', 'x00200037', 'x00280030', 'x00281050', 'x00281051', 'x00281052'])
    assert.equal(testo(ds, t), testo(ds0, t), t);
  for (const t of ['x00280010', 'x00280011', 'x00280100', 'x00280103']) assert.equal(ds.uint16(t), ds0.uint16(t), t);
  const p = ds.elements.x7fe00010; assert.deepEqual(new Uint8Array(ds.byteArray.buffer, ds.byteArray.byteOffset + p.dataOffset, p.length), PIXEL);
});
test('anonimizza: UID rigenerati, coerenti con la stessa chiave (serie unite) e diversi con un\'altra', async () => {
  const f = conPaziente(), a = leggi(await A.anonimizza(f.buffer, opz)), b = leggi(await A.anonimizza(f.buffer, opz));
  const c = leggi(await A.anonimizza(f.buffer, { ...opz, sale: 'altra' }));
  for (const t of ['x00080018', 'x0020000d', 'x0020000e']) {
    const u = testo(a, t);
    assert.match(u, /^2\.25\.\d+$/, t); assert.ok(u.length <= 64, `${t} più lungo di 64`);
    assert.notEqual(u, testo(leggi(f), t)); assert.equal(u, testo(b, t)); assert.notEqual(u, testo(c, t));
  }
  // due immagini della stessa serie restano nella stessa serie
  const f2 = dicomFinto({ ...PAZIENTE_FINTO, '00080018': ['UI', '1.2.3.4.5.6.7.99'], '00200013': ['IS', '13'] });
  const d2 = leggi(await A.anonimizza(f2.buffer, opz));
  assert.equal(testo(d2, 'x0020000e'), testo(a, 'x0020000e')); assert.notEqual(testo(d2, 'x00080018'), testo(a, 'x00080018'));
});
test('controllaIntestazione: segnala il file con dati del paziente (campi, date, privati), senza riportare i valori', () => {
  const p = A.controllaIntestazione(conPaziente(), opz.idCaso), testoP = p.join(' | ');
  assert.ok(p.includes('nome del paziente non anonimo')); assert.ok(p.includes('codice del paziente diverso dal caso'));
  assert.match(testoP, /campo privato/); assert.match(testoP, /x00100030|x00080020/);
  assert.doesNotMatch(testoP, /ROSSIGNOLI|SANTACROCE|BIANCHERI|19800101/, 'il controllo non deve mostrare i dati');
});
test('verifica: trova una parola vietata rimasta in un campo tenuto', () => {
  const f = dicomFinto({ '00100010': ['PN', 'ANONIMO'], '0008103e': ['LO', 'TORACE ROSSIGNOLI'] });
  assert.match(A.verifica(f, new Set(['ROSSIGNOLI'])) || '', /ROSSIGNOLI.*x0008103e/);
});
// le immagini non sono in git: su GitHub questo test si salta
const TCIA = path.join(QUI, '../../casi-free/caso-tcia-001');
const tciaPresente = (() => { try { const s = JSON.parse(fs.readFileSync(path.join(TCIA, 'serie.json'), 'utf8'))[0]; return fs.existsSync(path.join(TCIA, s.files[0])); } catch { return false; } })();
test('non regressione su un\'immagine vera (TCIA): dopo l\'anonimizzazione pixel identici e intestazione pulita', { skip: !tciaPresente && 'immagine TCIA assente' }, async () => {
  const dir = TCIA;
  const serie = JSON.parse(fs.readFileSync(path.join(dir, 'serie.json'), 'utf8'))[0], f = new Uint8Array(fs.readFileSync(path.join(dir, serie.files[0])));
  const i = A.analizza(f.buffer); assert.equal(i.escluso, null);
  const out = await A.anonimizza(f.buffer, opz), ds0 = leggi(f), ds = leggi(out);
  assert.deepEqual(A.controllaIntestazione(out, opz.idCaso), []);
  const px = (d) => { const e = d.elements.x7fe00010; return Buffer.from(d.byteArray.buffer, d.byteArray.byteOffset + e.dataOffset, e.length); };
  assert.ok(px(ds0).equals(px(ds)), 'pixel cambiati');
});

// ---- 1.254: parti indicate scoperte dalla misura di copertura (qualita/copertura.sh) ----
const le32 = (n) => { const u = new Uint8Array(4); new DataView(u.buffer).setUint32(0, n, true); return u; };
const fd64 = (x) => { const u = new Uint8Array(8); new DataView(u.buffer).setFloat64(0, x, true); return u; };
const pixelDi = (u8) => { const d = leggi(u8), e = d.elements.x7fe00010; return { d, e, px: u8.slice(e.dataOffset, e.dataOffset + e.length) }; };
const parola = (s) => Array.from(s, (c) => c.charCodeAt(0));
// pixel compressi (lunghezza indefinita): tabella degli offset vuota, un frammento, fine sequenza
const compresso = (frammento) => { const b = [...frammento]; if (b.length % 2) b.push(0); const n = b.length;
  return [0xe0, 0x7f, 0x10, 0x00, ...parola('OB'), 0, 0, 0xff, 0xff, 0xff, 0xff, 0xfe, 0xff, 0x00, 0xe0, 0, 0, 0, 0,
    0xfe, 0xff, 0x00, 0xe0, n & 255, (n >> 8) & 255, 0, 0, ...b, 0xfe, 0xff, 0xdd, 0xe0, 0, 0, 0, 0]; };
const JPEG = '1.2.840.10008.1.2.4.50';
const valori = (px) => [...new Uint16Array(px.buffer, 0, 16)];
const originali = valori(PIXEL.slice());

test('testo impresso coperto (MONOCHROME2): la zona prende il colore del fondo, il resto dei pixel non cambia, niente dati del paziente', async () => {
  const f = conPaziente(), out = await A.anonimizza(f.buffer, { ...opz, oscura: [{ x0: 0, y0: 0, x1: 1, y1: 0 }] });
  assert.deepEqual(A.controllaIntestazione(out, opz.idCaso), []);
  assert.equal(A.verifica(out, A.paroleVietate(f.buffer)), null);
  const { d, px } = pixelDi(out), v = valori(px);
  assert.equal(testo(d, 'x00020010'), '1.2.840.10008.1.2.1');
  assert.deepEqual(v.slice(0, 2), [0, 0], 'zona coperta con il nero (minimo)');
  assert.deepEqual(v.slice(2), originali.slice(2), 'fuori dalla zona i pixel restano quelli originali');
});
test('testo impresso coperto (MONOCHROME1): il fondo è il valore più alto; zone fuori dall\'immagine non rompono nulla', async () => {
  const f = dicomFinto({ ...PAZIENTE_FINTO, '00280004': ['CS', 'MONOCHROME1'] });
  const out = await A.anonimizza(f.buffer, { ...opz, oscura: [{ x0: -5, y0: 3, x1: 0.2, y1: 99 }] });
  const v = valori(pixelDi(out).px), fondo = Math.max(originali[0], originali[7], originali[14]);
  // la zona si arrotonda verso l'esterno (x1 = 0.2 copre anche la colonna 1): meglio coprire un pixel in più
  assert.deepEqual(v.slice(12, 14), [fondo, fondo]); assert.deepEqual(v.slice(0, 12), originali.slice(0, 12)); assert.deepEqual(v.slice(14), originali.slice(14));
});
test('testo impresso su immagine compressa: senza decodificatore si ferma; con il decodificatore i pixel originali compressi non escono', async () => {
  const f = dicomFinto(PAZIENTE_FINTO, { ts: JPEG, pixelGrezzo: compresso(parola('ROSSIGNOLI-NEI-PIXEL')) });
  await assert.rejects(A.anonimizza(f.buffer, { ...opz, oscura: [{ x0: 0, y0: 0, x1: 1, y1: 1 }] }), /compressa/);
  const out = await A.anonimizza(f.buffer, { ...opz, oscura: [{ x0: 0, y0: 0, x1: 0, y1: 0 }], decodifica: () => ({ pix: new Uint16Array(16).fill(500) }) });
  const { d, e, px } = pixelDi(out);
  assert.equal(testo(d, 'x00020010'), '1.2.840.10008.1.2.1'); assert.ok(!e.encapsulatedPixelData);
  assert.deepEqual(valori(px), new Array(16).fill(500));
  assert.ok(!Buffer.from(out).includes(Buffer.from('ROSSIGNOLI')), 'il frammento compresso originale è rimasto nel file');
  assert.deepEqual(A.controllaIntestazione(out, opz.idCaso), []);
});
test('immagine compressa senza testo da coprire: pixel compressi copiati identici, sintassi di trasferimento mantenuta, intestazione pulita', async () => {
  const fr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], f = dicomFinto(PAZIENTE_FINTO, { ts: JPEG, pixelGrezzo: compresso(fr) });
  const out = await A.anonimizza(f.buffer, opz), d = leggi(out), e = d.elements.x7fe00010;
  assert.equal(testo(d, 'x00020010'), JPEG); assert.ok(e.encapsulatedPixelData); assert.equal(e.fragments.length, 1);
  assert.deepEqual([...out.slice(e.fragments[0].position, e.fragments[0].position + fr.length)], fr);
  assert.deepEqual(A.controllaIntestazione(out, opz.idCaso), []);
  assert.equal(A.verifica(out, A.paroleVietate(f.buffer)), null);
});
// ecografia: regione d'immagine x 1-2, y 1-2 di un'immagine 4×4 RGB; tutto il resto (dove l'ecografo scrive nome e data) va annerito
const regione = { '00186012': ['US', 1], '00186018': ['UL', le32(1)], '0018601a': ['UL', le32(1)], '0018601c': ['UL', le32(2)], '0018601e': ['UL', le32(2)],
  '00186024': ['US', 3], '00186026': ['US', 3], '0018602c': ['FD', fd64(0.05)], '0018602e': ['FD', fd64(0.04)] };
const eco = (pixel, extra = {}) => dicomFinto({ ...PAZIENTE_FINTO, '00080016': ['UI', '1.2.840.10008.5.1.4.1.1.6.1'], '00080060': ['CS', 'US'], '00280002': ['US', 3],
  '00280004': ['CS', 'RGB'], '00280006': ['US', 0], '00280100': ['US', 8], '00280101': ['US', 8], '00280102': ['US', 7], '00280030': null, '00281050': null, '00281051': null,
  '00281052': null, '00281053': null, '00200032': null, '00200037': null, '00201041': null, '00186011': ['SQ', voce(regione)], '7fe00010': ['OB', pixel], ...extra });
const dentro = (i) => { const x = i % 4, y = Math.floor(i / 4); return x >= 1 && x <= 2 && y >= 1 && y <= 2; };
test('ecografia: fuori dalle regioni d\'immagine tutto nero, dentro invariato, RGB non compresso, spaziatura dalla regione, niente dati del paziente', async () => {
  const f = eco(new Uint8Array(48).fill(200)), out = await A.anonimizza(f.buffer, opz), { d, px } = pixelDi(out);
  for (let i = 0; i < 16; i++) assert.deepEqual([...px.slice(i * 3, i * 3 + 3)], dentro(i) ? [200, 200, 200] : [0, 0, 0], `pixel ${i}`);
  assert.equal(testo(d, 'x00280004'), 'RGB'); assert.equal(d.uint16('x00280002'), 3); assert.equal(d.uint16('x00280006'), 0);
  assert.equal(testo(d, 'x00280030'), '0.400000\\0.500000');
  assert.equal(testo(d, 'x00020010'), '1.2.840.10008.1.2.1');
  assert.deepEqual(A.controllaIntestazione(out, opz.idCaso), []);
  assert.equal(A.verifica(out, A.paroleVietate(f.buffer)), null);
});
test('ecografia a piani separati (PlanarConfiguration 1): i colori vengono rimessi in ordine RGB', async () => {
  const p = new Uint8Array(48); p.fill(10, 0, 16); p.fill(20, 16, 32); p.fill(30, 32, 48);
  const px = pixelDi(await A.anonimizza(eco(p, { '00280006': ['US', 1] }).buffer, opz)).px;
  for (let i = 0; i < 16; i++) assert.deepEqual([...px.slice(i * 3, i * 3 + 3)], dentro(i) ? [10, 20, 30] : [0, 0, 0], `pixel ${i}`);
});
test('ecografia senza regioni d\'immagine: per prudenza tutta l\'immagine viene annerita', async () => {
  const px = pixelDi(await A.anonimizza(eco(new Uint8Array(48).fill(200), { '00186011': null }).buffer, opz)).px;
  assert.ok(px.every((v) => v === 0));
});

// ---- 1.256: falle trovate dal test «a caso» (anonimizza-fuzz.test.mjs), stessa regola di anonimizza.py ----
test('file malformato: un campo tenuto con una lunghezza sbagliata che «inghiotte» i campi seguenti fa escludere il file', async () => {
  const f = conPaziente(), b = Buffer.from(f), i = b.indexOf(Buffer.from([0x08, 0x00, 0x60, 0x00, 0x43, 0x53, 0x02, 0x00, 0x43, 0x54]));   // Modality «CT»
  assert.ok(i > 0);
  let j = i + 10; for (let k = 0; k < 2; k++) j += 8 + b.readUInt16LE(j + 6);   // finisce dopo i due campi seguenti
  b.writeUInt16LE(j - (i + 8), i + 6);
  const ds = leggi(new Uint8Array(b)); assert.ok(ds.elements.x00080060.length > 2, 'il campo deve aver inghiottito altri campi');
  await assert.rejects(A.anonimizza(new Uint8Array(b).buffer, opz), /non conforme/);
});
test('campoConforme: testo seguito da altri dati, o parole dentro un campo binario, non è conforme', () => {
  const t = (s) => Uint8Array.from(Buffer.from(s, 'latin1'));
  assert.ok(A.campoConforme('x00080060', 'CS', t('CT')));
  assert.ok(A.campoConforme('x0008103e', 'LO', t('TORACE 1.25 ')));
  assert.ok(A.campoConforme('x0008103e', 'LO', t('TORACE\0\0')), 'zeri di riempimento in fondo ammessi');
  assert.ok(!A.campoConforme('x00080060', 'CS', t('CT\x08\x00\x80\x00LO\x14\x00OSPEDALE SANTACROCE')));
  assert.ok(!A.campoConforme('x00080060', undefined, t('CT\0ROSSIGNOLI')), 'VR implicito');
  assert.ok(A.campoConforme('x00280010', 'US', Uint8Array.from([4, 0])));
  assert.ok(!A.campoConforme('x00280010', 'US', t('\x04\x00ROSSIGNOLI')), 'parole dentro un campo binario');
});
test('gruppo 0028: i commenti liberi (Image Presentation Comments) vengono tolti, i testi tecnici restano', async () => {
  const f = dicomFinto({ ...PAZIENTE_FINTO, '00284000': ['LT', 'COMMENTO CON ROSSIGNOLI'], '00281055': ['LO', 'MEDIASTINO'] });
  const out = await A.anonimizza(f.buffer, opz), ds = leggi(out);
  assert.equal(ds.elements.x00284000, undefined); assert.ok(!Buffer.from(out).includes(Buffer.from('ROSSIGNOLI')));
  assert.equal(testo(ds, 'x00281055'), 'MEDIASTINO');
  assert.match(A.controllaIntestazione(f, opz.idCaso).join(' '), /x00284000/, 'il controllo dei file pubblicati lo segnala');
});

// ---- rafforzati dopo il test dei test (qualita/mutazioni.sh): parti dove un errore introdotto apposta non veniva notato ----
test('controllaIntestazione: ogni tipo di testo sospetto in un campo tenuto viene segnalato (strutture, medici, indirizzi, email, date, codice fiscale)', async () => {
  const sospetti = ['OSPEDALE CIVICO', 'PRESIDIO NORD', 'POLICLINICO DI PROVA', 'AZIENDA SANITARIA', 'ASP 6', 'AOU PROVA', 'AO PROVA', 'ASL 3', 'IRCCS PROVA',
    'CLINICA SAN PROVA', 'CASA DI CURA PROVA', 'DOTT ROSSI', 'DR. ROSSI', 'PROF. ROSSI', 'VIA ROMA 1', 'VIALE DEI PINI', 'PIAZZA GRANDE', 'mario@esempio.test',
    'TC 12/03/1980', 'TC 1-2-80', 'TC 3.4.2024', 'RSSMRA80A01H501U'];
  for (const t of sospetti) {
    const out = await A.anonimizza(dicomFinto({ '0008103e': ['LO', t] }).buffer, opz);
    assert.ok(A.controllaIntestazione(out, opz.idCaso).includes('testo sospetto (x0008103e)'), `non segnalato: «${t}»`);
  }
  for (const t of ['TORACE 1.25 MEDIASTINO', 'ADDOME FASE ARTERIOSA', 'T2 FLAIR ASSIALE', 'DWI b1000', 'Clinico']) {
    const out = await A.anonimizza(dicomFinto({ '0008103e': ['LO', t] }).buffer, opz);
    assert.deepEqual(A.controllaIntestazione(out, opz.idCaso), [], `falso allarme su «${t}»`);
  }
});
test('campoConforme: limiti esatti (6 lettere di fila in un campo binario, lettere A-Z e a-z, separatori, caratteri di controllo ammessi)', () => {
  const b = (s) => Uint8Array.from(Buffer.from(s, 'latin1'));
  assert.ok(A.campoConforme('x00280010', 'US', b('ABCDE\x00')), '5 lettere: ancora un numero');
  for (const s of ['ABCDEF', 'AZAZAZ', 'azazaz', 'AB^CD EF']) assert.ok(!A.campoConforme('x00280010', 'US', b(s)), s);
  for (const s of ['ABC1DEF', 'ABC@DEF', 'ABC[DEF', 'abc{def', 'ABC`DEF']) assert.ok(A.campoConforme('x00280010', 'US', b(s)), `${s}: le lettere non sono di fila`);
  assert.ok(A.campoConforme('x00280011', undefined, b('\x02\x00')), 'binario per tag noto senza VR');
  assert.ok(!A.campoConforme('x00281201', undefined, b('ROSSIGNOLI')), 'binario per tag noto senza VR, con un nome');
  for (const s of ['RIGA 1\r\nRIGA 2', 'A\tB', 'A\fB', 'A\x1b$)CB', 'CT\x00 \x00', 'CT  ']) assert.ok(A.campoConforme('x0008103e', 'LT', b(s)), JSON.stringify(s));
  for (const s of ['CT\x01', 'CT\x00X', 'CT\x00\x00\x08\x00']) assert.ok(!A.campoConforme('x0008103e', 'LO', b(s)), JSON.stringify(s));
});
test('ecografia in bianco e nero (1 campione, 8 e 16 bit, MONOCHROME1 e 2): convertita in RGB, fuori dalle regioni nero', async () => {
  const casi = [[{ '00280002': ['US', 1], '00280004': ['CS', 'MONOCHROME2'] }, new Uint8Array(16).fill(200), 200],
    [{ '00280002': ['US', 1], '00280004': ['CS', 'MONOCHROME1'] }, new Uint8Array(16).fill(200), 55],
    [{ '00280002': ['US', 1], '00280004': ['CS', 'MONOCHROME2'], '00280100': ['US', 16], '00280101': ['US', 16], '00280102': ['US', 15] }, Uint8Array.from({ length: 32 }, (_, i) => (i % 2 ? 0x50 : 0xff)), 0x50]];
  for (const [campi, pixel, atteso] of casi) {
    const out = await A.anonimizza(eco(pixel, campi).buffer, opz), { d, px } = pixelDi(out);
    assert.equal(testo(d, 'x00280004'), 'RGB'); assert.equal(d.uint16('x00280002'), 3);
    for (let i = 0; i < 16; i++) assert.deepEqual([...px.slice(i * 3, i * 3 + 3)], dentro(i) ? [atteso, atteso, atteso] : [0, 0, 0], `${JSON.stringify(campi)} pixel ${i}`);
  }
});
