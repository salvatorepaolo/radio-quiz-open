// Referto scaricabile (web/referto.js): PDF e Word scritti nel browser senza librerie, e versione da stampare.
// Si controlla che i file siano ben formati (indice del PDF, XML del Word), che il testo dell'utente resti testo
// e che lettere accentate, pagine, elenchi e figure escano giusti. Dati inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '../web');
const R = await import(pathToFileURL(path.join(WEB, 'referto.js')).href);

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);   // byte finti: si controlla solo che vengano copiati
const img = (didascalia) => ({ jpeg: JPEG, w: 40, h: 30, didascalia, url: 'blob:x' });
const DOC = {
  titolo: 'Referto TC torace', sottotitolo: 'Caso di prova · strumento didattico',
  intestazione: [['Esame', 'TC torace con mdc'], ['Data', '03/2026'], ['Richiedente', '']],
  sezioni: [{ titolo: 'Reperti', testo: 'Nodulo di 8 mm (lobo superiore dx); è più denso.\nSeconda riga con €, “virgolette” e \\ barra.' }, { titolo: 'Vuota', testo: '   ' }],
  blocchi: [{ tipo: 'h', runs: [{ t: 'Conclusioni' }] }, { tipo: 'p', runs: [{ t: 'Testo ' }, { t: 'grassetto', b: true }, { t: ' e ' }, { t: 'corsivo', i: true }, { t: ' sottolineato', u: true }] },
    { tipo: 'li', runs: [{ t: 'primo' }] }, { tipo: 'li', runs: [{ t: 'secondo' }] }, { tipo: 'oli', n: 1, runs: [{ t: 'numerato' }] }, { tipo: 'p', runs: [] }],
  misure: ['Diametro: 8 mm'], immagini: [img('assiale'), img('coronale'), img('')], schemi: [img('Fleischner')],
  firma: 'Lo specializzando', piede: 'radio-quiz.it · non per uso medico',
};
const leggiPdf = async (doc) => Buffer.from(await R.creaPDF(doc).arrayBuffer());
// verifica l'indice (xref): ogni oggetto deve stare all'offset dichiarato e startxref deve puntare all'indice
function controllaPdf(b) {
  const s = b.toString('latin1');
  assert.ok(s.startsWith('%PDF-1.4\n')); assert.ok(s.endsWith('%%EOF\n'));
  const sx = Number(s.match(/startxref\n(\d+)\n%%EOF\n$/)[1]); assert.equal(s.slice(sx, sx + 4), 'xref', 'startxref');
  const [, n] = s.slice(sx).match(/^xref\n0 (\d+)\n/); const voci = s.slice(sx).split('\n').slice(3, 2 + Number(n));
  voci.forEach((v, i) => { const off = Number(v.slice(0, 10)); assert.equal(s.slice(off, off + String(i + 1).length + 6), `${i + 1} 0 obj`, `oggetto ${i + 1}`); });
  // ogni flusso lungo esattamente /Length
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) { const da = m.index + m[0].length; assert.equal(s.slice(da + Number(m[1]), da + Number(m[1]) + 10), '\nendstream', 'lunghezza del flusso'); }
  return s;
}

test('PDF: file ben formato (indice, flussi), testo con accenti e simboli in WinAnsi, parentesi e barre protette', async () => {
  const s = controllaPdf(await leggiPdf(DOC));
  assert.match(s, /\/Count 2 >>/, 'testo e 2 figure nella prima pagina, il resto nella seconda');
  assert.ok(s.includes('\\350 pi\\371 denso'), 'è e ù in WinAnsi');
  assert.ok(s.includes('\\200') && s.includes('\\223virgolette\\224'), '€ e virgolette curve');
  assert.ok(s.includes('\\(lobo superiore dx\\)'), 'parentesi protette'); assert.ok(s.includes('\\\\ barra'), 'barra protetta');
  assert.ok(!/\(Vuota\)/.test(s), 'sezione vuota non stampata');
  assert.ok(s.includes('(RICHIEDENTE)') && s.includes('(\\227)'), 'valore vuoto = trattino');
  assert.ok(s.includes('/F2') && s.includes('/F3'), 'grassetto e corsivo'); assert.match(s, / m [\d.]+ [\d.]+ l S/, 'sottolineato');
  assert.ok(s.includes('(\\225) Tj') && s.includes('(1.) Tj'), 'punti elenco e numeri');
  assert.ok(s.includes('(pag. 1/2)') && s.includes('(radio-quiz.it \\267 non per uso medico)'), 'piede e numero di pagina');
});
test('PDF: immagini JPEG incorporate così come sono, numerate di seguito anche nei disegni delle scale', async () => {
  const b = await leggiPdf(DOC), s = controllaPdf(b);
  assert.equal([...s.matchAll(/\/Subtype \/Image \/Width 40 \/Height 30 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode/g)].length, 4);
  assert.ok(b.includes(Buffer.from(JPEG)));
  for (const t of ['(Fig. 1 \\227 assiale)', '(Fig. 2 \\227 coronale)', '(Fig. 3)', '(Fig. 4 \\227 Fleischner)']) assert.ok(s.includes(t), t);
  for (let i = 1; i <= 4; i++) assert.ok(s.includes(`/Im${i} Do`), `Im${i}`);
});
test('PDF: testo lungo su più pagine, righe dentro il margine, parole lunghissime senza blocchi', async () => {
  const lungo = Array.from({ length: 150 }, (_, i) => `Riga ${i + 1}: ` + 'parola '.repeat(30)).join('\n') + '\n' + 'x'.repeat(400);
  const s = controllaPdf(await leggiPdf({ titolo: 'Lungo', sezioni: [{ titolo: 'Testo', testo: lungo }] }));
  const n = Number(s.match(/\/Count (\d+) >>/)[1]); assert.ok(n >= 5, `${n} pagine`);
  assert.ok(s.includes(`(pag. ${n}/${n})`));
  // ogni riga di testo normale (10,5 pt) parte al margine sinistro (54) e nessuna x supera la larghezza della pagina
  for (const m of s.matchAll(/\/F1 10\.5 Tf ([\d.]+) ([\d.]+) Td/g)) { assert.ok(Number(m[1]) >= 54 && Number(m[1]) < 541, m[1]); assert.ok(Number(m[2]) > 54, 'sotto il margine basso'); }
  assert.ok(s.includes('x'.repeat(400)), 'la parola troppo lunga resta intera su una riga');
});
test('PDF: carta intestata con logo e righe della struttura', async () => {
  const s = controllaPdf(await leggiPdf({ ...DOC, ente: { righe: ['Ospedale di prova', 'Radiologia'], logo: { jpeg: JPEG, w: 300, h: 100 } } }));
  assert.ok(s.includes('(Ospedale di prova)') && s.includes('(Radiologia)'));
  assert.match(s, /q 144\.00 0 0 48\.00 54 [\d.]+ cm \/Im1 Do Q/, 'logo ridotto a 48 punti di altezza');
});

// Word: si cattura il contenuto del pacchetto invece di comprimerlo
const docx = (doc) => { let voci; R.creaDOCX(doc, (v) => { voci = v; return new Uint8Array(0); }); return Object.fromEntries(voci.map((v) => [v.nome, v.dati])); };
const testoDi = (u8) => new TextDecoder().decode(u8);
// XML ben formato: tag aperti e chiusi in ordine
function controllaXml(xml) {
  const pila = [];
  for (const m of xml.replace(/<\?xml[^>]*\?>/, '').matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g)) {
    if (m[4]) continue;
    if (m[1]) assert.equal(pila.pop(), m[2], `chiusura di ${m[2]}`); else pila.push(m[2]);
  }
  assert.deepEqual(pila, [], 'tag non chiusi');
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;|#)/.test(xml), '& non protetta');
}
test('Word: pacchetto completo e XML ben formato; il testo dell\'utente resta testo', () => {
  const cattivo = 'A & B <w:p>"x"</w:p>';
  const f = docx({ ...DOC, titolo: cattivo, sezioni: [{ titolo: cattivo, testo: cattivo }] });
  for (const n of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) assert.ok(f[n], n);
  for (const [n, d] of Object.entries(f)) if (n.endsWith('.xml') || n.endsWith('.rels')) controllaXml(testoDi(d));
  const d = testoDi(f['word/document.xml']);
  assert.ok(d.includes('A &amp; B &lt;w:p&gt;&quot;x&quot;&lt;/w:p&gt;'));
});
test('Word: immagini in word/media con le relazioni giuste, didascalie numerate, sezioni vuote saltate', () => {
  const f = docx({ ...DOC, ente: { righe: ['Ospedale di prova'], logo: { jpeg: JPEG, w: 300, h: 100 } } });
  const media = Object.keys(f).filter((n) => n.startsWith('word/media/')).sort();
  assert.deepEqual(media, ['word/media/img1.jpeg', 'word/media/img2.jpeg', 'word/media/img3.jpeg', 'word/media/img4.jpeg', 'word/media/logo.jpeg']);
  assert.ok(media.every((n) => Buffer.from(f[n]).equals(Buffer.from(JPEG))));
  const d = testoDi(f['word/document.xml']), rel = testoDi(f['word/_rels/document.xml.rels']);
  for (const id of [...d.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1])) assert.ok(rel.includes(`Id="${id}"`), `relazione ${id}`);
  for (const t of ['Fig. 1 — assiale', 'Fig. 2 — coronale', '>Fig. 3<', 'Fig. 4 — Fleischner', 'Ospedale di prova', 'MISURE', '•\t', '1.\t']) assert.ok(d.includes(t), t);
  assert.ok(!d.includes('>Vuota<'));
  assert.ok(testoDi(f['[Content_Types].xml']).includes('Extension="jpeg"'));
});
test('stampa: elenchi puntati e numerati aperti e chiusi bene, stili, figure numerate di seguito', () => {
  const h = R.htmlReferto(DOC, ['u1', 'u2', 'u3'], ['s1']);
  assert.ok(h.includes('<h2>Conclusioni</h2>'));
  assert.ok(h.includes('<b>grassetto</b>') && h.includes('<i>corsivo</i>') && h.includes('<u> sottolineato</u>'));
  assert.ok(h.includes('<ul><li>primo</li><li>secondo</li></ul><ol><li>numerato</li></ol><p class="r">&nbsp;</p>'), 'cambio di elenco');
  assert.ok(h.includes('<img src="s1" alt=""><figcaption>Fig. 4 — Fleischner'));
  assert.ok(h.includes('<dt>Richiedente</dt><dd>—</dd>'));
  assert.equal((h.match(/<figure>/g) || []).length, 4);
});
