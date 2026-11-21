import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
C = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/style.css'
shutil.copy(A, A + '.bak_1107x'); shutil.copy(C, C + '.bak_1107x')
s = open(A, encoding='utf-8').read()
a = """  const st = ok + '|' + att; if (g._st === st) return; g._st = st;
  g.hidden = !ok;
  g.querySelectorAll('[data-piano]').forEach((b) => b.classList.toggle('on', b.dataset.piano === att));"""
b = """  // la barra non deve cambiare forma passando da un riquadro all'altro (RX ↔ TC): il gruppo resta visibile
  // se almeno un riquadro può cambiare piano, e per il riquadro attivo che non può è solo disattivato
  const qualcuno = !MPR.attivo && V.pannelli.slice(0, V.n || 1).some((q) => q?.img && pianoPossibile(q));
  const st = ok + '|' + att + '|' + qualcuno; if (g._st === st) return; g._st = st;
  g.hidden = !ok && !qualcuno;
  g.querySelectorAll('[data-piano]').forEach((b) => { b.classList.toggle('on', ok && b.dataset.piano === att); b.disabled = !ok; });"""
assert s.count(a) == 1; s = s.replace(a, b)
open(A, 'w', encoding='utf-8').write(s)
c = open(C, encoding='utf-8').read()
c += "\n/* barra stabile: la tendina delle finestre ha sempre la stessa larghezza (W/L… nella TC, Finestra… nella RX) */\n#barra-2d #preset{width:116px;max-width:116px}\n#grp-piani button:disabled{opacity:.35}\n"
open(C, 'w', encoding='utf-8').write(c)
print('ok')
