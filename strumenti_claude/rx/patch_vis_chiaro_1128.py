#!/usr/bin/env python3
# 28/11: il visualizzatore torna anche chiaro, a scelta dell'utente (pulsante nella barra, scelta salvata nel browser).
# Predefinito: scuro «workstation» (aspetto sala refertazione del 27/11).
import json, os, shutil, sys
W = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/'
def bak(p):
    if not os.path.exists(p + '.bak_1128vis'): shutil.copy(p, p + '.bak_1128vis')
def rep(t, o, n, nome):
    if n in t: return t
    if t.count(o) != 1: sys.exit(f'{nome}: {t.count(o)} volte: {o[:80]!r}')
    return t.replace(o, n)

# --- stile: le regole scure valgono solo se l'utente non ha scelto il chiaro; il chiaro vale anche col tema scuro del sito
p = W + 'style.css'; t = open(p, encoding='utf-8').read(); t0 = t
S = ':root:not([data-vis="chiaro"]) '
for o in ['#vista-caso>.viewer,#vista-caso>aside.serie{--bg:#0b0f16;',
          '#vista-caso>.viewer{background:linear-gradient(180deg,#0b0f16,#070a10)}',
          '#vista-caso>aside.serie{background:#0b0f16;border-color:#1b2533}',
          '#vista-caso>.viewer .stage{border-radius:12px;box-shadow:0 0 0 1px #1b2533}',
          '#vista-caso>.viewer>.barra-unica,#vista-caso>.viewer>.toolbar{background:#111824;',
          '#vista-caso>.viewer .barra-unica button:hover,#vista-caso>.viewer .toolbar button:hover{background:#1a2433;',
          '#vista-caso>.viewer button.on{background:var(--elettrico);']:
    sel, resto = o.split('{', 1)
    nuovo = ','.join(S + s for s in sel.split(',')) + '{' + resto
    t = rep(t, o, nuovo, 'css')
CSS = '''
/* 28/11: visualizzatore chiaro, a scelta dell'utente (pulsante ☀ nella barra): colori chiari anche se il sito è scuro */
:root[data-vis="chiaro"] #vista-caso>.viewer,:root[data-vis="chiaro"] #vista-caso>aside.serie{--bg:#f4f6f9;--pan:#ffffff;--pan2:#eef1f5;--bord:#cfd6df;--txt:#16202b;--mut:#5d6b7a;--acc:#1a62bb;--pan-trasp:rgba(255,255,255,.95);color:var(--txt);color-scheme:light}
:root[data-vis="chiaro"] #vista-caso>.viewer{background:var(--bg)}
:root[data-vis="chiaro"] #vista-caso>aside.serie{background:var(--bg);border-color:var(--bord)}
:root[data-vis="chiaro"] #vista-caso>.viewer button.on{color:#fff}
#btn-vis-tema .vt-luna{display:none}
:root[data-vis="chiaro"] #btn-vis-tema .vt-sole{display:none}
:root[data-vis="chiaro"] #btn-vis-tema .vt-luna{display:inline}
'''
if '#btn-vis-tema' not in t: t += CSS
if t != t0: bak(p); open(p, 'w', encoding='utf-8').write(t); print('ok', p)

# --- pulsante nella barra, prima di «Solo immagini»
p = W + 'index.html'; t = open(p, encoding='utf-8').read()
BTN = ('<button id="btn-vis-tema" type="button" class="ico schermo" title="Visualizzatore chiaro o scuro (la scelta resta in questo browser)" aria-label="Visualizzatore chiaro o scuro" aria-pressed="false">'
       '<svg class="vt-sole" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
       '<svg class="vt-luna" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>\n    ')
t2 = rep(t, '<button id="btn-solo-imm" type="button"', BTN + '<button id="btn-solo-imm" type="button"', 'html')
if t2 != t: bak(p); open(p, 'w', encoding='utf-8').write(t2); print('ok', p)

# --- comportamento
p = W + 'app.js'; t = open(p, encoding='utf-8').read()
JS = '''// 28/11: aspetto del visualizzatore scelto dall'utente: scuro «workstation» (predefinito) o chiaro; resta nel browser
function applicaVisTema(v) {
  document.documentElement.dataset.vis = v; try { localStorage.setItem('quiz-vis-tema', v); } catch {}
  const b = $('#btn-vis-tema'); if (!b) return;
  b.setAttribute('aria-pressed', String(v === 'chiaro'));
  b.title = v === 'chiaro' ? 'Visualizzatore chiaro: clic per tornare scuro' : 'Visualizzatore scuro: clic per passare al chiaro';
}
try { applicaVisTema(localStorage.getItem('quiz-vis-tema') === 'chiaro' ? 'chiaro' : 'scuro'); } catch { applicaVisTema('scuro'); }
$('#btn-vis-tema')?.addEventListener('click', () => { applicaVisTema(document.documentElement.dataset.vis === 'chiaro' ? 'scuro' : 'chiaro'); try { disegna(); } catch {} });
'''
t2 = rep(t, "$('#btn-schermo').addEventListener('click', schermoIntero);", JS + "$('#btn-schermo').addEventListener('click', schermoIntero);", 'js')
if t2 != t: bak(p); open(p, 'w', encoding='utf-8').write(t2); print('ok', p)

# --- inglese
p = W + 'lingua/en.json'; s = open(p, encoding='utf-8').read().rstrip(); d = json.loads(s)
EN = {'Visualizzatore chiaro o scuro (la scelta resta in questo browser)': 'Light or dark viewer (the choice is kept in this browser)',
      'Visualizzatore chiaro o scuro': 'Light or dark viewer',
      'Visualizzatore chiaro: clic per tornare scuro': 'Light viewer: click to go back to dark',
      'Visualizzatore scuro: clic per passare al chiaro': 'Dark viewer: click to switch to light'}
nuove = {k: v for k, v in EN.items() if k not in d}
if nuove:
    s = s[:-1] + ''.join(', ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False) for k, v in nuove.items()) + '}\n'
    json.loads(s); bak(p); open(p, 'w', encoding='utf-8').write(s); print('ok en', len(nuove))
