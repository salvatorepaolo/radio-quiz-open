import shutil, json, re
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
N = ['aiuto.json', 'lingua/en/aiuto.json', 'manuale-client.html', 'manuale-client.en.html', 'index.html', 'lingua/en.json']
for n in N: shutil.copy(W + n, W + n + '.bak_1109disp')
T = {n: open(W + n, encoding='utf-8').read() for n in N}
def sost(k, a, b, n=1):
    assert T[k].count(a) == n, (k, a[:100], T[k].count(a)); T[k] = T[k].replace(a, b)

# disposizione attuale dell'MPR: grande a sinistra, tre piccole a destra, clic su una piccola = nel riquadro grande
sost('aiuto.json', "La disposizione è come nelle console Esaote: i tre piani in colonna a sinistra (assiale, coronale, sagittale) e il 3D grande a destra. Con le linee di riferimento un clic su un punto porta lì il centro;",
     "Il riquadro grande è a sinistra (all'apertura il 3D), le altre tre viste in colonna a destra: un clic su una vista piccola la porta nel riquadro grande (e manda quella grande al suo posto). Nella vista grande, con le linee di riferimento, un clic su un punto porta lì il centro;")
sost('lingua/en/aiuto.json', "The layout is as on Esaote consoles: the three planes in a column on the left (axial, coronal, sagittal) and the large 3D on the right. With the reference lines a click on a point moves the center there;",
     "The large viewport is on the left (3D at opening), the other three views in a column on the right: a click on a small view brings it into the large viewport (and sends the large one to its place). In the large view, with the reference lines, a click on a point moves the center there;")
sost('manuale-client.html', "Disposizione come nelle console Esaote: i tre piani in colonna a sinistra, il 3D grande a destra (doppio clic: ingrandisci una vista). Con le linee di riferimento un clic su un punto porta lì il centro.",
     "Il riquadro grande è a sinistra (all'apertura il 3D), le altre tre viste in colonna a destra: un clic su una vista piccola la porta nel riquadro grande; doppio clic: ingrandisci una vista. Nella vista grande, con le linee di riferimento, un clic su un punto porta lì il centro.")
sost('manuale-client.en.html', "Layout as on Esaote consoles: the three planes in a column on the left, the large 3D on the right (double click: enlarge a view). With the reference lines a click on a point moves the center there.",
     "The large viewport is on the left (3D at opening), the other three views in a column on the right: a click on a small view brings it into the large viewport; double click: enlarge a view. In the large view, with the reference lines, a click on a point moves the center there.")
# Multischermo ora è un pulsante della barra (non più nel menu ⋯)
sost('manuale-client.html', 'ci sono le funzioni meno usate: multischermo, collega finestre,', 'ci sono le funzioni meno usate: collega finestre,')
sost('manuale-client.en.html', 'holds the less used functions: multi-screen, link windows,', 'holds the less used functions: link windows,')
sost('manuale-client.html', '<b>Multischermo</b> apre', '<b>Multischermo</b> (pulsante con i due monitor nella barra) apre')
sost('manuale-client.en.html', '<b>Multi-screen</b> opens', '<b>Multi-screen</b> (button with two monitors in the bar) opens')
# aiuto breve dell'MPR
E = json.loads(T['lingua/en.json'])
m = re.search(r'<p class="aiuto" id="aiuto-mpr" hidden>(.*?)</p>', T['index.html'], re.S); vecchio = m.group(1)
nuovo = vecchio.replace('Clic su un punto: centro delle linee di riferimento', 'Clic su una vista piccola: nel riquadro grande · Clic su un punto della vista grande: centro delle linee di riferimento')
assert nuovo != vecchio; sost('index.html', vecchio, nuovo)
kv = re.sub(r'\s+', ' ', vecchio).strip(); v = E.pop(kv)
E[re.sub(r'\s+', ' ', nuovo).strip()] = v.replace('Click on a point: reference lines center', 'Click on a small view: into the large viewport · Click on a point of the large view: reference lines center')
assert 'Click on a small view' in E[re.sub(r'\s+', ' ', nuovo).strip()]
E['Clic: porta questa vista nel riquadro grande'] = 'Click: bring this view into the large viewport'
T['lingua/en.json'] = json.dumps(E, ensure_ascii=False, separators=(',', ':'))
for k in ('aiuto.json', 'lingua/en/aiuto.json'): json.loads(T[k])
for n in N: open(W + n, 'w', encoding='utf-8').write(T[n])
print('ok')
