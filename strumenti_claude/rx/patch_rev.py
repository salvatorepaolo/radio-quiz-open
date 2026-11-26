import re
D = '/Volumes/Caloggero/strumenti_claude/rx/'
p = D + 'scrivi_166_171.py'; s = open(p).read()

def rep(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)

# revisione indipendente nella nota del docente
rep("'NON ancora rivisto dal medico.' % (png, d['Finding Labels'], sp, extra_nota))}",
    "'%sNON ancora rivisto dal medico.' % (png, d['Finding Labels'], sp, extra_nota, REV.get(caso, '')))}")
rep("'strumenti_claude/rx/scrivi_166_171.py; pixel %.3f mm (spaziatura originale × riduzione). %s'",
    "'strumenti_claude/rx/scrivi_166_171.py; pixel %.3f mm (spaziatura originale × riduzione). %s'")
rep("OGGI = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')",
    """OGGI = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
# seconda lettura di Claude sull'immagine intera (26/11/2026, sera): non sostituisce la revisione del medico
REV = {
    'caso-tcia-166': '[revisione indipendente 26/11/2026] Campi polmonari trasparenti, seni liberi, ili e mediastino regolari, cuore nei limiti: confermata la normalità. ',
    'caso-tcia-167': '[revisione indipendente 26/11/2026] Opacità basale destra con menisco laterale e seno obliterato; base sinistra libera. Confermato. ',
    'caso-tcia-168': '[revisione indipendente 26/11/2026] Cuore grande confermato; trovati fili di sternotomia e clip chirurgiche (pregresso intervento cardiochirurgico), aggiunti come reperto. ',
    'caso-tcia-169': '[revisione indipendente 26/11/2026] Piccola opacità rotondeggiante nel campo superiore sinistro nel riquadro NIH; resto nella norma. Confermato. ',
    'caso-tcia-170': '[revisione indipendente 26/11/2026] Opacità del lobo superiore destro con margine inferiore netto e orizzontale: non si può dire se sia una massa, una consolidazione o un\\'atelettasia. Il caso è stato riscritto come «opacità da chiarire con la TC» invece di «massa». ',
    'caso-tcia-171': '[revisione indipendente 26/11/2026] Drenaggio a pigtail nell\\'emitorace sinistro, apice sinistro con aria residua nel riquadro NIH, mediastino in asse. Confermato; il pneumotorace residuo è piccolo e va cercato con la finestra stretta. ',
}""")

# 168: sternotomia
rep("        op('Campi polmonari senza versamento né edema alveolare evidenti', True, 'secondario', 0),\n        op('Versamento pericardico certo'",
    "        op('Campi polmonari senza versamento né edema alveolare evidenti', True, 'secondario', 0),\n"
    "        op('Fili metallici di sternotomia e clip chirurgiche nel mediastino: pregresso intervento cardiochirurgico', True, 'secondario', 0,\n"
    "           'Un reperto da riportare sempre: dopo un intervento sul cuore (bypass, valvole) l\\'ombra cardiaca è spesso grande.'),\n"
    "        op('Versamento pericardico certo'")
rep("'Cerca anche i segni di scompenso: ridistribuzione vascolare, linee B di Kerley, versamenti.',",
    "'Cerca anche i segni di scompenso (ridistribuzione vascolare, linee B di Kerley, versamenti) e quelli di interventi precedenti: '\n       'fili di sternotomia, clip, protesi valvolari, pacemaker.',")

# 170: da «massa» a «opacità da chiarire»
i = s.index("scrivi('caso-tcia-170'"); j = s.index("# ---------------------------------------------------------------- 171")
s = s[:i] + """scrivi('caso-tcia-170', '00022192_003.png',
       'RX torace (5/6): uomo di 73 anni', 'Opacità del lobo superiore destro: massa, consolidazione o atelettasia (NIH 00022192_003, etichetta «Mass»)',
       'non fornito', 'Intermedio',
       'Uomo di 73 anni. RX del torace in proiezione PA. La collezione non fornisce sintomi né motivo dell\\'esame.',
       'Descrivi l\\'opacità, indicala sull\\'immagine e scegli il passo successivo.',
       [op('Opacità del campo polmonare superiore destro con margine inferiore netto e orizzontale (sulla scissura orizzontale)', True, 'principale', 0,
           'Riquadro dei radiologi del NIH nel campo superiore destro (etichetta «Mass»).'),
        op('Dalla sola RX non si distingue tra massa, consolidazione e atelettasia del lobo superiore destro: serve un altro esame', True, 'secondario', 0),
        op('Versamento pleurico destro massivo', False, 'distrattore', 0),
        op('Pneumotorace apicale destro', False, 'distrattore', 0),
        op('Cardiomegalia', False, 'distrattore', 0),
        op('Opacità del lobo superiore destro in un paziente di 73 anni: TC del torace con mezzo di contrasto per cercare una massa (anche dentro o dietro un\\'atelettasia) e, se c\\'è, stadiarla', True, 'secondario', 1),
        op('Polmonite: solo antibiotico, nessun controllo', False, 'distrattore', 1),
        op('Nessun accertamento: reperto di nessun rilievo', False, 'distrattore', 1)],
       'Un\\'opacità che riempie il lobo superiore destro e si ferma con un margine netto e orizzontale è delimitata dalla scissura orizzontale. '
       'Le cause principali sono tre: consolidazione (polmonite: volume conservato, broncogramma aereo), atelettasia (perdita di volume: scissura che sale, '
       'ilo e trachea tirati verso l\\'alto e verso destra) e massa. Una massa all\\'ilo che chiude il bronco dà un\\'atelettasia con il margine a «S» '
       '(segno di Golden): è il quadro da non perdere nell\\'anziano fumatore. Per questo un\\'opacità del lobo superiore a questa età si studia con la TC con '
       'mezzo di contrasto; se si tratta come polmonite, la RX di controllo dopo 6-8 settimane è obbligatoria, perché una «polmonite che non guarisce» '
       'può nascondere un tumore.',
       'Opacità lobare nell\\'anziano: cerca perdita di volume e massa all\\'ilo; poi TC, oppure controllo obbligato dopo l\\'antibiotico.',
       'Opacità lobo superiore destro',
       extra_nota='Etichetta NIH «Mass»; la lettura sull\\'immagine non permette di confermarla. ')

""" + s[j:]
open(p, 'w').write(s)

p = D + 'scrivi_172_174.py'; s = open(p).read()
rep("'Età, sesso e dinamica non forniti dalla fonte. %sNON ancora rivisto dal medico.' % (jpg, tolti, extra))}",
    "'Età, sesso e dinamica non forniti dalla fonte. %s%sNON ancora rivisto dal medico.' % (jpg, tolti, extra, REV.get(caso, '')))}")
rep("OGGI = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')",
    """OGGI = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
REV = {
    'caso-tcia-172': '[revisione indipendente 26/11/2026] Linee di frattura nel radio distale nel riquadro della collezione, ulna integra in AP; manca la laterale per lo spostamento. Confermato. ',
    'caso-tcia-173': '[revisione indipendente 26/11/2026] Linea obliqua nella diafisi tibiale (passaggio tra terzo medio e distale), allineamento conservato, cartilagini di ginocchio e caviglia aperte (bambino). Confermato. ',
    'caso-tcia-174': '[revisione indipendente 26/11/2026] Corticali di radio e ulna continue, carpo allineato, metacarpi e falangi integri. Confermato senza fratture visibili. ',
}""")
open(p, 'w').write(s)
print('ok')
