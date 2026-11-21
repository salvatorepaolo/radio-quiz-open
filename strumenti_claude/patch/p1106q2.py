# 1.212: RM mammella in posizione prona: assiali ruotate di 180° all'apertura (come si refertano); testi dei casi 055 e 056
import json, sys, os, re, datetime
R = '/Volumes/Caloggero/piattaforma-quiz/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)
a = open(R + 'cloud/web/app.js', encoding='utf-8').read()
a = sost(a, "  prefetchDi(p, p.token);\n  await mostraDi(k, p.idx);\n",
  "  prefetchDi(p, p.token);\n  await mostraDi(k, p.idx);\n  if (rotazioneMammella(p)) { p.rot = 2; disegna(); }\n", 'selezione serie')
a = sost(a, "const normaleDi = (iop) =>",
  "// RM della mammella in posizione prona: le assiali arrivano con le mammelle in basso (anteriore verso il basso dello\n"
  "// schermo); si refertano ruotate di 180°, con le mammelle in alto e la destra della paziente a sinistra dello schermo\n"
  "function rotazioneMammella(p) {\n"
  "  const img = p.img, o = img?.iop; if (!o || p.piano || p.rot) return false;\n"
  "  const s = V.serie[p.sIdx], testo = `${V.caso?.distretto || ''} ${V.caso?.titolo || ''} ${s?.descrizione || ''} ${s?.studio || ''}`;\n"
  "  const rm = metodicaDi(V.caso || {}) === 'RM' || /^MR$/i.test(img.modalita || img.mod || '');\n"
  "  if (!rm || !/mammell|breast|\\bmamm/i.test(testo)) return false;\n"
  "  const n = normaleDi(o); if (Math.abs(n[2]) < 0.8) return false;     // solo le assiali\n"
  "  return o[4] < -0.5;                                                  // l'anteriore è in basso nello schermo\n"
  "}\n"
  "const normaleDi = (iop) =>", 'funzione')
open(R + 'cloud/web/app.js', 'w', encoding='utf-8').write(a)

IT_A = 'Paziente prona: in queste immagini la sinistra della paziente è a sinistra dello schermo.'
IT_A2 = 'Paziente prona: le assiali si mostrano ruotate di 180°, come si refertano (mammelle in alto, destra della paziente a sinistra dello schermo).'
IT_S = "Orientamento: la paziente è prona e in queste immagini la sinistra è a sinistra dello schermo; con lo strumento «speculare» (tasto H) puoi riportarla alla convenzione radiologica."
IT_S2 = "Orientamento: la paziente è prona; il visualizzatore mostra le assiali ruotate di 180°, come si refertano, con la destra della paziente a sinistra dello schermo (con il pulsante «Ruota» torni all'immagine originale)."
EN_A2 = "Prone patient: axial images are shown rotated by 180°, as they are reported (breasts up, patient's right on the left of the screen)."
EN_S2 = "Orientation: the patient is prone; the viewer shows axial images rotated by 180°, as they are reported, with the patient's right on the left of the screen (the «Rotate» button returns to the original image)."
oggi = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
for n in ['055', '056']:
    cid = f'caso-tcia-{n}'
    p = R + f'casi-free/{cid}/caso.json'
    d = json.load(open(p, encoding='utf-8'))
    s = json.dumps(d, ensure_ascii=False)
    if IT_A not in s: sys.exit(f'{cid}: frase dell\'anamnesi non trovata')
    s = s.replace(IT_A, IT_A2).replace(IT_S, IT_S2)
    d = json.loads(s); d['aggiornato'] = oggi
    t = p + '.tmp'; json.dump(d, open(t, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(t, p)
    open(R + f'casi-free/{cid}/AGGIORNA', 'w').close()
    # traduzione inglese del caso: coppie testo italiano → inglese
    pl = R + f'cloud/web/lingua/casi/{cid}.json'
    L = json.load(open(pl, encoding='utf-8'))
    def cambia(x):
        if isinstance(x, str):
            x = x.replace(IT_A, IT_A2).replace(IT_S, IT_S2)
            x = re.sub(r"Prone patient:[^\"]*?screen\.", EN_A2, x)
            x = re.sub(r"Patient (is )?prone:[^\"]*?screen\.", EN_A2, x)
            x = re.sub(r"Orientation: the patient is prone.*?radiological convention\.", EN_S2, x, flags=re.S)
            return x
        if isinstance(x, list): return [cambia(y) for y in x]
        if isinstance(x, dict): return {cambia(k): cambia(v) for k, v in x.items()}
        return x
    L2 = cambia(L)
    json.dump(L2, open(pl, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(cid, 'ok; inglese:', 'cambiato' if L2 != L else 'NON cambiato (controllare)')
