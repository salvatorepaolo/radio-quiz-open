# 1.212: checklist di lettura, modalità esame senza aiuti, confronto della misura con il docente
import json, re, sys, shutil, os, time
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/'
BK = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/backup_vista/20261106_pre_1212/'
os.makedirs(BK, exist_ok=True)
for f in ['web/app.js', 'web/index.html', 'web/style.css', 'api/logica.mjs', 'web/lingua/en.json']:
    if not os.path.exists(BK + os.path.basename(f)): shutil.copy2(R + f, BK + os.path.basename(f))

def sost(testo, vecchio, nuovo, nome):
    n = testo.count(vecchio)
    if n != 1: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)

LISTE = {
  'torace': ['Torace', ["Parenchima polmonare: tutti i lobi, apici e recessi (finestra polmone)", "Vie aeree: trachea e bronchi", "Mediastino e ili: linfonodi, esofago, tiroide", "Cuore, pericardio, aorta e arterie polmonari", "Pleura: versamento, ispessimenti, pneumotorace", "Parete toracica, mammelle e ascelle", "Ossa: coste, vertebre, sterno, scapole (finestra ossea)", "Addome superiore compreso nell'esame: fegato, surreni, milza"]],
  'rxtorace': ['RX del torace', ["Qualità tecnica: proiezione, inspirazione, rotazione", "Tubi, cateteri e dispositivi", "Trachea, mediastino e ili", "Polmoni: apici, zone dietro il cuore e sotto il diaframma", "Seni costofrenici e pleura", "Profilo e dimensioni del cuore", "Diaframma e aria libera sotto il diaframma", "Ossa e tessuti molli"]],
  'addome': ['Addome', ["Fegato, colecisti e vie biliari", "Pancreas e milza", "Reni, surreni, ureteri e vescica", "Stomaco, intestino e mesentere", "Peritoneo: liquido, aria libera, raccolte", "Vasi: aorta, vena cava, vene porta e mesenteriche", "Linfonodi", "Organi pelvici", "Basi polmonari", "Ossa e parete addominale (ernie)"]],
  'encefalo': ['Encefalo', ["Parenchima: sostanza grigia e bianca, nuclei della base", "Ventricoli e linea mediana", "Spazi subaracnoidei e cisterne della base", "Fossa cranica posteriore: cervelletto e tronco", "Raccolte extra-assiali (subdurali, epidurali)", "Vasi: iperdensità, aneurismi, seni venosi", "Ossa della volta e della base (finestra ossea)", "Seni paranasali, orbite e mastoidi"]],
  'rachide': ['Rachide', ["Allineamento e curve", "Corpi vertebrali: altezza, densità o segnale, fratture", "Dischi intervertebrali", "Canale vertebrale, midollo e cauda", "Forami di coniugazione e radici", "Elementi posteriori: faccette, lamine, spinose", "Tessuti molli paravertebrali", "Organi compresi nel campo (reni, aorta, polmoni)"]],
  'msk': ['Muscolo-scheletrico', ["Allineamento dei capi articolari", "Ossa: corticale e midollare, linee di frattura", "Spazio articolare e cartilagine", "Tendini e legamenti", "Muscoli", "Tessuti molli: raccolte, corpi estranei, gas", "Tutte le ossa nel campo, anche ai margini"]],
  'mammella': ['Mammella', ["Confronto destra-sinistra (simmetria)", "Densità e composizione", "Masse e noduli", "Microcalcificazioni (ingrandisci)", "Distorsioni architetturali", "Cute, capezzolo e regione retroareolare", "Cavo ascellare e linfonodi", "Confronto con gli esami precedenti"]],
  'eco': ['Ecografia', ["Organo del quesito: dimensioni, ecostruttura, lesioni focali", "Organi vicini visibili nelle scansioni", "Vasi e Doppler (se presenti)", "Liquido libero e raccolte", "Linfonodi", "Misure riportate sulle immagini"]],
  'pet': ['PET-TC', ["Captazioni fisiologiche da distinguere (encefalo, cuore, reni, vescica, intestino)", "Linfonodi per stazioni: collo, mediastino, addome, pelvi", "Organi solidi: fegato, milza, surreni", "Polmoni (anche sulla TC)", "Ossa e midollo", "Corrispondenza tra captazione e reperto TC", "Confronto con l'esame precedente (Deauville nei linfomi)"]],
  'cuore': ['Cuore', ["Volumi e funzione dei ventricoli", "Spessori di parete e cinetica", "Valvole e flussi", "Pericardio", "Impregnazione tardiva (LGE)", "Grossi vasi", "Reperti fuori dal cuore nel campo (polmoni, fegato, mammelle)"]],
  'collo': ['Collo', ["Tiroide e paratiroidi", "Linfonodi per livelli", "Ghiandole salivari", "Faringe e laringe", "Vasi del collo", "Spazi profondi e ossa", "Apici polmonari nel campo"]],
  'generica': ['Esame', ["Reperto principale e sue misure", "Tutti gli altri organi nel campo di vista", "Ossa e tessuti molli", "Dispositivi e corpi estranei", "Confronto con gli esami precedenti"]],
}
LISTE_EN = {
  'Torace': 'Chest', 'RX del torace': 'Chest X-ray', 'Addome': 'Abdomen', 'Encefalo': 'Brain', 'Rachide': 'Spine', 'Muscolo-scheletrico': 'Musculoskeletal',
  'Mammella': 'Breast', 'Ecografia': 'Ultrasound', 'PET-TC': 'PET-CT', 'Cuore': 'Heart', 'Collo': 'Neck', 'Esame': 'Examination',
  "Parenchima polmonare: tutti i lobi, apici e recessi (finestra polmone)": "Lung parenchyma: all lobes, apices and recesses (lung window)",
  "Vie aeree: trachea e bronchi": "Airways: trachea and bronchi",
  "Mediastino e ili: linfonodi, esofago, tiroide": "Mediastinum and hila: lymph nodes, oesophagus, thyroid",
  "Cuore, pericardio, aorta e arterie polmonari": "Heart, pericardium, aorta and pulmonary arteries",
  "Pleura: versamento, ispessimenti, pneumotorace": "Pleura: effusion, thickening, pneumothorax",
  "Parete toracica, mammelle e ascelle": "Chest wall, breasts and axillae",
  "Ossa: coste, vertebre, sterno, scapole (finestra ossea)": "Bones: ribs, vertebrae, sternum, scapulae (bone window)",
  "Addome superiore compreso nell'esame: fegato, surreni, milza": "Upper abdomen included in the scan: liver, adrenals, spleen",
  "Qualità tecnica: proiezione, inspirazione, rotazione": "Technical quality: projection, inspiration, rotation",
  "Tubi, cateteri e dispositivi": "Tubes, lines and devices",
  "Trachea, mediastino e ili": "Trachea, mediastinum and hila",
  "Polmoni: apici, zone dietro il cuore e sotto il diaframma": "Lungs: apices, behind the heart and below the diaphragm",
  "Seni costofrenici e pleura": "Costophrenic angles and pleura",
  "Profilo e dimensioni del cuore": "Cardiac contour and size",
  "Diaframma e aria libera sotto il diaframma": "Diaphragm and free air under the diaphragm",
  "Ossa e tessuti molli": "Bones and soft tissues",
  "Fegato, colecisti e vie biliari": "Liver, gallbladder and bile ducts",
  "Pancreas e milza": "Pancreas and spleen",
  "Reni, surreni, ureteri e vescica": "Kidneys, adrenals, ureters and bladder",
  "Stomaco, intestino e mesentere": "Stomach, bowel and mesentery",
  "Peritoneo: liquido, aria libera, raccolte": "Peritoneum: fluid, free air, collections",
  "Vasi: aorta, vena cava, vene porta e mesenteriche": "Vessels: aorta, IVC, portal and mesenteric veins",
  "Linfonodi": "Lymph nodes",
  "Organi pelvici": "Pelvic organs",
  "Basi polmonari": "Lung bases",
  "Ossa e parete addominale (ernie)": "Bones and abdominal wall (hernias)",
  "Parenchima: sostanza grigia e bianca, nuclei della base": "Parenchyma: grey and white matter, basal ganglia",
  "Ventricoli e linea mediana": "Ventricles and midline",
  "Spazi subaracnoidei e cisterne della base": "Subarachnoid spaces and basal cisterns",
  "Fossa cranica posteriore: cervelletto e tronco": "Posterior fossa: cerebellum and brainstem",
  "Raccolte extra-assiali (subdurali, epidurali)": "Extra-axial collections (subdural, epidural)",
  "Vasi: iperdensità, aneurismi, seni venosi": "Vessels: hyperdensity, aneurysms, venous sinuses",
  "Ossa della volta e della base (finestra ossea)": "Skull vault and base (bone window)",
  "Seni paranasali, orbite e mastoidi": "Paranasal sinuses, orbits and mastoids",
  "Allineamento e curve": "Alignment and curvature",
  "Corpi vertebrali: altezza, densità o segnale, fratture": "Vertebral bodies: height, density or signal, fractures",
  "Dischi intervertebrali": "Intervertebral discs",
  "Canale vertebrale, midollo e cauda": "Spinal canal, cord and cauda equina",
  "Forami di coniugazione e radici": "Neural foramina and nerve roots",
  "Elementi posteriori: faccette, lamine, spinose": "Posterior elements: facets, laminae, spinous processes",
  "Tessuti molli paravertebrali": "Paravertebral soft tissues",
  "Organi compresi nel campo (reni, aorta, polmoni)": "Organs in the field of view (kidneys, aorta, lungs)",
  "Allineamento dei capi articolari": "Joint alignment",
  "Ossa: corticale e midollare, linee di frattura": "Bones: cortex and marrow, fracture lines",
  "Spazio articolare e cartilagine": "Joint space and cartilage",
  "Tendini e legamenti": "Tendons and ligaments",
  "Muscoli": "Muscles",
  "Tessuti molli: raccolte, corpi estranei, gas": "Soft tissues: collections, foreign bodies, gas",
  "Tutte le ossa nel campo, anche ai margini": "Every bone in the field, including the edges",
  "Confronto destra-sinistra (simmetria)": "Right-left comparison (symmetry)",
  "Densità e composizione": "Density and composition",
  "Masse e noduli": "Masses and nodules",
  "Microcalcificazioni (ingrandisci)": "Microcalcifications (magnify)",
  "Distorsioni architetturali": "Architectural distortions",
  "Cute, capezzolo e regione retroareolare": "Skin, nipple and retroareolar region",
  "Cavo ascellare e linfonodi": "Axilla and lymph nodes",
  "Confronto con gli esami precedenti": "Comparison with previous examinations",
  "Organo del quesito: dimensioni, ecostruttura, lesioni focali": "Organ in question: size, echotexture, focal lesions",
  "Organi vicini visibili nelle scansioni": "Neighbouring organs visible in the scans",
  "Vasi e Doppler (se presenti)": "Vessels and Doppler (if present)",
  "Liquido libero e raccolte": "Free fluid and collections",
  "Misure riportate sulle immagini": "Measurements shown on the images",
  "Captazioni fisiologiche da distinguere (encefalo, cuore, reni, vescica, intestino)": "Physiological uptake to tell apart (brain, heart, kidneys, bladder, bowel)",
  "Linfonodi per stazioni: collo, mediastino, addome, pelvi": "Lymph nodes by station: neck, mediastinum, abdomen, pelvis",
  "Organi solidi: fegato, milza, surreni": "Solid organs: liver, spleen, adrenals",
  "Polmoni (anche sulla TC)": "Lungs (also on CT)",
  "Ossa e midollo": "Bones and marrow",
  "Corrispondenza tra captazione e reperto TC": "Match between uptake and CT finding",
  "Confronto con l'esame precedente (Deauville nei linfomi)": "Comparison with the previous scan (Deauville in lymphoma)",
  "Volumi e funzione dei ventricoli": "Ventricular volumes and function",
  "Spessori di parete e cinetica": "Wall thickness and motion",
  "Valvole e flussi": "Valves and flows",
  "Pericardio": "Pericardium",
  "Impregnazione tardiva (LGE)": "Late gadolinium enhancement (LGE)",
  "Grossi vasi": "Great vessels",
  "Reperti fuori dal cuore nel campo (polmoni, fegato, mammelle)": "Extracardiac findings in the field (lungs, liver, breasts)",
  "Tiroide e paratiroidi": "Thyroid and parathyroids",
  "Linfonodi per livelli": "Lymph nodes by level",
  "Ghiandole salivari": "Salivary glands",
  "Faringe e laringe": "Pharynx and larynx",
  "Vasi del collo": "Neck vessels",
  "Spazi profondi e ossa": "Deep spaces and bones",
  "Apici polmonari nel campo": "Lung apices in the field",
  "Reperto principale e sue misure": "Main finding and its measurements",
  "Tutti gli altri organi nel campo di vista": "All other organs in the field of view",
  "Dispositivi e corpi estranei": "Devices and foreign bodies",
}

CK_JS = '''// ---- checklist di lettura per distretto: allena a guardare tutto il campo prima di rispondere (contro l'errore di
// fermarsi al primo reperto). Il docente la rende obbligatoria o la nasconde caso per caso (campo «checklist»).
const CHECKLIST = ''' + json.dumps({k: {'nome': v[0], 'voci': v[1]} for k, v in LISTE.items()}, ensure_ascii=False) + ''';
function tipoChecklist(c) {
  const met = metodicaDi(c || {}), t = `${c?.distretto || ''} ${c?.titolo || ''} ${c?.quesito || ''}`.toLowerCase();
  if (met === 'Mammografia' || (met === 'RM' && /mammell/.test(t))) return 'mammella';
  if (met === 'Medicina nucleare') return 'pet';
  if (met === 'Ecografia' || met === 'Ecocardio') return 'eco';
  if (/encefal|cranio|cerebr|cervello|ictus/.test(t)) return 'encefalo';
  if (/rachide|colonna|vertebr|midollo|lombar|lombo|dorsale/.test(t)) return 'rachide';
  if (met === 'RX' && /torace|polmon/.test(t)) return 'rxtorace';
  if (met === 'RM' && /cuore|cardi|miocard/.test(t)) return 'cuore';
  if (/torace|polmon|mediastin|pleur/.test(t)) return 'torace';
  if (/addom|fegat|epatic|pancrea|rene|reni|renal|pelv|stomac|gastr|colon|retto|intestin|surren|milza|vescic|prostat|uter|ovai|annes|bilia/.test(t)) return 'addome';
  if (/collo|tiroid|laring|faring|parotid|salivar/.test(t)) return 'collo';
  if (met === 'RX' || /ginocc|spalla|anca|caviglia|polso|gomito|mano|piede|femor|tibi|omer|bacino|oss[ao]|scheletr|muscol|tendin|coscia|ginocchio/.test(t)) return 'msk';
  return 'generica';
}
function preparaChecklist() {
  const box = $('#q-check'); if (!box) return;
  const c = V.caso || {}, t = tipoChecklist(c), L = CHECKLIST[t];
  QZ.check = { tipo: t, obbl: c.checklist === 'obbligatoria' };
  box.hidden = c.checklist === 'spenta' || !L;
  const voci = box.querySelector('.qc-voci');
  if (box.hidden) { voci.innerHTML = ''; return; }
  box.querySelector('.qc-tit').textContent = `🧭 Checklist di lettura · ${L.nome}`;
  voci.innerHTML = L.voci.map((v, i) => `<label class="qc-voce"><input type="checkbox" value="${i}"> <span>${esc(v)}</span></label>`).join('');
  box.querySelector('.qc-obbl').hidden = !QZ.check.obbl;
  let aperta = false; try { aperta = localStorage.getItem('rq-checklist') === 'aperta'; } catch {}
  box.open = QZ.check.obbl || aperta;
  const conta = () => { const n = voci.querySelectorAll('input:checked').length; box.querySelector('.qc-conto').textContent = `${n}/${L.voci.length}`; box.classList.toggle('completa', n === L.voci.length); };
  voci.querySelectorAll('input').forEach((x) => x.addEventListener('change', conta)); conta();
}
$('#q-check summary')?.addEventListener('click', () => setTimeout(() => { try { localStorage.setItem('rq-checklist', $('#q-check').open ? 'aperta' : 'chiusa'); } catch {} }, 0));
function statoChecklist() {
  const box = $('#q-check'); if (!box || box.hidden || !QZ.check) return null;
  const L = CHECKLIST[QZ.check.tipo], fatte = [...box.querySelectorAll('.qc-voci input')].map((x) => x.checked);
  if (!L || !fatte.length) return null;
  return { tipo: QZ.check.tipo, fatte: fatte.filter(Boolean).length, totale: fatte.length, mancanti: L.voci.filter((_, i) => !fatte[i]) };
}
function htmlEsitoChecklist(ck) {
  if (!ck) return '';
  return ck.fatte === ck.totale ? `<p class="qc-esito ok">🧭 Checklist completa: hai controllato tutte le ${ck.totale} zone.</p>`
    : `<p class="qc-esito">🧭 Checklist: ${ck.fatte}/${ck.totale} zone controllate. Non spuntate: ${esc(ck.mancanti.join('; '))}.</p>`;
}
// per il docente (Analisi → Referti)
const htmlChecklistDoc = (ck) => (ck?.totale ? `<div class="ref-check small"><b>🧭 Checklist</b> ${ck.fatte}/${ck.totale}${ck.mancanti?.length ? ` · <span class="muted">non spuntate: ${esc(ck.mancanti.join('; '))}</span>` : ''}</div>` : '');
// ---- confronto della misura dello studente con quella del docente (dopo la risposta). Riferimento: la misura
// salvata con la vista del reperto (distanza o RECIST); in mancanza, il diametro maggiore del segno (indicativo).
// Le ROI dello studente si confrontano con il segno del docente (indice di Dice).
function spSerie(sIdx) { for (const q of V.pannelli) if (q.sIdx === sIdx && q.img?.spCol && !q.piano) return [q.img.spCol, q.img.spRow]; return null; }
function diceROI(A, B) {
  const x0 = Math.floor(Math.min(A.x0, B.x0)), x1 = Math.ceil(Math.max(A.x1, B.x1)), y0 = Math.floor(Math.min(A.y0, B.y0)), y1 = Math.ceil(Math.max(A.y1, B.y1));
  const st = Math.max(0.25, Math.max(x1 - x0, y1 - y0) / 220); let a = 0, b = 0, ab = 0;
  for (let y = y0; y <= y1; y += st) for (let x = x0; x <= x1; x += st) { const ia = A.dentro(x, y), ib = B.dentro(x, y); if (ia) a++; if (ib) b++; if (ia && ib) ab++; }
  return a + b ? 2 * ab / (a + b) : 0;
}
function htmlConfrontoMisura(v) {
  if (!v || (!v.misura && !v.segno)) return '';
  const sIdx = V.serie.findIndex((s) => s._i === v.serie); if (sIdx < 0) return '';
  const sp = v.misura?.sp || spSerie(sIdx); if (!sp) return '';
  const mm = (a, b) => Math.hypot((b.x - a.x) * sp[0], (b.y - a.y) * sp[1]), mezzo = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ','), segnato = (x) => (x >= 0 ? '+' : '−') + f1(Math.abs(x));
  const mie = [];
  for (const [k, l] of Object.entries(V.misure || {})) { const [s, i, piano] = k.split(':'); if (+s !== sIdx || piano) continue; for (const m of l || []) mie.push({ m, idx: +i }); }
  const righe = [];
  const giudizio = (d, rif) => (Math.abs(d) <= Math.max(1.5, rif * 0.1) ? ['ok', 'concordante'] : Math.abs(d) <= Math.max(3, rif * 0.2) ? ['medio', 'vicina'] : ['ko', 'diversa']);
  let ref = null;
  if (v.misura) ref = { a: v.misura.a, b: v.misura.b, c: v.misura.c, d: v.misura.d };
  else if (v.segno) { const cx = (v.segno.a.x + v.segno.b.x) / 2, cy = (v.segno.a.y + v.segno.b.y) / 2, rx = Math.abs(v.segno.b.x - v.segno.a.x) / 2, ry = Math.abs(v.segno.b.y - v.segno.a.y) / 2;
    ref = rx * sp[0] >= ry * sp[1] ? { a: { x: cx - rx, y: cy }, b: { x: cx + rx, y: cy } } : { a: { x: cx, y: cy - ry }, b: { x: cx, y: cy + ry } }; }
  const lin = mie.filter(({ m }) => (m.tipo === 'linea' || m.tipo === 'recist') && m.a && m.b);
  if (ref && lin.length) {
    const cRef = mezzo(ref.a, ref.b), lRef = mm(ref.a, ref.b);
    const best = lin.map((x) => ({ ...x, dc: mm(mezzo(x.m.a, x.m.b), cRef), di: Math.abs(x.idx - v.idx) })).sort((p, q) => (p.dc + 3 * p.di) - (q.dc + 3 * q.di))[0];
    if (best.dc > Math.max(15, lRef * 1.5) || best.di > 10) righe.push(`<li class="ko">La tua misura più vicina è lontana dal reperto (${f1(best.dc)} mm dal centro, ${best.di} immagini di distanza): probabilmente hai misurato un'altra struttura.</li>`);
    else {
      const lMia = mm(best.m.a, best.m.b), d = lMia - lRef, g = giudizio(d, lRef);
      righe.push(`<li class="${g[0]}">${v.misura ? `Asse lungo: tu ${f1(lMia)} mm · docente ${f1(lRef)} mm · differenza ${segnato(d)} mm (${segnato(d / lRef * 100).replace(/,\\d$/, '')}%)` : `Asse lungo: tu ${f1(lMia)} mm · segno del docente (indicativo) ${f1(lRef)} mm · differenza ${segnato(d)} mm (${segnato(d / lRef * 100).replace(/,\\d$/, '')}%)`} <span class="giud">${g[1]}</span></li>`);
      if (ref.c && ref.d && best.m.c && best.m.d) { const cr = mm(ref.c, ref.d), cm = mm(best.m.c, best.m.d), dd = cm - cr, gg = giudizio(dd, cr);
        righe.push(`<li class="${gg[0]}">Asse corto: tu ${f1(cm)} mm · docente ${f1(cr)} mm · differenza ${segnato(dd)} mm (${segnato(dd / cr * 100).replace(/,\\d$/, '')}%) <span class="giud">${gg[1]}</span></li>`); }
      righe.push(`<li>${best.di ? `Posizione: ${best.di} ${best.di === 1 ? 'immagine' : 'immagini'} di distanza, centri a ${f1(best.dc)} mm.` : `Posizione: stessa immagine, centri a ${f1(best.dc)} mm.`}</li>`);
      if (v.misura && Math.abs(d / lRef) >= 0.2) righe.push('<li class="muted small">Il 20% è la soglia RECIST di progressione: misure così diverse cambierebbero la valutazione della risposta.</li>');
    }
  }
  const rois = mie.filter(({ m }) => (m.tipo === 'roi' || m.tipo === 'roi-libera') && (m.pts?.length >= 3 || (m.a && m.b)) && formaROI(m).ok);
  if (v.segno && rois.length) {
    const S = formaROI({ tipo: 'roi', a: v.segno.a, b: v.segno.b });
    if (S.ok) {
      const best = rois.map((x) => ({ ...x, di: Math.abs(x.idx - v.idx), dice: diceROI(S, formaROI(x.m)) })).sort((p, q) => (q.dice - 0.05 * q.di) - (p.dice - 0.05 * p.di))[0];
      if (best.di <= 3) { const d = Math.round(best.dice * 100); righe.push(`<li class="${d >= 70 ? 'ok' : d >= 40 ? 'medio' : 'ko'}">Contorno (ROI): sovrapposizione con il segno del docente ${d}% (indice di Dice)</li>`); }
    }
  }
  if (!righe.length) return v.misura ? `<h3>📏 La tua misura e quella del docente</h3><p class="muted small">Il docente ha misurato il reperto: ${f1(mm(v.misura.a, v.misura.b))} mm all'immagine ${v.idx + 1}. Misuralo anche tu (distanza o RECIST) prima di rispondere, così vedi la differenza.</p>` : '';
  return `<h3>📏 La tua misura e quella del docente</h3><ul class="cfr-misura">${righe.join('')}</ul>`;
}
'''

a = open(R + 'web/app.js', encoding='utf-8').read()
a = sost(a, "const funzioneSpenta = (f) => !AUTORE && V.caso?.[f] === false;",
  "const funzioneSpenta = (f) => !AUTORE && V.caso?.[f] === false;\n"
  "// modalità esame (esame simulato, turno di guardia, lista di lavoro): niente aiuti alla diagnosi durante la prova\n"
  "const aiutiSpenti = () => !!esameDelCaso();\n"
  "const bloccoEsame = () => { if (!aiutiSpenti()) return false; avvisoBreve('Modalità esame: scale, calcolatori, analisi IA e schede sono spenti fino alla fine della prova.'); return true; };", 'aiutiSpenti')
a = sost(a, "  else { const mv = $('#mpr-vertebre'); if (mv) mv.hidden = false; } attivaQuizAnatomia(false); ANAT.etichetta = null;",
  "  else { const mv = $('#mpr-vertebre'); if (mv) mv.hidden = false; } attivaQuizAnatomia(false); ANAT.etichetta = null;\n"
  "  { const sp = aiutiSpenti(); if ($('#btn-radiomica')) $('#btn-radiomica').hidden = sp;\n"
  "    if (sp) for (const id of ['#btn-scale', '#btn-aspects', '#btn-vertebre', '#btn-densita', '#btn-quiz-anat', '#mpr-vertebre']) { const x = $(id); if (x) x.hidden = true; } }", 'nascondi aiuti')
a = sost(a, "function apriScale(sceltaIniziale) {", "function apriScale(sceltaIniziale) {\n  if (bloccoEsame()) return;", 'apriScale')
a = sost(a, "$('#btn-aspects').addEventListener('click', () => {", "$('#btn-aspects').addEventListener('click', () => {\n  if (bloccoEsame()) return;", 'aspects')
a = sost(a, "async function mostraRadiomica() {", "async function mostraRadiomica() {\n  if (bloccoEsame()) return;", 'radiomica')
a = sost(a, "async function attivaQuizAnatomia(on) {", "async function attivaQuizAnatomia(on) {\n  if (on && bloccoEsame()) return;", 'quizanat')
a = sost(a, "async function attivaDensita() {", "async function attivaDensita() {\n  if (!DENS.attiva && bloccoEsame()) return;", 'densita')
a = sost(a, "async function attivaVertebre(on) {", "async function attivaVertebre(on) {\n  if (on && bloccoEsame()) return;", 'vertebre')
a = sost(a, "const anatomiaConsentita = () => { if (funzioneSpenta('anatomia')) {", "const anatomiaConsentita = () => { if (bloccoEsame()) return false; if (funzioneSpenta('anatomia')) {", 'anatomia')
a = sost(a, '· <a href="#/esame/esito" id="esci-giro">termina e correggi</a>`;',
  '· <span class="senza-aiuti" title="Durante la prova scale, calcolatori, analisi IA e schede sono spenti">🔒 senza aiuti</span> · <a href="#/esame/esito" id="esci-giro">termina e correggi</a>`;', 'banner')
a = sost(a, "function renderQuiz() {", CK_JS + "function renderQuiz() {", 'checklist js')
a = sost(a, "preparaModelli(); fermaDettatura(); azzeraComunicazione();", "preparaModelli(); fermaDettatura(); azzeraComunicazione(); preparaChecklist();", 'renderQuiz')
a = sost(a, "  const scaduto = leggiSessione('quiz-giro', null)?.scaduto;\n",
  "  const scaduto = leggiSessione('quiz-giro', null)?.scaduto;\n"
  "  const ck = statoChecklist();\n"
  "  if (ck && QZ.check?.obbl && ck.fatte < ck.totale && !scaduto) { $('#q-check').open = true; alertInline(`Checklist obbligatoria in questo caso: spunta tutte le zone che hai controllato (ne mancano ${ck.totale - ck.fatte}).`); return; }\n", 'conferma ck')
a = sost(a, "scale: Object.values(V.scaleMie || {}) }, nome:", "scale: Object.values(V.scaleMie || {}), ...(ck ? { checklist: ck } : {}) }, nome:", 'dettagli')
a = sost(a, "    V.vistaReperto = r.vista || null;\n",
  "    { const extra = htmlConfrontoMisura(r.vista) + htmlEsitoChecklist(ck);\n"
  "      if (extra) { const box = document.createElement('div'); box.className = 'cfr-extra'; box.innerHTML = extra; const dove = $('#q-referto-ia'); if (dove) dove.before(box); else $('#q-esito').append(box); } }\n"
  "    $('#q-check')?.querySelectorAll('input').forEach((x) => { x.disabled = true; });\n"
  "    V.vistaReperto = r.vista || null;\n", 'esito extra')
a = sost(a, "  const nota = prompt('Breve descrizione del reperto (facoltativa):', V.caso.vista?.nota || '');",
  "  // misura di riferimento: l'ultima distanza o RECIST di questa immagine (confrontata con quella dello studente)\n"
  "  const lin = p.piano ? null : (V.misure[chiaveMis(p)] || []).filter((m) => (m.tipo === 'linea' || m.tipo === 'recist') && m.a && m.b).pop();\n"
  "  const misura = lin && p.img?.spCol ? { tipo: lin.tipo, a: lin.a, b: lin.b, ...(lin.c && lin.d ? { c: lin.c, d: lin.d } : {}), sp: [p.img.spCol, p.img.spRow] } : null;\n"
  "  const nota = prompt('Breve descrizione del reperto (facoltativa):', V.caso.vista?.nota || '');", 'vista misura')
a = sost(a, "    segno: roi ? { a: roi.a, b: roi.b } : null, nota };", "    segno: roi ? { a: roi.a, b: roi.b } : null, ...(misura ? { misura } : {}), nota };", 'vista obj')
a = sost(a, "${roi ? ', con segno' : ' (disegna una ROI per aggiungere il segno)'}", "${roi ? ', con segno' : ' (disegna una ROI per aggiungere il segno)'}${misura ? ', con la misura di riferimento' : ''}", 'vista stato')
a = sost(a, "  for (const f of ['anatomia', 'scelte', 'score']) { const x = $('#ed-f-' + f); x.checked = edCaso[f] !== false; x.disabled = !ADMIN; }",
  "  for (const f of ['anatomia', 'scelte', 'score']) { const x = $('#ed-f-' + f); x.checked = edCaso[f] !== false; x.disabled = !ADMIN; }\n"
  "  if ($('#ed-checklist')) $('#ed-checklist').value = edCaso.checklist || '';", 'editor load')
a = sost(a, "score: $('#ed-f-score').checked,", "score: $('#ed-f-score').checked, checklist: $('#ed-checklist')?.value || undefined,", 'editor save')
a = sost(a, "${esc(r.dettagli.referto).replace(/\\n/g, '<br>')}${r.dettagli?.chiavi?.length ?",
  "${esc(r.dettagli.referto).replace(/\\n/g, '<br>')}${htmlChecklistDoc(r.dettagli?.checklist)}${r.dettagli?.chiavi?.length ?", 'doc referti')
open(R + 'web/app.js', 'w', encoding='utf-8').write(a)

h = open(R + 'web/index.html', encoding='utf-8').read()
h = sost(h, '    <div id="q-loc" class="q-loc" hidden>',
  '    <details id="q-check" class="q-check" hidden><summary><span class="qc-tit">🧭 Checklist di lettura</span> <span class="qc-conto"></span> <span class="qc-obbl" hidden>obbligatoria</span></summary>\n'
  '      <p class="muted small qc-aiuto">Prima di rispondere controlla ogni zona, anche dopo aver trovato il reperto principale: fermarsi al primo reperto è l\'errore più frequente.</p><div class="qc-voci"></div></details>\n'
  '    <div id="q-loc" class="q-loc" hidden>', 'html checklist')
h = sost(h, '<fieldset class="ed-funzioni" id="ed-didattica"><legend>Uso didattico</legend>',
  '<fieldset class="ed-funzioni" id="ed-didattica"><legend>Uso didattico</legend>\n'
  '    <label class="campo">Checklist di lettura per lo studente <select id="ed-checklist"><option value="">Facoltativa (la spunta chi vuole)</option><option value="obbligatoria">Obbligatoria prima di rispondere</option><option value="spenta">Nascosta in questo caso</option></select></label>', 'html editor')
h = sost(h, "l'ultima ROI disegnata diventa il segno del reperto\"", "l'ultima ROI disegnata diventa il segno del reperto; l'ultima distanza o RECIST diventa la misura di riferimento, confrontata con quella dello studente\"", 'html vista title')
open(R + 'web/index.html', 'w', encoding='utf-8').write(h)

c = open(R + 'web/style.css', encoding='utf-8').read()
if '.q-check{' not in c:
    c += '''
/* 1.212 checklist di lettura, esame senza aiuti, confronto delle misure */
.q-check{margin:10px 0;border:1px solid var(--bord);border-radius:10px;padding:6px 10px;background:var(--pan2)}
.q-check summary{cursor:pointer;font-weight:600}
.q-check .qc-conto{font-weight:400;color:var(--mut);margin-left:4px}
.q-check.completa .qc-conto{color:var(--ok);font-weight:600}
.q-check .qc-obbl{font-size:.75em;font-weight:600;background:var(--warn);color:#1b1300;border-radius:6px;padding:1px 6px;margin-left:4px}
.q-check .qc-aiuto{margin:6px 0}
.qc-voci{display:grid;gap:3px;margin:4px 0 2px}
.qc-voce{display:flex;gap:6px;align-items:flex-start;font-size:.92em;cursor:pointer;line-height:1.3}
.qc-voce input{margin-top:2px}
.qc-voce:has(input:checked) span{color:var(--mut);text-decoration:line-through;text-decoration-color:var(--ok)}
.qc-esito{margin:8px 0}.qc-esito.ok{color:var(--ok)}
.cfr-misura{list-style:none;padding-left:0;margin:6px 0}.cfr-misura li{margin:4px 0}
.cfr-misura li.ok{color:var(--ok)}.cfr-misura li.medio{color:var(--warn)}.cfr-misura li.ko{color:var(--ko)}
.cfr-misura .giud{font-weight:700;text-transform:uppercase;font-size:.78em;letter-spacing:.03em;margin-left:4px}
.senza-aiuti{font-size:.85em;white-space:nowrap}
.ref-check{margin-top:6px}
'''
    open(R + 'web/style.css', 'w', encoding='utf-8').write(c)

l = open(R + 'api/logica.mjs', encoding='utf-8').read()
l = sost(l, "  const segno = v.segno && punto(v.segno.a) && punto(v.segno.b) ? { a: punto(v.segno.a), b: punto(v.segno.b) } : null;\n",
  "  const segno = v.segno && punto(v.segno.a) && punto(v.segno.b) ? { a: punto(v.segno.a), b: punto(v.segno.b) } : null;\n"
  "  // misura di riferimento del docente (distanza o RECIST) con la spaziatura dei pixel, per il confronto con lo studente\n"
  "  const ms = v.misura, misura = ms && punto(ms.a) && punto(ms.b) && Array.isArray(ms.sp) && ms.sp.length === 2 && ms.sp.every((x) => Number.isFinite(+x) && +x > 0 && +x < 50)\n"
  "    ? { tipo: ms.tipo === 'recist' ? 'recist' : 'linea', a: punto(ms.a), b: punto(ms.b), ...(punto(ms.c) && punto(ms.d) ? { c: punto(ms.c), d: punto(ms.d) } : {}), sp: ms.sp.map((x) => +(+x).toFixed(5)) } : null;\n", 'vista misura srv')
l = sost(l, "zoom: n(v.zoom, 0.2, 20) ?? 1, panX: n(v.panX, -5000, 5000) ?? 0, panY: n(v.panY, -5000, 5000) ?? 0, segno,",
  "zoom: n(v.zoom, 0.2, 20) ?? 1, panX: n(v.panX, -5000, 5000) ?? 0, panY: n(v.panY, -5000, 5000) ?? 0, segno, ...(misura ? { misura } : {}),", 'vista ret')
l = sost(l, "  ...(d.score === false ? { score: false } : {}),",
  "  ...(d.score === false ? { score: false } : {}),\n"
  "  // checklist di lettura per lo studente: obbligatoria prima di rispondere o nascosta (assente = facoltativa)\n"
  "  ...(['obbligatoria', 'spenta'].includes(d.checklist) ? { checklist: d.checklist } : {}),", 'caso checklist')
l = sost(l, "    referto: String(d.referto || '').slice(0, 4000),\n",
  "    referto: String(d.referto || '').slice(0, 4000),\n"
  "    // checklist di lettura: zone spuntate prima di rispondere\n"
  "    ...(d.checklist && typeof d.checklist === 'object' ? { checklist: { tipo: String(d.checklist.tipo || '').slice(0, 20), fatte: Math.round(numero(d.checklist.fatte, 50)), totale: Math.round(numero(d.checklist.totale, 50)),\n"
  "      mancanti: (Array.isArray(d.checklist.mancanti) ? d.checklist.mancanti : []).slice(0, 20).map((x) => String(x || '').slice(0, 120)) } } : {}),\n", 'dettagli srv')
open(R + 'api/logica.mjs', 'w', encoding='utf-8').write(l)

# inglese
en = json.load(open(R + 'web/lingua/en.json', encoding='utf-8'))
nuove = dict(LISTE_EN)
nuove.update({
  '🧭 Checklist di lettura · {x}': '🧭 Reading checklist · {x}', '🧭 Checklist di lettura': '🧭 Reading checklist', 'obbligatoria': 'required',
  "Prima di rispondere controlla ogni zona, anche dopo aver trovato il reperto principale: fermarsi al primo reperto è l'errore più frequente.": 'Before answering, check every area, even after finding the main finding: stopping at the first finding is the most common error.',
  'Checklist obbligatoria in questo caso: spunta tutte le zone che hai controllato (ne mancano {x}).': 'The checklist is required in this case: tick every area you have checked ({x} missing).',
  '🧭 Checklist completa: hai controllato tutte le {x} zone.': '🧭 Checklist complete: you checked all {x} areas.',
  '🧭 Checklist: {x}/{x} zone controllate. Non spuntate: {x}.': '🧭 Checklist: {x}/{x} areas checked. Not ticked: {x}.',
  '🧭 Checklist': '🧭 Checklist', 'non spuntate: {x}': 'not ticked: {x}',
  'Checklist di lettura per lo studente': 'Reading checklist for the student', 'Facoltativa (la spunta chi vuole)': 'Optional (ticked by those who want)',
  'Obbligatoria prima di rispondere': 'Required before answering', 'Nascosta in questo caso': 'Hidden in this case',
  '🔒 senza aiuti': '🔒 no aids', 'Durante la prova scale, calcolatori, analisi IA e schede sono spenti': 'During the test scales, calculators, AI analysis and cards are off',
  'Modalità esame: scale, calcolatori, analisi IA e schede sono spenti fino alla fine della prova.': 'Exam mode: scales, calculators, AI analysis and cards are off until the end of the test.',
  '📏 La tua misura e quella del docente': '📏 Your measurement and the teacher\'s',
  'Asse lungo: tu {x} mm · docente {x} mm · differenza {x} mm ({x}%)': 'Long axis: you {x} mm · teacher {x} mm · difference {x} mm ({x}%)',
  'Asse lungo: tu {x} mm · segno del docente (indicativo) {x} mm · differenza {x} mm ({x}%)': "Long axis: you {x} mm · teacher's mark (approximate) {x} mm · difference {x} mm ({x}%)",
  'Asse corto: tu {x} mm · docente {x} mm · differenza {x} mm ({x}%)': 'Short axis: you {x} mm · teacher {x} mm · difference {x} mm ({x}%)',
  'concordante': 'consistent', 'vicina': 'close', 'diversa': 'different',
  'Posizione: stessa immagine, centri a {x} mm.': 'Position: same image, centres {x} mm apart.',
  'Posizione: {x} immagine di distanza, centri a {x} mm.': 'Position: {x} image apart, centres {x} mm apart.',
  'Posizione: {x} immagini di distanza, centri a {x} mm.': 'Position: {x} images apart, centres {x} mm apart.',
  "La tua misura più vicina è lontana dal reperto ({x} mm dal centro, {x} immagini di distanza): probabilmente hai misurato un'altra struttura.": 'Your closest measurement is far from the finding ({x} mm from the centre, {x} images away): you probably measured another structure.',
  'Il 20% è la soglia RECIST di progressione: misure così diverse cambierebbero la valutazione della risposta.': '20% is the RECIST progression threshold: measurements this different would change the response assessment.',
  'Contorno (ROI): sovrapposizione con il segno del docente {x}% (indice di Dice)': "Outline (ROI): overlap with the teacher's mark {x}% (Dice index)",
  "Il docente ha misurato il reperto: {x} mm all'immagine {x}. Misuralo anche tu (distanza o RECIST) prima di rispondere, così vedi la differenza.": 'The teacher measured the finding: {x} mm on image {x}. Measure it yourself (distance or RECIST) before answering to see the difference.',
  "Salva serie, immagine, finestra e zoom del riquadro attivo; l'ultima ROI disegnata diventa il segno del reperto; l'ultima distanza o RECIST diventa la misura di riferimento, confrontata con quella dello studente": "Save series, image, window and zoom of the active viewport; the last ROI drawn becomes the finding mark; the last distance or RECIST becomes the reference measurement, compared with the student's",
})
agg = 0
for k, v in nuove.items():
    if k not in en: en[k] = v; agg += 1
json.dump(en, open(R + 'web/lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('OK, voci inglesi aggiunte:', agg)

# RM cardiaca: «Modello di referto» e «Copia nel referto» vanno nell'editor del referto (nel client il campo del quiz è nascosto)
a = open(R + 'web/app.js', encoding='utf-8').read()
a = sost(a, "  $('#cmr-modello').onclick = () => { const q = $('#q-referto'); if (!q) return; q.value = (q.value.trim() ? q.value.trim() + '\\n\\n' : '') + modelloRefertoCmr(ris); q.closest('details')?.setAttribute('open', ''); };",
  "  $('#cmr-modello').onclick = () => cmrAlReferto(modelloRefertoCmr(ris), true);", 'cmr modello')
a = sost(a, "  $('#cmr-copia')?.addEventListener('click', () => { const q = $('#q-referto'); if (!q) return; q.value = (q.value.trim() ? q.value.trim() + '\\n' : '') + ris.righe.join('. ') + '.'; q.closest('details')?.setAttribute('open', ''); });",
  "  $('#cmr-copia')?.addEventListener('click', () => cmrAlReferto(ris.righe.join('. ') + '.', false));", 'cmr copia')
a = sost(a, "function inserisciNelReferto(testo) {",
  "// RM cardiaca → referto: nell'editor (client, o editor aperto sulla piattaforma), altrimenti nel campo del quiz\n"
  "async function cmrAlReferto(testo, aCapo) {\n"
  "  if (CLIENT && !$('#dlg-referto')?.open) await apriReferto();\n"
  "  if ($('#dlg-referto')?.open) { aggiungiAlEditor(String(testo).split('\\n').filter((r) => r.trim()).map((r) => `<p>${esc(r)}</p>`).join('')); salvaBozzaReferto(); avvisoBreve('Inserito nel referto.'); return; }\n"
  "  const q = $('#q-referto'); if (!q) return;\n"
  "  q.value = (q.value.trim() ? q.value.trim() + (aCapo ? '\\n\\n' : '\\n') : '') + testo; q.closest('details')?.setAttribute('open', ''); q.dispatchEvent(new Event('input', { bubbles: true }));\n"
  "}\n"
  "function inserisciNelReferto(testo) {", 'cmr funzione')
open(R + 'web/app.js', 'w', encoding='utf-8').write(a)
en = json.load(open(R + 'web/lingua/en.json', encoding='utf-8'))
en.setdefault('Inserito nel referto.', 'Added to the report.')
json.dump(en, open(R + 'web/lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('cmr OK')
