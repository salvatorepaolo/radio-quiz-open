import shutil
A = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/app.js'
C = '/Volumes/Caloggero/piattaforma-quiz/cloud/web/style.css'
shutil.copy(A, A + '.bak_1108saltati'); shutil.copy(C, C + '.bak_1108saltati')
s = open(A, encoding='utf-8').read()
def sost(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:90], s.count(a)); s = s.replace(a, b)

# elenco dei file saltati (non letti in tempo)
sost("""  await aGruppi(files, 12, async (f) => {
    let info = giaLette?.info?.[chiaveF(f)];
    if (!info) {
      info = await conLimite(f);""", """  const saltati = [];
  await aGruppi(files, 12, async (f) => {
    let info = giaLette?.info?.[chiaveF(f)];
    if (!info) {
      info = await conLimite(f);
      if (info.escluso === NON_LETTO) saltati.push(f);""")
sost("""  if (location.hash === '#/caso/locale') routerClient('caso'); else location.hash = '#/caso/locale';
}
function sceltaStudi(""", """  if (location.hash === '#/caso/locale') routerClient('caso'); else location.hash = '#/caso/locale';
  if (saltati.length) avvisoSaltati(saltati);
}
// file che non si sono potuti leggere: quali sono, perché (di solito iCloud Drive con «Ottimizza spazio»), e «Riprova»
function avvisoSaltati(saltati) {
  let d = $('#dlg-saltati');
  if (!d) { d = document.createElement('dialog'); d.id = 'dlg-saltati'; d.className = 'dlg-saltati'; document.body.appendChild(d); }
  const nomi = saltati.map((f) => percorsoDi(f)).sort();
  const cartelle = [...new Set(nomi.map((p) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '(cartella scelta)'))];
  d.innerHTML = `<form method="dialog"><h3>⚠ ${saltati.length} file non letti</h3>
    <p>L'esame si è aperto senza questi file: la lettura non è finita entro 20 secondi. Di solito sono <b>file di iCloud Drive non scaricati</b> sul Mac (con «Ottimizza spazio del Mac» restano solo nel cloud), oppure un disco esterno in standby o un disco di rete lento.</p>
    <p class="small"><b>Per iCloud</b>: nel Finder, clic destro sulla cartella dell'esame → <b>Scarica ora</b> (aspetta che sparisca la nuvola), poi «Riprova». Per non avere più il problema: Impostazioni di Sistema → [il tuo nome] → iCloud → iCloud Drive → togli «Ottimizza spazio del Mac», oppure copia gli esami in una cartella fuori da iCloud.</p>
    <p class="small muted">${cartelle.length === 1 ? 'Cartella' : 'Cartelle'}: ${cartelle.slice(0, 5).map(esc).join(' · ')}${cartelle.length > 5 ? ` e altre ${cartelle.length - 5}` : ''}</p>
    <details${saltati.length <= 12 ? ' open' : ''}><summary>Elenco dei file (${saltati.length})</summary><ol class="saltati-lista">${nomi.slice(0, 300).map((n) => `<li>${esc(n)}</li>`).join('')}</ol>${nomi.length > 300 ? `<p class="small muted">… e altri ${nomi.length - 300}</p>` : ''}</details>
    <div class="riga"><button type="button" class="primary" id="saltati-riprova">↻ Riprova</button><button type="button" class="ghost" id="saltati-copia">Copia l'elenco</button><span class="spacer"></span><button value="chiudi">Chiudi</button></div></form>`;
  d.querySelector('#saltati-copia').onclick = async () => { try { await navigator.clipboard.writeText(nomi.join('\\n')); avvisoBreve('Elenco copiato'); } catch { avvisoBreve('Copia non riuscita'); } };
  // si riapre tutto l'esame: i file già letti non si rileggono (intestazioni ricordate), si riprovano solo i saltati
  d.querySelector('#saltati-riprova').onclick = () => { d.close(); if (CL.sorgenti?.length) caricaClient(CL.sorgenti); };
  if (!d.open) d.showModal();
}
function sceltaStudi(""")
open(A, 'w', encoding='utf-8').write(s)
c = open(C, encoding='utf-8').read()
c += """
/* client: file non letti (iCloud, disco lento) */
.dlg-saltati{max-width:min(640px,calc(100vw - 32px))}
.dlg-saltati .saltati-lista{max-height:220px;overflow:auto;font:12px ui-monospace,Menlo,monospace;margin:6px 0;padding-left:28px}
"""
open(C, 'w', encoding='utf-8').write(c)
print('ok')
