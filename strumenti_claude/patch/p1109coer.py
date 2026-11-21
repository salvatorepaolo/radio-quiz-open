import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
M = '/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js'
F = {'mi': W + 'manuale-client.html', 'me': W + 'manuale-client.en.html', 'm': M}
for f in F.values(): shutil.copy(f, f + '.bak_1109coer')
T = {k: open(f, encoding='utf-8').read() for k, f in F.items()}
def sost(k, a, b, n=1):
    assert T[k].count(a) == n, (k, a[:100], T[k].count(a)); T[k] = T[k].replace(a, b)

# manuale: «Multischermo» al posto di «Nuova finestra»
sost('mi', 'esporta, nuova finestra.', 'esporta, multischermo.')
sost('me', 'export, new window.', 'export, multi-screen.')
sost('mi', '<b>⧉ Nuova finestra</b> apre', '<b>Multischermo</b> apre')
sost('me', '<b>⧉ New window</b> opens', '<b>Multi-screen</b> opens')
# manuale: disposizione dell'MPR e comandi come nel 2D
sost('mi', "tolgono le strutture che coprono la vista.</p>",
     "tolgono le strutture che coprono la vista.</p>\n    <p>Disposizione come nelle console Esaote: i tre piani in colonna a sinistra, il 3D grande a destra (doppio clic: ingrandisci una vista). Con le linee di riferimento un clic su un punto porta lì il centro. I comandi sono quelli del 2D: rotellina premuta su/giù = ingrandisci/rimpicciolisci, Maiusc + trascina = sposta (anche nel 3D), destro = finestra; il testo delle misure si trascina.</p>")
sost('me', 'remove the structures that obstruct the view.</p>',
     "remove the structures that obstruct the view.</p>\n    <p>Layout as on Esaote consoles: the three planes in a column on the left, the large 3D on the right (double click: enlarge a view). With the reference lines a click on a point moves the center there. The controls are those of 2D: wheel button up/down = zoom in/out, Shift + drag = pan (also in 3D), right button = window; measurement text can be dragged.</p>")

# MPR: stessa sensibilità dello zoom del 2D (circa ×1,3 ogni 40 pixel di trascinamento, qualunque sia la grandezza della vista)
sost('m', "  const cursoreDi = g._getCursor.bind(g);",
     "  zoomCome2D(g);\n  const cursoreDi = g._getCursor.bind(g);")
sost('m', "  g3.addTool(PanTool.toolName);\n  strumento3d(strumentoAttivo);",
     "  g3.addTool(PanTool.toolName);\n  zoomCome2D(g3);\n  strumento3d(strumentoAttivo);")
sost('m', "// tasti del mouse nel 3D:",
     """// zoom trascinando: Cornerstone cambia la scala di 5 × spostamento / altezza della vista (nelle viste piccole a sinistra
// troppo veloce); qui come nel 2D: exp(−spostamento / 150 px)
function zoomCome2D(gr) {
  try {
    const z = gr.getToolInstance(ZoomTool.toolName), orig = z?._dragParallelProjection; if (!orig || z._come2d) return; z._come2d = true;
    z._dragParallelProjection = (evt, vp, cam, pinch = false) => {
      if (pinch) return orig(evt, vp, cam, pinch);
      const d = evt.detail, f = (d.element?.clientHeight || 400) / 750, dp = d.deltaPoints;
      return orig({ detail: { ...d, deltaPoints: { ...dp, canvas: [dp.canvas[0] * f, dp.canvas[1] * f] } } }, vp, cam, pinch);
    };
  } catch {}
}
// tasti del mouse nel 3D:""")
for k, f in F.items(): open(f, 'w', encoding='utf-8').write(T[k])
print('ok')
