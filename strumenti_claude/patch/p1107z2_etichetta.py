import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
D, A = W + 'decodifica.js', W + 'app.js'
for f in (D, A): shutil.copy(f, f + '.bak_1107z')

d = open(D, encoding='utf-8').read()
a = "    for: ds.string('x00200052') || '',\n"
b = """    for: ds.string('x00200052') || '',
    // dati dell'esame per l'etichetta della serie: solo campi non identificativi (niente nome, codici, struttura)
    esame: (() => { const st = (t) => (ds.string(t) || '').trim(), n = (t) => num(t);
      return { sesso: st('x00100040'), eta: st('x00101010'), data: st('x00080020'), studio: st('x00081030'), serie: st('x0008103e'), parte: st('x00180015'),
        kv: n('x00180060'), mas: n('x00181152'), ma: n('x00181151'), ctdi: n('x00189345'), tesla: n('x00180087'), tr: n('x00180080'), ti: n('x00180082'), flip: n('x00181314'),
        mdc: st('x00180010'), produttore: st('x00080070'), modello: st('x00081090') }; })(),
"""
assert d.count(a) == 1; d = d.replace(a, b)
open(D, 'w', encoding='utf-8').write(d)

s = open(A, encoding='utf-8').read()
# righe dell'etichetta: paziente (sesso, età), data e descrizione dello studio, parametri tecnici
a = "function righePaziente(img) {"
b = """// età DICOM («022Y», «006M», «03W», «010D») in parole
function etaLeggibile(v) {
  const m = /^(\\d{1,3})([YMWD])$/i.exec(v || ''); if (!m) return '';
  const x = +m[1], u = m[2].toUpperCase();
  return u === 'Y' ? `${x} anni` : u === 'M' ? `${x} ${x === 1 ? 'mese' : 'mesi'}` : u === 'W' ? `${x} ${x === 1 ? 'settimana' : 'settimane'}` : `${x} ${x === 1 ? 'giorno' : 'giorni'}`;
}
function righeEsame(img, gia = '', largo = true) {
  const e = img?.esame; if (!e) return [];
  const r = [], sesso = { M: 'M', F: 'F', O: 'altro' }[e.sesso?.toUpperCase()] || '';
  const eta = /\\banni\\b|\\bmesi\\b|\\bgiorni\\b/.test(gia) ? '' : etaLeggibile(e.eta);
  const p1 = [sesso && !/\\b[MF]\\b ·/.test(gia) ? sesso : '', eta, e.data && !V.esportando ? dataDicom(e.data) : '', e.studio && !gia.toLowerCase().includes(e.studio.toLowerCase()) ? e.studio : ''].filter(Boolean);
  if (p1.length) r.push(p1.join(' · '));
  if (!largo) return r;
  const v = (x, c = 0) => (x != null ? virgola(x, c) : '');
  const t = img.modalita === 'CT' ? [e.kv ? `${v(e.kv)} kV` : '', e.mas ? `${v(e.mas)} mAs` : e.ma ? `${v(e.ma)} mA` : '', e.ctdi ? `CTDIvol ${v(e.ctdi, 1)} mGy` : '']
    : img.modalita === 'MR' ? [e.tesla ? `${v(e.tesla, 1)} T` : '', e.tr ? `TR ${v(e.tr)}` : '', img.te != null ? `TE ${v(img.te, img.te < 10 ? 1 : 0)}` : '', e.ti ? `TI ${v(e.ti)}` : '', e.flip ? `${v(e.flip)}°` : '']
    : ['CR', 'DX', 'MG', 'RF', 'XA'].includes(img.modalita) ? [e.kv ? `${v(e.kv)} kV` : '', e.mas ? `${v(e.mas, 1)} mAs` : ''] : [];
  if (e.mdc) t.push(`mdc: ${e.mdc}`);
  const t2 = t.filter(Boolean); if (t2.length) r.push(t2.join(' · '));
  const app = [e.produttore, e.modello].filter(Boolean).join(' ');
  if (app) r.push(app);
  return r;
}
function righePaziente(img) {"""
assert s.count(a) == 1; s = s.replace(a, b)
a = "  if (CLIENT && V.datiPaziente && !V.esportando && img) for (const r of righePaziente(img)) tl.push('👤 ' + r);"
b = """  if (img && V.datiEsame !== false) tl.splice(1, 0, ...righeEsame(img, tl[0], R.w >= 360 && R.h >= 260));   // sotto il nome della serie
  if (CLIENT && V.datiPaziente && !V.esportando && img) for (const r of righePaziente(img)) tl.push('👤 ' + r);"""
assert s.count(a) == 1; s = s.replace(a, b)
open(A, 'w', encoding='utf-8').write(s)
print('ok')
