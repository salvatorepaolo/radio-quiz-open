#!/usr/bin/env python3
"""Manuale d'uso in PDF (web/manuale.pdf) generato dallo stesso testo dell'aiuto del sito (web/aiuto.json).

    python3 strumenti/manuale.py [cartella web]        (predefinita: cloud/web accanto a strumenti/)

Serve reportlab (pip install reportlab). Immagini e caratteri sono in strumenti/manuale/.
Le immagini vanno alla fine della sezione indicata in IMMAGINI; se una sezione cambia nome resta solo il testo.
"""
import json, os, re, sys, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image, PageBreak,
                                ListFlowable, ListItem, KeepTogether)
from reportlab.platypus.tableofcontents import TableOfContents

QUI = os.path.dirname(os.path.abspath(__file__))
RISORSE = os.path.join(QUI, 'manuale')
WEB = sys.argv[1] if len(sys.argv) > 1 else os.path.join(QUI, '..', 'cloud', 'web')
if not os.path.exists(os.path.join(WEB, 'aiuto.json')):          # copia di lavoro: static/ accanto a strumenti/
    WEB = os.path.join(QUI, '..', 'static')

for nome, file in [('Sans', 'DejaVuSans.ttf'), ('Sans-B', 'DejaVuSans-Bold.ttf'), ('Sans-I', 'DejaVuSans-Oblique.ttf')]:
    pdfmetrics.registerFont(TTFont(nome, os.path.join(RISORSE, 'caratteri', file)))
pdfmetrics.registerFontFamily('Sans', normal='Sans', bold='Sans-B', italic='Sans-I', boldItalic='Sans-B')

BLU = colors.HexColor('#1f5fbf'); GRIGIO = colors.HexColor('#555555')
ST = {
    'titolo': ParagraphStyle('titolo', fontName='Sans-B', fontSize=30, leading=36, textColor=BLU, spaceAfter=6),
    'sotto': ParagraphStyle('sotto', fontName='Sans', fontSize=13, leading=18, textColor=GRIGIO, spaceAfter=4),
    'h1': ParagraphStyle('h1', fontName='Sans-B', fontSize=17, leading=22, textColor=BLU, spaceBefore=4, spaceAfter=8),
    'p': ParagraphStyle('p', fontName='Sans', fontSize=10, leading=14.5, spaceAfter=6),
    'li': ParagraphStyle('li', fontName='Sans', fontSize=10, leading=14.5),
    'did': ParagraphStyle('did', fontName='Sans-I', fontSize=9, leading=12, textColor=GRIGIO, alignment=1, spaceBefore=3, spaceAfter=10),
    'toc': ParagraphStyle('toc', fontName='Sans', fontSize=11.5, leading=20),
}
# immagini: sezione dopo la quale vanno, file, didascalia
IMMAGINI = {
    'accesso': ('accesso.png', 'La pagina di accesso: email e password, iscrizione, password dimenticata.'),
    'elenco': ('elenco.png', 'Elenco dei casi con ricerca, compiti e percorsi.'),
    'visualizzatore': ('visualizzatore.png', 'Il visualizzatore: barra delle icone, ROI con istogramma, tabella delle fasi.'),
    'docente': ('docente.png', 'Il menù Gestione.'),
}
# simboli che DejaVu Sans non ha: sostituiti con testo
SOSTITUZIONI = {'⏱': '', 'ⓘ': '(i)', '👤': '', '📍': '', '🚑': '', '🔍': ''}


def pulisci(t):
    for a, b in SOSTITUZIONI.items():
        t = t.replace(a, b)
    t = t.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    t = re.sub(r'\s{2,}', ' ', t).strip()
    # «Nome: testo» all'inizio di una voce: il nome in grassetto, come nell'aiuto del sito
    m = re.match(r'^([^:.]{2,70}):\s', t)
    return f'<b>{m.group(1)}</b>: {t[m.end():]}' if m else t


def immagine(file, larghezza):
    p = os.path.join(RISORSE, 'immagini', file)
    w, h = ImageReader(p).getSize()
    return Image(p, width=larghezza, height=larghezza * h / w)


class Manuale(BaseDocTemplate):
    def __init__(self, uscita, versione, **kw):
        super().__init__(uscita, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm,
                         title='Quiz Radiologia — manuale', author='Quiz Radiologia', subject=f'Manuale d\'uso, versione {versione}', **kw)
        self.versione = versione
        cornice = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='f')
        self.addPageTemplates([PageTemplate('p', [cornice], onPage=self.piede)])

    def piede(self, c, doc):
        c.saveState(); c.setFont('Sans', 8); c.setFillColor(GRIGIO)
        c.drawString(20 * mm, 10 * mm, f'Quiz Radiologia — radio-quiz.it · manuale, versione {self.versione}')
        c.drawRightString(A4[0] - 20 * mm, 10 * mm, str(doc.page)); c.restoreState()

    def afterFlowable(self, f):
        if isinstance(f, Paragraph) and f.style.name == 'h1':
            self.notify('TOCEntry', (0, f.getPlainText(), self.page))


def costruisci():
    aiuto = json.load(open(os.path.join(WEB, 'aiuto.json'), encoding='utf-8'))
    try:
        versione = json.load(open(os.path.join(WEB, 'versione.json'))).get('versione', '')
    except Exception:
        versione = ''
    versione = os.environ.get('VERSIONE', versione) or datetime.date.today().isoformat()
    uscita = os.path.join(WEB, 'manuale.pdf')
    doc = Manuale(uscita, versione)
    L = doc.width
    s = [Spacer(1, 18 * mm), Paragraph('Quiz Radiologia', ST['titolo']),
         Paragraph('Manuale d\'uso per amministratori, docenti, specializzandi, TSRM e infermieri', ST['sotto']),
         Paragraph(f'Versione {versione} · {datetime.date.today().strftime("%d/%m/%Y")}', ST['sotto']), Spacer(1, 10 * mm),
         immagine('copertina.png', L), Paragraph('Il visualizzatore nel tema chiaro.', ST['did']), PageBreak(),
         Paragraph('Indice', ParagraphStyle('ind', parent=ST['h1']))]
    toc = TableOfContents(); toc.levelStyles = [ST['toc']]; toc.dotsMinLevel = 0
    s += [toc, PageBreak()]
    for n, sez in enumerate(aiuto['sezioni'], 1):
        blocco = [Paragraph(f'{n}. {pulisci(sez["titolo"])}', ST['h1'])]
        for b in sez['blocchi']:
            if isinstance(b, str):
                blocco.append(Paragraph(pulisci(b), ST['p']))
            elif isinstance(b, dict) and b.get('video'):          # video tutorial: nel PDF titolo, descrizione e indirizzo
                blocco.append(Paragraph(pulisci(f"Video «{b.get('titolo', '')}»: {b.get('testo', '')} (radio-quiz.it{b['video']})"), ST['p']))
            else:
                blocco.append(ListFlowable([ListItem(Paragraph(pulisci(x), ST['li']), leftIndent=12, value='•') for x in b],
                                           bulletType='bullet', bulletFontName='Sans', bulletFontSize=9, leftIndent=12, spaceAfter=6))
        s += blocco
        if sez['id'] in IMMAGINI:
            f, did = IMMAGINI[sez['id']]
            s.append(KeepTogether([Spacer(1, 3 * mm), immagine(f, L * (0.6 if f in ('accesso.png', 'docente.png') else 1)), Paragraph(did, ST['did'])]))
        s.append(Spacer(1, 6 * mm))
    doc.multiBuild(s)
    print(f'scritto {uscita} ({os.path.getsize(uscita) // 1024} kB, versione {versione})')


if __name__ == '__main__':
    costruisci()
