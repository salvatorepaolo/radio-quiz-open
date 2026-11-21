import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
shutil.copy(A, A + '.bak_1107v')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)
# «riquadri 0» nell'editor vuol dire «automatico»: la disposizione automatica vale anche lì
sost("  const auto = !disp.length && !Number.isInteger(V.caso.riquadri) && !window.matchMedia('(max-width: 700px)').matches ? protocolloAutomatico() : null;",
     "  const auto = !disp.length && !(V.caso.riquadri >= 1) && !window.matchMedia('(max-width: 700px)').matches ? protocolloAutomatico() : null;\n  V.protoAuto = !!auto;")
sost("    if ((V.caso.disposizione || []).length || Number.isInteger(V.caso.riquadri) || !$('#ws-mg').hidden) return;",
     "    if ((V.caso.disposizione || []).length || V.caso.riquadri >= 1 || V.protoAuto || !$('#ws-mg').hidden) return;")
sost("      if (!(V.caso?.disposizione || []).length && !(V.caso?.riquadri > 1)) await disposizioneClient();",
     "      if (!(V.caso?.disposizione || []).length && !(V.caso?.riquadri >= 1) && !V.protoAuto) await disposizioneClient();")
# RM per distretto (prostata, encefalo, fegato, mammella): le sequenze tipiche dello schema del distretto
sost("""  if (met === 'RM') {
    // nella RM il piano principale""", """  if (met === 'RM') {
    const dove = [V.caso?.distretto, V.caso?.titolo, ...V.serie.map((s) => `${s.regione || ''} ${s.descrizione || ''}`)].join(' ');
    const sc = SCHEMI.find((x) => x.dist && !x.finestre && x.mod.test('RM') && x.dist.test(dove));
    if (sc) { const l = serieSchema(sc).filter((si) => !ult || studioDi(V.serie[si]).id === ult.id); if (l.length >= 2) return Object.assign(l.map((si) => ({ si })), { nota: sc.nome }); }
    // nella RM il piano principale""")
sost("finestre: [[40, 400, 'mediastino'], [-600, 1500, 'polmone']] }", "finestre: [[-600, 1500, 'polmone'], [40, 400, 'mediastino']] }")
sost("{ nome: 'TC torace: mediastino · polmone',", "{ nome: 'TC torace: polmone · mediastino',")
sost("`${V.serie[lista[0]].descrizione}: finestra per il mediastino e per il polmone, sincronizzate`", "`${V.serie[lista[0]].descrizione}: finestra per il polmone e per il mediastino, sincronizzate`")
open(A, 'w', encoding='utf-8').write(s)
print('ok')
