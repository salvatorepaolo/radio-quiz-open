import pandas as pd, sys
from idc_index import IDCClient
c=IDCClient()
d=pd.read_csv('/Volumes/Caloggero/strumenti_claude/nuovi/hcc_tace_series.csv')
for p in sys.argv[1:]:
    x=d[d.PatientID==p]; first=x.StudyDate.min(); x=x[(x.StudyDate==first)&~x.SeriesDescription.str.contains('AIMI')]
    print(p, list(x.SeriesDescription), flush=True)
    c.download_from_selection(seriesInstanceUID=list(x.SeriesInstanceUID), downloadDir=f'/Volumes/Caloggero/piattaforma-quiz/_tcia_grezzi/hcc_tace_seg/{p}', dirTemplate='%SeriesInstanceUID')
print('FINE', flush=True)
