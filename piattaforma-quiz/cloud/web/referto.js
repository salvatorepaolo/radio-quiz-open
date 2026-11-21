// Referto con immagini, senza rete: PDF e Word (.docx) scritti nel browser, senza librerie esterne.
// doc = { titolo, sottotitolo, intestazione: [[etichetta, valore]], sezioni: [{ titolo, testo }], misure: [testo],
//         immagini: [{ jpeg: Uint8Array, w, h, didascalia }], schemi (disegni delle scale, stesso formato), firma, piede,
//         ente: { righe: [struttura, reparto, indirizzo…], logo: { jpeg, w, h, url } } (carta intestata, facoltativa) }

// ---------------------------------------------------------------- PDF (A4, Helvetica, immagini JPEG)
// larghezze dei caratteri di Helvetica (1/1000 em), ASCII 32-126
const LARGH = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
// caratteri fuori da Latin-1 che WinAnsi ha comunque
const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99 };
const base = (c) => c.normalize('NFD')[0];
function codice(c) {
  if (WIN[c]) return WIN[c];
  const n = c.charCodeAt(0);
  if (n < 256) return n;
  const b = base(c); return b.charCodeAt(0) < 128 ? b.charCodeAt(0) : 63;
}
function larghezza(t, dim, grassetto) {
  let w = 0;
  for (const c of t) { const n = base(c).charCodeAt(0); w += n >= 32 && n <= 126 ? LARGH[n - 32] : 556; }
  return (w * dim) / 1000 * (grassetto ? 1.06 : 1);
}
function stringaPdf(t) {
  let s = '';
  for (const c of t) { const n = codice(c); s += n === 40 || n === 41 || n === 92 ? '\\' + String.fromCharCode(n) : n < 32 || n > 126 ? '\\' + n.toString(8).padStart(3, '0') : String.fromCharCode(n); }
  return '(' + s + ')';
}
function aCapo(t, dim, grassetto, max) {
  const righe = [];
  for (const par of String(t).split('\n')) {
    const parole = par.split(/ +/); let r = '';
    for (const p of parole) {
      const prova = r ? r + ' ' + p : p;
      if (larghezza(prova, dim, grassetto) <= max || !r) r = prova; else { righe.push(r); r = p; }
    }
    righe.push(r);
  }
  return righe;
}
export function creaPDF(doc) {
  const W = 595.28, H = 841.89, M = 54, L = W - 2 * M;
  const pagine = []; let ops = [], y = H - M;
  const nuova = () => { if (ops.length) pagine.push(ops); ops = []; y = H - M; };
  const testo = (t, x, yy, dim, gr, colore = '0.1 0.13 0.17') => ops.push(`BT ${colore} rg /${gr ? 'F2' : 'F1'} ${dim} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td ${stringaPdf(t)} Tj ET`);
  const spazio = (h) => { if (y - h < M + 30) nuova(); };
  const blocco = (t, dim, gr, rientro = 0, colore) => { for (const r of aCapo(t, dim, gr, L - rientro)) { spazio(dim * 1.4); testo(r, M + rientro, y - dim, dim, gr, colore); y -= dim * 1.4; } };
  const linea = () => { ops.push(`0.8 0.84 0.88 RG 0.8 w ${M} ${y.toFixed(2)} m ${W - M} ${y.toFixed(2)} l S`); };
  const immagini = [];
  // carta intestata della struttura: logo a sinistra, righe di testo accanto
  if (doc.ente && (doc.ente.logo || doc.ente.righe?.length)) {
    let xT = M, hL = 0;
    if (doc.ente.logo) {
      const lg = doc.ente.logo, s = Math.min(150 / lg.w, 48 / lg.h), dw = lg.w * s, dh = lg.h * s, n = immagini.push(lg);
      ops.push(`q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${M} ${(y - dh).toFixed(2)} cm /Im${n} Do Q`); xT = M + dw + 14; hL = dh;
    }
    let yy = y - 11;
    (doc.ente.righe || []).forEach((r, i) => { for (const t of aCapo(r, i ? 9 : 11, !i, W - M - xT)) { testo(t, xT, yy, i ? 9 : 11, !i, i ? '0.3 0.35 0.42' : '0.1 0.13 0.17'); yy -= i ? 11.5 : 14; } });
    y = Math.min(y - hL, yy + 4) - 10; linea(); y -= 16;
  }
  blocco(doc.titolo || 'Referto', 18, true); y -= 2;
  if (doc.sottotitolo) blocco(doc.sottotitolo, 9.5, false, 0, '0.38 0.43 0.5');
  y -= 6; linea(); y -= 10;
  if (doc.intestazione?.length) {
    const col = L / 2;
    for (let i = 0; i < doc.intestazione.length; i += 2) {
      spazio(26);
      for (let j = 0; j < 2 && i + j < doc.intestazione.length; j++) {
        const [k, v] = doc.intestazione[i + j];
        testo(k.toUpperCase(), M + j * col, y - 8, 7.5, true, '0.38 0.43 0.5');
        testo(aCapo(v || '—', 10.5, false, col - 10)[0], M + j * col, y - 21, 10.5, false);
      }
      y -= 28;
    }
    y -= 2; linea(); y -= 12;
  }
  for (const s of doc.sezioni || []) {
    if (!String(s.testo || '').trim()) continue;
    spazio(30);
    if (s.titolo) { blocco(s.titolo, 10, true, 0, '0.12 0.35 0.75'); y -= 1; }
    blocco(s.testo, 10.5, false); y -= 8;
  }
  // testo formattato (grassetto, corsivo, sottolineato, elenchi, titoli): parole con il loro stile, a capo sulla larghezza
  for (const bl of doc.blocchi || []) {
    const titolo = bl.tipo === 'h', dim = titolo ? 10.5 : 10.5, rientro = bl.tipo === 'li' || bl.tipo === 'oli' ? 16 : 0;
    const colore = titolo ? '0.12 0.35 0.75' : '0.1 0.13 0.17';
    const parole = [];
    for (const r of bl.runs || []) { const st = { b: !!r.b || titolo, i: !!r.i, u: !!r.u }; String(r.t).split(/(\n| +)/).forEach((p) => { if (p) parole.push({ t: p, ...st }); }); }
    if (!parole.some((p) => p.t.trim())) { y -= dim * 0.7; continue; }
    const font = (p) => (p.b && p.i ? 'F4' : p.b ? 'F2' : p.i ? 'F3' : 'F1');
    const righe = []; let riga = [], w = 0, max = L - rientro;
    for (const p of parole) {
      if (p.t === '\n') { righe.push(riga); riga = []; w = 0; continue; }
      const pw = larghezza(p.t, dim, p.b);
      if (/^ +$/.test(p.t)) { if (riga.length) { riga.push({ ...p, w: pw }); w += pw; } continue; }
      if (w + pw > max && riga.length) { while (riga.length && /^ +$/.test(riga[riga.length - 1].t)) riga.pop(); righe.push(riga); riga = []; w = 0; }
      riga.push({ ...p, w: pw }); w += pw;
    }
    righe.push(riga);
    spazio(dim * 1.5 + (titolo ? 6 : 0)); if (titolo) y -= 4;
    righe.forEach((rg, k) => {
      spazio(dim * 1.45);
      let x = M + rientro;
      if (k === 0 && rientro) testo(bl.tipo === 'li' ? '•' : `${bl.n || 1}.`, M + 4, y - dim, dim, false, colore);
      for (const p of rg) {
        if (!/^ +$/.test(p.t)) {
          ops.push(`BT ${colore} rg /${font(p)} ${dim} Tf ${x.toFixed(2)} ${(y - dim).toFixed(2)} Td ${stringaPdf(p.t)} Tj ET`);
          if (p.u) ops.push(`${colore} RG 0.6 w ${x.toFixed(2)} ${(y - dim - 1.6).toFixed(2)} m ${(x + p.w).toFixed(2)} ${(y - dim - 1.6).toFixed(2)} l S`);
        }
        x += p.w;
      }
      y -= dim * 1.45;
    });
    y -= titolo ? 1 : 3;
  }
  if (doc.misure?.length) { spazio(30); blocco('MISURE', 10, true, 0, '0.12 0.35 0.75'); for (const m of doc.misure) blocco('• ' + m, 10, false, 6); y -= 8; }
  let nFig = 0;
  for (const [tit, lista] of [['IMMAGINI CHIAVE', doc.immagini], ['DISEGNI DELLE SCALE E CLASSIFICAZIONI', doc.schemi]]) {
    if (!lista?.length) continue;
    spazio(40); blocco(tit, 10, true, 0, '0.12 0.35 0.75'); y -= 4;
    const gap = 14, cw = (L - gap) / 2;
    for (let i = 0; i < lista.length; i += 2) {
      const riga = lista.slice(i, i + 2).map((im) => { const s = Math.min(cw / im.w, 230 / im.h); return { ...im, dw: im.w * s, dh: im.h * s }; });
      const hmax = Math.max(...riga.map((r) => r.dh)) + 30;
      if (y - hmax < M + 30) nuova();
      riga.forEach((im, j) => {
        const n = immagini.push(im), x = M + j * (cw + gap) + (cw - im.dw) / 2;
        ops.push(`q ${im.dw.toFixed(2)} 0 0 ${im.dh.toFixed(2)} ${x.toFixed(2)} ${(y - im.dh).toFixed(2)} cm /Im${n} Do Q`);
        const did = aCapo(`Fig. ${nFig + i + j + 1}${im.didascalia ? ' — ' + im.didascalia : ''}`, 8.5, false, cw);
        did.slice(0, 2).forEach((r, k) => testo(r, M + j * (cw + gap), y - im.dh - 11 - k * 10.5, 8.5, false, '0.3 0.35 0.42'));
      });
      y -= hmax;
    }
    nFig += lista.length;
  }
  if (doc.firma) { spazio(50); y -= 16; blocco(doc.firma, 10.5, false); }
  nuova();
  // oggetti
  const ogg = [], add = (o) => ogg.push(o) ;
  const enc = new TextEncoder();
  const nPag = pagine.length, idPag = (i) => 7 + i * 2, idImg = (i) => 7 + nPag * 2 + i;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${pagine.map((_, i) => idPag(i) + ' 0 R').join(' ')}] /Count ${nPag} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-BoldOblique /Encoding /WinAnsiEncoding >>');
  const risorseImg = immagini.map((_, i) => `/Im${i + 1} ${idImg(i)} 0 R`).join(' ');
  pagine.forEach((o, i) => {
    const piede = [`BT 0.5 0.55 0.6 rg /F1 7.5 Tf ${M} 28 Td ${stringaPdf(doc.piede || '')} Tj ET`, `BT 0.5 0.55 0.6 rg /F1 7.5 Tf ${W - M - 40} 28 Td ${stringaPdf(`pag. ${i + 1}/${nPag}`)} Tj ET`];
    const flusso = [...o, ...piede].join('\n');
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> /XObject << ${risorseImg} >> >> /Contents ${idPag(i) + 1} 0 R >>`);
    add({ dict: `<< /Length ${enc.encode(flusso).length} >>`, dati: enc.encode(flusso) });
  });
  immagini.forEach((im) => add({ dict: `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>`, dati: im.jpeg }));
  const parti = [enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')], offs = []; let pos = parti[0].length;
  ogg.forEach((o, i) => {
    const a = enc.encode(`${i + 1} 0 obj\n${typeof o === 'string' ? o : o.dict + '\nstream\n'}`), z = typeof o === 'string' ? enc.encode('\nendobj\n') : enc.encode('\nendstream\nendobj\n');
    offs.push(pos); parti.push(a); pos += a.length;
    if (typeof o !== 'string') { parti.push(o.dati); pos += o.dati.length; }
    parti.push(z); pos += z.length;
  });
  const xref = `xref\n0 ${ogg.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${ogg.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parti.push(enc.encode(xref));
  return new Blob(parti, { type: 'application/pdf' });
}

// ---------------------------------------------------------------- Word (.docx, Office Open XML)
const x = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const run = (t, { b = false, dim = 21, colore = '' } = {}) => `<w:r><w:rPr>${b ? '<w:b/>' : ''}${colore ? `<w:color w:val="${colore}"/>` : ''}<w:sz w:val="${dim}"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>`;
const par = (runs, { dopo = 80 } = {}) => `<w:p><w:pPr><w:spacing w:after="${dopo}"/></w:pPr>${runs}</w:p>`;
function immagineDocx(n, cx, cy) {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="Figura ${n}"/>
<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="img${n}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rImg${n}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
export function creaDOCX(doc, creaZip) {
  const enc = new TextEncoder(), corpo = [], extra = [];
  // carta intestata: logo e righe della struttura
  if (doc.ente && (doc.ente.logo || doc.ente.righe?.length)) {
    const lg = doc.ente.logo, emu = 9525;
    const img = lg ? (() => { const s = Math.min(200 / lg.w, 64 / lg.h); extra.push({ nome: 'word/media/logo.jpeg', dati: lg.jpeg });
      return immagineDocx(900, Math.round(lg.w * emu * s), Math.round(lg.h * emu * s)).replace('rImg900', 'rLogo'); })() : '';
    const testoEnte = (doc.ente.righe || []).map((r, i) => par(run(r, { b: !i, dim: i ? 17 : 22, colore: i ? '4D5866' : '' }), { dopo: 0 })).join('') || par('');
    corpo.push(`<w:tbl><w:tblPr><w:tblW w:w="9600" w:type="dxa"/><w:tblBorders><w:bottom w:val="single" w:sz="6" w:color="CFD6DF"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="${img ? 3200 : 1}"/><w:gridCol w:w="${img ? 6400 : 9599}"/></w:tblGrid><w:tr>`
      + `<w:tc><w:tcPr><w:tcW w:w="${img ? 3200 : 1}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${par(img, { dopo: 60 })}</w:tc><w:tc><w:tcPr><w:tcW w:w="${img ? 6400 : 9599}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>${testoEnte}</w:tc></w:tr></w:tbl>`);
    corpo.push(par('', { dopo: 120 }));
  }
  corpo.push(par(run(doc.titolo || 'Referto', { b: true, dim: 36 }), { dopo: 40 }));
  if (doc.sottotitolo) corpo.push(par(run(doc.sottotitolo, { dim: 18, colore: '5D6B7A' }), { dopo: 200 }));
  if (doc.intestazione?.length) {
    const righe = [];
    for (let i = 0; i < doc.intestazione.length; i += 2) {
      righe.push(`<w:tr>${doc.intestazione.slice(i, i + 2).map(([k, v]) => `<w:tc><w:tcPr><w:tcW w:w="4800" w:type="dxa"/></w:tcPr>${par(run(k.toUpperCase(), { b: true, dim: 15, colore: '5D6B7A' }), { dopo: 0 })}${par(run(v || '—', { dim: 21 }), { dopo: 60 })}</w:tc>`).join('')}</w:tr>`);
    }
    corpo.push(`<w:tbl><w:tblPr><w:tblW w:w="9600" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="CFD6DF"/><w:bottom w:val="single" w:sz="4" w:color="CFD6DF"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4800"/><w:gridCol w:w="4800"/></w:tblGrid>${righe.join('')}</w:tbl>`);
    corpo.push(par('', { dopo: 120 }));
  }
  for (const s of doc.sezioni || []) {
    if (!String(s.testo || '').trim()) continue;
    if (s.titolo) corpo.push(par(run(s.titolo, { b: true, dim: 20, colore: '1F5BBF' }), { dopo: 40 }));
    for (const r of String(s.testo).split('\n')) corpo.push(par(run(r), { dopo: 60 }));
  }
  for (const bl of doc.blocchi || []) {
    const titolo = bl.tipo === 'h', lista = bl.tipo === 'li' || bl.tipo === 'oli';
    const runs = (lista ? run(bl.tipo === 'li' ? '•\t' : `${bl.n || 1}.\t`) : '') + (bl.runs || []).map((r) => String(r.t).split('\n').map((t, k) => (k ? '<w:r><w:br/></w:r>' : '') + (t ? `<w:r><w:rPr>${r.b || titolo ? '<w:b/>' : ''}${r.i ? '<w:i/>' : ''}${r.u ? '<w:u w:val="single"/>' : ''}${titolo ? '<w:color w:val="1F5BBF"/>' : ''}<w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">${x(t)}</w:t></w:r>` : '')).join('')).join('');
    corpo.push(`<w:p><w:pPr><w:spacing w:before="${titolo ? 120 : 0}" w:after="${lista ? 30 : 80}"/>${lista ? '<w:ind w:left="400" w:hanging="260"/><w:tabs><w:tab w:val="left" w:pos="400"/></w:tabs>' : ''}</w:pPr>${runs}</w:p>`);
  }
  if (doc.misure?.length) { corpo.push(par(run('MISURE', { b: true, dim: 20, colore: '1F5BBF' }), { dopo: 40 })); for (const m of doc.misure) corpo.push(par(run('• ' + m, { dim: 20 }), { dopo: 30 })); }
  const media = [];
  for (const [tit, lista, da] of [['IMMAGINI CHIAVE', doc.immagini, 0], ['DISEGNI DELLE SCALE E CLASSIFICAZIONI', doc.schemi, doc.immagini?.length || 0]]) {
    if (!lista?.length) continue;
    corpo.push(par(run(tit, { b: true, dim: 20, colore: '1F5BBF' }), { dopo: 60 }));
    lista.forEach((im, i) => {
      const n = da + i + 1, emu = 9525, s = Math.min(400 / im.w, 300 / im.h);
      media.push({ nome: `word/media/img${n}.jpeg`, dati: im.jpeg });
      corpo.push(par(immagineDocx(n, Math.round(im.w * emu * s), Math.round(im.h * emu * s)), { dopo: 20 }));
      corpo.push(par(run(`Fig. ${n}${im.didascalia ? ' — ' + im.didascalia : ''}`, { dim: 17, colore: '4D5866' }), { dopo: 160 }));
    });
  }
  if (doc.firma) corpo.push(par('', { dopo: 200 }), par(run(doc.firma)));
  if (doc.piede) corpo.push(par(run(doc.piede, { dim: 15, colore: '808A96' })));
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${corpo.join('\n')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const stili = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:lang w:val="it-IT"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  const tipi = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpeg" ContentType="image/jpeg"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStili" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${extra.length ? '<Relationship Id="rLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.jpeg"/>' : ''}${media.map((m, i) => `<Relationship Id="rImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/img${i + 1}.jpeg"/>`).join('')}</Relationships>`;
  const voci = [{ nome: '[Content_Types].xml', dati: enc.encode(tipi) }, { nome: '_rels/.rels', dati: enc.encode(rels) }, { nome: 'word/document.xml', dati: enc.encode(documento) },
    { nome: 'word/styles.xml', dati: enc.encode(stili) }, { nome: 'word/_rels/document.xml.rels', dati: enc.encode(docRels) }, ...media, ...extra];
  return new Blob([creaZip(voci)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

// ---------------------------------------------------------------- stampa (HTML in una cornice nascosta)
function htmlBlocchi(bl) {
  const e = x, runs = (r) => (r || []).map((y) => { let t = e(y.t).replace(/\n/g, '<br>'); if (y.b) t = `<b>${t}</b>`; if (y.i) t = `<i>${t}</i>`; if (y.u) t = `<u>${t}</u>`; return t; }).join('');
  let h = '', lista = null;
  for (const b of bl) {
    const tipo = b.tipo === 'li' ? 'ul' : b.tipo === 'oli' ? 'ol' : null;
    if (lista && lista !== tipo) { h += `</${lista}>`; lista = null; }
    if (tipo) { if (!lista) { h += `<${tipo}>`; lista = tipo; } h += `<li>${runs(b.runs)}</li>`; }
    else h += b.tipo === 'h' ? `<h2>${runs(b.runs)}</h2>` : `<p class="r">${runs(b.runs) || '&nbsp;'}</p>`;
  }
  return h + (lista ? `</${lista}>` : '');
}
export function htmlReferto(doc, urlImmagini, urlSchemi = []) {
  const e = x;
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${e(doc.titolo || 'Referto')}</title><style>
@page{size:A4;margin:18mm 16mm 20mm}body{font:11pt/1.45 "Helvetica Neue",Arial,sans-serif;color:#1a2230;margin:0}
h1{font-size:19pt;margin:0 0 2px}.ente{display:flex;align-items:center;gap:14px;border-bottom:1px solid #cfd6df;padding-bottom:8px;margin-bottom:12px}.ente img{max-height:17mm;max-width:55mm}.ente .e1{font-weight:700;font-size:12pt}.ente .er{font-size:9pt;color:#4d5866}.sotto{color:#5d6b7a;font-size:9.5pt;margin:0 0 10px}
.int{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;border-top:1px solid #cfd6df;border-bottom:1px solid #cfd6df;padding:8px 0;margin:0 0 14px}
.int dt{font-size:7.5pt;font-weight:700;color:#5d6b7a;text-transform:uppercase;letter-spacing:.04em}.int dd{margin:0}
h2{font-size:10pt;color:#1f5bbf;margin:12px 0 2px;text-transform:uppercase;letter-spacing:.03em}p{margin:0 0 4px;white-space:pre-wrap}p.r{white-space:normal}
ul{margin:2px 0 8px 18px;padding:0}.figure{display:grid;grid-template-columns:1fr 1fr;gap:12px}
figure{margin:0;break-inside:avoid}figure img{width:100%;max-height:85mm;object-fit:contain;background:#000;border-radius:3px}figcaption{font-size:8.5pt;color:#4d5866;margin-top:3px}
.firma{margin-top:22px}.piede{position:fixed;bottom:-12mm;left:0;right:0;font-size:7.5pt;color:#808a96}
</style></head><body>
${doc.ente && (doc.ente.logo || doc.ente.righe?.length) ? `<div class="ente">${doc.ente.logo ? `<img src="${doc.ente.logo.url}" alt="">` : ''}<div>${(doc.ente.righe || []).map((r, i) => i ? `<div class="er">${e(r)}</div>` : `<div class="e1">${e(r)}</div>`).join('')}</div></div>` : ''}
<h1>${e(doc.titolo || 'Referto')}</h1>${doc.sottotitolo ? `<p class="sotto">${e(doc.sottotitolo)}</p>` : ''}
${doc.intestazione?.length ? `<dl class="int">${doc.intestazione.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v || '—')}</dd></div>`).join('')}</dl>` : ''}
${(doc.sezioni || []).filter((s) => String(s.testo || '').trim()).map((s) => `${s.titolo ? `<h2>${e(s.titolo)}</h2>` : ''}<p>${e(s.testo)}</p>`).join('')}
${htmlBlocchi(doc.blocchi || [])}
${doc.misure?.length ? `<h2>Misure</h2><ul>${doc.misure.map((m) => `<li>${e(m)}</li>`).join('')}</ul>` : ''}
${doc.immagini?.length ? `<h2>Immagini chiave</h2><div class="figure">${doc.immagini.map((im, i) => `<figure><img src="${urlImmagini[i]}" alt=""><figcaption>Fig. ${i + 1}${im.didascalia ? ' — ' + e(im.didascalia) : ''}</figcaption></figure>`).join('')}</div>` : ''}
${doc.schemi?.length ? `<h2>Disegni delle scale e classificazioni</h2><div class="figure">${doc.schemi.map((im, i) => `<figure><img src="${urlSchemi[i]}" alt=""><figcaption>Fig. ${(doc.immagini?.length || 0) + i + 1}${im.didascalia ? ' — ' + e(im.didascalia) : ''}</figcaption></figure>`).join('')}</div>` : ''}
${doc.firma ? `<p class="firma">${e(doc.firma)}</p>` : ''}<div class="piede">${e(doc.piede || '')}</div></body></html>`;
}
