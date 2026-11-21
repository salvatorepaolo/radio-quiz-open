import shutil
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
A, C = W + 'app.js', W + 'style.css'
for f in (A, C): shutil.copy(f, f + '.bak_1108referto')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:100], s.count(a)); s = s.replace(a, b)

# finestra separata vera (window.open) invece del «picture in picture»: ha i normali pulsanti della finestra
# (ingrandisci, schermo intero) e si può spostare su un altro monitor; il pulsante ⛶ mette a schermo intero
sost("""  if (!('documentPictureInPicture' in window)) {
    const era = dlg.open; if (era) dlg.close(); dlg.classList.add('affiancato'); if (era) dlg.show();
    scriviPrefFinestraRef('affiancato'); $('#ref-finestra').textContent = '⧉ Rimetti nella pagina'; return;
  }
  const w = await documentPictureInPicture.requestWindow({ width: Math.round(Math.min(1050, screen.availWidth * 0.55)), height: Math.round(Math.min(1000, screen.availHeight - 60)) });
  FIN_REF.win = w;""", """  const w = window.open('', 'rq-referto-' + Date.now(), `popup,width=${Math.round(Math.min(1250, screen.availWidth * 0.7))},height=${Math.round(Math.min(1000, screen.availHeight - 60))}`);
  if (!w) {   // finestre popup bloccate: il referto si affianca nella pagina
    avvisoBreve('Il browser ha bloccato la finestra: consenti le finestre popup per questo sito. Intanto il referto si affianca.');
    const era = dlg.open; if (era) dlg.close(); dlg.classList.add('affiancato'); if (era) dlg.show();
    scriviPrefFinestraRef('affiancato'); $('#ref-finestra').textContent = '⧉ Rimetti nella pagina'; return;
  }
  w.document.open(); w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Referto · radio-quiz</title></head><body></body></html>'); w.document.close();
  FIN_REF.win = w;""")
# il ritorno nella pagina deve avvenire subito alla chiusura (spostato più tardi i pulsanti non rispondono più)
sost("""  w.addEventListener('pagehide', () => {
    fermaDettaturaCl(); salvaBozzaReferto();
    try { dlg.close(); } catch {}
    dlg.classList.remove('in-finestra'); document.body.append(dlg); FIN_REF.win = null;
    $('#ref-finestra').textContent = '⧉ Finestra separata';
  });""", """  const rientra = () => {
    if (FIN_REF.win !== w) return;
    try { fermaDettaturaCl(); salvaBozzaReferto(); } catch {}
    try { dlg.close(); } catch {}
    dlg.classList.remove('in-finestra', 'pieno'); document.body.append(dlg); FIN_REF.win = null;
    $('#ref-finestra').textContent = '⧉ Finestra separata'; $('#ref-pieno').textContent = '⛶ Schermo intero';
  };
  w.__rientra = rientra; w.addEventListener('pagehide', rientra);
  // chiudendo la pagina principale si chiude anche il referto
  addEventListener('pagehide', () => { try { w.close(); } catch {} }, { once: true });""")
sost("  if (FIN_REF.win) { FIN_REF.win.close(); setTimeout(() => apriReferto().catch(() => {}), 50); return; }",
     "  if (FIN_REF.win) { const w = FIN_REF.win; try { w.__rientra?.(); } catch {} w.close(); setTimeout(() => apriReferto().catch(() => {}), 50); return; }")
# ⛶ nella finestra separata: schermo intero vero (nella pagina resta l'ingrandimento del riquadro)
sost("  $('#ref-pieno').onclick = () => { const d = $('#dlg-referto'); d.classList.toggle('pieno'); $('#ref-pieno').textContent = d.classList.contains('pieno') ? '🗗 Finestra' : '⛶ Schermo intero'; };",
     """  $('#ref-pieno').onclick = async () => {
    const d = $('#dlg-referto'), w = FIN_REF.win;
    if (w) { const doc = w.document; try { if (doc.fullscreenElement) await doc.exitFullscreen(); else await doc.documentElement.requestFullscreen(); } catch {}
      setTimeout(() => { $('#ref-pieno').textContent = doc.fullscreenElement ? '🗗 Esci da schermo intero' : '⛶ Schermo intero'; }, 150); return; }
    d.classList.toggle('pieno'); $('#ref-pieno').textContent = d.classList.contains('pieno') ? '🗗 Finestra' : '⛶ Schermo intero'; };""")
open(A, 'w', encoding='utf-8').write(s)

c = open(C, encoding='utf-8').read()
c = c.replace(".dlg-referto.in-finestra #ref-pieno{display:none}", "")
c += """
/* referto nella finestra separata: come nella pagina, dati del paziente e carta intestata a sinistra, referto a destra
   (una colonna sola se la finestra è stretta) */
@media (min-width:900px){
  .dlg-referto.in-finestra .ref-griglia{grid-template-columns:340px minmax(0,1fr);grid-template-rows:none;align-content:stretch;overflow:hidden}
  .dlg-referto.in-finestra .ref-sx{overflow:auto;min-height:0}
  .dlg-referto.in-finestra .ref-corpo{overflow:auto;min-height:0}
  .dlg-referto.in-finestra .ref-paz{grid-template-columns:1fr}
}
"""
open(C, 'w', encoding='utf-8').write(c)
print('ok')
