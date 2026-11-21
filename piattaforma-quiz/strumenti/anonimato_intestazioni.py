# uso: ~/.radioquiz-ia/venv/bin/python strumenti/anonimato_intestazioni.py casi   (risultato in intestazioni.json accanto allo script)
# Controllo completo dell'anonimato nelle intestazioni DICOM: tutti i file, tutti i campi (anche sequenze e privati).
# Non stampa mai i valori trovati: solo caso, campo e tipo di problema.
import os, re, sys, json, collections, pydicom
from pydicom.datadict import keyword_for_tag
BASE = sys.argv[1]
IDENT = {'InstitutionName','InstitutionAddress','InstitutionalDepartmentName','StationName','DeviceSerialNumber','ReferringPhysicianName',
 'ReferringPhysicianAddress','OperatorsName','PerformingPhysicianName','RequestingPhysician','PhysiciansOfRecord','NameOfPhysiciansReadingStudy',
 'AccessionNumber','StudyID','OtherPatientIDs','OtherPatientNames','PatientBirthDate','PatientBirthTime','PatientAddress','PatientTelephoneNumbers',
 'PatientMotherBirthName','MilitaryRank','Occupation','AdditionalPatientHistory','PatientComments','IssuerOfPatientID','EthnicGroup',
 'RequestedProcedureID','ScheduledProcedureStepID','PerformedProcedureStepID','PatientInsurancePlanCodeSequence','CountryOfResidence',
 'RegionOfResidence','PatientBirthName','ResponsiblePerson','ResponsibleOrganization','InstitutionCodeSequence','ScheduledPerformingPhysicianName',
 'ContentCreatorName','VerifyingObserverName','PersonName','ReviewerName','DetectorID','PlateID','CassetteID','GantryID'}
PAROLE = re.compile(r"ospedal|presidio|policlinic|azienda|\bA\.?S\.?P\b|\bA\.?O\.?U?\b|\bA\.?S\.?L\b|irccs|clinica|casa di cura|\bdott|\bdr\.|\bprof\.|cannizzaro|garibaldi|\bvia\b|viale|piazza|\btel\b|@|\b\d{2}[/.-]\d{2}[/.-]\d{4}\b|\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b|\b\d{10,}\b", re.I)
TESTO = {'LO','SH','ST','LT','UT','PN','UC'}
problemi = collections.defaultdict(collections.Counter); radici = collections.Counter(); sc = collections.Counter(); privati = collections.Counter(); n = 0
def visita(ds, caso, dentro=''):
    for el in ds:
        kw = keyword_for_tag(el.tag) or ''
        if el.VR == 'SQ':
            for it in el.value: visita(it, caso, kw)
            continue
        if el.tag.is_private:
            privati[caso] += 1
            if el.VR in TESTO and el.value not in (None, '') and PAROLE.search(str(el.value)): problemi[caso][f'testo sospetto in campo privato {el.tag}'] += 1
            continue
        v = el.value
        if v in (None, '', b'') or (isinstance(v, (list, pydicom.multival.MultiValue)) and not len(v)): continue
        if kw == 'PatientName':
            if not str(v).startswith('ANONIMO'): problemi[caso]['PatientName non anonimo'] += 1
            continue
        if kw == 'PatientID':
            if not re.fullmatch(r'caso-[0-9a-z-]+|prop-[a-z0-9]{8}', str(v)): problemi[caso]['PatientID non del caso'] += 1
            continue
        if kw in IDENT: problemi[caso][f'{kw} presente' + (f' (in {dentro})' if dentro else '')] += 1; continue
        if el.VR == 'PN': problemi[caso][f'nome di persona in {kw or el.tag}'] += 1; continue
        if el.VR in ('DA','DT') and kw not in ('',): problemi[caso][f'data in {kw}'] += 1; continue
        if el.VR in TESTO and PAROLE.search(str(v)): problemi[caso][f'testo sospetto in {kw or el.tag}'] += 1
for caso in sorted(os.listdir(BASE)):
    cd = os.path.join(BASE, caso)
    if not os.path.isdir(cd) or caso.startswith(('_', '.')): continue
    for dp, dn, fs in os.walk(cd):
        dn[:] = [d for d in dn if not d.startswith('_')]
        for f in fs:
            if not f.endswith('.dcm'): continue
            try: d = pydicom.dcmread(os.path.join(dp, f), stop_before_pixels=True)
            except Exception: problemi[caso]['file non leggibile'] += 1; continue
            n += 1
            visita(d, caso)
            visita(d.file_meta, caso)
            u = str(d.get('SOPInstanceUID', '')); radici['.'.join(u.split('.')[:4])] += 1
            it = [str(x).upper() for x in (d.get('ImageType') or [])]
            if 'SECONDARY' in it or str(d.get('SOPClassUID', '')).startswith('1.2.840.10008.5.1.4.1.1.7'): sc[caso] += 1
            if str(d.get('BurnedInAnnotation', '')).upper() == 'YES': problemi[caso]['BurnedInAnnotation=YES'] += 1
    print(caso, n, flush=True)
json.dump({'file': n, 'problemi': {k: dict(v) for k, v in problemi.items()}, 'radici_uid': radici.most_common(12), 'secondarie': dict(sc), 'privati': dict(privati)},
          open(os.path.join(os.path.dirname(__file__), 'intestazioni.json'), 'w'), indent=1)
print('FINE', n)
