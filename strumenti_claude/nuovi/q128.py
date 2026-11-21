from idc_index import IDCClient
c=IDCClient()
df=c.sql_query("select PatientID, StudyInstanceUID, SeriesInstanceUID, Modality, SeriesDescription, series_size_MB, instanceCount, license_short_name, StudyDate from index where collection_id='hcc_tace_seg'")
df.to_csv('/Volumes/Caloggero/strumenti_claude/nuovi/hcc_tace_series.csv',index=False)
print(len(df), df.PatientID.nunique(), df.license_short_name.unique())
