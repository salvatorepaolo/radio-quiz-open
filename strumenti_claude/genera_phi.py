# Esame FINTO con dati paziente inventati e riconoscibili (marcatori), per provare che il visualizzatore non li invia.
import pydicom, pathlib, sys, json
src = pathlib.Path(sys.argv[1]); dst = pathlib.Path(sys.argv[2]); dst.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in src.rglob('*.dcm'))[:60]
for i, p in enumerate(files):
    d = pydicom.dcmread(p)
    d.PatientName = 'ZZPROVAPHI^MARIOPHI'; d.PatientID = 'PHIID778899'; d.PatientBirthDate = '19470315'; d.PatientSex = 'M'
    d.OtherPatientIDs = 'RSSMRA47C15F158X'; d.InstitutionName = 'OSPEDALE ZZPHI'; d.ReferringPhysicianName = 'DOTTPHI^ANNA'
    d.AccessionNumber = 'ACCPHI4455'; d.StudyDescription = 'TC ADDOME PROVAPHI'
    d.save_as(dst / f'img{i:03d}.dcm')
print(len(files), 'file in', dst)
