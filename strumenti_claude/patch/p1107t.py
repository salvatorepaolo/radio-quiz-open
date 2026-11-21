A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)
sost("""  const avvia = () => {
    while (attive < 3 && coda.length) {
      const b = coda.shift(), s = V.serie[+b.dataset.i]; if (!s) continue;
      attive++;""", """  const avvia = () => {
    // prima l'immagine del riquadro attivo: le miniature aspettano (sulla rete lenta non le rubano banda)
    if (!CLIENT && !P(V.attivo)?.img) { setTimeout(avvia, 400); return; }
    while (attive < 3 && coda.length) {
      const b = coda.shift(), s = V.serie[+b.dataset.i]; if (!s) continue;
      attive++;
      // con l'anteprima ridotta della serie la miniatura non scarica l'immagine intera (RX e mammografie pesano MB)
      if (s.anteprima && !CLIENT) {
        caricaAnteprima(s).then((a) => { if (!a) throw new Error('senza anteprima');
          const m = a.n >> 1, pix = a.dati.subarray(m * a.w * a.h, (m + 1) * a.w * a.h);
          const cv = document.createElement('canvas'); cv.width = 72; cv.height = 72; cv.className = 'anteprima';
          disegnaAnteprima(cv, suvizza({ rows: a.h, cols: a.w, pix, slope: 1, inter: 0, wc: a.wc ?? undefined, ww: a.ww ?? undefined, spRow: (a.sp?.[0] || 1) * a.f, spCol: (a.sp?.[1] || 1) * a.f, mono1: !!a.mono1 }, s.suv));
          b.prepend(cv); })
          .catch(() => caricaRaw({ url: `/casi/${V.caso.id}/${s.files[Math.floor(s.files.length / 2)]}` }).then((buf) => { const cv = document.createElement('canvas'); cv.width = 72; cv.height = 72; cv.className = 'anteprima'; disegnaAnteprima(cv, suvizza(decodificaDicom(buf), s.suv)); b.prepend(cv); }).catch(() => {}))
          .finally(() => { attive--; avvia(); });
        continue;
      }""")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
