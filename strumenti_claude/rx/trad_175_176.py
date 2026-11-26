import json
B = '/Volumes/Caloggero/piattaforma-quiz/'
EN = {
175: ["Chest X-ray in two views: 47-year-old man with a positive SARS-CoV-2 swab",
"Normal PA and lateral chest X-ray in a COVID-19 positive patient (COVID-19-NY-SBU A551031)",
"47-year-old man with a positive SARS-CoV-2 swab. PA and lateral chest X-ray. The lateral view opens at the second question.",
"Read the PA first, then the lateral: what does the second view add?",
"The lateral view shows the areas hidden on the PA behind the heart, behind the domes and in front of the mediastinum. Read them in order: retrosternal space (in front of the ascending aorta: it must be clear; it fills with anterior mediastinal masses), retrocardiac space (behind the heart: it must be clear), spine (going down, the vertebrae get darker; if they get lighter there is a lower lobe opacity, «spine sign»), posterior costophrenic angles (the first to fill with fluid: about 50 ml is enough), fissures (a thickened or displaced fissure indicates fluid or volume loss), hila and the tracheal air column. In COVID-19 the X-ray is often normal in the first days: a normal X-ray does not exclude the disease.",
"On the lateral: retrosternal, retrocardiac, spine darkening downwards, posterior angles.",
"PA: clear lung fields, without focal opacities or effusion",
"Cardiac silhouette, hila and mediastinum normal",
"Middle lobe opacity obscuring the right heart border",
"Left pleural effusion",
"Retrosternal and retrocardiac spaces clear",
"Going down towards the diaphragm the vertebrae get darker: normal appearance",
"Sharp posterior costophrenic angles: no effusion",
"The lower vertebrae get lighter: lower lobe opacity hidden on the PA",
"Retrosternal space filled by an anterior mediastinal mass",
"Normal chest X-ray in both views; in a COVID-19 patient a normal X-ray does not exclude early lung disease",
"Lower lobe pneumonia visible only on the lateral",
"Suspicious lateral: immediate chest CT needed",
"Normally the vertebrae are darker lower down because more aerated lung lies over them; if they get lighter an opacity is superimposed (spine sign).",
"COVID-19-NY-SBU collection: patient with a positive SARS-CoV-2 swab. No report in the collection; reading by Claude.",
"Lateral: the patient faces right (sternum on the right of the image)",
"PA view", "Lateral view", "Conclusions", "What do you see on the PA?", "What do you check on the lateral?", "What is the conclusion?"],
176: ["Chest X-ray in a child with pneumonia",
"Left lower lobe bacterial pneumonia, retrocardiac (Kermany 2018, person411_bacteria_1826)",
"Child aged 1 to 5 (exact age and sex not provided by the collection) diagnosed with bacterial pneumonia. AP chest X-ray.",
"Where is the pneumonia? Look behind the heart too.",
"Behind the heart lies part of the left lower lobe, which on a PA or AP is seen only through the cardiac silhouette: it is one of the hidden areas. Compare the density of the heart on the two sides of the spine and look for the outline of the descending aorta and the medial left hemidiaphragm: if they disappear (silhouette sign) there is an opacity in contact. In children the projection is often AP and the heart looks larger; in the youngest the thymus can mimic a mediastinal opacity. The lateral view, when available, shows the consolidation above the diaphragm, behind the heart. A follow-up X-ray after uncomplicated pneumonia in a child is not needed if the clinical course is good.",
"Always look behind the heart: equal density on both sides of the spine and outlines of the descending aorta and hemidiaphragm.",
"Left retrocardiac opacity: behind the cardiac silhouette the lung is whiter and the medial outline of the left hemidiaphragm is not visible",
"Right lung clear, without consolidation",
"Left pneumothorax",
"Foreign body in the right main bronchus with hyperinflation",
"Right upper lobe opacity",
"Left lower lobe pneumonia, retrocardiac: treatment according to the clinical picture; follow-up X-ray only if the course is not good",
"Normal X-ray: no pneumonia",
"Posterior mediastinal mass: urgent CT",
"Reading by Claude: the collection only says «bacterial pneumonia», without a site.",
"Kermany 2018 collection: «bacterial pneumonia» label given by expert physicians; no site or clinical data.",
"Left retrocardiac opacity",
"Findings", "Conclusions", "What do you see?", "What is the conclusion?"]}
T = json.load(open(B + 'cloud/web/lingua/casi/_titoli.json'))
for n, en in EN.items():
    c = json.load(open(B + 'casi-free/caso-tcia-%d/caso.json' % n))
    it = [c[k] for k in ('titolo', 'titolo_interno', 'anamnesi', 'domanda', 'spiegazione', 'regola')] + [o['testo'] for o in c['opzioni']] + [o['nota'] for o in c['opzioni'] if o.get('nota')] + [c['esito_clinico']['testo'], c['vista']['nota']] + [z['nome'] for z in c['sezioni']] + [z['domanda'] for z in c['sezioni']]
    assert len(it) == len(en), (n, len(it), len(en))
    json.dump(dict(zip(it, en)), open(B + 'cloud/web/lingua/casi/caso-tcia-%d.json' % n, 'w'), ensure_ascii=False)
    T[it[0]] = en[0]
T.update({'COVID-19': 'COVID-19', 'polmonite': 'pneumonia'})
json.dump(T, open(B + 'cloud/web/lingua/casi/_titoli.json', 'w'), ensure_ascii=False)
print('ok')
