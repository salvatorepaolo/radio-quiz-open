"""Caso 175 (26/11/2026): RX torace in due proiezioni (PA e laterale), TCIA COVID-19-NY-SBU paziente A551031.
Le immagini sono già in casi-free/caso-tcia-175 (anonimizza.py, DICOM originali). La laterale si apre alla seconda domanda.
"""
import json, datetime
C = '/Volumes/Caloggero/piattaforma-quiz/casi-free/caso-tcia-175/'
s = json.load(open(C + 'serie.json'))
s[0]['descrizione'] = 'RX torace PA'; s[1]['descrizione'] = 'RX torace laterale'
json.dump(s, open(C + 'serie.json', 'w'), ensure_ascii=False, indent=1)

def op(t, ok, tipo, sez, nota=None):
    o = {'testo': t, 'corretta': ok, 'tipo': tipo, 'sezione': sez}
    if nota: o['nota'] = nota
    return o

c = {
 'id': 'caso-tcia-175', 'visibile': True, 'aggiornato': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
 'titolo': 'RX torace in due proiezioni: uomo di 47 anni con tampone positivo per SARS-CoV-2',
 'titolo_interno': 'RX torace PA e laterale nei limiti della norma in paziente COVID-19 positivo (COVID-19-NY-SBU A551031)',
 'distretto': 'Torace', 'quesito': 'COVID-19', 'modalita': 'RX', 'difficolta': 'Base',
 'anamnesi': 'Uomo di 47 anni con tampone positivo per SARS-CoV-2. RX del torace in proiezione PA e laterale. La laterale si apre alla seconda domanda.',
 'domanda': 'Leggi prima la PA, poi la laterale: che cosa aggiunge la seconda proiezione?',
 'sezioni': [
   {'nome': 'Proiezione PA', 'domanda': 'Che cosa vedi nella PA?', 'serie': 0},
   {'nome': 'Proiezione laterale', 'domanda': 'Che cosa controlli nella laterale?', 'serie': 1, 'scopri': True},
   {'nome': 'Conclusioni', 'domanda': 'Qual è la conclusione?', 'singola': True, 'serie': 1}],
 'opzioni': [
   op('PA: campi polmonari trasparenti, senza opacità focali né versamento', True, 'principale', 0),
   op('Ombra cardiaca, ili e mediastino nei limiti', True, 'secondario', 0),
   op('Opacità del lobo medio che cancella il margine destro del cuore', False, 'distrattore', 0),
   op('Versamento pleurico sinistro', False, 'distrattore', 0),
   op('Spazio retrosternale e spazio retrocardiaco liberi (chiari)', True, 'secondario', 1),
   op('Scendendo verso il diaframma le vertebre diventano più scure: aspetto normale', True, 'secondario', 1,
      'Normalmente le vertebre sono più scure in basso perché sopra c\'è più polmone aerato; se diventano più chiare c\'è un\'opacità sovrapposta (segno della colonna).'),
   op('Seni costofrenici posteriori acuti: nessun versamento', True, 'secondario', 1),
   op('Le vertebre basse diventano più chiare: opacità nel lobo inferiore nascosta nella PA', False, 'distrattore', 1),
   op('Spazio retrosternale occupato da una massa del mediastino anteriore', False, 'distrattore', 1),
   op('RX del torace nei limiti della norma nelle due proiezioni; in un paziente con COVID-19 una RX normale non esclude la malattia polmonare iniziale', True, 'secondario', 2),
   op('Polmonite del lobo inferiore visibile solo nella laterale', False, 'distrattore', 2),
   op('Laterale sospetta: serve subito una TC del torace', False, 'distrattore', 2)],
 'spiegazione': ('La laterale fa vedere le zone che nella PA sono nascoste dietro il cuore, dietro le cupole e davanti al mediastino. Si leggono in ordine: '
   'spazio retrosternale (davanti all\'aorta ascendente: deve essere chiaro; si riempie con masse del mediastino anteriore), spazio retrocardiaco '
   '(dietro il cuore: deve essere chiaro), colonna (scendendo le vertebre diventano più scure; se diventano più chiare c\'è un\'opacità del lobo '
   'inferiore, «segno della colonna»), seni costofrenici posteriori (i primi a riempirsi di liquido: bastano circa 50 ml), scissure (una scissura '
   'ispessita o spostata indica liquido o perdita di volume), ili e colonna d\'aria della trachea. Nella COVID-19 la RX è spesso normale nei primi '
   'giorni: una radiografia normale non esclude la malattia.'),
 'regola': 'Nella laterale: retrosternale, retrocardiaco, colonna che scurisce in basso, seni posteriori.',
 'esito_clinico': {'tipo': 'altro', 'testo': 'Collezione COVID-19-NY-SBU: paziente con tampone positivo per SARS-CoV-2. Nessun referto nella collezione; lettura di Claude.'},
 'fonte': {'archivio': 'The Cancer Imaging Archive (TCIA)', 'collezione': 'COVID-19-NY-SBU', 'soggetto': 'A551031', 'doi': '10.7937/TCIA.BBAG-2923',
   'licenza': 'CC BY 4.0', 'licenza_url': 'https://creativecommons.org/licenses/by/4.0/',
   'citazione': 'Saltz J., Saltz M., Prasanna P., Moffitt R., Hajagos J., Bremer E., Balsamo J., Kurc T. (2021). Stony Brook University COVID-19 Positive Cases [Data set]. The Cancer Imaging Archive.',
   'url': 'https://www.cancerimagingarchive.net/collection/covid-19-ny-sbu/'},
 'serie_iniziale': 0, 'riquadri': 1, 'checklist': 'obbligatoria',
 'vista': {'serie': 1, 'idx': 0, 'zoom': 1, 'panX': 0, 'panY': 0, 'nota': 'Laterale: il paziente guarda verso destra (sterno a destra dell\'immagine)'},
 'nota_docente': ('Caso creato da Claude il 26/11/2026 dalla collezione TCIA COVID-19-NY-SBU (A551031, CR PA e LATERAL dello stesso studio), DICOM originali '
   'anonimizzati con anonimizza.py; strumenti_claude/rx/scrivi_175.py. Nella laterale lo sterno è a destra dell\'immagine (il contrario della convenzione '
   'più comune): si è lasciata com\'è. Lettura di Claude: PA e laterale nei limiti della norma. NON ancora rivisto dal medico.'),
}
json.dump(c, open(C + 'caso.json', 'w'), ensure_ascii=False, indent=1)
print('ok')
