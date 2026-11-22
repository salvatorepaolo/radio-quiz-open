# traduci_148_150.py: file lingua/casi/<id>.json (italiano -> inglese) dei casi 148-150 e nuova frase T2* di 108/109
import json, os, sys
ROOT = sys.argv[1]  # .../piattaforma-quiz
CASI = os.path.join(ROOT, 'casi-free'); LING = os.path.join(ROOT, 'cloud/web/lingua/casi')

BASE_EN = (
    "Iron shortens T2*: in multi-echo gradient-echo sequences the signal of iron-loaded tissue falls faster the more iron there is. "
    "You draw an ROI and fit a curve S(TE) = S0·e^(−TE/T2*); R2* = 1000/T2* (s⁻¹). "
    "Heart: full-thickness ROI on the interventricular septum of the mid-ventricular short-axis slice (away from the susceptibility artifacts of the cardiac veins and lung in the lateral wall). "
    "Cardiac thresholds at 1.5 T: T2* > 20 ms normal, 10-20 ms mild-moderate overload, < 10 ms severe. "
    "Liver: ROI in the right-lobe parenchyma away from vessels; the liver iron concentration (LIC, mg Fe/g dry weight) is estimated from R2* with a calibration curve (the collection uses Garbowski 2014: LIC ≈ 0.029·R2*^1.014). "
    "Most used LIC classes: < 2 mg/g normal (up to about 1.8), 2-7 mild, 7-15 moderate, > 15 severe. "
    "With very low signal, noise creates a «floor»: a fit on all echoes overestimates T2*; truncation of the late echoes or a model with a constant (offset) is used. "
    "In the viewer, the T2* tool (More measurements → T2*) copies the ROI to all echoes of the slice, shows the curve, T2* and R2* with both models and, for the liver, the LIC. "
)
SEZ = {"sezioni.0.nome": "Findings", "sezioni.0.domanda": "What do you see?", "sezioni.1.nome": "Conclusions", "sezioni.1.domanda": "What is the conclusion?",
       "domanda": "Scroll through the echoes of the T2* series (from the shortest to the longest TE) in the heart and liver. What do you see and how do you quantify it? What is the conclusion?",
       "richiesta.farmaci": "Chelation therapy (details not provided)"}

EN = {}
EN['148'] = {**SEZ,
 "titolo": "Cardiac and liver T2* MRI: 6-year-old girl with transfusion-dependent thalassemia major",
 "titolo_interno": "Child: heart without overload (T2* 29.6 ms) and liver with severe overload (T2* 2.0 ms, R2* 500 s⁻¹, LIC about 16 mg/g) – CHMMOTv1 1023",
 "anamnesi": "6-year-old girl with thalassemia major, regularly transfused. 1.5 T MRI for monitoring of iron overload: multi-echo gradient-echo (12 echoes) in cardiac short axis (2 slices) and axial liver (4 slices). Ferritin 5,410 µg/L, AST 27, ALT 38, ALP 325 U/L. Chelation therapy ongoing (type and doses not provided by the collection).",
 "richiesta.reparto": "Pediatric hematology (thalassemia center)",
 "richiesta.lab.0.0": "Ferritin", "richiesta.lab.0.1": "5,410 µg/L", "richiesta.lab.1.0": "AST / ALT", "richiesta.lab.1.1": "27 / 38 U/L", "richiesta.lab.2.0": "ALP", "richiesta.lab.2.1": "325 U/L",
 "opzioni.0.testo": "Myocardium keeps its signal up to the last echoes, like the chest wall muscle: normal myocardial T2* (> 20 ms)",
 "opzioni.0.nota": "Collection value: T2* 29.6 ms (R2* 33 s⁻¹, MIC 0.94 mg/g). Indicative radio-quiz.it measurement: about 25 ms on a left-ventricular wall ROI; on the septum, often only 2-3 pixels in a child, the ROI also includes blood from the cavities and the value rises above 80 ms.",
 "opzioni.1.testo": "Liver bright on the first echo that becomes almost black by the fourth echo (TE about 5 ms), much earlier than the spleen and muscles: severe hepatic overload",
 "opzioni.1.nota": "Collection: liver T2* 2.0 ms, R2* 500 s⁻¹ (the LIC in the sheet, «1518», is a typo: with the collection's calibration R2* 500 gives about 16 mg/g). Indicative radio-quiz.it measurement on slices 2-3: 2.1-2.3 ms with the offset model.",
 "opzioni.2.testo": "In a small heart the septum is only a few pixels thick: an ROI that is too large includes cavity blood, which has a long T2*, and biases the measurement upwards",
 "opzioni.3.testo": "The myocardium darkens rapidly like the liver: severe cardiac overload",
 "opzioni.3.nota": "The myocardium stays grey up to the last echoes; it is the liver that darkens rapidly.",
 "opzioni.4.testo": "The liver is already dark on the first echo, so T2* cannot be measured",
 "opzioni.4.nota": "On the first echo (TE about 1 ms) the liver still has signal: the fall over the next 3-4 echoes is enough for the fit (T2* about 2 ms).",
 "opzioni.5.testo": "Severe hepatic iron overload with an iron-free heart: report it to the hematologist to adjust chelation and repeat cardiac and liver T2* MRI at the periodic follow-ups",
 "opzioni.6.testo": "Severe cardiac iron overload: risk of heart failure, intensive chelation for the heart",
 "opzioni.7.testo": "No significant overload: at 6 years iron does not accumulate yet and the high ferritin is due to inflammation",
 "opzioni.7.nota": "Transfusional iron accumulates from the first years, first in the liver; the heart usually loads later.",
 "opzioni.8.testo": "Examination not assessable in children: T2* measurement is valid only in adults",
 "opzioni.8.nota": "T2* MRI is also used in children, when they can keep still and hold their breath (often from 6-8 years; before that sedation may be needed).",
 "spiegazione": BASE_EN + (
    "In this girl the myocardium does not lose signal appreciably over the echoes (collection T2* 29.6 ms, normal), while the liver is almost black from the fourth echo (T2* 2.0 ms, R2* 500 s⁻¹, LIC about 16 mg/g: severe). "
    "In children transfusional iron deposits first in the liver; the heart usually loads later, but it must be checked periodically with MRI. "
    "In small hearts the septum is thin: zoom in before drawing the ROI and keep it in the myocardium, even if only a few pixels, because cavity blood has a long T2* and raises the value (an ROI that includes blood gives values above 100-200 ms with the T2* tool)."),
 "esito_clinico.testo": "CHMMOTv1 collection values: cardiac T2* 29.6 ms (R2* 33.1 s⁻¹, MIC 0.94 mg/g), heart «Normal»; liver T2* 2.0 ms (R2* 499.7 s⁻¹), liver «Severe»; ferritin 5,410 µg/L.",
 "comunicazione.motivo": "Severe hepatic overload with an iron-free heart: report it to the hematologist with the report to adjust chelation, not urgently.",
 "regola": "In children iron deposits first in the liver: always measure liver and heart, and in a small heart keep the ROI in the myocardium, out of the blood.",
 "vista.nota": "Short axis, first echo: scroll through the echoes and compare myocardium and liver",
}
EN['149'] = {**SEZ,
 "titolo": "Cardiac and liver T2* MRI: 14-year-old girl with transfusion-dependent thalassemia major",
 "titolo_interno": "Heart without overload (T2* 33.9 ms) and liver with mild overload (T2* 7.4 ms, LIC 4.3 mg/g) – CHMMOTv1 2014",
 "anamnesi": "14-year-old girl with thalassemia major, regularly transfused. 1.5 T MRI for monitoring of iron overload: multi-echo gradient-echo (12 echoes) in cardiac short axis and axial liver, cine bSSFP. Ferritin 1,997 µg/L, AST 19, ALT 12, ALP 349 U/L. Chelation therapy ongoing (type and doses not provided by the collection).",
 "richiesta.reparto": "Hematology (thalassemia center)",
 "richiesta.lab.0.0": "Ferritin", "richiesta.lab.0.1": "1,997 µg/L", "richiesta.lab.1.0": "AST / ALT", "richiesta.lab.1.1": "19 / 12 U/L", "richiesta.lab.2.0": "ALP", "richiesta.lab.2.1": "349 U/L",
 "opzioni.0.testo": "Interventricular septum keeps its signal up to the last echoes: normal myocardial T2* (> 20 ms)",
 "opzioni.0.nota": "Collection: T2* 33.9 ms (R2* 29.5 s⁻¹, MIC 0.94 mg/g). Indicative radio-quiz.it measurement on the septum of slice 2: 25-27 ms.",
 "opzioni.1.testo": "Liver that darkens gradually over the echoes, more than the paravertebral muscle but without turning black: mild hepatic overload",
 "opzioni.1.nota": "Collection: liver T2* 7.4 ms, R2* 138 s⁻¹, LIC 4.3 mg/g (mild: 2-7 mg/g). Indicative radio-quiz.it measurement on slice 3: about 7.8 ms with offset.",
 "opzioni.2.testo": "Liver almost black from the second echo: severe hepatic overload",
 "opzioni.2.nota": "That is the picture of cases with a liver T2* of 1-2 ms (for example 108 and 150); here the liver still has signal on the last echoes.",
 "opzioni.3.testo": "A liver T2* of about 7 ms is normal, so there is no iron in the liver",
 "opzioni.3.nota": "What counts is the LIC estimated from R2*: 4.3 mg/g is above normal (up to about 1.8-2 mg/g), and the collection classes it as «Mild». Some tables place the liver T2* limit around 6 ms, but with biopsy calibrations (such as Garbowski's) a normal LIC corresponds to a T2* of about 15 ms or more.",
 "opzioni.4.testo": "Mild hepatic iron overload, iron-free heart: picture controlled by chelation; report with the values and continue periodic MRI follow-up",
 "opzioni.5.testo": "Mild-moderate cardiac overload (T2* 10-20 ms): reconsider chelation for the heart",
 "opzioni.6.testo": "Severe hepatic overload: alert the hematologist immediately to intensify chelation",
 "opzioni.7.testo": "No iron accumulation: with this ferritin MRI is useless",
 "opzioni.7.nota": "The LIC is 4.3 mg/g, above normal, and ferritin does not accurately predict cardiac or hepatic iron.",
 "spiegazione": BASE_EN + (
    "In this girl the septum stays grey up to the last echoes (T2* 33.9 ms in the collection: normal), while the liver darkens gradually: T2* 7.4 ms, R2* 138 s⁻¹, LIC 4.3 mg/g, mild overload. "
    "Be careful not to read the liver T2* with the cardiac thresholds: for the liver, reason on the LIC. "
    "It is a picture of good chelation control: report with the values and continue periodic follow-up."),
 "esito_clinico.testo": "CHMMOTv1 collection values: cardiac T2* 33.9 ms (R2* 29.5 s⁻¹, MIC 0.94 mg/g), heart «Normal»; liver T2* 7.4 ms (R2* 138.2 s⁻¹, LIC 4.3 mg/g), liver «Mild»; ferritin 1,997 µg/L.",
 "comunicazione.motivo": "Mild hepatic overload and normal heart: the report is enough, no separate communication is needed.",
 "regola": "For the liver what counts is the LIC estimated from R2*, not the cardiac T2* thresholds.",
 "vista.nota": "Mid-ventricular slice, first echo: scroll through the echoes and look at the septum",
}
EN['150'] = {**SEZ,
 "titolo": "Cardiac and liver T2* MRI: 35-year-old woman with thalassemia major, ferritin 1,191 µg/L",
 "titolo_interno": "Ferritin not very high but mild-moderate cardiac (T2* 11 ms) and severe hepatic overload (T2* 1.6 ms, LIC 19.9 mg/g) – CHMMOTv1 2003",
 "anamnesi": "35-year-old woman with thalassemia major, regularly transfused. 1.5 T MRI for monitoring of iron overload: multi-echo gradient-echo (12 echoes) in cardiac short axis and axial liver, cine bSSFP. Ferritin 1,191 µg/L, AST 17, ALT 21, ALP 295 U/L. Chelation therapy ongoing (type and doses not provided by the collection).",
 "richiesta.reparto": "Hematology (thalassemia center)",
 "richiesta.lab.0.0": "Ferritin", "richiesta.lab.0.1": "1,191 µg/L", "richiesta.lab.1.0": "AST / ALT", "richiesta.lab.1.1": "17 / 21 U/L", "richiesta.lab.2.0": "ALP", "richiesta.lab.2.1": "295 U/L",
 "opzioni.0.testo": "Septum that loses signal on the intermediate echoes more than skeletal muscle, but without turning black: myocardial T2* between 10 and 20 ms, mild-moderate cardiac overload",
 "opzioni.0.nota": "Collection: T2* 11.0 ms (R2* 91 s⁻¹, MIC 2.7 mg/g). Indicative radio-quiz.it measurement on the septum of slice 2: 11-12 ms.",
 "opzioni.1.testo": "Liver almost black from the second-third echo: severe hepatic overload (LIC above 15 mg/g)",
 "opzioni.1.nota": "Collection: T2* 1.6 ms, R2* 627 s⁻¹, LIC 19.9 mg/g («Very severe» in the collection). Indicative radio-quiz.it measurement on slice 3: about 1.4 ms with offset; a log-linear fit on all echoes gives about 9 ms because of the noise floor.",
 "opzioni.2.testo": "The spleen also darkens rapidly over the echoes: there is iron in the spleen too, as expected in transfusional hemosiderosis",
 "opzioni.2.nota": "Indicative measurement on the spleen (slice 3): T2* about 1 ms.",
 "opzioni.3.testo": "The septum has the same signal as skeletal muscle on all echoes: iron-free heart",
 "opzioni.4.testo": "Mild-moderate cardiac and severe hepatic overload despite a not very high ferritin: report it to the hematologist with the report to review chelation",
 "opzioni.5.testo": "With a ferritin of about 1,200 µg/L the overload is necessarily modest: no change in therapy",
 "opzioni.5.nota": "Ferritin estimates tissue iron poorly, especially cardiac iron: that is why MRI is performed.",
 "opzioni.6.testo": "Severe cardiac overload (T2* below 10 ms): immediate risk of heart failure and arrhythmias, urgent communication",
 "opzioni.6.nota": "T2* is 11 ms: mild-moderate, close to the severe threshold. It must be reported, but it is not the picture below 10 ms.",
 "opzioni.7.testo": "Primary hemochromatosis: HFE genetic test and phlebotomy",
 "opzioni.7.nota": "In transfused thalassemia the iron comes from transfusions (spleen involved); phlebotomy cannot be performed in transfusion-dependent anemia.",
 "spiegazione": BASE_EN + (
    "Here ferritin is relatively low (1,191 µg/L), but MRI shows a liver that is almost black from the second-third echo (T2* 1.6 ms, LIC 19.9 mg/g: severe) and a septum that darkens more than muscle (T2* 11 ms: mild-moderate, close to the severe threshold). "
    "The spleen also loses signal rapidly: in transfusional overload iron accumulates in the macrophages of the reticuloendothelial system (liver and spleen), whereas in primary hemochromatosis the spleen is spared. "
    "Ferritin is an indirect and imperfect marker: it does not replace the measurement of iron in the heart and liver."),
 "esito_clinico.testo": "CHMMOTv1 collection values: cardiac T2* 11.0 ms (R2* 91.2 s⁻¹, MIC 2.7 mg/g), heart «Moderate»; liver T2* 1.6 ms (R2* 626.9 s⁻¹, LIC 19.92 mg/g), liver «Very severe»; ferritin 1,191 µg/L.",
 "comunicazione.motivo": "Mild-moderate cardiac and severe hepatic iron with a not very high ferritin: the hematologist must know to review chelation; it is not a minutes-level emergency.",
 "regola": "Ferritin is not enough: severe liver overload and an already loaded heart can be present even with ferritin just above 1,000 µg/L.",
 "vista.nota": "Mid-ventricular slice, first echo: scroll through the echoes and look at the septum",
}

def get(d, path):
    for p in path.split('.'):
        d = d[int(p)] if isinstance(d, list) else d[p]
    return d

titoli_p = os.path.join(LING, '_titoli.json'); titoli = json.load(open(titoli_p, encoding='utf-8'))
for cid, m in EN.items():
    c = json.load(open(os.path.join(CASI, f'caso-tcia-{cid}', 'caso.json'), encoding='utf-8'))
    out = {}
    for path, en in m.items():
        out[get(c, path)] = en
    # controllo: ogni testo del caso tradotto
    testi = [c['titolo'], c['titolo_interno'], c['anamnesi'], c['domanda'], c['spiegazione'], c['regola'], c['esito_clinico']['testo'], c['vista']['nota'], c['comunicazione']['motivo']]
    for o in c['opzioni']:
        testi.append(o['testo']); testi += [o['nota']] if o.get('nota') else []
    manca = [t[:60] for t in testi if t not in out]
    assert not manca, (cid, manca)
    json.dump(out, open(os.path.join(LING, f'caso-tcia-{cid}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    titoli[c['titolo']] = m['titolo']
    print(cid, len(out), 'testi')

# 108 e 109: nuova frase sullo strumento T2*
OLD_IT = "Il visualizzatore non ha ancora uno strumento T2* automatico: puoi seguire il segnale di una ROI sullo stesso punto scorrendo gli echi (frecce o rotellina) e confrontare la velocità con cui scuriscono miocardio, fegato, milza e muscolo."
NEW_IT = "Nel visualizzatore lo strumento T2* (Altre misure → T2*) riporta la ROI su tutti gli echi della fetta e mostra la curva, il T2* e l'R2* con due modelli (con offset e troncato) e, per il fegato, la LIC; scorrendo gli echi (frecce o rotellina) puoi anche confrontare a occhio la velocità con cui scuriscono miocardio, fegato, milza e muscolo."
NEW_EN = "In the viewer, the T2* tool (More measurements → T2*) copies the ROI to all echoes of the slice and shows the curve, T2* and R2* with two models (offset and truncated) and, for the liver, the LIC; by scrolling through the echoes (arrows or wheel) you can also compare by eye how fast myocardium, liver, spleen and muscle darken."
for cid in ['108', '109']:
    c = json.load(open(os.path.join(CASI, f'caso-tcia-{cid}', 'caso.json'), encoding='utf-8'))
    p = os.path.join(LING, f'caso-tcia-{cid}.json'); t = json.load(open(p, encoding='utf-8'))
    vecchio_it = c['spiegazione'].replace(NEW_IT, OLD_IT)
    en_vecchio = t.get(vecchio_it)
    assert en_vecchio, cid
    i = en_vecchio.rfind("The viewer does not yet")
    assert i > 0, (cid, en_vecchio[-300:])
    t[c['spiegazione']] = en_vecchio[:i] + NEW_EN
    json.dump(t, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    print(cid, 'spiegazione inglese aggiornata:', en_vecchio[i:i+80])
json.dump(titoli, open(titoli_p, 'w', encoding='utf-8'), ensure_ascii=False)
