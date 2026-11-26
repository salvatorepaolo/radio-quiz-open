"""Casi 172-174 (26/11/2026): RX ossa da FracAtlas (JPG 8 bit 2304×2880 → DICOM DX, senza spaziatura dei pixel).
Il logo della clinica impresso nell'immagine («PRIME CLINIC») viene coperto con il colore dello sfondo; restano la lettera
di lato e il nome della proiezione. Uso: ~/.radioquiz-ia/venv/bin/python scrivi_172_174.py
"""
import glob, json, os, datetime
import numpy as np
from PIL import Image
from skimage import measure, morphology
from pydicom.dataset import Dataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid

CASI = '/Volumes/Caloggero/piattaforma-quiz/casi-free'
FA = '/Volumes/Caloggero/piattaforma-quiz/_tcia_grezzi/fracatlas/FracAtlas'
DX = '1.2.840.10008.5.1.4.1.1.1.1'
OGGI = datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
coco = json.load(open(glob.glob(FA + '/Annotations/COCO JSON/*.json')[0]))
idn = {i['id']: i['file_name'] for i in coco['images']}
BOX = {}
for a in coco['annotations']: BOX.setdefault(idn[a['image_id']], []).append(a['bbox'])
PATH = {p.split('/')[-1]: p for p in glob.glob(FA + '/images/*/*.jpg')}
FONTE = {
    'archivio': 'figshare (Scientific Data), non TCIA', 'collezione': 'FracAtlas', 'doi': '10.6084/m9.figshare.22363012',
    'licenza': 'CC BY 4.0', 'licenza_url': 'https://creativecommons.org/licenses/by/4.0/',
    'citazione': 'Abedeen I., Rahman M.A., Prottyasha F.Z., Ahmed T., Chowdhury T.M., Shatabda S. (2023). FracAtlas: A Dataset for Fracture Classification, Localization and Segmentation of Musculoskeletal Radiographs. Scientific Data 10, 521. https://doi.org/10.1038/s41597-023-02432-4',
    'url': 'https://doi.org/10.6084/m9.figshare.22363012',
    'nota': 'Immagini convertite da JPG a 8 bit in DICOM da radio-quiz.it: non sono DICOM originali. Logo della struttura coperto.'}
SEZ = [{'nome': 'Reperti', 'domanda': 'Che cosa vedi?'},
       {'nome': 'Conclusioni', 'domanda': 'Qual è la conclusione e che cosa fai?', 'singola': True}]


def senza_logo(a):
    """copre il logo (riquadro chiaro di circa 170×185 px con il nome della clinica) con il colore dello sfondo"""
    m = morphology.closing(a > 200, morphology.footprint_rectangle((9, 9))); tolti = 0
    for r in measure.regionprops(measure.label(m)):
        y0, x0, y1, x1 = r.bbox; h, w = y1 - y0, x1 - x0
        if 15000 < r.area < 40000 and 140 < w < 220 and 150 < h < 230:
            Y0, X0 = max(0, y0 - 8), max(0, x0 - 8)
            fondo = np.median(a[max(0, y0 - 40):y1 + 40, max(0, x0 - 40):x1 + 40][a[max(0, y0 - 40):y1 + 40, max(0, x0 - 40):x1 + 40] < 120])
            a[Y0:y1 + 8, X0:x1 + 8] = int(fondo); tolti += 1
    return a, tolti


def dicom(caso, jpg, desc, parte):
    a = np.asarray(Image.open(PATH[jpg]).convert('L'), dtype=np.uint8).copy()
    a, tolti = senza_logo(a)
    cart = os.path.join(CASI, caso, 'serie', '0001_' + desc.replace(' ', '_')); os.makedirs(cart, exist_ok=True)
    fm = FileMetaDataset(); fm.MediaStorageSOPClassUID = DX; fm.MediaStorageSOPInstanceUID = generate_uid(); fm.TransferSyntaxUID = ExplicitVRLittleEndian
    ds = Dataset(); ds.file_meta = fm
    ds.ImageType = ['DERIVED', 'SECONDARY']; ds.SOPClassUID = DX; ds.SOPInstanceUID = fm.MediaStorageSOPInstanceUID
    ds.Modality = 'DX'; ds.PresentationIntentType = 'FOR PRESENTATION'; ds.SeriesDescription = desc
    ds.DerivationDescription = 'Convertita da JPG a 8 bit della collezione FracAtlas, logo coperto: non e un DICOM originale'
    ds.PatientName = 'ANONIMO^' + caso; ds.PatientID = caso; ds.PatientIdentityRemoved = 'YES'
    ds.DeidentificationMethod = 'FracAtlas anonimizzata alla fonte; logo coperto'
    ds.BodyPartExamined = parte; ds.ViewPosition = 'AP'
    ds.StudyInstanceUID = generate_uid(); ds.SeriesInstanceUID = generate_uid(); ds.SeriesNumber = 1; ds.InstanceNumber = 1
    ds.SamplesPerPixel = 1; ds.PhotometricInterpretation = 'MONOCHROME2'; ds.Rows, ds.Columns = a.shape
    ds.BitsAllocated = 8; ds.BitsStored = 8; ds.HighBit = 7; ds.PixelRepresentation = 0; ds.BurnedInAnnotation = 'NO'
    lo, hi = np.percentile(a, [1, 99.5]); ds.WindowCenter = round((lo + hi) / 2); ds.WindowWidth = round(hi - lo)
    ds.RescaleIntercept = 0; ds.RescaleSlope = 1; ds.RescaleType = 'US'; ds.ImageComments = 'FracAtlas ' + jpg
    ds.PixelData = a.tobytes()
    rel = os.path.join('serie', os.path.basename(cart), 'img_00001.dcm'); ds.save_as(os.path.join(CASI, caso, rel), enforce_file_format=True)
    json.dump([{'descrizione': desc, 'numero': 1, 'files': [rel]}], open(os.path.join(CASI, caso, 'serie.json'), 'w'), ensure_ascii=False, indent=1)
    return tolti


def op(testo, corretta, tipo, sez, nota=None):
    o = {'testo': testo, 'corretta': corretta, 'tipo': tipo, 'sezione': sez}
    if nota: o['nota'] = nota
    return o


def scrivi(caso, jpg, desc, parte, distretto, titolo, titolo_interno, quesito, diff, anamnesi, domanda, opzioni, spiegazione, regola, nota_vista, extra='', comunicazione=None):
    tolti = dicom(caso, jpg, desc, parte)
    c = {'id': caso, 'visibile': True, 'aggiornato': OGGI, 'titolo': titolo, 'titolo_interno': titolo_interno, 'distretto': distretto,
         'quesito': quesito, 'modalita': 'RX', 'difficolta': diff, 'anamnesi': anamnesi, 'domanda': domanda, 'sezioni': SEZ,
         'opzioni': opzioni, 'spiegazione': spiegazione, 'regola': regola,
         'esito_clinico': {'tipo': 'altro', 'testo': ('Annotazione della collezione FracAtlas: «fractured», riquadro della frattura. ' if jpg in BOX else 'Annotazione della collezione FracAtlas: «non fractured». ') + 'Nessun dato clinico né sul trattamento.'},
         'fonte': dict(FONTE, soggetto=jpg), 'serie_iniziale': 0, 'riquadri': 1,
         'vista': {'serie': 0, 'idx': 0, 'zoom': 1, 'panX': 0, 'panY': 0, 'nota': nota_vista},
         'nota_docente': ('Caso creato da Claude il 26/11/2026: FracAtlas %s (2304×2880), convertita da JPG 8 bit in DICOM DX senza spaziatura dei pixel '
                          '(la fonte non la dà: niente misure in mm) con strumenti_claude/rx/scrivi_172_174.py; logo della struttura coperto (%d). '
                          'Età, sesso e dinamica non forniti dalla fonte. %sNON ancora rivisto dal medico.' % (jpg, tolti, extra))}
    if jpg in BOX:
        x, y, w, h = BOX[jpg][0]; c['localizza'] = True
        c['vista']['segno'] = {'a': {'x': round(x), 'y': round(y)}, 'b': {'x': round(x + w), 'y': round(y + h)}}
    if comunicazione: c['comunicazione'] = comunicazione
    json.dump(c, open(os.path.join(CASI, caso, 'caso.json'), 'w'), ensure_ascii=False, indent=1)
    print(caso, jpg, 'loghi coperti', tolti)


DIFFERITA = {'livello': 'differita', 'accettabili': ['urgente'], 'destinatari': ['richiedente'], 'parole': ['frattura'],
             'motivo': 'Frattura in Pronto soccorso con paziente stabile: basta un referto tempestivo; la comunicazione diretta all\'ortopedico è accettabile.'}

scrivi('caso-tcia-172', 'IMG0002355.jpg', 'RX polso AP', 'WRIST', 'Muscolo-scheletrico',
       'RX polso destro dopo un trauma: dolore e tumefazione', 'Frattura del radio distale (FracAtlas IMG0002355)',
       'trauma del polso', 'Base',
       'Paziente con dolore e tumefazione al polso destro dopo un trauma (età, sesso e dinamica non forniti dalla collezione). RX del polso in proiezione AP; la laterale non c\'è.',
       'Descrivi il reperto, indicalo sull\'immagine e scegli la gestione.',
       [op('Frattura del radio distale: linee di frattura nella metafisi distale del radio', True, 'principale', 0, 'Riquadro della collezione sul radio distale.'),
        op('Ulna distale senza fratture evidenti in questa proiezione', True, 'secondario', 0),
        op('Frattura dello scafoide', False, 'distrattore', 0),
        op('Lussazione perilunare del carpo', False, 'distrattore', 0),
        op('Frattura delle basi metacarpali', False, 'distrattore', 0),
        op('Frattura del radio distale: proiezione laterale (spostamento e angolazione dorsale/volare), riduzione se scomposta, immobilizzazione e valutazione ortopedica', True, 'secondario', 1),
        op('Nessuna frattura: bendaggio e antinfiammatori', False, 'distrattore', 1),
        op('Frattura dello scafoide: gesso con il pollice incluso', False, 'distrattore', 1)],
       'Il polso si studia sempre in due proiezioni: l\'AP mostra la frattura e l\'eventuale estensione all\'articolazione, la laterale lo spostamento '
       '(dorsale nella frattura di Colles, volare nella Smith) e l\'inclinazione della superficie articolare. Nell\'AP si controllano l\'altezza del radio, '
       'l\'inclinazione radiale, la varianza ulnare, lo stiloide ulnare, gli archi del carpo (Gilula) e lo scafoide. Una frattura scomposta o articolare '
       'va ridotta e spesso operata; una composta si immobilizza e si ricontrolla.',
       'Polso: sempre due proiezioni; nell\'AP guarda radio, stiloide ulnare, archi del carpo e scafoide.',
       'Frattura del radio distale', comunicazione=DIFFERITA)

scrivi('caso-tcia-173', 'IMG0002322.jpg', 'RX gamba AP', 'LEG', 'Muscolo-scheletrico',
       'RX gamba dopo un trauma: bambino che non riesce a caricare', 'Frattura obliqua composta della diafisi tibiale (FracAtlas IMG0002322)',
       'trauma della gamba', 'Base',
       'Bambino con dolore alla gamba dopo un trauma e difficoltà a caricare: le cartilagini di accrescimento del ginocchio sono aperte (età precisa, sesso, lato e dinamica non forniti dalla collezione). RX della gamba in AP.',
       'C\'è una frattura? Se sì, indicala e descrivila.',
       [op('Frattura obliqua della diafisi tibiale, senza spostamento evidente in questa proiezione', True, 'principale', 0, 'Riquadro della collezione sulla diafisi della tibia.'),
        op('Allineamento conservato: nessuna scomposizione evidente dei monconi in AP', True, 'secondario', 0),
        op('Frattura del piatto tibiale', False, 'distrattore', 0),
        op('Frattura del malleolo mediale', False, 'distrattore', 0),
        op('Nessuna frattura', False, 'distrattore', 0),
        op('Frattura diafisaria di tibia: completare con la laterale (comprese ginocchio e caviglia), immobilizzare, valutazione ortopedica, attenzione alla sindrome compartimentale', True, 'secondario', 1),
        op('Contusione: carico libero', False, 'distrattore', 1),
        op('Frattura da stress: solo riposo senza controlli', False, 'distrattore', 1)],
       'Nelle fratture di gamba la radiografia deve comprendere le due articolazioni (ginocchio e caviglia) in due proiezioni: una frattura della tibia può '
       'associarsi a una del perone lontana dal focolaio (per esempio prossimale). Si descrivono sede (terzo prossimale, medio, distale), tipo (trasversa, '
       'obliqua, spiroide, comminuta), spostamento, angolazione e accorciamento. Le fratture tibiali rischiano la sindrome compartimentale (dolore '
       'sproporzionato, dolore allo stiramento passivo): va cercata clinicamente. Nel bambino le fratture diafisarie composte della tibia si trattano di solito con un apparecchio gessato; si controllano anche le cartilagini di accrescimento.',
       'Gamba: due proiezioni con ginocchio e caviglia; dopo la tibia guarda tutto il perone.',
       'Frattura diafisi tibiale', comunicazione=DIFFERITA,
       extra='Il perone non è giudicato nelle opzioni: in una sola AP non si vede intero con certezza. ')

scrivi('caso-tcia-174', 'IMG0000101.jpg', 'RX polso e mano AP', 'WRIST', 'Muscolo-scheletrico',
       'RX polso sinistro dopo un trauma: dolore al polso', 'Polso e mano senza fratture (FracAtlas IMG0000101, «non fractured»)',
       'trauma del polso', 'Base',
       'Paziente con dolore al polso sinistro dopo un trauma (età, sesso e dinamica non forniti dalla collezione). RX del polso e della mano in AP.',
       'Leggi la radiografia: c\'è una frattura? Che cosa fai se il dolore è sulla tabacchiera anatomica?',
       [op('Radio e ulna distali con corticali continue, senza linee di frattura', True, 'principale', 0),
        op('Ossa del carpo allineate: archi del carpo regolari, spazi articolari conservati', True, 'secondario', 0),
        op('Metacarpi e falangi visibili senza fratture', True, 'secondario', 0),
        op('Frattura del radio distale', False, 'distrattore', 0),
        op('Frattura dello scafoide evidente', False, 'distrattore', 0),
        op('Lussazione del semilunare', False, 'distrattore', 0),
        op('Nessuna frattura visibile; se c\'è dolore alla tabacchiera anatomica: proiezioni dedicate per lo scafoide, oppure immobilizzare e ricontrollare (RM se il sospetto resta)', True, 'secondario', 1),
        op('Frattura: gesso per 6 settimane', False, 'distrattore', 1),
        op('Radiografia normale: nessun controllo in ogni caso, anche con dolore alla tabacchiera', False, 'distrattore', 1,
           'Le fratture dello scafoide possono non vedersi subito: con il dolore tipico si immobilizza e si ricontrolla.')],
       'Saper dire «nessuna frattura» è importante quanto trovarla. Nel polso si controllano: corticali di radio e ulna, stiloidi, i tre archi del carpo '
       '(Gilula) senza scalini, gli spazi tra le ossa del carpo (uno spazio scafo-lunato largo indica una lesione legamentosa) e lo scafoide. '
       'La frattura dello scafoide è la più spesso sfuggente: se c\'è dolore alla tabacchiera anatomica servono le proiezioni dedicate e, se negative, '
       'immobilizzazione e controllo dopo 10-14 giorni o una RM, perché il rischio è la necrosi del polo prossimale.',
       'RX negativa ma dolore alla tabacchiera: lo scafoide non è escluso.',
       'Polso senza fratture')
