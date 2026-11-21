import json
p='/Volumes/Caloggero/piattaforma-quiz/cloud/web/lingua/en.json'
d=json.load(open(p,encoding='utf-8'))
nuovi={
"Noduli polmonari con IA nelle TC del torace (facoltativo): un modello open source (MONAI, Apache-2.0) si scarica una volta e gira su questo computer; le immagini non escono":"AI lung nodules in chest CT (optional): an open-source model (MONAI, Apache-2.0) is downloaded once and runs on this computer; the images never leave it",
"⬇ Scarica il modello":"⬇ Download the model",
"🗑 Elimina il modello":"🗑 Delete the model",
"Da scaricare ({x}, una volta sola).":"To download ({x}, only once).",
"Modello scaricato: l'analisi parte da sola aprendo una TC del torace a strato sottile (o con 🫁 sulla barra).":"Model downloaded: the analysis starts by itself when you open a thin-slice chest CT (or with 🫁 on the toolbar).",
"Modello scaricato":"Model downloaded",
"La ricerca dei noduli con IA è facoltativa: accendila in ⚙ Impostazioni del visualizzatore (pagina iniziale). Il modello si scarica una volta e gira su questo computer.":"AI nodule search is optional: turn it on in ⚙ Viewer settings (home page). The model is downloaded once and runs on this computer.",
"L'analisi gira su questo computer: le immagini non escono. Puoi continuare a guardare l'esame.":"The analysis runs on this computer: the images never leave it. You can keep reading the exam.",
"Cerca i noduli polmonari in questa serie con il modello IA scaricato (da 1 a qualche minuto, dipende dal computer).":"Search this series for lung nodules with the downloaded AI model (from one to a few minutes, depending on the computer).",
"🫁 Cerca i noduli":"🫁 Find nodules",
"Serve una TC assiale a strato sottile (fino a 2,5 mm) del torace.":"A thin-slice (up to 2.5 mm) axial chest CT is needed.",
"Il modello non è ancora scaricato: ⚙ Impostazioni del visualizzatore → Noduli polmonari con IA.":"The model has not been downloaded yet: ⚙ Viewer settings → AI lung nodules.",
"Carico le immagini…":"Loading the images…",
"Preparo le immagini…":"Preparing the images…",
"Avvio del modello…":"Starting the model…",
"Seconda lettura con il modello open source MONAI (RetinaNet 3D, LUNA16), sul tuo computer. Diametro = media di asse lungo e corto misurati sulle immagini; Lung-RADS v2022 come primo esame; lato stimato. Può sbagliare (vasi, cicatrici) e non trova tutto: controlla sempre sulle immagini. Solo per la formazione.":"Second read with the open-source MONAI model (3D RetinaNet, LUNA16), on your computer. Diameter = mean of long and short axes measured on the images; Lung-RADS v2022 as a baseline exam; side estimated. It can be wrong (vessels, scars) and does not find everything: always check on the images. For training only.",
"polmone destro":"right lung","polmone sinistro":"left lung",
"Nessun nodulo trovato dai due modelli IA in questa serie.":"No nodule found by the two AI models in this series.",
}
n=0
for k,v in nuovi.items():
    if k not in d: d[k]=v; n+=1
json.dump(d,open(p,'w',encoding='utf-8'),ensure_ascii=False,separators=(',',':'))
print('aggiunte',n)
