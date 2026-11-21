import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1107q')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

sost("""const SCHEMI = [
  { nome: 'TC: fasi affiancate',""", """const SCHEMI = [
  // per distretto (prima questi: la disposizione automatica sceglie quello del distretto dell'esame)
  { nome: 'RM prostata: T2 · DWI · ADC · DCE', mod: /RM/, dist: /prostat/i, cat: [['T2', /T2/i], ['DWI', /DWI|diff|trace|b\\s?-?(1[0-9]{3}|2000)|calc/i], ['ADC', /ADC/i], ['DCE', /DCE|dinam|dyn|perf|twist|T1.*(mdc|post|gd)/i]] },
  { nome: 'RM encefalo: FLAIR · DWI · ADC · T1 mdc', mod: /RM/, dist: /encef|cranio|cerebr|brain|head/i, cat: [['FLAIR', /FLAIR|T2/i], ['DWI', /DWI|diff|trace|b\\s?1000/i], ['ADC', /ADC/i], ['T1 mdc', /T1.*(mdc|post|gd|\\+c|contr)|(mdc|post|gd).*T1/i]] },
  { nome: 'RM fegato: T2 · DWI · arteriosa · tardiva', mod: /RM/, dist: /fegat|epat|liver/i, cat: [['T2', /T2/i], ['DWI', /DWI|diff|b\\s?\\d{3}/i], ['Arteriosa', /arter/i], ['Tardiva', /epatobil|hepatobil|20 ?min|tardiv|portal/i]] },
  { nome: 'RM mammella: T1 pre · T1 post · sottrazione · T2', mod: /RM/, dist: /mamm|breast|seno/i, cat: [['Sottrazione', /sub|sottraz/i], ['T1 post', /post|mdc|gd|dyn|dinam/i], ['T1 pre', /pre\\b|basal|senza mdc|T1/i], ['T2', /T2|STIR/i]] },
  { nome: 'TC torace: mediastino · polmone', mod: /TC/, dist: /torac|polmon|chest|lung/i, finestre: [[40, 400, 'mediastino'], [-600, 1500, 'polmone']] },
  { nome: 'TC: fasi affiancate',""")
# serie dello schema: per le due finestre, la stessa serie (la più fine, non quella per l'osso) due volte
sost("""function serieSchema(sc) {
  const ultimo""", """function serieSchema(sc) {
  if (sc.finestre) {
    const cand = V.serie.map((s, i) => [s, i]).filter(([s]) => s.files.length >= 20 && !/scout|topogram|loc|survey|mip|osso|bone|mpr|coron|sagit/i.test(s.descrizione))
      .sort((a, b) => b[0].files.length - a[0].files.length);
    return cand.length ? sc.finestre.map(() => cand[0][1]) : [];
  }
  const ultimo""")
sost("""  for (const sc of SCHEMI) {
    const lista = serieSchema(sc);
    if (lista.length < 2 || (!sc.mod.test(mod) && !V.serie.some((s) => sc.mod.test(s.regione || '')))) continue;
    const b = Object.assign(document.createElement('button'), { textContent: sc.nome, title: lista.map((i) => V.serie[i].descrizione).join(' · ') });""",
"""  const dove = [V.caso?.distretto, V.caso?.titolo, ...V.serie.map((s) => `${s.regione || ''} ${s.descrizione || ''}`)].join(' ');
  for (const sc of SCHEMI) {
    if (sc.dist && !sc.dist.test(dove)) continue;
    const lista = serieSchema(sc);
    if (lista.length < 2 || (!sc.mod.test(mod) && !V.serie.some((s) => sc.mod.test(s.regione || '')))) continue;
    const b = Object.assign(document.createElement('button'), { textContent: sc.nome, title: sc.finestre ? `${V.serie[lista[0]].descrizione}: finestra per il mediastino e per il polmone, sincronizzate` : lista.map((i) => V.serie[i].descrizione).join(' · ') });
    if (sc.dist) b.dataset.auto = '1';""")
sost("""      for (let k = 0; k < lista.length; k++) await selezionaSerie(lista[k], k);
      box.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === b));
      evidenziaSerie(); await sincronizzaDa(0);
    };
    box.appendChild(b);
  }""", """      for (let k = 0; k < lista.length; k++) await selezionaSerie(lista[k], k);
      if (sc.finestre) { sc.finestre.forEach(([wc, ww], k) => { const p = P(k); p.wc = wc; p.ww = ww; }); disegna(); }
      box.querySelectorAll('button').forEach((y) => y.classList.toggle('on', y === b));
      evidenziaSerie(); await sincronizzaDa(0);
    };
    box.appendChild(b);
  }""")
# disposizione automatica: prima lo schema del distretto, poi le fasi affiancate o le sequenze RM
sost("""    const b = [...qsAll('#ws-fasi button')].find((x) => /fasi affiancate|T1 · T2/.test(x.textContent));""",
     """    const b = qs1('#ws-fasi button[data-auto="1"]') || [...qsAll('#ws-fasi button')].find((x) => /fasi affiancate|T1 · T2/.test(x.textContent));""")
# piattaforma: la disposizione automatica vale anche quando il docente ha lasciato un solo riquadro senza disposizione
sost("      if (!(V.caso?.disposizione || []).length && !Number.isInteger(V.caso?.riquadri)) await disposizioneClient();",
     "      if (!(V.caso?.disposizione || []).length && !(V.caso?.riquadri > 1)) await disposizioneClient();")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
