# 1.213: pannello delle domande in una finestra separata (come il referto e la scheda della RM cardiaca)
import json, sys, re
R = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def sost(testo, vecchio, nuovo, nome, volte=1):
    n = testo.count(vecchio)
    if n != volte: sys.exit(f'ERRORE {nome}: trovato {n} volte')
    return testo.replace(vecchio, nuovo)
a = open(R + 'app.js', encoding='utf-8').read()
VEC = "const FIN_ALTRE = { cmr: null };\nconst $ = (s) => document.querySelector(s) || FIN_REF.win?.document.querySelector(s) || FIN_ALTRE.cmr?.document.querySelector(s) || null;"
if a.count(VEC) != 1: sys.exit('ERRORE testata')
a = a.replace(VEC, '@@TESTATA@@')
# ogni ricerca di elementi passa anche dalle finestre separate (pannello delle domande, scheda cardiaca, referto)
a, n1 = re.subn(r'(?<![.\w])document\.querySelectorAll\(', 'qsAll(', a)
a, n2 = re.subn(r'(?<![.\w])document\.querySelector\(', 'qs1(', a)
a = a.replace('@@TESTATA@@',
  "const FIN_ALTRE = { cmr: null, quiz: null };\n"
  "// documenti in cui cercare gli elementi: la pagina e le finestre separate aperte\n"
  "const DOCS = () => [document, FIN_REF.win?.document, FIN_ALTRE.cmr?.document, FIN_ALTRE.quiz?.document].filter(Boolean);\n"
  "const qs1 = (s) => { for (const d of DOCS()) { const x = d.querySelector(s); if (x) return x; } return null; };\n"
  "const qsAll = (s) => { const d = DOCS(); return d.length === 1 ? d[0].querySelectorAll(s) : d.flatMap((x) => [...x.querySelectorAll(s)]); };\n"
  "const $ = qs1;")
FUNZ = r'''// ---- pannello delle domande in una finestra separata (window.open: si sposta su un altro monitor). L'elemento si sposta
// con i suoi gestori; chiudendo la finestra torna nella pagina.
function staccaQuiz() {
  const aside = $('aside.quiz'); if (!aside || FIN_ALTRE.quiz) return;
  const w = window.open('', 'rq-quiz', `popup,width=${Math.round(Math.min(620, screen.availWidth * 0.4))},height=${Math.round(Math.min(1000, screen.availHeight - 60))}`);
  if (!w) { avvisoBreve('Il browser ha bloccato la finestra: consenti le finestre popup per questo sito.'); return; }
  w.document.open(); w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Domande · radio-quiz</title></head><body class="fin-quiz"></body></html>'); w.document.close();
  copiaStili(w); FIN_ALTRE.quiz = w;
  const casa = $('#btn-pannello'); aside.classList.add('in-finestra'); w.document.body.append(aside);
  $('#vista-caso')?.classList.add('senza-quiz', 'quiz-staccato'); if (casa) casa.hidden = true;
  aggiornaBtnQuizFinestra(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
  let fatto = false;
  const rientra = () => { if (fatto) return; fatto = true; clearInterval(t); if (FIN_ALTRE.quiz === w) FIN_ALTRE.quiz = null;
    aside.classList.remove('in-finestra'); (casa ? casa.after(aside) : $('#vista-caso')?.append(aside));
    let chiuso = false; try { chiuso = localStorage.getItem('quiz-pannello-chiuso') === '1'; } catch {}
    $('#vista-caso')?.classList.remove('quiz-staccato'); $('#vista-caso')?.classList.toggle('senza-quiz', chiuso); if (casa) casa.hidden = false;
    aggiornaBtnQuizFinestra(); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); };
  const t = setInterval(() => { if (w.closed) rientra(); }, 700);
  w.addEventListener('pagehide', () => setTimeout(rientra, 0));
}
function aggiornaBtnQuizFinestra() {
  const b = $('#btn-quiz-finestra'); if (!b) return;
  b.textContent = FIN_ALTRE.quiz ? '⤓ Rimetti nella pagina' : '⧉ Finestra separata';
  b.title = FIN_ALTRE.quiz ? 'Rimetti le domande nella pagina' : 'Apri le domande in una finestra separata (spostala su un altro monitor, come il referto)';
}
$('#btn-quiz-finestra')?.addEventListener('click', () => { if (FIN_ALTRE.quiz) { try { FIN_ALTRE.quiz.close(); } catch {} } else staccaQuiz(); });
addEventListener('pagehide', () => { try { FIN_ALTRE.quiz?.close(); } catch {} });
'''
a = sost(a, "// ---- pannello delle domande a scomparsa (la scelta resta per le prossime aperture)\nfunction pannelloQuiz(chiuso) {",
  FUNZ + "// ---- pannello delle domande a scomparsa (la scelta resta per le prossime aperture)\nfunction pannelloQuiz(chiuso) {", 'funzioni')
open(R + 'app.js', 'w', encoding='utf-8').write(a)
print('sostituzioni', n1, n2)

h = open(R + 'index.html', encoding='utf-8').read()
h = sost(h, '  <aside class="quiz">', '  <aside class="quiz">\n    <div class="q-attrezzi"><button type="button" id="btn-quiz-finestra" class="ghost piccolo" title="Apri le domande in una finestra separata (spostala su un altro monitor, come il referto)">⧉ Finestra separata</button></div>', 'bottone')
open(R + 'index.html', 'w', encoding='utf-8').write(h)
s = open(R + 'style.css', encoding='utf-8').read()
if '.q-attrezzi' not in s:
    s += '''
/* 1.213 domande in una finestra separata */
.q-attrezzi{display:flex;justify-content:flex-end;margin:-8px -6px 4px 0}
.q-attrezzi button{font-size:.78rem;padding:3px 9px;border-radius:999px}
body.fin-quiz{margin:0;background:var(--pan);color:var(--txt);font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
body.fin-quiz aside.quiz.in-finestra{border:0;min-height:100vh;max-width:none;overflow:visible;padding:18px 22px}
@media (max-width:900px),(pointer:coarse){#btn-quiz-finestra{display:none}.q-attrezzi{margin:0}}
'''
    open(R + 'style.css', 'w', encoding='utf-8').write(s)
en = json.load(open(R + 'lingua/en.json', encoding='utf-8'))
for k, v in {'⧉ Finestra separata': '⧉ Separate window', '⤓ Rimetti nella pagina': '⤓ Back into the page', 'Rimetti le domande nella pagina': 'Put the questions back in the page',
  'Apri le domande in una finestra separata (spostala su un altro monitor, come il referto)': 'Open the questions in a separate window (move it to another monitor, like the report)'}.items(): en.setdefault(k, v)
json.dump(en, open(R + 'lingua/en.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('finestra domande OK')
