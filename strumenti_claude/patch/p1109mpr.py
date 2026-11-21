import shutil
M = '/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js'
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
shutil.copy(M, M + '.bak_1109mpr')
for f in ('style.css', 'app.js'): shutil.copy(W + f, W + f + '.bak_1109mpr')
s = open(M, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:110], s.count(a)); s = s.replace(a, b)

sost("  EllipticalROITool, LengthTool, AngleTool, ProbeTool, BidirectionalTool, annotation as annotazioni,\n} from '@cornerstonejs/tools';",
     "  EllipticalROITool, LengthTool, AngleTool, ProbeTool, BidirectionalTool, annotation as annotazioni, cursors as cursori,\n} from '@cornerstonejs/tools';")
# rotellina premuta: su = ingrandisci, giù = rimpicciolisci (come nel 2D)
sost("  g.addTool(PanTool.toolName);\n  g.addTool(ZoomTool.toolName);\n  g.addTool(StackScrollTool.toolName);",
     """  g.addTool(PanTool.toolName);
  g.addTool(ZoomTool.toolName, { invert: true });
  g.addTool(StackScrollTool.toolName);
  // «scorri»: il puntatore resta la freccia normale
  const cursoreDi = g._getCursor.bind(g);
  g._getCursor = (nome, strategia) => (nome === StackScrollTool.toolName ? cursori.MouseCursor.getDefinedCursor('default') : cursoreDi(nome, strategia));
  // linee di riferimento: un clic (senza trascinare) su un punto porta lì il centro, negli altri piani
  for (const id of mpr) {
    const el = motore.getViewport(id).element; let giu = null;
    const down = (e) => { giu = e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey ? [e.clientX, e.clientY] : null; };
    const up = (e) => {
      const g0 = giu; giu = null;
      if (!g0 || e.button !== 0 || cpr || strumentoAttivo !== CrosshairsTool.toolName || Math.hypot(e.clientX - g0[0], e.clientY - g0[1]) > 3) return;
      const vp = motore?.getViewport(id); if (!vp) return;
      const r = el.getBoundingClientRect(), w = vp.canvasToWorld([e.clientX - r.left, e.clientY - r.top]);
      if (w?.every(Number.isFinite)) vaiAlPunto([...w]);
    };
    el.addEventListener('mousedown', down); el.addEventListener('mouseup', up);
    CLIC_CENTRO.push([el, 'mousedown', down], [el, 'mouseup', up]);
  }""")
sost("let suMisura = null;     // richiamata quando lo specializzando completa una misura",
     "let suMisura = null;     // richiamata quando lo specializzando completa una misura\nconst CLIC_CENTRO = [];  // ascoltatori del clic che sposta il centro delle linee di riferimento")
# 3D: rotellina premuta = zoom (come nel 2D), Maiusc + sinistro = sposta; con «Sposta» o «Ingrandisci» scelti, anche il sinistro
sost("  g3.addTool(ZoomTool.toolName);\n  g3.addTool(PanTool.toolName);\n  g3.setToolActive(TrackballRotateTool.toolName, { bindings: [{ mouseButton: MouseBindings.Primary }] });\n  g3.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: MouseBindings.Secondary }, { mouseButton: MouseBindings.Wheel }] });\n  g3.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: MouseBindings.Auxiliary }] });",
     "  g3.addTool(ZoomTool.toolName, { invert: true });\n  g3.addTool(PanTool.toolName);\n  strumento3d(strumentoAttivo);")
sost("/** Strumento sul tasto sinistro nelle tre viste MPR: 'crosshair' | 'wl' | 'pan' | 'zoom' */\nexport function strumento(nome) {",
     """// tasti del mouse nel 3D: sinistro ruota (o sposta / ingrandisce se è lo strumento scelto), destro e rotellina zoom,
// rotellina premuta zoom (su = ingrandisci), Maiusc + sinistro sposta
function strumento3d(t) {
  const g3 = ToolGroupManager.getToolGroup(ID_GRUPPO_3D); if (!g3) return;
  const sx = t === PanTool.toolName ? PanTool.toolName : t === ZoomTool.toolName ? ZoomTool.toolName : TrackballRotateTool.toolName;
  const base = { [TrackballRotateTool.toolName]: [], [ZoomTool.toolName]: [{ mouseButton: MouseBindings.Secondary }, { mouseButton: MouseBindings.Wheel }, { mouseButton: MouseBindings.Auxiliary }],
    [PanTool.toolName]: [{ mouseButton: MouseBindings.Primary, modifierKey: KeyboardBindings.Shift }] };
  for (const [nome, b] of Object.entries(base)) { const l = nome === sx ? [{ mouseButton: MouseBindings.Primary }, ...b] : b; try { if (l.length) g3.setToolActive(nome, { bindings: l }); else g3.setToolPassive(nome); } catch {} }
}
/** Strumento sul tasto sinistro nelle tre viste MPR: 'crosshair' | 'wl' | 'pan' | 'zoom' */
export function strumento(nome) {""")
sost("  g.setToolActive(t, { bindings: [{ mouseButton: MouseBindings.Primary }, ...(fissi[t] || [])] });\n}",
     "  g.setToolActive(t, { bindings: [{ mouseButton: MouseBindings.Primary }, ...(fissi[t] || [])] });\n  strumento3d(t);\n}")
# chiusura: via gli ascoltatori del clic
sost("export function chiudi() {", "export function chiudi() {\n  for (const [el, tipo, f] of CLIC_CENTRO.splice(0)) el.removeEventListener(tipo, f);")
# solo per i test: posizione dei testi delle misure
sost("/** misure fatte nell'MPR (per portarle nel referto) */",
     "/** Solo per i test: testi delle misure (posizione nel mondo e se spostati) e scala delle viste */\nexport const _testi = () => annotazioni.state.getAllAnnotations().filter((a) => MISURE().includes(a.metadata?.toolName)).map((a) => ({ tool: a.metadata.toolName, tb: a.data.handles.textBox?.worldPosition ? [...a.data.handles.textBox.worldPosition] : null, mosso: !!a.data.handles.textBox?.hasMoved }));\nexport const _scala = (q = 'assiale') => motore?.getViewport(VP[q])?.getCamera()?.parallelScale ?? null;\n/** misure fatte nell'MPR (per portarle nel referto) */")
open(M, 'w', encoding='utf-8').write(s)

# ---- disposizione «Esaote»: tre piani piccoli a sinistra (assiale, coronale, sagittale), il riquadro grande a destra
c = open(W + 'style.css', encoding='utf-8').read()
c += """
/* MPR + 3D come nelle console Esaote: i tre piani MPR in colonna a sinistra, il riquadro grande a destra (3D) */
@media (min-width:800px){
  .mpr:not(.solo){grid-template-columns:minmax(0,1fr) minmax(0,2.2fr);grid-template-rows:repeat(3,minmax(0,1fr))}
  .mpr:not(.solo)>.mpr-cella{min-height:120px}
  .mpr:not(.solo)>.mpr-cella:has(#vp-assiale){grid-column:1;grid-row:1}
  .mpr:not(.solo)>.mpr-cella:has(#vp-coronale){grid-column:1;grid-row:2}
  .mpr:not(.solo)>.mpr-cella:has(#vp-sagittale){grid-column:1;grid-row:3}
  .mpr:not(.solo)>.mpr-cella:has(#vp-3d){grid-column:2;grid-row:1 / span 3}
}
"""
open(W + 'style.css', 'w', encoding='utf-8').write(c)
print('ok')
