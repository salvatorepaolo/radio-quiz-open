"""Casi 166-171 (26/11/2026): RX torace dal NIH ChestX-ray14 (PNG 8 bit 1024×1024 → DICOM DX).
Solo immagini con il riquadro disegnato dai radiologi del NIH (BBox_List_2017) e un'immagine «No Finding».
Uso: ~/.radioquiz-ia/venv/bin/python scrivi_166_171.py   (dalla cartella _tcia_grezzi/nih_cxr14)
"""
import csv, json, os, datetime
import numpy as np, pydicom
from PIL import Image
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free'
QUI = '/Volumes/Caloggero/piattaforma-quiz/_tcia_grezzi/nih_cxr14'
DX = '1.2.840.10008.5.1.4.1.1.1.1'
de = {r['Image Index']: r for r in csv.DictReader(open(os.path.join(QUI, 'Data_Entry_2017_v2020.csv')))}
bb = {r[0]: (r[1], *map(float, r[2:6])) for r in list(csv.reader(open(os.path.join(QUI, 'BBox_List_2017.csv'))))[1:]}
OGGI = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
# seconda lettura di Claude sull'immagine intera (26/11/2026, sera): non sostituisce la revisione del medico
REV = {
    'caso-tcia-166': '[revisione indipendente 26/11/2026] Campi polmonari trasparenti, seni liberi, ili e mediastino regolari, cuore nei limiti: confermata la normalità. ',
    'caso-tcia-167': '[revisione indipendente 26/11/2026] Opacità basale destra con menisco laterale e seno obliterato; base sinistra libera. Confermato. ',
    'caso-tcia-168': '[revisione indipendente 26/11/2026] Cuore grande confermato; trovati fili di sternotomia e clip chirurgiche (pregresso intervento cardiochirurgico), aggiunti come reperto. ',
    'caso-tcia-169': '[revisione indipendente 26/11/2026] Piccola opacità rotondeggiante nel campo superiore sinistro nel riquadro NIH; resto nella norma. Confermato. ',
    'caso-tcia-170': '[revisione indipendente 26/11/2026] Opacità del lobo superiore destro con margine inferiore netto e orizzontale: non si può dire se sia una massa, una consolidazione o un\'atelettasia. Il caso è stato riscritto come «opacità da chiarire con la TC» invece di «massa». ',
    'caso-tcia-171': '[revisione indipendente 26/11/2026] Drenaggio a pigtail nell\'emitorace sinistro, apice sinistro con aria residua nel riquadro NIH, mediastino in asse. Confermato; il pneumotorace residuo è piccolo e va cercato con la finestra stretta. ',
}

FONTE = {
    'archivio': 'NIH Clinical Center, non TCIA',
    'collezione': 'NIH ChestX-ray14 (ChestX-ray8)',
    'licenza': 'Uso senza restrizioni, con citazione (NIH Clinical Center)',
    'licenza_url': 'https://nihcc.app.box.com/v/ChestXray-NIHCC',
    'citazione': 'Wang X., Peng Y., Lu L., Lu Z., Bagheri M., Summers R.M. (2017). ChestX-ray8: Hospital-scale Chest X-ray Database and Benchmarks on Weakly-Supervised Classification and Localization of Common Thorax Diseases. IEEE CVPR, pp. 3462-3471. Dati forniti dal NIH Clinical Center.',
    'url': 'https://nihcc.app.box.com/v/ChestXray-NIHCC',
    'nota': 'Immagini PNG a 8 bit (1024×1024) convertite in DICOM da radio-quiz.it: non sono DICOM originali.',
}
SEZ = [{'nome': 'Reperti', 'domanda': 'Che cosa vedi?'},
       {'nome': 'Conclusioni', 'domanda': 'Qual è la conclusione e che cosa fai?', 'singola': True}]


def dicom(caso, png, desc):
    d = de[png]; im = Image.open(os.path.join(QUI, 'png', png)).convert('L'); a = np.asarray(im, dtype=np.uint8)
    # il NIH ha ridotto ogni immagine a 1024×1024: si usano solo originali quadrati, quindi il pixel resta quadrato
    assert abs(int(d['OriginalImage[Width']) / int(d['Height]']) - 1) < 0.01, png
    sp = float(d['OriginalImagePixelSpacing[x']) * int(d['OriginalImage[Width']) / a.shape[1]
    cart = os.path.join(CASI, caso, 'serie', '0001_RX_torace_PA'); os.makedirs(cart, exist_ok=True)
    fm = FileMetaDataset(); fm.MediaStorageSOPClassUID = DX; fm.MediaStorageSOPInstanceUID = generate_uid(); fm.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = Dataset(); ds.file_meta = fm
    ds.ImageType = ['DERIVED', 'SECONDARY']; ds.SOPClassUID = DX; ds.SOPInstanceUID = fm.MediaStorageSOPInstanceUID
    ds.Modality = 'DX'; ds.PresentationIntentType = 'FOR PRESENTATION'
    ds.SeriesDescription = desc
    ds.DerivationDescription = 'Convertita da PNG a 8 bit della collezione NIH ChestX-ray14: non e un DICOM originale'
    ds.PatientName = 'ANONIMO^' + caso; ds.PatientID = caso; ds.PatientSex = d['Patient Gender']; ds.PatientAge = '%03dY' % int(d['Patient Age'])
    ds.PatientIdentityRemoved = 'YES'; ds.DeidentificationMethod = 'NIH ChestX-ray14 anonimizzata alla fonte'
    ds.BodyPartExamined = 'CHEST'; ds.ViewPosition = 'PA'
    ds.StudyInstanceUID = generate_uid(); ds.SeriesInstanceUID = generate_uid(); ds.SeriesNumber = 1; ds.InstanceNumber = 1
    ds.PixelSpacing = [round(sp, 4)] * 2; ds.ImagerPixelSpacing = [round(sp, 4)] * 2
    ds.PixelSpacingCalibrationType = 'GEOMETRY'; ds.PixelSpacingCalibrationDescription = 'Dalla collezione (spaziatura originale × fattore di riduzione a 1024 px)'
    ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME2'; ds.Rows, ds.Columns = a.shape
    ds.BitsAllocated = 8; ds.BitsStored = 8; ds.HighBit = 7; ds.PixelRepresentation = 0; ds.BurnedInAnnotation = 'NO'
    lo, hi = np.percentile(a, [1, 99.5]); ds.WindowCenter = round((lo + hi) / 2); ds.WindowWidth = round(hi - lo)
    ds.RescaleIntercept = 0; ds.RescaleSlope = 1; ds.RescaleType = 'US'
    ds.ImageComments = 'NIH ChestX-ray14 ' + png
    ds.PixelData = a.tobytes()
    f = os.path.join(cart, 'img_00001.dcm'); ds.save_as(f, enforce_file_format=True)
    json.dump([{'descrizione': desc, 'numero': 1, 'files': ['serie/0001_RX_torace_PA/img_00001.dcm']}],
              open(os.path.join(CASI, caso, 'serie.json'), 'w'), ensure_ascii=False, indent=1)
    return sp, d


def segno(png):
    _, x, y, w, h = bb[png]
    return {'a': {'x': round(x), 'y': round(y)}, 'b': {'x': round(x + w), 'y': round(y + h)}}


def op(testo, corretta, tipo, sez, nota=None):
    o = {'testo': testo, 'corretta': corretta, 'tipo': tipo, 'sezione': sez}
    if nota: o['nota'] = nota
    return o


def scrivi(caso, png, titolo, titolo_interno, quesito, diff, anamnesi, domanda, opzioni, spiegazione, regola, nota_vista,
           localizza=True, comunicazione=None, esito=None, extra_nota=''):
    sp, d = dicom(caso, png, 'RX torace PA')
    lab = bb.get(png, ('No Finding',))[0]
    c = {'id': caso, 'visibile': True, 'aggiornato': OGGI, 'titolo': titolo, 'titolo_interno': titolo_interno,
         'distretto': 'Torace', 'quesito': quesito, 'modalita': 'RX', 'difficolta': diff, 'anamnesi': anamnesi,
         'domanda': domanda, 'sezioni': SEZ, 'opzioni': opzioni, 'spiegazione': spiegazione, 'regola': regola,
         'esito_clinico': esito or {'tipo': 'altro', 'testo': ('Riquadro della lesione disegnato dai radiologi del NIH (BBox_List_2017: «%s»). ' % lab if png in bb else 'Etichetta della collezione: «No Finding» (estratta dai referti con un programma). ') + 'Nessun dato clinico, istologia o follow-up.'},
         'fonte': dict(FONTE, soggetto='%s (paziente %s, controllo n. %s; %s, %s anni)' % (png, d['Patient ID'], d['Follow-up #'], d['Patient Gender'], d['Patient Age'])),
         'serie_iniziale': 0, 'riquadri': 1,
         'vista': {'serie': 0, 'idx': 0, 'zoom': 1, 'panX': 0, 'panY': 0, 'nota': nota_vista},
         'nota_docente': ('Caso creato da Claude il 26/11/2026 dalla collezione NIH ChestX-ray14 (%s, etichette «%s»), convertita da PNG 8 bit 1024×1024 in DICOM DX con '
                          'strumenti_claude/rx/scrivi_166_171.py; pixel %.3f mm (spaziatura originale × riduzione). %s'
                          '%sNON ancora rivisto dal medico.' % (png, d['Finding Labels'], sp, extra_nota, REV.get(caso, '')))}
    if localizza and png in bb:
        c['localizza'] = True; c['vista']['segno'] = segno(png)
    if comunicazione: c['comunicazione'] = comunicazione
    c['checklist'] = 'obbligatoria'   # 26/11: casi del primo anno, si legge con la lista prima di rispondere
    os.makedirs(os.path.join(CASI, caso), exist_ok=True)
    json.dump(c, open(os.path.join(CASI, caso, 'caso.json'), 'w'), ensure_ascii=False, indent=1)
    print(caso, png, lab, 'pixel %.3f mm' % sp)


# ---------------------------------------------------------------- 166 normale
scrivi('caso-tcia-166', '00002246_000.png',
       'RX torace (1/6): uomo di 44 anni', 'RX del torace nei limiti della norma (NIH 00002246_000, «No Finding»)',
       'non fornito', 'Base',
       'Uomo di 44 anni. RX del torace in proiezione PA. La collezione non fornisce sintomi né motivo dell\'esame.',
       'Leggi la radiografia con un ordine fisso e concludi.',
       [op('Campi polmonari ben espansi e trasparenti, senza opacità focali', True, 'principale', 0),
        op('Seni costofrenici liberi e cupole diaframmatiche regolari', True, 'secondario', 0),
        op('Ombra cardiaca nei limiti: rapporto cardio-toracico inferiore a 0,5', True, 'secondario', 0),
        op('Ili polmonari di forma e sede regolari, mediastino in asse', True, 'secondario', 0),
        op('Nodulo polmonare nel campo medio destro', False, 'distrattore', 0),
        op('Versamento pleurico sinistro', False, 'distrattore', 0),
        op('Pneumotorace apicale', False, 'distrattore', 0),
        op('RX del torace nei limiti della norma: polmoni trasparenti, cuore e mediastino regolari', True, 'secondario', 1),
        op('Cardiomegalia: ecocardiogramma', False, 'distrattore', 1),
        op('Opacità sospetta: TC del torace', False, 'distrattore', 1)],
       'Una RX del torace normale va saputa riconoscere prima di quelle patologiche. Conviene leggere sempre nello stesso ordine: '
       'qualità (identificazione, proiezione PA, inspirazione: 9-10 archi costali posteriori sopra il diaframma, rotazione: processi spinosi a metà tra le teste delle clavicole), '
       'vie aeree e mediastino, ili, polmoni confrontando i due lati zona per zona, pleure e seni costofrenici, diaframma, cuore (rapporto cardio-toracico in PA < 0,5), '
       'ossa e tessuti molli, e infine le «zone nascoste»: apici, dietro il cuore, sotto le cupole.',
       'Leggi sempre con lo stesso ordine e controlla le zone nascoste: apici, retrocardiaca, sotto le cupole.',
       'RX del torace normale', localizza=False,
       extra_nota='Etichetta NLP «No Finding» (non è un riquadro di radiologo): normalità verificata solo da Claude sull\'immagine. ')

# ---------------------------------------------------------------- 167 versamento
scrivi('caso-tcia-167', '00023058_004.png',
       'RX torace (2/6): uomo di 52 anni', 'Versamento pleurico destro (NIH 00023058_004, riquadro «Effusion»)',
       'non fornito', 'Base',
       'Uomo di 52 anni. RX del torace in proiezione PA. La collezione non fornisce sintomi né motivo dell\'esame.',
       'Descrivi il reperto, indica dove si trova e concludi.',
       [op('Opacità omogenea della base destra con margine superiore a menisco (concavo verso l\'alto, più alto lateralmente)', True, 'principale', 0,
           'Riquadro dei radiologi del NIH sulla base destra.'),
        op('Seno costofrenico destro obliterato', True, 'secondario', 0),
        op('Base sinistra e seno costofrenico sinistro liberi', True, 'secondario', 0),
        op('Consolidazione del lobo inferiore destro con broncogramma aereo', False, 'distrattore', 0),
        op('Pneumotorace destro', False, 'distrattore', 0),
        op('Sollevamento dell\'emidiaframma destro senza liquido', False, 'distrattore', 0),
        op('Versamento pleurico destro con menisco: ecografia del torace per quantificarlo e cercarne la causa (ed eventualmente guidare la toracentesi)', True, 'secondario', 1),
        op('Polmonite basale destra: solo terapia antibiotica', False, 'distrattore', 1),
        op('RX nei limiti della norma', False, 'distrattore', 1)],
       'Il versamento pleurico libero si raccoglie nelle parti declivi: in piedi oblitera prima il seno costofrenico posteriore (laterale), poi quello laterale in PA '
       '(servono circa 200-300 ml). Il segno tipico è il menisco: margine superiore concavo, più alto lungo la parete. Una consolidazione invece ha margini irregolari, '
       'broncogramma aereo e non segue la gravità. L\'ecografia conferma il liquido, ne stima la quantità, mostra setti e corpuscolati e guida la toracentesi; '
       'la causa (scompenso, infezione, neoplasia) va cercata con la clinica e, se serve, con l\'analisi del liquido.',
       'Base opaca con menisco e seno obliterato = liquido; cerca sempre il lato opposto e la causa.',
       'Versamento pleurico destro')

# ---------------------------------------------------------------- 168 cardiomegalia
scrivi('caso-tcia-168', '00000661_000.png',
       'RX torace (3/6): uomo di 57 anni', 'Cardiomegalia (NIH 00000661_000, riquadro «Cardiomegaly»)',
       'non fornito', 'Base',
       'Uomo di 57 anni. RX del torace in proiezione PA. La collezione non fornisce sintomi né motivo dell\'esame.',
       'Valuta l\'ombra cardiaca (puoi misurarla) e concludi.',
       [op('Ombra cardiaca ingrandita: rapporto cardio-toracico superiore a 0,5', True, 'principale', 0,
           'Diametro trasverso massimo del cuore diviso per il diametro interno massimo del torace, sulla stessa PA.'),
        op('Campi polmonari senza versamento né edema alveolare evidenti', True, 'secondario', 0),
        op('Fili metallici di sternotomia e clip chirurgiche nel mediastino: pregresso intervento cardiochirurgico', True, 'secondario', 0,
           'Un reperto da riportare sempre: dopo un intervento sul cuore (bypass, valvole) l\'ombra cardiaca è spesso grande.'),
        op('Versamento pericardico certo', False, 'distrattore', 0,
           'Sulla RX un cuore grande non distingue tra dilatazione delle camere e versamento pericardico: serve l\'ecocardiogramma.'),
        op('Edema polmonare alveolare bilaterale «ad ali di farfalla»', False, 'distrattore', 0),
        op('Mediastino superiore allargato', False, 'distrattore', 0),
        op('Cardiomegalia: ecocardiogramma per capire la causa (camere dilatate, ipertrofia, versamento pericardico)', True, 'secondario', 1),
        op('Cuore normale: in PA l\'ombra cardiaca è sempre sovrastimata', False, 'distrattore', 1,
           'È la proiezione AP (letto, paziente seduto) a ingrandire il cuore; in PA il rapporto > 0,5 è significativo.'),
        op('Versamento pericardico: pericardiocentesi', False, 'distrattore', 1)],
       'Il rapporto cardio-toracico (RCT) si misura solo in PA in buona inspirazione: diametro trasverso massimo del cuore (dalla linea mediana al bordo destro più quella '
       'al bordo sinistro) diviso per il diametro interno massimo del torace. Oltre 0,5 è cardiomegalia. In AP, in espirazione o con il paziente sdraiato il cuore appare '
       'più grande e il valore non è affidabile. La RX non distingue camere dilatate, ipertrofia e versamento pericardico: per questo si fa l\'ecocardiogramma. '
       'Cerca anche i segni di scompenso (ridistribuzione vascolare, linee B di Kerley, versamenti) e quelli di interventi precedenti: '
       'fili di sternotomia, clip, protesi valvolari, pacemaker.',
       'RCT > 0,5 solo in PA ben inspirata; poi cerca i segni di scompenso.',
       'Ombra cardiaca ingrandita')

# ---------------------------------------------------------------- 169 nodulo
x0 = bb['00012374_000.png']
scrivi('caso-tcia-169', '00012374_000.png',
       'RX torace (4/6): uomo di 34 anni', 'Nodulo polmonare nel campo superiore sinistro (NIH 00012374_000, riquadro «Nodule»)',
       'non fornito', 'Intermedio',
       'Uomo di 34 anni. RX del torace in proiezione PA. La collezione non fornisce sintomi né motivo dell\'esame; non ci sono radiografie precedenti.',
       'C\'è una lesione? Se sì, indicala sull\'immagine e concludi.',
       [op('Piccolo nodulo nel campo polmonare superiore sinistro', True, 'principale', 0,
           'Riquadro dei radiologi del NIH nel campo superiore sinistro, sotto la clavicola.'),
        op('Restanti campi polmonari, seni costofrenici e ombra cardiaca nella norma', True, 'secondario', 0),
        op('Nodulo nel campo inferiore destro', False, 'distrattore', 0),
        op('Massa ilare sinistra', False, 'distrattore', 0),
        op('Nessuna lesione focale', False, 'distrattore', 0),
        op('Nodulo polmonare isolato senza precedenti per confronto: TC del torace per caratterizzarlo (dimensioni, densità, margini, calcificazioni)', True, 'secondario', 1),
        op('Nessun controllo: a 34 anni un nodulo è sempre benigno', False, 'distrattore', 1),
        op('Ripetere la RX tra due anni', False, 'distrattore', 1)],
       'Un nodulo polmonare è un\'opacità rotondeggiante fino a 3 cm (oltre si parla di massa). Prima di tutto si cercano radiografie precedenti: un nodulo stabile da '
       'più di 2 anni o con calcificazioni benigne (centrale, diffusa, a «popcorn», lamellare) non richiede altro. Altrimenti si caratterizza con la TC, che dice '
       'dimensioni, densità (solido, parzialmente solido, vetro smerigliato) e margini; il percorso successivo segue le linee guida (Fleischner per i noduli '
       'incidentali) e il rischio del paziente. Attenzione alle false immagini: capezzolo, incrocio di coste, osteofiti, calcificazioni costali.',
       'Davanti a un nodulo: cerca le RX precedenti, poi TC; escludi capezzoli e incroci costali.',
       'Nodulo campo superiore sinistro',
       extra_nota='Il riquadro NIH (circa %.0f × %.0f mm) è più grande del nodulo: misurarlo sull\'immagine prima di indicarne le dimensioni. ' % (x0[3] * 0.418, x0[4] * 0.418))

# ---------------------------------------------------------------- 170 massa
scrivi('caso-tcia-170', '00022192_003.png',
       'RX torace (5/6): uomo di 73 anni', 'Opacità del lobo superiore destro: massa, consolidazione o atelettasia (NIH 00022192_003, etichetta «Mass»)',
       'non fornito', 'Intermedio',
       'Uomo di 73 anni. RX del torace in proiezione PA. La collezione non fornisce sintomi né motivo dell\'esame.',
       'Descrivi l\'opacità, indicala sull\'immagine e scegli il passo successivo.',
       [op('Opacità del campo polmonare superiore destro con margine inferiore netto e orizzontale (sulla scissura orizzontale)', True, 'principale', 0,
           'Riquadro dei radiologi del NIH nel campo superiore destro (etichetta «Mass»).'),
        op('Dalla sola RX non si distingue tra massa, consolidazione e atelettasia del lobo superiore destro: serve un altro esame', True, 'secondario', 0),
        op('Versamento pleurico destro massivo', False, 'distrattore', 0),
        op('Pneumotorace apicale destro', False, 'distrattore', 0),
        op('Cardiomegalia', False, 'distrattore', 0),
        op('Opacità del lobo superiore destro in un paziente di 73 anni: TC del torace con mezzo di contrasto per cercare una massa (anche dentro o dietro un\'atelettasia) e, se c\'è, stadiarla', True, 'secondario', 1),
        op('Polmonite: solo antibiotico, nessun controllo', False, 'distrattore', 1),
        op('Nessun accertamento: reperto di nessun rilievo', False, 'distrattore', 1)],
       'Un\'opacità che riempie il lobo superiore destro e si ferma con un margine netto e orizzontale è delimitata dalla scissura orizzontale. '
       'Le cause principali sono tre: consolidazione (polmonite: volume conservato, broncogramma aereo), atelettasia (perdita di volume: scissura che sale, '
       'ilo e trachea tirati verso l\'alto e verso destra) e massa. Una massa all\'ilo che chiude il bronco dà un\'atelettasia con il margine a «S» '
       '(segno di Golden): è il quadro da non perdere nell\'anziano fumatore. Per questo un\'opacità del lobo superiore a questa età si studia con la TC con '
       'mezzo di contrasto; se si tratta come polmonite, la RX di controllo dopo 6-8 settimane è obbligatoria, perché una «polmonite che non guarisce» '
       'può nascondere un tumore.',
       'Opacità lobare nell\'anziano: cerca perdita di volume e massa all\'ilo; poi TC, oppure controllo obbligato dopo l\'antibiotico.',
       'Opacità lobo superiore destro',
       extra_nota='Etichetta NIH «Mass»; la lettura sull\'immagine non permette di confermarla. ')

# ---------------------------------------------------------------- 171 pneumotorace con drenaggio
scrivi('caso-tcia-171', '00028861_009.png',
       'RX torace (6/6): donna di 24 anni con drenaggio toracico', 'Pneumotorace sinistro residuo con drenaggio in sede (NIH 00028861_009, riquadro «Pneumothorax»)',
       'controllo dopo drenaggio', 'Intermedio',
       'Donna di 24 anni. RX del torace in proiezione PA di controllo; è presente un drenaggio toracico. La collezione non fornisce il motivo del drenaggio.',
       'C\'è ancora aria nel cavo pleurico? Indicala sull\'immagine e concludi.',
       [op('Pneumotorace sinistro residuo nella parte alta dell\'emitorace: linea pleurica viscerale con spazio senza trama polmonare all\'esterno', True, 'principale', 0,
           'Riquadro dei radiologi del NIH nella parte superiore dell\'emitorace sinistro.'),
        op('Drenaggio toracico nell\'emitorace sinistro', True, 'secondario', 0),
        op('Mediastino in asse ed emidiaframma sinistro non appiattito: nessun segno di tensione', True, 'secondario', 0),
        op('Versamento pleurico sinistro con menisco', False, 'distrattore', 0),
        op('Frattura costale scomposta', False, 'distrattore', 0),
        op('Consolidazione del lobo superiore destro', False, 'distrattore', 0),
        op('Pneumotorace residuo con drenaggio in sede: avvisare chi segue la paziente, verificare che il drenaggio funzioni e sia ben posizionato, ripetere la RX', True, 'secondario', 1),
        op('Polmone completamente riespanso: il drenaggio si può togliere', False, 'distrattore', 1),
        op('Pneumotorace iperteso: decompressione immediata con ago', False, 'distrattore', 1)],
       'Il pneumotorace si riconosce dalla linea pleurica viscerale: una sottile linea bianca parallela alla parete, oltre la quale non c\'è trama polmonare. '
       'In piedi l\'aria sale all\'apice; da sdraiati va davanti e in basso (segno del solco profondo). Le pieghe cutanee e i bordi della scapola possono simularlo: '
       'la linea pleurica è sottile e curva, la piega è più spessa e spesso continua oltre il torace. Nei controlli dopo drenaggio si guardano tre cose: '
       'quanta aria resta, dove passa il tubo (fori laterali dentro il torace) e se compare enfisema sottocutaneo. Lo spostamento del mediastino verso il lato sano '
       'con appiattimento del diaframma indica un pneumotorace iperteso, che è un\'emergenza clinica.',
       'Cerca la linea pleurica viscerale; nei controlli valuta aria residua, posizione del tubo, enfisema sottocutaneo.',
       'Pneumotorace residuo sinistro',
       comunicazione={'livello': 'urgente', 'accettabili': ['immediata'], 'destinatari': ['richiedente'], 'parole': ['pneumotorace'],
                      'motivo': 'Aria residua nonostante il drenaggio: chi segue la paziente deve saperlo presto per controllare il tubo; non è iperteso, quindi non serve l\'allarme immediato.'},
       extra_nota='Nella collezione quasi tutti i pneumotoraci con riquadro hanno già un drenaggio: per questo il caso è un controllo e non una prima diagnosi in Pronto soccorso. ')
