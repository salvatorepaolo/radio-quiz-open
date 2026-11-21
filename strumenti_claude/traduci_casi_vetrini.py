# traduzioni inglesi dei 5 casi di soli vetrini (1.274): web/lingua/casi/<id>.json e _titoli.json
import json, os
CASI='/Volumes/Caloggero/piattaforma-quiz/casi-free'; L='/Volumes/Caloggero/piattaforma-quiz/cloud/web/lingua/casi'
EN = {
# comuni
"Sfoglia il vetrino: cosa osservi e qual è la diagnosi?": "Browse the slide: what do you see and what is the diagnosis?",
"Reperti": "Findings", "Conclusioni": "Conclusions",
"Sfoglia il vetrino a piccolo e a forte ingrandimento: cosa osservi?": "Browse the slide at low and high magnification: what do you see?",
"Qual è la diagnosi istologica più probabile?": "What is the most likely histological diagnosis?",
# 136 tiroide
"Vetrino: nodulo tiroideo": "Slide: thyroid nodule", "nodulo tiroideo": "thyroid nodule",
"Carcinoma papillare della tiroide, variante classica (pT2 N1b)": "Papillary thyroid carcinoma, classic variant (pT2 N1b)",
"Paziente di 43 anni. Tiroidectomia totale per nodulo tiroideo con citologia sospetta; linfonodi del collo ingranditi all'ecografia. Vetrino in ematossilina-eosina del pezzo operatorio, scansione a 20×.": "43-year-old patient. Total thyroidectomy for a thyroid nodule with suspicious cytology; enlarged neck lymph nodes on ultrasound. Haematoxylin-eosin slide of the surgical specimen, scanned at 20×.",
"Architettura papillare: assi fibrovascolari rivestiti da cellule epiteliali, in quasi tutto il preparato": "Papillary architecture: fibrovascular cores lined by epithelial cells, in almost the whole section",
"Ben visibile già a piccolo ingrandimento; ai margini restano follicoli normali con colloide.": "Already well visible at low magnification; normal follicles with colloid remain at the edges.",
"Nuclei ovali, sovrapposti, chiari («a vetro smerigliato»), con incisure": "Oval, overlapping, clear (“ground-glass”) nuclei with grooves",
"Sono le caratteristiche nucleari che definiscono il carcinoma papillare, anche quando l'architettura è follicolare.": "These are the nuclear features that define papillary carcinoma, even when the architecture is follicular.",
"Follicoli di tiroide normale con colloide ai margini della lesione": "Normal thyroid follicles with colloid at the edges of the lesion",
"Necrosi estesa e numerose mitosi atipiche": "Extensive necrosis and numerous atypical mitoses",
"Non presenti: sarebbero sospette per un carcinoma scarsamente differenziato o anaplastico.": "Not present: they would suggest a poorly differentiated or anaplastic carcinoma.",
"Cellule fusate disposte in fasci con stroma amiloide": "Spindle cells in fascicles with amyloid stroma",
"Quadro del carcinoma midollare (cellule C, calcitonina), non di questo caso.": "Pattern of medullary carcinoma (C cells, calcitonin), not of this case.",
"Carcinoma papillare della tiroide": "Papillary thyroid carcinoma", "Adenoma follicolare": "Follicular adenoma",
"Mancano capsula integra e architettura solo follicolare; i nuclei sono tipici del papillare.": "There is no intact capsule nor purely follicular architecture; the nuclei are typical of papillary carcinoma.",
"Carcinoma midollare della tiroide": "Medullary thyroid carcinoma", "Carcinoma anaplastico": "Anaplastic carcinoma", "Tiroidite di Hashimoto": "Hashimoto thyroiditis",
"Mancano l'infiltrato linfoide con centri germinativi e le cellule ossifile diffuse.": "The lymphoid infiltrate with germinal centres and the diffuse oxyphilic cells are missing.",
"Il carcinoma papillare è il tumore maligno più frequente della tiroide (circa l'80-85%). La diagnosi si fa sui nuclei: ovali, ingranditi, sovrapposti, con cromatina chiara («a vetro smerigliato»), incisure e pseudoinclusioni; spesso papille con asse fibrovascolare e corpi psammomatosi.\nCorrelazione radiologica: all'ecografia nodulo solido ipoecogeno, a margini irregolari, più alto che largo, con microcalcificazioni (i corpi psammomatosi): EU-TIRADS 5 / ACR TI-RADS TR5. Le metastasi linfonodali (livelli VI e laterali) sono frequenti già alla diagnosi: possono essere cistiche e con microcalcificazioni come il tumore primitivo.":
"Papillary carcinoma is the most common thyroid malignancy (about 80-85%). The diagnosis rests on the nuclei: oval, enlarged, overlapping, with clear (“ground-glass”) chromatin, grooves and pseudoinclusions; often papillae with a fibrovascular core and psammoma bodies.\nRadiological correlation: on ultrasound a solid hypoechoic nodule with irregular margins, taller than wide, with microcalcifications (the psammoma bodies): EU-TIRADS 5 / ACR TI-RADS TR5. Nodal metastases (level VI and lateral) are common at diagnosis: they can be cystic and contain microcalcifications like the primary tumour.",
"Carcinoma papillare: la diagnosi è nei nuclei (chiari, sovrapposti, con incisure), non solo nelle papille.": "Papillary carcinoma: the diagnosis is in the nuclei (clear, overlapping, grooved), not only in the papillae.",
"Carcinoma papillare della tiroide (TCGA-THCA: papillary adenocarcinoma, NOS), pT2 N1b, stadio I (AJCC, età < 55 anni).": "Papillary thyroid carcinoma (TCGA-THCA: papillary adenocarcinoma, NOS), pT2 N1b, stage I (AJCC, age < 55 years).",
# 137 GBM
"Vetrino: massa cerebrale": "Slide: brain mass", "massa cerebrale": "brain mass",
"Glioblastoma (necrosi a pseudopalizzata, proliferazione microvascolare)": "Glioblastoma (pseudopalisading necrosis, microvascular proliferation)",
"Paziente di 63 anni con cefalea e deficit neurologico di recente comparsa. RM: massa intra-assiale con impregnazione ad anello. Resezione chirurgica. Vetrino in ematossilina-eosina, scansione a 20×.": "63-year-old patient with headache and a recent neurological deficit. MRI: intra-axial mass with ring enhancement. Surgical resection. Haematoxylin-eosin slide, scanned at 20×.",
"Neoplasia gliale molto cellulata con nuclei pleomorfi e ipercromatici": "Highly cellular glial neoplasm with pleomorphic, hyperchromatic nuclei",
"Le cellule tumorali infiltrano il parenchima con fondo fibrillare.": "Tumour cells infiltrate the parenchyma on a fibrillary background.",
"Necrosi a carta geografica con cellule tumorali disposte a palizzata attorno (pseudopalizzata)": "Geographic necrosis with tumour cells palisading around it (pseudopalisading)",
"Ben visibile nel frammento a sinistra in alto: bande eosinofile serpiginose bordate da nuclei addensati.": "Well visible in the upper-left fragment: serpiginous eosinophilic bands lined by crowded nuclei.",
"Vasi con pareti ispessite e cellule endoteliali proliferate (proliferazione microvascolare)": "Vessels with thickened walls and proliferating endothelial cells (microvascular proliferation)",
"Ghiandole rivestite da epitelio cilindrico con mucina": "Glands lined by columnar epithelium with mucin",
"Sarebbe una metastasi di adenocarcinoma: qui non ci sono strutture epiteliali.": "That would be an adenocarcinoma metastasis: there are no epithelial structures here.",
"Cellule monomorfe «a uovo fritto» con capillari a rete di pollaio, senza necrosi": "Monomorphic “fried-egg” cells with chicken-wire capillaries, without necrosis",
"Quadro dell'oligodendroglioma.": "Pattern of oligodendroglioma.",
"Glioblastoma": "Glioblastoma", "Metastasi cerebrale di carcinoma": "Brain metastasis of carcinoma", "Linfoma primitivo del sistema nervoso centrale": "Primary central nervous system lymphoma",
"Il linfoma ha cellule linfoidi atipiche monomorfe attorno ai vasi, non necrosi a pseudopalizzata con proliferazione microvascolare.": "Lymphoma shows monomorphic atypical lymphoid cells around vessels, not pseudopalisading necrosis with microvascular proliferation.",
"Astrocitoma di basso grado": "Low-grade astrocytoma", "Necrosi e proliferazione microvascolare escludono il basso grado.": "Necrosis and microvascular proliferation rule out a low grade.",
"Ascesso cerebrale": "Brain abscess",
"Necrosi (spesso a pseudopalizzata) e proliferazione microvascolare sono i criteri istologici del grado 4 nei gliomi diffusi. Nella classificazione WHO 2021 il glioblastoma è per definizione IDH wild-type; i casi storici TCGA-GBM sono in gran parte IDH wild-type, ma lo stato di IDH di questo paziente non è riportato qui.\nCorrelazione radiologica: la necrosi centrale corrisponde al centro non impregnato della lesione ad anello, la proliferazione microvascolare all'impregnazione spessa e irregolare della parete e all'aumento del volume ematico in perfusione (rCBV). L'edema iperintenso in T2/FLAIR attorno contiene cellule tumorali infiltranti: per questo la recidiva è quasi sempre al margine della cavità.":
"Necrosis (often pseudopalisading) and microvascular proliferation are the histological criteria for grade 4 in diffuse gliomas. In the WHO 2021 classification glioblastoma is IDH-wildtype by definition; the historical TCGA-GBM cases are largely IDH-wildtype, but this patient's IDH status is not reported here.\nRadiological correlation: the central necrosis corresponds to the non-enhancing centre of the ring lesion, microvascular proliferation to the thick, irregular enhancement of the wall and to the increased blood volume on perfusion (rCBV). The surrounding T2/FLAIR hyperintense oedema contains infiltrating tumour cells: this is why recurrence almost always occurs at the margin of the cavity.",
"Glioma con necrosi o proliferazione microvascolare = grado 4; nella RM è l'anello spesso e irregolare con centro necrotico.": "Glioma with necrosis or microvascular proliferation = grade 4; on MRI it is the thick, irregular ring with a necrotic centre.",
"Glioblastoma (TCGA-GBM, primary diagnosis: Glioblastoma).": "Glioblastoma (TCGA-GBM, primary diagnosis: Glioblastoma).",
# 138 colon
"Vetrino: lesione del colon ascendente": "Slide: ascending colon lesion", "lesione del colon": "colon lesion",
"Adenocarcinoma del colon (pT1 N0)": "Colon adenocarcinoma (pT1 N0)",
"Paziente di 78 anni con anemia sideropenica. Colonscopia: lesione vegetante del colon ascendente. Emicolectomia destra. Vetrino in ematossilina-eosina, scansione a 20×.": "78-year-old patient with iron-deficiency anaemia. Colonoscopy: exophytic lesion of the ascending colon. Right hemicolectomy. Haematoxylin-eosin slide, scanned at 20×.",
"Mucosa del colon normale con cripte regolari in una parte del preparato": "Normal colonic mucosa with regular crypts in part of the section",
"In alto: confronto utile con le ghiandole tumorali.": "At the top: a useful comparison with the tumour glands.",
"Ghiandole irregolari, fuse e ramificate, rivestite da epitelio con nuclei allungati e stratificati": "Irregular, fused and branching glands lined by epithelium with elongated, stratified nuclei",
"Ghiandole «a dorso a dorso», con detriti necrotici nel lume («dirty necrosis»), tipiche dell'adenocarcinoma colorettale.": "Back-to-back glands with necrotic debris in the lumen (“dirty necrosis”), typical of colorectal adenocarcinoma.",
"Ghiandole tumorali al di sotto della mucosa, nella sottomucosa (invasione)": "Tumour glands beneath the mucosa, in the submucosa (invasion)",
"È l'invasione oltre la muscolaris mucosae che distingue il carcinoma dall'adenoma con displasia di alto grado.": "Invasion beyond the muscularis mucosae is what distinguishes carcinoma from an adenoma with high-grade dysplasia.",
"Abbondanti laghi di mucina extracellulare in più della metà del tumore": "Abundant pools of extracellular mucin in more than half of the tumour",
"Sarebbe un adenocarcinoma mucinoso: qui la componente mucinosa non è prevalente.": "That would be a mucinous adenocarcinoma: here the mucinous component is not predominant.",
"Cellule fusate positive al KIT nella parete muscolare": "KIT-positive spindle cells in the muscular wall", "Quadro di un GIST.": "Pattern of a GIST.",
"Adenocarcinoma del colon": "Colon adenocarcinoma", "Adenoma tubulo-villoso con displasia di basso grado": "Tubulovillous adenoma with low-grade dysplasia",
"C'è invasione della sottomucosa: è un carcinoma.": "There is submucosal invasion: it is a carcinoma.",
"Tumore neuroendocrino ben differenziato": "Well-differentiated neuroendocrine tumour", "Linfoma": "Lymphoma", "Colite ulcerosa in fase attiva": "Active ulcerative colitis",
"L'adenocarcinoma colorettale nasce quasi sempre da un adenoma. Il criterio di malignità è l'invasione della sottomucosa: nel colon il carcinoma confinato alla mucosa non dà metastasi. Lo stadio T dipende dalla profondità (T1 sottomucosa, T2 muscolare propria, T3 sottosierosa/grasso pericolico, T4 sierosa o organi vicini).\nCorrelazione radiologica: in TC ispessimento parietale asimmetrico o massa a «torsolo di mela»; la TC non distingue T1 da T2, ma serve a vedere l'estensione nel grasso pericolico (T3), i linfonodi e le metastasi epatiche e polmonari. Nei tumori del colon destro l'anemia sideropenica è la presentazione tipica.":
"Colorectal adenocarcinoma almost always arises from an adenoma. The criterion for malignancy is invasion of the submucosa: in the colon, carcinoma confined to the mucosa does not metastasise. The T stage depends on depth (T1 submucosa, T2 muscularis propria, T3 subserosa/pericolic fat, T4 serosa or adjacent organs).\nRadiological correlation: on CT asymmetric wall thickening or an “apple-core” mass; CT does not distinguish T1 from T2, but shows extension into the pericolic fat (T3), lymph nodes and liver and lung metastases. In right-sided colon cancer, iron-deficiency anaemia is the typical presentation.",
"Adenoma → carcinoma: lo decide l'invasione della sottomucosa, non il grado di displasia.": "Adenoma → carcinoma: submucosal invasion decides, not the grade of dysplasia.",
"Adenocarcinoma del colon ascendente (TCGA-COAD: Adenocarcinoma, NOS), pT1 N0, stadio I.": "Adenocarcinoma of the ascending colon (TCGA-COAD: Adenocarcinoma, NOS), pT1 N0, stage I.",
# 139 fegato
"Vetrino: nodulo epatico": "Slide: liver nodule", "nodulo epatico": "liver nodule",
"Carcinoma epatocellulare ben differenziato (G1) con cellule chiare": "Well-differentiated hepatocellular carcinoma (G1) with clear cells",
"Paziente di 59 anni con epatopatia cronica in sorveglianza ecografica. Nodulo epatico di nuova comparsa, resecato. Vetrino in ematossilina-eosina, scansione a 20×.": "59-year-old patient with chronic liver disease under ultrasound surveillance. New liver nodule, resected. Haematoxylin-eosin slide, scanned at 20×.",
"Cellule di tipo epatocitario disposte in trabecole separate da sinusoidi": "Hepatocyte-like cells arranged in trabeculae separated by sinusoids",
"Il citoplasma ricorda gli epatociti; tra le trabecole capillari sinusoidali senza spazi portali normali.": "The cytoplasm resembles hepatocytes; between the trabeculae there are sinusoidal capillaries without normal portal tracts.",
"Molte cellule con citoplasma chiaro, vacuolizzato (lipidi o glicogeno)": "Many cells with clear, vacuolated cytoplasm (lipid or glycogen)",
"Il cambiamento a cellule chiare è frequente nel carcinoma epatocellulare ben differenziato: non va confuso con una metastasi renale.": "Clear-cell change is common in well-differentiated hepatocellular carcinoma: it must not be mistaken for a renal metastasis.",
"Nuclei con lieve atipia e nucleoli evidenti in alcune cellule": "Nuclei with mild atypia and prominent nucleoli in some cells",
"Ghiandole con mucina e stroma desmoplastico abbondante": "Glands with mucin and abundant desmoplastic stroma",
"Quadro del colangiocarcinoma o di una metastasi di adenocarcinoma.": "Pattern of cholangiocarcinoma or of an adenocarcinoma metastasis.",
"Spazi portali regolari distribuiti in tutta la lesione": "Regular portal tracts distributed throughout the lesion",
"La perdita degli spazi portali (con arterie «spaiate») è uno dei segni del carcinoma epatocellulare.": "Loss of portal tracts (with “unpaired” arteries) is one of the signs of hepatocellular carcinoma.",
"Carcinoma epatocellulare": "Hepatocellular carcinoma", "Metastasi di carcinoma renale a cellule chiare": "Metastasis of clear cell renal cell carcinoma",
"Possibile alla sola morfologia: si distingue con l'immunoistochimica (arginasi-1, HepPar-1 positivi nel carcinoma epatocellulare; PAX8 e CD10 nel renale) e con la clinica.": "Possible on morphology alone: it is distinguished by immunohistochemistry (arginase-1, HepPar-1 positive in hepatocellular carcinoma; PAX8 and CD10 in renal carcinoma) and by the clinical picture.",
"Steatosi epatica semplice": "Simple hepatic steatosis", "La steatosi non forma una lesione nodulare con trabecole ispessite e atipia.": "Steatosis does not form a nodular lesion with thickened trabeculae and atypia.",
"Colangiocarcinoma intraepatico": "Intrahepatic cholangiocarcinoma", "Adenoma epatocellulare": "Hepatocellular adenoma",
"Nel fegato con epatopatia cronica un nodulo epatocitario atipico è un carcinoma epatocellulare fino a prova contraria.": "In a liver with chronic disease, an atypical hepatocellular nodule is hepatocellular carcinoma until proven otherwise.",
"Il carcinoma epatocellulare nasce quasi sempre in un fegato cirrotico o con epatopatia cronica (virus B o C, alcol, steatoepatite). Istologicamente: trabecole più spesse di 2-3 cellule, perdita della rete di reticolina, arterie «spaiate» senza dotti biliari, a volte cellule chiare o steatosiche.\nCorrelazione radiologica: in un fegato a rischio la diagnosi si può fare senza biopsia (LI-RADS 5) con l'impregnazione in fase arteriosa (non ad anello), il wash-out nelle fasi tardive e la capsula. Le arterie spaiate spiegano l'iperarterializzazione; il grasso intralesionale (come le cellule chiare di questo caso) dà calo di segnale in opposizione di fase alla RM ed è una caratteristica accessoria a favore del carcinoma epatocellulare.":
"Hepatocellular carcinoma almost always arises in a cirrhotic liver or one with chronic liver disease (hepatitis B or C, alcohol, steatohepatitis). Histologically: trabeculae thicker than 2-3 cells, loss of the reticulin network, “unpaired” arteries without bile ducts, sometimes clear or steatotic cells.\nRadiological correlation: in an at-risk liver the diagnosis can be made without biopsy (LI-RADS 5) from non-rim arterial phase hyperenhancement, washout in the late phases and the capsule. Unpaired arteries explain the arterialisation; intralesional fat (like the clear cells of this case) causes signal drop on opposed-phase MRI and is an ancillary feature favouring hepatocellular carcinoma.",
"Nodulo con cellule chiare nel fegato cirrotico: prima carcinoma epatocellulare; la metastasi renale si esclude con l'immunoistochimica.": "Nodule with clear cells in a cirrhotic liver: hepatocellular carcinoma first; renal metastasis is ruled out with immunohistochemistry.",
"Carcinoma epatocellulare (TCGA-LIHC: Hepatocellular carcinoma, NOS), grado G1, pT1, stadio I.": "Hepatocellular carcinoma (TCGA-LIHC: Hepatocellular carcinoma, NOS), grade G1, pT1, stage I.",
# 140 polmone
"Vetrino: massa polmonare": "Slide: lung mass", "massa polmonare": "lung mass",
"Carcinoma squamoso del polmone (pT1b N0)": "Squamous cell carcinoma of the lung (pT1b N0)",
"Paziente di 72 anni, forte fumatore. TC: massa solida del lobo inferiore di circa 2 cm. Lobectomia. Vetrino in ematossilina-eosina, scansione a 20×.": "72-year-old patient, heavy smoker. CT: solid lower-lobe mass of about 2 cm. Lobectomy. Haematoxylin-eosin slide, scanned at 20×.",
"Nidi e cordoni solidi di cellule poligonali con citoplasma eosinofilo, separati da stroma": "Solid nests and cords of polygonal cells with eosinophilic cytoplasm, separated by stroma",
"Crescita a nidi solidi, senza ghiandole né papille.": "Growth in solid nests, without glands or papillae.",
"Segni di differenziazione squamosa: ponti intercellulari e cheratinizzazione (cellule a citoplasma denso eosinofilo, perle cornee)": "Signs of squamous differentiation: intercellular bridges and keratinisation (cells with dense eosinophilic cytoplasm, keratin pearls)",
"Vanno cercati a forte ingrandimento: sono ciò che definisce il carcinoma squamoso.": "Look for them at high magnification: they are what defines squamous cell carcinoma.",
"Ghiandole e crescita lungo le pareti alveolari (lepidica)": "Glands and growth along the alveolar walls (lepidic)",
"Quadro dell'adenocarcinoma.": "Pattern of adenocarcinoma.",
"Piccole cellule con citoplasma scarso, nuclei a «sale e pepe» e modellamento nucleare": "Small cells with scant cytoplasm, “salt-and-pepper” nuclei and nuclear moulding",
"Quadro del microcitoma (carcinoma a piccole cellule).": "Pattern of small cell carcinoma.",
"Carcinoma squamoso (spinocellulare) del polmone": "Squamous cell carcinoma of the lung", "Adenocarcinoma del polmone": "Lung adenocarcinoma",
"Carcinoma a piccole cellule": "Small cell carcinoma", "Tumore carcinoide tipico": "Typical carcinoid tumour", "Amartoma polmonare": "Pulmonary hamartoma",
"L'amartoma contiene cartilagine e grasso: in TC calcificazioni «a popcorn» e grasso.": "Hamartoma contains cartilage and fat: on CT “popcorn” calcifications and fat.",
"Il carcinoma squamoso è fortemente legato al fumo; si riconosce dalla cheratinizzazione e dai ponti intercellulari. Nei casi poco differenziati serve l'immunoistochimica (p40 e p63 positivi, TTF-1 negativo; l'adenocarcinoma è di solito TTF-1 positivo).\nCorrelazione radiologica: più spesso centrale, vicino ai bronchi principali o lobari (atelettasia, polmonite ostruttiva), ma anche periferico come in questo caso; tende a cavitarsi (necrosi della cheratina). Può dare ipercalcemia paraneoplastica (PTHrP). Lo stadio T in TC dipende dal diametro maggiore della componente solida: T1b > 1 e ≤ 2 cm (TNM 8ª edizione).":
"Squamous cell carcinoma is strongly linked to smoking; it is recognised by keratinisation and intercellular bridges. In poorly differentiated cases immunohistochemistry is needed (p40 and p63 positive, TTF-1 negative; adenocarcinoma is usually TTF-1 positive).\nRadiological correlation: more often central, near the main or lobar bronchi (atelectasis, obstructive pneumonia), but also peripheral as in this case; it tends to cavitate (keratin necrosis). It can cause paraneoplastic hypercalcaemia (PTHrP). The CT T stage depends on the largest diameter of the solid component: T1b > 1 and ≤ 2 cm (TNM 8th edition).",
"Polmone: cheratina e ponti intercellulari = squamoso; ghiandole o crescita lepidica = adenocarcinoma.": "Lung: keratin and intercellular bridges = squamous; glands or lepidic growth = adenocarcinoma.",
"Carcinoma squamoso del lobo inferiore (TCGA-LUSC: Squamous cell carcinoma, NOS), pT1b N0, stadio IA.": "Lower-lobe squamous cell carcinoma (TCGA-LUSC: Squamous cell carcinoma, NOS), pT1b N0, stage IA.",
# 141 rene (1.276)
"Vetrino: massa renale": "Slide: renal mass", "massa renale": "renal mass",
"Carcinoma renale a cellule chiare G4 (pT3a N0 M1), stessa paziente del caso 088 (TC)": "Clear cell renal cell carcinoma G4 (pT3a N0 M1), same patient as case 088 (CT)",
"Donna di 54 anni con voluminosa massa del rene destro e noduli polmonari multipli alla TC. Nefrectomia destra. Vetrino in ematossilina-eosina del pezzo operatorio, scansione a 40×.": "54-year-old woman with a large right renal mass and multiple lung nodules on CT. Right nephrectomy. Haematoxylin-eosin slide of the surgical specimen, scanned at 40×.",
"Neoplasia a nidi e alveoli separati da una fitta rete di capillari sottili": "Neoplasm in nests and alveoli separated by a dense network of thin capillaries",
"La rete vascolare delicata («a rete di pollaio») è tipica del carcinoma a cellule chiare e spiega l'impregnazione intensa in fase arteriosa.": "The delicate (“chicken-wire”) vascular network is typical of clear cell carcinoma and explains the intense arterial-phase enhancement.",
"Cellule con citoplasma chiaro o granuloso eosinofilo e nuclei con nucleoli evidenti": "Cells with clear or granular eosinophilic cytoplasm and nuclei with prominent nucleoli",
"Nelle aree di alto grado il citoplasma diventa più eosinofilo e i nucleoli sono ben visibili già a piccolo ingrandimento (grado ISUP/WHO alto).": "In high-grade areas the cytoplasm becomes more eosinophilic and the nucleoli are visible even at low magnification (high ISUP/WHO grade).",
"Aree di emorragia nel tumore": "Areas of haemorrhage in the tumour", "Corrispondono alle zone eterogenee della massa in TC.": "They correspond to the heterogeneous areas of the mass on CT.",
"Parenchima renale non tumorale con glomeruli e tubuli al margine del preparato": "Non-tumoral renal parenchyma with glomeruli and tubules at the edge of the section",
"In basso: utile confronto con il tumore.": "At the bottom: a useful comparison with the tumour.",
"Papille con macrofagi schiumosi e corpi psammomatosi": "Papillae with foamy macrophages and psammoma bodies", "Quadro del carcinoma papillare.": "Pattern of papillary carcinoma.",
"Cellule pallide con membrane cellulari spesse «a cellula vegetale» e alone perinucleare": "Pale cells with thick “plant-cell” membranes and perinuclear halos", "Quadro del carcinoma cromofobo.": "Pattern of chromophobe carcinoma.",
"Carcinoma renale a cellule chiare": "Clear cell renal cell carcinoma", "Carcinoma renale papillare": "Papillary renal cell carcinoma", "Carcinoma renale cromofobo": "Chromophobe renal cell carcinoma", "Oncocitoma": "Oncocytoma", "Angiomiolipoma": "Angiomyolipoma",
"L'oncocitoma ha cellule eosinofile in nidi in uno stroma edematoso, senza cellule chiare né aree di alto grado; non metastatizza.": "Oncocytoma has eosinophilic cells in nests within an oedematous stroma, without clear cells or high-grade areas; it does not metastasise.",
"Grasso, vasi a parete spessa e muscolo liscio: in TC il grasso macroscopico lo riconosce.": "Fat, thick-walled vessels and smooth muscle: on CT macroscopic fat identifies it.",
"Il carcinoma a cellule chiare è il tumore renale maligno più frequente dell'adulto (circa il 70-75%). Le cellule hanno citoplasma chiaro (lipidi e glicogeno) o, nelle aree di alto grado, eosinofilo; sono organizzate in nidi e alveoli circondati da una ricca rete di capillari. Il grado (ISUP/WHO) si basa sui nucleoli; il grado 4 comprende atipia marcata, aspetti sarcomatoidi o rabdoidi.\nCorrelazione radiologica (caso 088, TC della stessa paziente): la rete capillare spiega l'impregnazione intensa e precoce con lavaggio; necrosi ed emorragia la rendono eterogenea; il grasso intracitoplasmatico può dare calo di segnale in opposizione di fase alla RM. L'alto grado e le dimensioni si accompagnano alle metastasi ematogene: qui polmonari multiple (M1).":
"Clear cell carcinoma is the most common malignant renal tumour in adults (about 70-75%). The cells have clear cytoplasm (lipid and glycogen) or, in high-grade areas, eosinophilic cytoplasm; they are arranged in nests and alveoli surrounded by a rich capillary network. The grade (ISUP/WHO) is based on the nucleoli; grade 4 includes marked atypia and sarcomatoid or rhabdoid features.\nRadiological correlation (case 088, CT of the same patient): the capillary network explains the intense, early enhancement with washout; necrosis and haemorrhage make it heterogeneous; intracytoplasmic fat may cause signal drop on opposed-phase MRI. High grade and size go with haematogenous metastases: here multiple lung metastases (M1).",
"Carcinoma a cellule chiare: nidi di cellule chiare in una fitta rete di capillari, cioè ipervascolare in TC e RM.": "Clear cell carcinoma: nests of clear cells in a dense capillary network, i.e. hypervascular on CT and MRI.",
"Carcinoma renale a cellule chiare (TCGA-KIRC: clear cell adenocarcinoma, NOS), G4, pT3a N0 M1, rene destro.": "Clear cell renal cell carcinoma (TCGA-KIRC: clear cell adenocarcinoma, NOS), G4, pT3a N0 M1, right kidney.",
# correlazioni (rassegna)
"TC: carcinoma papillare della tiroide (variante follicolare), nodulo solido del lobo destro": "CT: papillary thyroid carcinoma (follicular variant), solid nodule of the right lobe",
"RM: glioblastoma con impregnazione ad anello e centro necrotico, edema perilesionale": "MRI: glioblastoma with ring enhancement and necrotic centre, perilesional oedema",
"TC: metastasi epatiche multiple da carcinoma del colon-retto": "CT: multiple liver metastases from colorectal carcinoma",
"TC: piccole metastasi epatiche ipovascolari da carcinoma colorettale": "CT: small hypovascular liver metastases from colorectal carcinoma",
"TC: epatocarcinoma LR-5, iperarterializzazione e wash-out": "CT: LR-5 hepatocellular carcinoma, arterial hyperenhancement and washout",
"Ecografia e CEUS: epatocarcinoma di 1,5 cm": "Ultrasound and CEUS: 1.5 cm hepatocellular carcinoma",
"TC: epatocarcinoma gigante in fegato non cirrotico": "CT: giant hepatocellular carcinoma in a non-cirrhotic liver",
"TC: carcinoma squamoso del lobo inferiore sinistro con piccola cavitazione": "CT: squamous cell carcinoma of the left lower lobe with small cavitation",
"TC della STESSA paziente: massa renale destra voluminosa e metastasi polmonari": "CT of the SAME patient: large right renal mass and lung metastases",
"TC trifasica: carcinoma a cellule chiare ipervascolare con wash-out (vetrino visibile dopo la risposta)": "Triphasic CT: hypervascular clear cell carcinoma with washout (slide visible after answering)",
"RM multiparametrica di un carcinoma a cellule chiare": "Multiparametric MRI of a clear cell carcinoma",
"vetrino: carcinoma papillare della tiroide (papille, nuclei chiari con incisure)": "slide: papillary thyroid carcinoma (papillae, clear grooved nuclei)",
"vetrino: glioblastoma, necrosi a pseudopalizzata e proliferazione microvascolare (anello e centro necrotico in RM)": "slide: glioblastoma, pseudopalisading necrosis and microvascular proliferation (ring and necrotic centre on MRI)",
"vetrino: adenocarcinoma del colon, il tumore primitivo": "slide: colon adenocarcinoma, the primary tumour",
"vetrino: carcinoma epatocellulare ben differenziato (trabecole, arterie «spaiate», cellule chiare)": "slide: well-differentiated hepatocellular carcinoma (trabeculae, “unpaired” arteries, clear cells)",
"vetrino: carcinoma epatocellulare ben differenziato": "slide: well-differentiated hepatocellular carcinoma",
"vetrino: carcinoma squamoso del polmone (nidi solidi, cheratinizzazione)": "slide: squamous cell carcinoma of the lung (solid nests, keratinisation)",
"vetrino della STESSA paziente: carcinoma a cellule chiare G4 della nefrectomia": "slide of the SAME patient: G4 clear cell carcinoma from the nephrectomy",
"vetrino: carcinoma a cellule chiare di alto grado di un'altra paziente (con metastasi polmonari)": "slide: high-grade clear cell carcinoma of another patient (with lung metastases)",
"vetrino: carcinoma renale a cellule chiare": "slide: clear cell renal cell carcinoma",

}
mancanti = []
tit = json.load(open(os.path.join(L, '_titoli.json'), encoding='utf-8'))
for k in range(136, 142):
    cid = f'caso-tcia-{k}'; c = json.load(open(os.path.join(CASI, cid, 'caso.json'), encoding='utf-8'))
    testi = [x['testo'] for x in c.get('rassegna') or []] + [c['titolo'], c['titolo_interno'], c['anamnesi'], c['domanda'], c['spiegazione'], c['regola'], c['esito_clinico']['testo'], c['quesito']]
    testi += [x for z in c['sezioni'] for x in (z['nome'], z['domanda'])] + [x for o in c['opzioni'] for x in (o['testo'], o['nota']) if x]
    d = {}
    for t in testi:
        if t in EN: d[t] = EN[t]
        else: mancanti.append((cid, t[:80]))
    json.dump(d, open(os.path.join(L, cid + '.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    tit[c['titolo']] = EN[c['titolo']]; tit[c['quesito']] = EN[c['quesito']]
json.dump(tit, open(os.path.join(L, '_titoli.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('mancanti', mancanti)

# casi radiologici collegati (correla_vetrini.py): si aggiungono solo le frasi della rassegna
for cid in ['caso-tcia-133','caso-tcia-057','caso-tcia-021','caso-tcia-090','caso-tcia-128','caso-tcia-124','caso-tcia-129','caso-tcia-026','caso-tcia-088','caso-tcia-003','caso-tcia-079']:
    c = json.load(open(os.path.join(CASI, cid, 'caso.json'), encoding='utf-8')); f = os.path.join(L, cid + '.json')
    d = json.load(open(f, encoding='utf-8')) if os.path.exists(f) else {}
    for x in c.get('rassegna') or []:
        if x['testo'] in EN: d[x['testo']] = EN[x['testo']]
        elif x['testo'] not in d: mancanti.append((cid, x['testo'][:80]))
    json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False)
print('mancanti dopo i collegati', mancanti)
