"""Applica a web/app.js la visualizzazione della seconda lettura dei noduli (noduli_ia.py)."""
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()

vecchio = """    r.push(!n.length ? '<b>Noduli polmonari</b>: nessuno trovato dall\\'IA' : `<b>Noduli polmonari</b> (seconda lettura IA, con falsi positivi: vasi, cupola epatica, basi polmonari): ${n.length}; i più grandi ${n.slice(0, 4).map((x) => `${mm1(x.diametro_medio_mm)} (${Math.round(x.volume_mm3)} mm³)`).join(', ')}${n[0].diametro_medio_mm >= 8 ? ' — il maggiore ≥ 8 mm: valuta Fleischner o Lung-RADS (Σ Scale)' : ''}`);
  }"""
nuovo = """    if (an.noduli_metodo) {
      // seconda lettura con due modelli (strumenti/noduli_ia.py): tipo, lobo, Lung-RADS e «vai al nodulo»
      const tipo = { solido: 'solido', 'parzialmente solido': 'parzialmente solido', 'vetro smerigliato': 'a vetro smerigliato' };
      r.push(!n.length ? '<b>Noduli polmonari</b>: nessuno trovato dai due modelli IA' : '<b>Noduli polmonari</b> (seconda lettura IA con due modelli, TotalSegmentator e MONAI: ● trovato da entrambi, ○ da uno solo; può sbagliare, controlla sempre sulle immagini):'
        + `<ol class="ia-noduli">${n.map((x) => `<li>${x.modelli === 'entrambi' ? '●' : '○'} <b>${mm1(x.diametro_medio_mm)}</b> (${mm1(x.A).replace(' mm', '')} × ${mm1(x.B)}), ${tipo[x.tipo] || esc(x.tipo || '')}${x.tipo === 'parzialmente solido' ? `, componente solida ${mm1(x.solido_mm)}` : ''} · lobo ${esc(x.lobo || '—')} · <b>Lung-RADS ${esc(x.lung_rads || '—')}</b>${x.vicino_soglia ? ' <span class="muted small" title="Con 1 mm di differenza nella misura la categoria cambierebbe">(vicino alla soglia)</span>' : ''} ${x.centro_lps ? `<button type="button" class="ghost piccolo ia-nodulo" data-p="${x.centro_lps.join(',')}" title="Porta i piani sul nodulo">vai · img ${x.immagine}</button>` : `· img ${x.immagine}`}</li>`).join('')}</ol>`
        + '<span class="muted small">Lung-RADS v2022 come primo esame di screening (senza precedenti); diametro = media di asse lungo e corto. Per i noduli incidentali fuori dallo screening vale Fleischner (Σ Scale).</span>');
    } else
    r.push(!n.length ? '<b>Noduli polmonari</b>: nessuno trovato dall\\'IA' : `<b>Noduli polmonari</b> (seconda lettura IA, con falsi positivi: vasi, cupola epatica, basi polmonari): ${n.length}; i più grandi ${n.slice(0, 4).map((x) => `${mm1(x.diametro_medio_mm)} (${Math.round(x.volume_mm3)} mm³)`).join(', ')}${n[0].diametro_medio_mm >= 8 ? ' — il maggiore ≥ 8 mm: valuta Fleischner o Lung-RADS (Σ Scale)' : ''}`);
  }"""
assert s.count(vecchio) == 1, "blocco dei noduli non trovato"
s = s.replace(vecchio, nuovo)

ancora = "// le stesse analisi in tutti gli esami del caso (una serie per esame): ventricoli, emorragia, versamenti nei controlli"
assert s.count(ancora) == 1
gestore = """// «vai al nodulo» della seconda lettura IA: in MPR sposta i tre piani, nel 2D va all'immagine più vicina
document.addEventListener('click', async (e) => {
  const b = e.target.closest?.('.ia-nodulo'); if (!b) return;
  const w = b.dataset.p.split(',').map(Number); if (w.length !== 3 || w.some((x) => !Number.isFinite(x))) return;
  if (MPR.attivo && MPR.modulo?.vaiAlPunto) { MPR.modulo.vaiAlPunto(w); return; }
  const k = V.attivo, p = P(k); if (!p?.frames?.length) return;
  const t = await fettaVicina(p.frames, applica(offsetDi(p.img?.for), w), null).catch(() => null);
  if (t && t.i !== p.idx) await mostraDi(k, t.i);
});
"""
s = s.replace(ancora, gestore + ancora)
open(p, "w", encoding="utf-8").write(s)
print("ok")
