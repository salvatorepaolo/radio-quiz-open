M = '/Volumes/Caloggero/piattaforma-quiz/cloud/mpr3d/mpr3d.src.js'
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
s = open(M, encoding='utf-8').read()
def sost(t, a, b):
    assert t.count(a) == 1, a[:80]; return t.replace(a, b)
s = sost(s, "  ic /= nc; const soglia = ct ? Math.max(100, (ic + 20) / 2) : ic / 2;\n  const rl = [], re = [], ia = iaVaso && etichettaIn(c) === iaVaso.id;",
  "  ic /= nc; const soglia = ct ? Math.max(100, (ic + 20) / 2) : ic / 2, opac = !ct || ic >= 150;   // TC senza contrasto: il lume non si distingue\n  const rl = [], re = [], ia = iaVaso && etichettaIn(c) === iaVaso.id;\n  if (!opac && !ia) return null;")
s = sost(s, "  const rL = taglia(rl), rE = ia ? taglia(re).map((x, t) => Math.max(x, rL[t])) : rL;",
  "  const rL = opac ? taglia(rl) : null, rE = ia ? taglia(re).map((x, t) => Math.max(x, rL ? rL[t] : 0)) : rL;")
s = sost(s, "  const e = diam(rE), l = diam(rL);", "  const e = diam(rE), l = rL ? diam(rL) : { dmax: null };")
s = sost(s, "  return { rE, rL, ia, dmax: e.dmax,", "  return { rE, rL, ia, opac, dmax: e.dmax,")
s = sost(s, "    out.contorno = m.rE.map((r, t) => px(r, t)); out.lume = m.ia ? m.rL.map((r, t) => px(r, t)) : null;",
  "    out.contorno = m.rE.map((r, t) => px(r, t)); out.lume = m.ia && m.rL ? m.rL.map((r, t) => px(r, t)) : null;")
s = sost(s, "  const ia = val.filter((x) => x.ia).length > val.length / 2;\n  return { ok: true, profilo: out,",
  "  const ia = val.filter((x) => x.ia).length > val.length / 2, opac = val.filter((x) => x.dlume != null).length > val.length / 2;\n  if (!val.length) return { ok: false, motivo: 'TC senza contrasto e vaso non segmentato: il lume non si distingue' };\n  return { ok: true, opac, profilo: out,")
open(M, 'w', encoding='utf-8').write(s)
a = open(W + 'app.js', encoding='utf-8').read()
a = sost(a, "su ? k.lineTo(X(x.s), Y(x[campo])) : k.moveTo(X(x.s), Y(x[campo])); su = true; } k.stroke(); k.setLineDash([]); };\n  if (r.parete === 'ia') linea('dlume', '#7ee787', true);",
  "su ? k.lineTo(X(x.s), Y(x[campo])) : k.moveTo(X(x.s), Y(x[campo])); su = true; } k.stroke(); k.setLineDash([]); };\n  if (r.parete === 'ia' && r.opac) linea('dlume', '#7ee787', true);")
a = sost(a, "for (const x of r.profilo) { if (!x) { su = false; continue; } su ? k.lineTo(X(x.s), Y(x[campo])) : k.moveTo(X(x.s), Y(x[campo])); su = true; } k.stroke(); k.setLineDash([]); };\n  if (r.parete === 'ia' && r.opac)",
  "for (const x of r.profilo) { if (!x || x[campo] == null) { su = false; continue; } su ? k.lineTo(X(x.s), Y(x[campo])) : k.moveTo(X(x.s), Y(x[campo])); su = true; } k.stroke(); k.setLineDash([]); };\n  if (r.parete === 'ia' && r.opac)")
a = sost(a, "(r.parete === 'ia' ? `parete esterna dalla segmentazione IA, trombo compreso; lume opacizzato ${mm(m.dlume)} mm. ` : 'misurato sul lume opacizzato (senza trombo). ')",
  "(r.parete === 'ia' ? `parete esterna dalla segmentazione IA, trombo compreso; ${m.dlume != null ? `lume opacizzato ${mm(m.dlume)} mm` : 'lume non opacizzato (fase senza contrasto)'}. ` : 'misurato sul lume opacizzato (senza trombo). ')")
a = sost(a, "${r.parete === 'ia' ? ` (lume opacizzato ${mm(m.dlume)} mm)` : ''}", "${r.parete === 'ia' && m.dlume != null ? ` (lume opacizzato ${mm(m.dlume)} mm)` : ''}")
a = sost(a, "${r.parete === 'ia' ? ' · <span style=\"color:#7ee787\">- - lume</span>' : ''}", "${r.parete === 'ia' && r.opac ? ' · <span style=\"color:#7ee787\">- - lume</span>' : ''}")
open(W + 'app.js', 'w', encoding='utf-8').write(a)
c = open(W + 'style.css', encoding='utf-8').read()
c = sost(c, "#cpr-sezione{width:120px;height:120px;", "#cpr-sezione{width:110px;height:110px;")
c = sost(c, ".cpr-analisi{max-height:52%;overflow:auto}", ".cpr-analisi{max-height:44%;overflow:auto;flex:none}\n.cpr-analisi #cpr-profilo{height:72px}\n.cpr-guida{flex-wrap:wrap;max-width:96%;justify-content:center}\n.cpr-guida button{white-space:nowrap}\n.cpr-guida #cpr-testo{max-width:220px}\n.cpr-guida select{background:#1f2630;color:#f5f7fa;border:1px solid #4a5563;border-radius:6px;padding:3px 6px;max-width:190px}")
open(W + 'style.css', 'w', encoding='utf-8').write(c)
print('ok')
