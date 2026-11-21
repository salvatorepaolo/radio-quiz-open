import shutil, json, re
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
N = ['app.js', 'index.html', 'aiuto.json', 'lingua/en/aiuto.json', 'manuale-client.html', 'manuale-client.en.html', 'lingua/en.json']
for n in N: shutil.copy(W + n, W + n + '.bak_1109doc')
T = {n: open(W + n, encoding='utf-8').read() for n in N}
def sost(k, a, b, n=1):
    assert T[k].count(a) == n, (k, a[:100], T[k].count(a)); T[k] = T[k].replace(a, b)
E = json.loads(T['lingua/en.json'])
def chiave(vecchia, nuova, trad=None):   # cambia una chiave di en.json (testo italiano cambiato)
    v = E.pop(vecchia); E[nuova] = trad(v) if trad else v

# ✕ ora in alto a destra
for k in ('app.js', 'index.html', 'aiuto.json', 'manuale-client.html'): sost(k, '✕ in alto a sinistra', '✕ in alto a destra')
for k in ('lingua/en/aiuto.json', 'manuale-client.en.html'): sost(k, '✕ at the top left', '✕ at the top right')
for k in [x for x in E if '✕ in alto a sinistra' in x]: chiave(k, k.replace('✕ in alto a sinistra', '✕ in alto a destra'), lambda v: v.replace('✕ at the top left', '✕ at the top right'))

# Multischermo
sost('aiuto.json', '«⧉ Nuova finestra» (un\'altra finestra', '«Multischermo» (un\'altra finestra')
sost('lingua/en/aiuto.json', '“⧉ New window” (another window', '“Multi-screen” (another window')
sost('manuale-client.html', 'nuova finestra,', 'multischermo,') if 'nuova finestra,' in T['manuale-client.html'] else None
sost('manuale-client.en.html', 'new window, link windows', 'multi-screen, link windows')

# testo delle misure spostabile e layout 2×1
sost('aiuto.json', '"RECIST 1.1: una sola misura.', '"Testo delle misure (distanza, RECIST, ROI, angolo, freccia, Cobb): si trascina con il mouse dove dà meno fastidio, una linea tratteggiata lo collega alla misura; vale anche nell\'MPR.",\n      "RECIST 1.1: una sola misura.')
sost('lingua/en/aiuto.json', '"RECIST 1.1: a single measurement.', '"Measurement text (distance, RECIST, ROI, angle, arrow, Cobb): drag it with the mouse where it is least in the way, a dashed line links it to the measurement; this also works in the MPR.",\n      "RECIST 1.1: a single measurement.')
sost('aiuto.json', 'lo chiude e gli altri si allargano."', 'lo chiude e gli altri si allargano. «▢ 2×1» mette due riquadri uno sopra l\'altro, per gli schermi verticali."')
sost('lingua/en/aiuto.json', 'closes it and the others widen."', 'closes it and the others widen. “▢ 2×1” places two viewports one above the other, for vertical screens."')
sost('manuale-client.html', '      <li><b>RECIST 1.1</b>:', "      <li>Il <b>testo</b> di ogni misura si trascina dove si vuole: una linea tratteggiata lo collega alla misura.</li>\n      <li><b>RECIST 1.1</b>:")
sost('manuale-client.en.html', '      <li><b>RECIST 1.1</b>:', "      <li>The <b>text</b> of each measurement can be dragged wherever you like: a dashed line links it to the measurement.</li>\n      <li><b>RECIST 1.1</b>:")

# MPR: disposizione Esaote, clic sul centro, zoom con la rotellina premuta
sost('aiuto.json', 'con il piano (assiale, coronale, sagittale, obliquo)."', 'con il piano (assiale, coronale, sagittale, obliquo). La disposizione è come nelle console Esaote: i tre piani in colonna a sinistra (assiale, coronale, sagittale) e il 3D grande a destra. Con le linee di riferimento un clic su un punto porta lì il centro; come nel 2D, rotellina premuta su = ingrandisci e giù = rimpicciolisci, Maiusc + trascina = sposta (anche nel 3D), destro = finestra."')
sost('lingua/en/aiuto.json', 'with the plane (axial, coronal, sagittal, oblique)."', 'with the plane (axial, coronal, sagittal, oblique). The layout is as on Esaote consoles: the three planes in a column on the left (axial, coronal, sagittal) and the large 3D on the right. With the reference lines a click on a point moves the center there; as in 2D, wheel button up = zoom in and down = zoom out, Shift + drag = pan (also in 3D), right button = window."')
m = re.search(r'<p class="aiuto" id="aiuto-mpr" hidden>(.*?)</p>', T['index.html'], re.S); vecchio = m.group(1)
nuovo = vecchio.replace('Rotellina premuta: zoom', 'Clic su un punto: centro delle linee di riferimento · Rotellina premuta su/giù: ingrandisci/rimpicciolisci')
assert nuovo != vecchio
sost('index.html', vecchio, nuovo)
kv = re.sub(r'\s+', ' ', vecchio).strip()
chiave(kv, re.sub(r'\s+', ' ', nuovo).strip(), lambda v: v.replace('Wheel button: zoom', 'Click on a point: reference lines center · Wheel button up/down: zoom in/out').replace('Pressed wheel: zoom', 'Click on a point: reference lines center · Wheel button up/down: zoom in/out'))
print('aiuto-mpr EN:', E[re.sub(r'\s+', ' ', nuovo).strip()][:400])

T['lingua/en.json'] = json.dumps(E, ensure_ascii=False, separators=(',', ':'))
for k in ('aiuto.json', 'lingua/en/aiuto.json'): json.loads(T[k])
for n in N: open(W + n, 'w', encoding='utf-8').write(T[n])
print('ok')
