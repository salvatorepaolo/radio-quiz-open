# integra_noduli.py: inserisce segmentaNodulo (versione scelta) in app.js e lo usa in crescitaVolume per i noduli polmonari
# in TC. Uso: python3 integra_noduli.py <segmenta_nodulo_vN.js>
import sys
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
s = open(W, encoding='utf-8').read(); f = open(sys.argv[1], encoding='utf-8').read().strip() + '\n'
a = '// Crescita di regione dal punto (x0, y0) dell\'immagine idx della serie del riquadro (o pannello temporaneo) p\nasync function crescitaVolume(p, idx, x0, y0, opz = {}) {\n  const img0 = await immagineDi(p, idx);\n  if (!img0) return null;\n  const W = img0.cols, H = img0.rows;\n  if (x0 < 1 || y0 < 1 || x0 >= W - 1 || y0 >= H - 1) return null;\n'
assert s.count(a) == 1, 'inizio di crescitaVolume non trovato'
b = f + a + '''  // nodulo polmonare in TC (1.270): segmentazione 3D dedicata; fuori dal polmone (o in PET) la crescita di regione generale
  if (!opz.generale && img0.modalita === 'CT' && !img0.suv) {
    const r = await segmentaNodulo(p, idx, x0, y0, immagineDi, normaleDi);
    if (r?.errore) return r;
    if (r) {
      const idxs = [...r.maschere.keys()].sort((a, b) => a - b);
      return { maschere: r.maschere, vol: r.vol, sconfina: r.sconfina, media: r.media, estensione: idxs.length * r.passo, unita: unita(img0), pet: null,
        diametro: diametroMaschere(r.maschere, img0), nodulo: { subsolido: r.subsolido, soglia: r.soglia } };
    }
  }
'''
s = s.replace(a, b)
# messaggio dopo la misura: il metodo usato
c = "avvisoBreve(`Volume ${virgola(r.vol, 2)} cm³ · RECIST ${virgola(rc.lung, 1)} mm di diametro massimo (immagine ${rc.j + 1}), aggiunto come misura: controllalo e correggilo se serve.`); } }"
assert s.count(c) == 1, 'messaggio non trovato'
s = s.replace(c, "avvisoBreve(`${r.nodulo ? (r.nodulo.subsolido ? 'Nodulo in vetro smerigliato (soglia −650 HU) · ' : 'Nodulo solido (soglia −400 HU) · ') : ''}Volume ${virgola(r.vol, 2)} cm³ (${Math.round(r.vol * 1000)} mm³) · RECIST ${virgola(rc.lung, 1)} mm di diametro massimo (immagine ${rc.j + 1}), aggiunto come misura: controllalo e correggilo se serve.`); } }")
open(W, 'w', encoding='utf-8').write(s); print('integrato')
