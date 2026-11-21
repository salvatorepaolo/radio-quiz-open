# 1.213: misure esportate come DICOM Structured Report (Comprehensive SR, modello TID 1500)
import json, sys
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)

g = open(R + 'gsps.js', encoding='utf-8').read()
if 'export function creaSR' not in g:
    g += r'''
// ---- Structured Report (Comprehensive SR, PS3.3 A.35.3) con il modello TID 1500 «Imaging Measurement Report»:
// le misure come dati (valore, unità UCUM, codice del concetto) con la regione disegnata (SCOORD) e l'immagine di origine.
const codice = (v, s, m) => ({ '00080100': ['SH', v], '00080102': ['SH', s], '00080104': ['LO', m] });
const voceSR = (rel, tipo, nome, extra = {}) => ({ '0040A010': ['CS', rel], '0040A040': ['CS', tipo], '0040A043': ['SQ', [codice(...nome)]], ...extra });
const ds16 = (x) => { let s = String(+(+x).toPrecision(8)); if (s.length > 16) s = (+x).toExponential(6); return s; };
/**
 * studio: come per creaGSPS; immagini: [{ classe, uid, serie, frame?, sr: [{ nome, valori: [{ codice: [v, s, m], valore, unita: [v, m] }], grafici: [{ tipo, punti }], testo? }] }]
 */
export function creaSR(studio, immagini, { autore = '', descrizione = 'Misure radio-quiz' } = {}) {
  const SR = '1.2.840.10008.5.1.4.1.1.88.33', uid = nuovoUID(), [data, orario] = ora();
  const rif = (im) => ({ '00081150': ['UI', im.classe], '00081155': ['UI', im.uid], ...(im.frame ? { '00081160': ['IS', String(im.frame)] } : {}) });
  const gruppi = []; let n = 0;
  for (const im of immagini) for (const m of im.sr || []) {
    n++;
    const regioni = (m.grafici || []).map((gr) => voceSR('INFERRED FROM', 'SCOORD', ['111030', 'DCM', 'Image Region'], {
      '00700023': ['CS', gr.tipo], '00700022': ['FL', gr.punti], '0040A730': ['SQ', [voceSR('SELECTED FROM', 'IMAGE', ['121112', 'DCM', 'Source of Measurement'], { '00081199': ['SQ', [rif(im)]] })]] }));
    const figli = [voceSR('HAS OBS CONTEXT', 'TEXT', ['112039', 'DCM', 'Tracking Identifier'], { '0040A160': ['UT', `${m.nome} ${n}`] }),
      voceSR('HAS OBS CONTEXT', 'UIDREF', ['112040', 'DCM', 'Tracking Unique Identifier'], { '0040A124': ['UI', nuovoUID()] })];
    for (const v of m.valori || []) figli.push(voceSR('CONTAINS', 'NUM', v.codice, {
      '0040A300': ['SQ', [{ '004008EA': ['SQ', [codice(v.unita[0], 'UCUM', v.unita[1])]], '0040A30A': ['DS', ds16(v.valore)] }]], ...(regioni.length ? { '0040A730': ['SQ', regioni] } : {}) }));
    if (m.testo) figli.push(voceSR('CONTAINS', 'TEXT', ['121106', 'DCM', 'Comment'], { '0040A160': ['UT', String(m.testo).slice(0, 1024)], ...(regioni.length && !(m.valori || []).length ? { '0040A730': ['SQ', regioni] } : {}) }));
    gruppi.push(voceSR('CONTAINS', 'CONTAINER', ['125007', 'DCM', 'Measurement Group'], { '0040A050': ['CS', 'SEPARATE'], '0040A730': ['SQ', figli] }));
  }
  const contenuto = [
    voceSR('HAS CONCEPT MOD', 'CODE', ['121049', 'DCM', 'Language of Content Item and Descendants'], { '0040A168': ['SQ', [codice('it', 'RFC5646', 'Italian')]] }),
    ...(autore ? [voceSR('HAS OBS CONTEXT', 'PNAME', ['121008', 'DCM', 'Person Observer Name'], { '0040A123': ['PN', autore] })] : []),
    voceSR('HAS CONCEPT MOD', 'CODE', ['121058', 'DCM', 'Procedure reported'], { '0040A168': ['SQ', [codice('363679005', 'SCT', 'Imaging procedure')]] }),
    voceSR('CONTAINS', 'CONTAINER', ['126010', 'DCM', 'Imaging Measurements'], { '0040A050': ['CS', 'SEPARATE'], '0040A730': ['SQ', gruppi] }),
  ];
  const perSerie = new Map(); for (const im of immagini) { if (!perSerie.has(im.serie)) perSerie.set(im.serie, []); perSerie.get(im.serie).push(im); }
  const ds = {
    '00080005': ['CS', 'ISO_IR 192'], '00080016': ['UI', SR], '00080018': ['UI', uid], '00080012': ['DA', data], '00080013': ['TM', orario],
    '00080020': ['DA', studio.data || ''], '00080023': ['DA', data], '00080030': ['TM', studio.ora || ''], '00080033': ['TM', orario], '00080050': ['SH', studio.accesso || ''],
    '00080060': ['CS', 'SR'], '00080070': ['LO', 'radio-quiz'], '00080090': ['PN', ''], '0008103E': ['LO', descrizione], '00081111': ['SQ', []],
    '00100010': ['PN', studio.paziente?.nome || ''], '00100020': ['LO', studio.paziente?.id || ''], '00100030': ['DA', studio.paziente?.nascita || ''], '00100040': ['CS', studio.paziente?.sesso || ''],
    '0020000D': ['UI', studio.uid], '0020000E': ['UI', nuovoUID()], '00200010': ['SH', studio.id || ''], '00200011': ['IS', '9903'], '00200013': ['IS', '1'],
    '0040A040': ['CS', 'CONTAINER'], '0040A043': ['SQ', [codice('126000', 'DCM', 'Imaging Measurement Report')]], '0040A050': ['CS', 'SEPARATE'],
    '0040A375': ['SQ', [{ '00081115': ['SQ', [...perSerie.entries()].map(([s, l]) => ({ '00081199': ['SQ', l.map(rif)], '0020000E': ['UI', s] }))], '0020000D': ['UI', studio.uid] }]],
    '0040A491': ['CS', 'PARTIAL'], '0040A493': ['CS', 'UNVERIFIED'],
    '0040A504': ['SQ', [{ '00080105': ['CS', 'DCMR'], '0040DB00': ['CS', '1500'] }]],
    '0040A730': ['SQ', contenuto],
  };
  return part10(ds, SR, uid);
}
'''
    open(R + 'gsps.js', 'w', encoding='utf-8').write(g)

a = open(R + 'app.js', encoding='utf-8').read()
a = sost(a, "async function esportaGSPS() {", r'''// misure come dati per il DICOM SR: valori con codice SNOMED CT o DICOM e unità UCUM, più la regione disegnata
function misureSR(m, img, idx, si, grafici) {
  const mm = (a, b) => Math.hypot((b.x - a.x) * img.spCol, (b.y - a.y) * img.spRow), L = ['410668003', 'SCT', 'Length'], MM = ['mm', 'millimeter'];
  if (m.tipo === 'linea') return [{ nome: 'Distanza', valori: [{ codice: L, valore: mm(m.a, m.b), unita: MM }], grafici }];
  if (m.tipo === 'recist' && m.c && m.d) return [{ nome: 'RECIST', valori: [{ codice: ['103339001', 'SCT', 'Long Axis'], valore: mm(m.a, m.b), unita: MM }, { codice: ['103340004', 'SCT', 'Short Axis'], valore: mm(m.c, m.d), unita: MM }], grafici }];
  if (m.tipo === 'angolo' && m.c) return [{ nome: 'Angolo', valori: [{ codice: ['1483009', 'SCT', 'Angle'], valore: angoloDi(img, m), unita: ['deg', 'degree'] }], grafici }];
  if (m.tipo === 'roi') {
    const st = statisticheROI(img, m); if (!st) return [];
    const u = img.suv ? ['{SUVbw}g/ml', 'Standardized Uptake Value body weight'] : img.adc ? ['um2/s', 'square micrometer per second'] : !img.modalita || img.modalita === 'CT' ? ["[hnsf'U]", 'Hounsfield unit'] : ['1', 'no units'];
    return [{ nome: m.etichetta || 'ROI', testo: m.etichetta || '', grafici, valori: [
      { codice: ['373098007', 'SCT', 'Mean'], valore: Math.round(st.media * 100) / 100, unita: u },
      { codice: ['386136009', 'SCT', 'Standard Deviation'], valore: Math.round(st.ds * 100) / 100, unita: u },
      { codice: ['42798000', 'SCT', 'Area'], valore: st.area * 100, unita: ['mm2', 'square millimeter'] }] }];
  }
  if (m.tipo === 'nota' && m.testo) return [{ nome: 'Nota', testo: m.testo.replace(/^✎\s*/, ''), valori: [], grafici }];
  return [];
}
async function esportaGSPS({ sr = false } = {}) {''', 'misureSR')
a = sost(a, "      cols: img.cols, rows: img.rows, mono1: !!img.mono1, wc: pan?.wc, ww: pan?.ww, grafici: [], testi: [] };",
  "      cols: img.cols, rows: img.rows, mono1: !!img.mono1, wc: pan?.wc, ww: pan?.ww, grafici: [], testi: [], sr: [] };", 'voce sr')
a = sost(a, "      for (const m of lista) { const r = graficiMisura(m, img, +idx, +si); v.grafici.push(...r.g); v.testi.push(...r.testi); }",
  "      for (const m of lista) { const r = graficiMisura(m, img, +idx, +si); v.grafici.push(...r.g); v.testi.push(...r.testi); v.sr.push(...misureSR(m, img, +idx, +si, r.g)); }", 'loop sr')
a = sost(a, "      for (const g of r.g) { const pts = []; for (let i = 0; i < g.punti.length; i += 2) pts.push(...aPix(aPaz(g.punti[i] - 0.5, g.punti[i + 1] - 0.5))); v.grafici.push({ ...g, punti: pts }); }",
  "      const gNuovi = []; for (const g of r.g) { const pts = []; for (let i = 0; i < g.punti.length; i += 2) pts.push(...aPix(aPaz(g.punti[i] - 0.5, g.punti[i + 1] - 0.5))); gNuovi.push({ ...g, punti: pts }); } v.grafici.push(...gNuovi);\n"
  "      v.sr.push(...misureSR(m, fp, +idx, +si, gNuovi).map((x) => ({ ...x, testo: [x.testo, `misurata sulla ricostruzione ${(PIANI[piano]?.nome || piano).toLowerCase()}`].filter(Boolean).join(' · ') })));", 'piani sr')
a = sost(a, "  const file = [...perStudio.values()].map((x, i) => ({ nome: `annotazioni_${i + 1}.dcm`, dati: creaGSPS(x.studio, x.immagini, { autore: UTENTE?.nome || '' }) }));",
  "  if (sr) {\n"
  "    const { creaSR } = await import('./gsps.js');\n"
  "    const fileSR = [...perStudio.values()].filter((x) => x.immagini.some((im) => im.sr.length)).map((x, i) => ({ nome: `misure_${i + 1}.dcm`, dati: creaSR(x.studio, x.immagini.filter((im) => im.sr.length), { autore: UTENTE?.nome || '' }) }));\n"
  "    if (!fileSR.length) throw new Error('nessuna misura con un valore (distanze, RECIST, ROI, angoli) da salvare');\n"
  "    fileSR.suPiani = suPiani; return fileSR;\n"
  "  }\n"
  "  const file = [...perStudio.values()].map((x, i) => ({ nome: `annotazioni_${i + 1}.dcm`, dati: creaGSPS(x.studio, x.immagini, { autore: UTENTE?.nome || '' }) }));", 'creaSR')
# client: voce nel menu Esporta
a = sost(a, "  } else if (cosa === 'misure') {",
  "  } else if (cosa === 'sr') {\n"
  "    st('Preparo il referto strutturato DICOM…'); const fl = await esportaGSPS({ sr: true });\n"
  "    if (fl.length === 1) scarica(new Blob([fl[0].dati], { type: 'application/dicom' }), `${base}_misure_SR.dcm`); else scarica(creaZip(fl), `${base}_misure_SR.zip`);\n"
  "    st(`Misure salvate in DICOM SR (${fl.length} ${fl.length === 1 ? 'file' : 'file, uno per studio'}): il PACS le legge come dati, con l'immagine di origine e la regione misurata.`);\n"
  "  } else if (cosa === 'misure') {", 'client sr')
# sito: pulsante SR accanto a GSPS (docenti e autori)
a = sost(a, "$('#btn-gsps').hidden = !(DOCENTE || AUTORE);", "$('#btn-gsps').hidden = !(DOCENTE || AUTORE); if ($('#btn-sr')) $('#btn-sr').hidden = !(DOCENTE || AUTORE);", 'sr visibile')
a = sost(a, "$('#btn-ripeti')?.addEventListener('click', () => ripeti());",
  "$('#btn-sr')?.addEventListener('click', async () => {\n"
  "  try { const fl = await esportaGSPS({ sr: true }), nome = slug(V.caso?.titolo_interno || V.caso?.titolo || V.caso?.id || 'caso');\n"
  "    if (fl.length === 1) scarica(new Blob([fl[0].dati], { type: 'application/dicom' }), `${nome}_misure_SR.dcm`); else scarica(creaZip(fl), `${nome}_misure_SR.zip`);\n"
  "    avvisoBreve('Misure salvate in DICOM SR: il PACS le legge come dati, insieme alle immagini del caso (⤓ Scarica lo studio).');\n"
  "  } catch (e) { avvisoBreve('DICOM SR: ' + e.message); }\n"
  "});\n"
  "$('#btn-ripeti')?.addEventListener('click', () => ripeti());", 'sr pulsante')
open(R + 'app.js', 'w', encoding='utf-8').write(a)

h = open(R + 'index.html', encoding='utf-8').read()
h = sost(h, '  <label class="check"><input type="radio" name="ex-cosa" value="gsps">',
  '  <label class="check"><input type="radio" name="ex-cosa" value="sr"> Misure come referto strutturato DICOM per il PACS (SR)</label>\n  <label class="check"><input type="radio" name="ex-cosa" value="gsps">', 'radio sr')
i = h.find('<button id="btn-gsps"'); j = h.find('</button>', i) + len('</button>')
h = h[:j] + '\n        <button id="btn-sr" class="ico" hidden title="Salva le misure (distanze, RECIST, ROI, angoli) come referto strutturato DICOM (SR, modello TID 1500): il PACS le legge come dati, con l\'immagine di origine" aria-label="Misure DICOM SR"><b style="font-size:9px;line-height:18px">SR</b></button>' + h[j:]
open(R + 'index.html', 'w', encoding='utf-8').write(h)
en = json.load(open(R + 'lingua/en.json', encoding='utf-8'))
for k, v in {'Misure come referto strutturato DICOM per il PACS (SR)': 'Measurements as a DICOM structured report for the PACS (SR)',
  "Salva le misure (distanze, RECIST, ROI, angoli) come referto strutturato DICOM (SR, modello TID 1500): il PACS le legge come dati, con l'immagine di origine": 'Save the measurements (distances, RECIST, ROIs, angles) as a DICOM structured report (SR, TID 1500 template): the PACS reads them as data, with the source image',
  'Misure DICOM SR': 'DICOM SR measurements', 'Preparo il referto strutturato DICOM…': 'Preparing the DICOM structured report…',
  'Misure salvate in DICOM SR: il PACS le legge come dati, insieme alle immagini del caso (⤓ Scarica lo studio).': 'Measurements saved as DICOM SR: the PACS reads them as data, together with the case images (⤓ Download the study).',
  "Misure salvate in DICOM SR ({x} {x}): il PACS le legge come dati, con l'immagine di origine e la regione misurata.": 'Measurements saved as DICOM SR ({x} {x}): the PACS reads them as data, with the source image and the measured region.',
  'DICOM SR: {x}': 'DICOM SR: {x}', 'nessuna misura con un valore (distanze, RECIST, ROI, angoli) da salvare': 'no measurement with a value (distances, RECIST, ROIs, angles) to save'}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('SR OK')
