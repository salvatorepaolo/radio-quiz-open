import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1107u')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)
sost("""async function dividiPerPiano(serie, id) {""", r"""// solo l'intestazione DICOM di un file: con una richiesta parziale (i primi 64 kB) invece del file intero, che per RX e
// mammografie pesa diversi MB; se il server non la accetta o l'intestazione è più lunga, si scarica il file
async function intestazioneDicom(url) {
  const leggi = (b) => dicomParser.parseDicom(b, { untilTag: 'x7fe00010' });
  if (BUF.has(url)) return leggi(new Uint8Array(bufDi(BUF.get(url))));
  if (!CLIENT) try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-65535' }, credentials: 'same-origin' });
    if (r.status === 206) { const b = new Uint8Array(await r.arrayBuffer()); try { const ds = leggi(b); if (ds.elements.x7fe00010 || b.length < 65536) return ds; } catch {} }
  } catch {}
  const buf = await caricaRaw({ url }); BUF.set(url, buf); return leggi(new Uint8Array(bufDi(buf)));
}
async function dividiPerPiano(serie, id) {""")
sost("""      const f = { url }; const buf = await caricaRaw(f); BUF.set(url, buf);
      const ds = dicomParser.parseDicom(new Uint8Array(bufDi(buf)), { untilTag: 'x7fe00010' });""", """      const ds = await intestazioneDicom(url);""")
sost("""    try { const f = { url: `/casi/${V.caso.id}/${s.files[0]}` }; const im = decodificaDicom(await caricaRaw(f));""",
     """    try { const ds = await intestazioneDicom(`/casi/${V.caso.id}/${s.files[0]}`), fl = (n) => { const v = [...Array(n).keys()].map((i) => ds.floatString('x00200037', i)); return v.every(Number.isFinite) ? v : null; };
      const im = { modalita: (ds.string('x00080060') || '').trim(), for: ds.string('x00200052') || '', iop: fl(6) };""")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
