import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
G = W + 'gsps.js'; A = W + 'app.js'; I = W + 'index.html'
for f in (G, A, I): shutil.copy(f, f + '.bak_1107r')
def sost(t, a, b, n=1):
    assert t.count(a) == n, (a[:90], t.count(a)); return t.replace(a, b)

g = open(G, encoding='utf-8').read()
g = sost(g, "  if (vr === 'OB') return v;", "  if (vr === 'AT') { const l = Array.isArray(v) ? v : [v], b = new Uint8Array(l.length * 4), d = new DataView(b.buffer); l.forEach((x, i) => { d.setUint16(i * 4, parseInt(x.slice(0, 4), 16), true); d.setUint16(i * 4 + 2, parseInt(x.slice(4), 16), true); }); return b; }\n  if (vr === 'OB') return v;")
g += r'''
// ---- Segmentation (PS3.3 A.51), binaria: le regioni misurate (volumi semiautomatici, calcificazioni coronariche) come
// maschere DICOM che 3D Slicer, OHIF e i PACS sovrappongono alle immagini originali. Un fotogramma per fetta e segmento.
/**
 * studio: come creaGSPS; rif: { classe, serie, forUID, iop: [6], sp: [riga, colonna], spessore, passo, rows, cols };
 * segmenti: [{ etichetta, descrizione?, colore?: [L, a, b] 0-65535, algoritmo: 'SEMIAUTOMATIC'|'MANUAL', nomeAlg,
 *   tipo?: [valore, schema, significato], fette: [{ uid, frame?, ipp: [3], maschera: Uint8Array rows*cols (0/1) }] }]
 */
export function creaSEG(studio, rif, segmenti, { descrizione = 'Segmentazioni radio-quiz', autore = '', versione = '' } = {}) {
  const SEG = '1.2.840.10008.5.1.4.1.1.66.4', uid = nuovoUID(), serie = nuovoUID(), org = nuovoUID(), [data, orario] = ora();
  const n = [rif.iop[1] * rif.iop[5] - rif.iop[2] * rif.iop[4], rif.iop[2] * rif.iop[3] - rif.iop[0] * rif.iop[5], rif.iop[0] * rif.iop[4] - rif.iop[1] * rif.iop[3]];
  const lungo = (p) => p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
  // indici di posizione comuni a tutti i segmenti (dal basso verso l'alto lungo la normale)
  const posizioni = [...new Set(segmenti.flatMap((s) => s.fette.map((f) => lungo(f.ipp).toFixed(3))))].map(Number).sort((a, b) => a - b);
  const fotogrammi = [];
  segmenti.forEach((s, k) => [...s.fette].sort((a, b) => lungo(a.ipp) - lungo(b.ipp)).forEach((f) => fotogrammi.push({ seg: k + 1, f, pos: posizioni.indexOf(+lungo(f.ipp).toFixed(3)) + 1 })));
  // pixel a 1 bit, senza riempimento tra i fotogrammi (il primo pixel è il bit meno significativo)
  const px1 = rif.rows * rif.cols, bit = px1 * fotogrammi.length, byte = Math.ceil(bit / 8), dati = new Uint8Array(byte + (byte % 2));
  fotogrammi.forEach((fr, j) => { const m = fr.f.maschera, o = j * px1; for (let i = 0; i < px1; i++) if (m[i]) { const b = o + i; dati[b >> 3] |= 1 << (b & 7); } });
  const istanze = [...new Map(fotogrammi.map((fr) => [fr.f.uid, fr.f])).values()];
  const st = studio;
  const ds = {
    '00080005': ['CS', 'ISO_IR 192'], '00080008': ['CS', ['DERIVED', 'PRIMARY']], '00080016': ['UI', SEG], '00080018': ['UI', uid],
    '00080012': ['DA', data], '00080013': ['TM', orario], '00080020': ['DA', st.data || ''], '00080030': ['TM', st.ora || ''], '00080023': ['DA', data], '00080033': ['TM', orario],
    '00080050': ['SH', st.accesso || ''], '00080060': ['CS', 'SEG'], '00080070': ['LO', 'radio-quiz'], '00080090': ['PN', ''], '0008103E': ['LO', descrizione],
    '00081090': ['LO', 'visualizzatore radio-quiz'], '00181000': ['LO', '1'], '00181020': ['LO', versione || 'radio-quiz'],
    '00081115': ['SQ', [{ '0020000E': ['UI', rif.serie], '0008114A': ['SQ', istanze.map((f) => ({ '00081150': ['UI', rif.classe], '00081155': ['UI', f.uid] }))] }]],
    '00100010': ['PN', st.paziente?.nome || ''], '00100020': ['LO', st.paziente?.id || ''], '00100030': ['DA', st.paziente?.nascita || ''], '00100040': ['CS', st.paziente?.sesso || ''],
    '0020000D': ['UI', st.uid], '0020000E': ['UI', serie], '00200010': ['SH', st.id || ''], '00200011': ['IS', '9903'], '00200013': ['IS', '1'],
    '00200052': ['UI', rif.forUID], '00201040': ['LO', ''],
    '00280002': ['US', [1]], '00280004': ['CS', 'MONOCHROME2'], '00280008': ['IS', String(fotogrammi.length)], '00280010': ['US', [rif.rows]], '00280011': ['US', [rif.cols]],
    '00280100': ['US', [1]], '00280101': ['US', [1]], '00280102': ['US', [0]], '00280103': ['US', [0]], '00282110': ['CS', '00'],
    '00700080': ['CS', 'RADIOQUIZ'], '00700081': ['LO', descrizione], '00700084': ['PN', autore || ''],
    '00620001': ['CS', 'BINARY'],
    '00620002': ['SQ', segmenti.map((s, k) => ({
      '00620004': ['US', [k + 1]], '00620005': ['LO', String(s.etichetta).slice(0, 64)], ...(s.descrizione ? { '00620006': ['ST', String(s.descrizione).slice(0, 1024)] } : {}),
      '00620008': ['CS', s.algoritmo || 'SEMIAUTOMATIC'], ...(s.algoritmo !== 'MANUAL' ? { '00620009': ['LO', s.nomeAlg || 'radio-quiz'] } : {}),
      '0062000D': ['US', s.colore || [55000, 40000, 50000]],
      '00620003': ['SQ', [codice('49755003', 'SCT', 'Morphologically Altered Structure')]],
      '0062000F': ['SQ', [codice(...(s.tipo || ['52988006', 'SCT', 'Lesion']))]] }))],
    '00209221': ['SQ', [{ '00209164': ['UI', org] }]],
    '00209222': ['SQ', [{ '00209164': ['UI', org], '00209165': ['AT', '0062000B'], '00209167': ['AT', '0062000A'], '00209421': ['LO', 'Segmento'] },
      { '00209164': ['UI', org], '00209165': ['AT', '00200032'], '00209167': ['AT', '00209113'], '00209421': ['LO', 'Posizione'] }]],
    '52009229': ['SQ', [{ '00289110': ['SQ', [{ '00280030': ['DS', rif.sp.map(ds16)], '00180050': ['DS', ds16(rif.spessore || rif.passo || 1)], '00180088': ['DS', ds16(rif.passo || rif.spessore || 1)] }]],
      '00209116': ['SQ', [{ '00200037': ['DS', rif.iop.map(ds16)] }]] }]],
    '52009230': ['SQ', fotogrammi.map((fr) => ({
      '00089124': ['SQ', [{ '00082112': ['SQ', [{ '00081150': ['UI', rif.classe], '00081155': ['UI', fr.f.uid], ...(fr.f.frame ? { '00081160': ['IS', String(fr.f.frame)] } : {}),
        '0040A170': ['SQ', [codice('121322', 'DCM', 'Source image for image processing operation')]] }]], '00089215': ['SQ', [codice('113076', 'DCM', 'Segmentation')]] }]],
      '00209111': ['SQ', [{ '00209157': ['UL', [fr.seg, fr.pos]] }]],
      '00209113': ['SQ', [{ '00200032': ['DS', fr.f.ipp.map(ds16)] }]],
      '0062000A': ['SQ', [{ '0062000B': ['US', [fr.seg]] }]] }))],
    '7FE00010': ['OB', dati],
  };
  return part10(ds, SEG, uid);
}
'''
open(G, 'w', encoding='utf-8').write(g)

h = open(I, encoding='utf-8').read()
h = sost(h, '  <label class="check"><input type="radio" name="ex-cosa" value="gsps"> Annotazioni DICOM per il PACS (presentation state)</label>',
  '  <label class="check"><input type="radio" name="ex-cosa" value="gsps"> Annotazioni DICOM per il PACS (presentation state)</label>\n  <label class="check"><input type="radio" name="ex-cosa" value="seg"> Volumi e calcificazioni come segmentazione DICOM (SEG) per 3D Slicer o il PACS</label>')
h = sost(h, 'value="pacs"> Invia al PACS misure (SR) e annotazioni (GSPS) di questo esame</label>', 'value="pacs"> Invia al PACS misure (SR), annotazioni (GSPS) e segmentazioni (SEG) di questo esame</label>')
open(I, 'w', encoding='utf-8').write(h)

a = open(A, encoding='utf-8').read()
a = sost(a, "async function esportaGSPS({ sr = false } = {}) {", r'''// segmentazioni DICOM (SEG) dei volumi semiautomatici e delle calcificazioni coronariche: solo nel visualizzatore scaricabile
async function esportaSEG() {
  if (!esportaPermesso()) throw new Error('esportazione disponibile solo nel visualizzatore scaricabile');
  const regioni = [...(V.volumi || []).filter((v) => !v.pet).map((v, i) => ({ sIdx: v.sIdx, maschere: v.maschere, etichetta: `Volume ${i + 1}`, descrizione: `volume ${virgola(v.vol, 2)} cm³`, nomeAlg: 'radio-quiz crescita di regione', colore: [60000, 45000, 60000] })),
    ...CAC.lesioni.map((l, i) => ({ sIdx: l.sIdx, maschere: l.maschere, etichetta: `Calcio ${l.vaso} ${i + 1}`, descrizione: `Agatston ${virgola(l.agatston, 1)}, ${virgola(l.volume, 0)} mm³`, nomeAlg: 'radio-quiz soglia 130 HU', colore: [40000, 20000, 60000] }))];
  if (!regioni.length) throw new Error('nessun volume o calcificazione da salvare (strumenti «Volume» o «CAC»)');
  const { creaSEG } = await import('./gsps.js'), out = [];
  for (const si of [...new Set(regioni.map((r) => r.sIdx))]) {
    const s = V.serie[si], p = await pannelloDi(si), testa = {};
    const leggi = async (idx) => { if (testa[idx]) return testa[idx];
      const raw = await caricaRaw({ url: `/casi/${V.caso.id}/${s.files[idx]}` }), ds = dicomParser.parseDicom(new Uint8Array(bufDi(raw)), { untilTag: 'x7fe00010' }), t = (x) => (ds.string(x) || '').trim();
      return (testa[idx] = { t, ds, frame: raw?.frame != null && (parseInt(t('x00280008')) || 1) > 1 ? raw.frame + 1 : null }); };
    const idx0 = [...regioni.find((r) => r.sIdx === si).maschere.keys()][0], h0 = await leggi(idx0), img0 = await immagineDi(p, idx0);
    const t = h0.t, f3 = (tag, n) => Array.from({ length: n }, (_, i) => h0.ds.floatString(tag, i));
    const studio = { uid: t('x0020000d'), data: t('x00080020'), ora: t('x00080030'), id: t('x00200010'), accesso: t('x00080050'), paziente: { nome: t('x00100010'), id: t('x00100020'), nascita: t('x00100030'), sesso: t('x00100040') } };
    const rif = { classe: t('x00080016'), serie: t('x0020000e'), forUID: t('x00200052') || nuovoUIDLocale(), iop: img0.iop || f3('x00200037', 6), sp: [img0.spRow, img0.spCol], spessore: img0.spessore, rows: img0.rows, cols: img0.cols };
    const segmenti = [];
    for (const r of regioni.filter((x) => x.sIdx === si)) {
      const fette = [];
      for (const [idx, lista] of r.maschere) { const h = await leggi(idx), im = await immagineDi(p, idx), m = new Uint8Array(rif.rows * rif.cols); for (const i of lista) m[i] = 1;
        fette.push({ uid: h.t('x00080018'), frame: h.frame, ipp: im.ipp || [0, 1, 2].map((i) => h.ds.floatString('x00200032', i)), maschera: m }); }
      segmenti.push({ etichetta: r.etichetta, descrizione: r.descrizione, nomeAlg: r.nomeAlg, colore: r.colore, fette });
    }
    const pos = segmenti.flatMap((sg) => sg.fette.map((f) => f.ipp)), nrm = normaleDi(rif.iop), z = pos.map((q) => q[0] * nrm[0] + q[1] * nrm[1] + q[2] * nrm[2]).sort((a, b) => a - b);
    rif.passo = z.length > 1 ? Math.max(1e-3, Math.min(...z.slice(1).map((v, i) => v - z[i]).filter((d) => d > 1e-3))) : img0.spessore;
    const dati = creaSEG(studio, rif, segmenti, { descrizione: 'Segmentazioni radio-quiz', versione: VERSIONE?.numero ? 'radio-quiz ' + VERSIONE.numero : 'radio-quiz' });
    out.push({ nome: `segmentazione_serie${si + 1}.dcm`, dati });
  }
  return out;
}
const nuovoUIDLocale = () => '2.25.' + BigInt('0x' + [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')).toString();
async function esportaGSPS({ sr = false } = {}) {''')
a = sost(a, """  } else if (cosa === 'sr') {
    st('Preparo il referto strutturato DICOM…');""", """  } else if (cosa === 'seg') {
    st('Preparo la segmentazione DICOM…'); const fl = await esportaSEG();
    if (fl.length === 1) scarica(new Blob([fl[0].dati], { type: 'application/dicom' }), `${base}_segmentazione.dcm`); else scarica(creaZip(fl), `${base}_segmentazioni.zip`);
    st(`Segmentazione salvata in DICOM SEG (${fl.length} ${fl.length === 1 ? 'file' : 'file, uno per serie'}): si apre in 3D Slicer, OHIF o nel PACS sopra le immagini originali.`);
  } else if (cosa === 'sr') {
    st('Preparo il referto strutturato DICOM…');""")
a = sost(a, """    try { da.push(...(await esportaGSPS())); } catch {}
    if (!da.length) throw new Error('nessuna misura o annotazione da inviare');""", """    try { da.push(...(await esportaGSPS())); } catch {}
    try { da.push(...(await esportaSEG())); } catch {}
    if (!da.length) throw new Error('nessuna misura o annotazione da inviare');""")
a = sost(a, "window.__dbg = { GPU2D, CPRS, CAC, calcioDa, ", "window.__dbg = { GPU2D, CPRS, CAC, calcioDa, esportaSEG, volumeDa, ")
open(A, 'w', encoding='utf-8').write(a)
print('ok')
