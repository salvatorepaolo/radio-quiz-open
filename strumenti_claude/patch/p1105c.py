import sys
W = sys.argv[1]; P = W + '/../../../strumenti_claude/patch/'
src = open(W + '/app.js', encoding='utf-8').read()
def rep(old, new, count=1):
    global src
    n = src.count(old); assert n == count, (n, old[:100]); src = src.replace(old, new)
# decodificatori (dopo le sintassi native)
rep("const TS_NATIVI = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'];\n",
    "const TS_NATIVI = ['1.2.840.10008.1.2', '1.2.840.10008.1.2.1'];\n" + open(P + 'codec_parte.js', encoding='utf-8').read())
# decodifica: fotogramma, compressioni, colore
rep("""function decodificaDicom(buf, { grezzo = false } = {}) {
  const byteArray = new Uint8Array(buf);
  const ds = dicomParser.parseDicom(byteArray);
  const ts = ds.string('x00020010');""",
"""function decodificaDicom(buf, { grezzo = false, frame = 0 } = {}) {
  if (buf && !(buf instanceof ArrayBuffer) && buf.buf instanceof ArrayBuffer) { frame = buf.frame || 0; buf = buf.buf; }   // fotogramma di un multi-frame
  const byteArray = new Uint8Array(buf);
  let ds = DS_CACHE.get(buf);
  if (!ds) { ds = dicomParser.parseDicom(byteArray); if ((parseInt(ds.string('x00280008')) || 1) > 1) DS_CACHE.set(buf, ds); }
  const nFr = parseInt(ds.string('x00280008')) || 1; frame = Math.max(0, Math.min(nFr - 1, frame));
  const ts = (ds.string('x00020010') || '').trim();""")
rep("""  const fot = (ds.string('x00280004') || 'MONOCHROME2').toUpperCase();
  if (spp !== 1 && spp !== 3) throw new Error('Formato colore non supportato');
  if (spp === 3 && !/^RGB/.test(fot)) throw new Error('Colore ' + fot + ' non supportato');""",
"""  let fot = (ds.string('x00280004') || 'MONOCHROME2').trim().toUpperCase();
  if (spp !== 1 && spp !== 3) throw new Error('Formato colore non supportato');""")
rep("""  if (el.encapsulatedPixelData) {
    if (!TS_LOSSLESS.includes(ts)) throw new Error('Compressione non supportata: ' + ts);
    const fr = (el.basicOffsetTable && el.basicOffsetTable.length)
      ? dicomParser.readEncapsulatedImageFrame(ds, el, 0)
      : dicomParser.readEncapsulatedPixelDataFromFragments(ds, el, 0, el.fragments.length);
    const out = new Decoder().decompress(fr.buffer, fr.byteOffset, fr.length);
    pix = tipo(out.buffer ? out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) : out);
  } else {
    if (!TS_NATIVI.includes(ts)) throw new Error('Sintassi non supportata: ' + ts);
    const start = byteArray.byteOffset + el.dataOffset;
    pix = tipo(byteArray.buffer.slice(start, start + el.length));
  }""",
"""  if (el.encapsulatedPixelData) {
    if (!TS_LOSSLESS.includes(ts) && ts !== TS_RLE && !TS_CODEC[ts]) throw new Error('Compressione non supportata: ' + (NOMI_TS[ts] || ts));
    const fr = frameIncapsulato(ds, el, frame, nFr);
    if (TS_LOSSLESS.includes(ts)) {
      const out = new Decoder().decompress(fr.buffer, fr.byteOffset, fr.length);
      pix = tipo(out.buffer ? out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) : out);
    } else if (ts === TS_RLE) pix = tipo(decodificaRLE(fr, rows, cols, spp, bits).buffer);
    else { pix = tipo(decodificaCodec(TS_CODEC[ts], fr).buffer); if (spp === 3) fot = 'RGB'; }   // JPEG e JPEG 2000 escono già in RGB
  } else {
    if (!TS_NATIVI.includes(ts)) throw new Error('Sintassi non supportata: ' + (NOMI_TS[ts] || ts));
    const nb = nFr > 1 ? rows * cols * spp * (bits / 8) : el.length, start = byteArray.byteOffset + el.dataOffset + frame * nb;
    pix = tipo(byteArray.buffer.slice(start, start + nb));
    if (spp === 3 && fot === 'YBR_FULL' && ds.uint16('x00280006') !== 1) {     // YBR_FULL non compresso → RGB
      const c = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
      for (let i = 0; i < pix.length; i += 3) { const y = pix[i], cb = pix[i + 1] - 128, cr = pix[i + 2] - 128; pix[i] = c(y + 1.402 * cr); pix[i + 1] = c(y - 0.344136 * cb - 0.714136 * cr); pix[i + 2] = c(y + 1.772 * cb); }
      fot = 'RGB';
    }
  }
  if (spp === 3 && !/^RGB/.test(fot)) throw new Error('Colore ' + fot + ' non supportato');""")
rep("  const num = (tag, i = 0) => { const v = ds.floatString(tag, i); return Number.isFinite(v) ? v : undefined; };",
    "  // nei multi-frame «enhanced» i valori per fotogramma stanno nei gruppi funzionali\n  const num = (tag, i = 0) => { let v = ds.floatString(tag, i); if (!Number.isFinite(v) && nFr > 1) v = fgFloat(ds, frame, tag, i); return Number.isFinite(v) ? v : undefined; };")
rep("    for: ds.string('x00200052') || '',\n",
    "    for: ds.string('x00200052') || '',\n    // versione client: dati del paziente, mostrati solo se chi legge li accende (mai nelle esportazioni)\n    paziente: CLIENT ? { nome: (ds.string('x00100010') || '').replace(/\\^+/g, ' ').trim(), nascita: ds.string('x00100030') || '', sesso: (ds.string('x00100040') || '').trim(), esame: ds.string('x00080020') || '', studio: (ds.string('x00081030') || '').trim(), struttura: (ds.string('x00080080') || '').trim() } : undefined,\n")
# lettura dei file: dal disco quando servono, decodificatore pronto prima di decodificare
rep("""  if (!f.buf && BUF.has(f.url)) f.buf = BUF.get(f.url);
  if (f.buf) return f.buf;""", """  if (!f.buf && BUF.has(f.url)) { const v = BUF.get(f.url); f.buf = v instanceof Blob || v?.file ? await daFile(v) : v; }
  if (f.buf) { await assicuraCodec(f.buf); return f.buf; }""")
rep(".then((b) => (f.buf = b)).catch((e) => { f.promise = null; throw e; });", ".then(async (b) => { await assicuraCodec(b); return (f.buf = b); }).catch((e) => { f.promise = null; throw e; });")
rep("const ds = dicomParser.parseDicom(new Uint8Array(buf), { untilTag: 'x7fe00010' });", "const ds = dicomParser.parseDicom(new Uint8Array(bufDi(buf)), { untilTag: 'x7fe00010' });")
# dati del paziente nell'angolo, solo a richiesta
rep("  tl.forEach((t, i) => testoContorno(t, R.x + 10, R.y + 8 + i * 15, '#d8e2ee'));",
    "  if (CLIENT && V.datiPaziente && !V.esportando && img) for (const r of righePaziente(img)) tl.push('👤 ' + r);\n  tl.forEach((t, i) => testoContorno(t, R.x + 10, R.y + 8 + i * 15, '#d8e2ee'));")
# finestra e zoom alle altre finestre
rep("  disegnaLente(); aggiornaPulsantiPiani();\n}", "  disegnaLente(); aggiornaPulsantiPiani();\n  if (CLIENT) clientInviaVista();\n}")
# sezione client nuova al posto della vecchia
a = src.index('\n// ================================================================ VERSIONE CLIENT')
b = src.index("\nif (/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)")
src = src[:a] + open(P + 'client_v2.js', encoding='utf-8').read() + src[b:]
rep("window.__dbg = { CL, caricaClient, esportaClient,", "window.__dbg = { CL, caricaClient, esportaClient, decodificaDicom, caricaCodec,")
open(W + '/app.js', 'w', encoding='utf-8').write(src)

# analizza: anche solo l'intestazione; sintassi, fotogrammi, tempo tra i fotogrammi, geometria per fotogramma
a = open(W + '/anonimizza.js', encoding='utf-8').read()
o = """export function analizza(buf) {
  let ds;
  try { ds = dicomParser.parseDicom(new Uint8Array(buf)); } catch { return { escluso: 'non è un file DICOM' }; }"""
assert a.count(o) == 1
a = a.replace(o, """export function analizza(buf, { intestazione = false } = {}) {
  let ds;
  try { ds = dicomParser.parseDicom(new Uint8Array(buf), intestazione ? { untilTag: 'x7fe00010' } : undefined); } catch { return { escluso: 'non è un file DICOM' }; }""")
o = "  info.regione = distrettoDi(ds, info.descrizione);"
assert a.count(o) == 1
a = a.replace(o, """  info.regione = distrettoDi(ds, info.descrizione);
  info.ts = testo(ds, 'x00020010');
  info.nFrames = parseInt(testo(ds, 'x00280008')) || 1;
  info.frameMs = ds.floatString('x00181063') || null;
  // multi-frame «enhanced»: posizione e orientamento di ogni fotogramma (gruppi funzionali)
  if (info.nFrames > 1 && ds.elements.x52009230?.items?.length) {
    const fg = (k, seq, tag, n) => { for (const g of [ds.elements.x52009230.items[k]?.dataSet, ds.elements.x52009229?.items?.[0]?.dataSet]) { const it = g?.elements?.[seq]?.items?.[0]?.dataSet; const v = it ? numeri(it, tag, n) : null; if (v) return v; } return null; };
    info.frames = Array.from({ length: info.nFrames }, (_, k) => ({ ipp: fg(k, 'x00209113', 'x00200032', 3), iop: fg(k, 'x00209116', 'x00200037', 6) }));
    if (!info.iop) info.iop = info.frames[0]?.iop || null;
  }""")
open(W + '/anonimizza.js', 'w', encoding='utf-8').write(a)

h = open(W + '/index.html', encoding='utf-8').read()
def hrep(o, n):
    global h; assert h.count(o) == 1, o[:80]; h = h.replace(o, n)
hrep('    <p id="cl-stato" class="stato"></p>\n', '''    <p id="cl-stato" class="stato"></p>
    <div id="cl-scelta" class="cl-scelta" hidden></div>
    <p class="cl-torna-riga"><button id="cl-torna" type="button" hidden>← Torna all'esame aperto: <span id="cl-torna-nome"></span></button></p>
''')
hrep('<span id="cl-installa-nota" class="cl-nota">Si installa come app con Chrome o Edge</span>',
     '<span id="cl-installa-nota" class="cl-nota">Si installa come app con Chrome o Edge</span>\n        <span id="cl-browser" class="cl-nota cl-browser" hidden>Con questo browser il visualizzatore funziona, ma installazione e video MP4 sono garantiti solo con Chrome o Edge.</span>')
hrep('<p class="cl-nota">TC, RM, RX, mammografia, ecografia, PET-TC · più studi insieme per il confronto con i precedenti</p>',
     '<p class="cl-nota">CD con DICOMDIR, cartelle o file · TC, RM, RX, mammografia, ecografia (anche clip), angiografia, PET-TC · DICOM compressi (JPEG, JPEG 2000, JPEG-LS, RLE)</p>')
hrep('''      <label class="check" title="Le finestre seguono la posizione della finestra in cui scorri"><input type="checkbox" id="cl-sincro" checked> collega finestre</label>''',
     '''      <label class="check" title="Le finestre seguono posizione, finestra (W/L) e zoom della finestra in cui lavori"><input type="checkbox" id="cl-sincro" checked> collega finestre</label>
      <label class="check" title="Mostra nome, data di nascita, data dell'esame e struttura sull'immagine (solo su questo schermo: mai nelle esportazioni)"><input type="checkbox" id="cl-paziente"> dati paziente</label>''')
hrep('''  <label class="check"><input type="radio" name="ex-cosa" value="dicom"> Esame anonimizzato (DICOM, .zip)</label>''',
     '''  <label class="check"><input type="radio" name="ex-cosa" value="misure"> Misure (file di testo)</label>
  <label class="check"><input type="radio" name="ex-cosa" value="dicom"> Esame anonimizzato (DICOM, .zip)</label>''')
hrep('''  <div id="ex-scritte-riga" class="ex-riga">''', '''  <div id="ex-testo-riga" class="ex-riga" hidden><label class="check"><input type="checkbox" id="ex-copri" checked> copri il testo impresso nelle immagini (nomi, date, struttura)</label></div>
  <div id="ex-scritte-riga" class="ex-riga">''')
open(W + '/index.html', 'w', encoding='utf-8').write(h)
print('ok')
