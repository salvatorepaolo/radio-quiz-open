import sys
W = sys.argv[1]; P = W + '/../../../strumenti_claude/patch/'
src = open(W + '/app.js', encoding='utf-8').read()
def rep(old, new, count=1):
    global src
    n = src.count(old); assert n == count, (n, old[:100]); src = src.replace(old, new)
rep("\nif (/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname) && (location.search.includes('prova') || CLIENT)) window.__dbg = {",
    open(P + 'client_v3.js', encoding='utf-8').read() + "\nif (/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname) && (location.search.includes('prova') || CLIENT)) window.__dbg = { esportaGSPS, datiSessione, applicaSessione,")
# zip e sessione all'apertura
rep("""  files = files.filter((f) => !/(^|\\/)\\./.test(percorsoDi(f)) && f.size > 0);
  if (!files.length) { st('Nessun file nella selezione.', 'errore'); return; }""",
"""  files = files.filter((f) => !/(^|\\/)\\./.test(percorsoDi(f)) && f.size > 0);
  try { files = await espandiZip(files, st); } catch (e) { st('Archivio non aperto: ' + esc(e.message), 'errore'); return; }
  // file di sessione insieme all'esame (per esempio nello zip anonimizzato): si riapre dopo le immagini
  const sessione = files.find((f) => /\\.rqsess(\\.json)?$/i.test(f.name || ''));
  if (sessione) { CL.sessioneDaAprire = sessione; files = files.filter((f) => f !== sessione); }
  if (!files.length) { st('Nessun file nella selezione.', 'errore'); return; }""")
rep("""    await apriCaso('locale', CL.studio);
    if (!CL.finestra) await confrontoAutomatico();""", """    await apriCaso('locale', CL.studio);
    if (!CL.finestra) await confrontoAutomatico();
    if (CL.sessioneDaAprire && !CL.finestra) { const s = CL.sessioneDaAprire; CL.sessioneDaAprire = null; await apriSessioneFile(s); }""")
rep("""  $('#cl-aggiungi-file').addEventListener('change', (e) => { aggiungiEsameClient([...e.target.files]); e.target.value = ''; });""",
"""  $('#cl-aggiungi-file').addEventListener('change', (e) => { aggiungiEsameClient([...e.target.files]); e.target.value = ''; });
  $('#cl-sessione').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; $('.cl-aggiungi')?.removeAttribute('open'); if (f) apriSessioneFile(f); });""")
# esportazione: sessione, annotazioni DICOM; sessione anche nello zip anonimizzato
rep("""  } else if (cosa === 'misure') {""", """  } else if (cosa === 'sessione') {
    scarica(new Blob([JSON.stringify(datiSessione(), null, 1)], { type: 'application/json' }), `${base}.rqsess.json`);
    st('Sessione salvata: riaprila con «＋ Aggiungi esame → Apri sessione», o mettila insieme all\\'esame (anche nello zip anonimizzato).');
  } else if (cosa === 'gsps') {
    st('Preparo le annotazioni DICOM…'); const fl = await esportaGSPS();
    if (fl.length === 1) scarica(new Blob([fl[0].dati], { type: 'application/dicom' }), `${base}_annotazioni.dcm`); else scarica(creaZip(fl), `${base}_annotazioni.zip`);
    st(`Annotazioni salvate in DICOM (presentation state, ${fl.length} ${fl.length === 1 ? 'file' : 'file, uno per studio'}): importale nel PACS insieme alle immagini.`);
  } else if (cosa === 'misure') {""")
rep("""    voci.sort((x, y) => x.nome.localeCompare(y.nome));
    if (voci.reduce((t, v) => t + v.dati.length, 0) > 4e9)""", """    voci.sort((x, y) => x.nome.localeCompare(y.nome));
    voci.push({ nome: `${base}_anonimo/sessione.rqsess.json`, dati: new TextEncoder().encode(JSON.stringify(datiSessione())) });
    if (voci.reduce((t, v) => t + v.dati.length, 0) > 4e9)""")
rep("""    : cosa === 'misure' ? `${nMis}""", """    : cosa === 'sessione' ? 'Misure, riquadri, serie, immagini, finestre e zoom in un piccolo file (.rqsess.json), senza immagini né dati del paziente: si riapre sullo stesso esame, anche anonimizzato.'
    : cosa === 'gsps' ? 'Frecce, misure e ROI in un file DICOM «presentation state» (GSPS) che i PACS sovrappongono alle immagini originali. Le misure sui piani ricostruiti non si includono.'
    : cosa === 'misure' ? `${nMis}""")
# sito: annotazioni DICOM anche per docenti e autori
rep("""    if (tipo === 'caso' && id) { await apriCaso(decodeURIComponent(id)); await confrontoAutomatico(); }""",
    """    if (tipo === 'caso' && id) { await apriCaso(decodeURIComponent(id)); await confrontoAutomatico(); $('#btn-gsps').hidden = !(DOCENTE || AUTORE); }""")
rep("$('#btn-annulla')?.addEventListener('click', () => annulla());", """$('#btn-annulla')?.addEventListener('click', () => annulla());
$('#btn-gsps')?.addEventListener('click', async () => {
  try { const fl = await esportaGSPS(), nome = slug(V.caso?.titolo_interno || V.caso?.titolo || V.caso?.id || 'caso');
    if (fl.length === 1) scarica(new Blob([fl[0].dati], { type: 'application/dicom' }), `${nome}_annotazioni.dcm`); else scarica(creaZip(fl), `${nome}_annotazioni.zip`);
    avvisoBreve('Annotazioni salvate in DICOM (GSPS): si aprono nel PACS insieme alle immagini del caso (⤓ Scarica lo studio).');
  } catch (e) { avvisoBreve('Annotazioni DICOM: ' + e.message); }
});""")
open(W + '/app.js', 'w', encoding='utf-8').write(src)

h = open(W + '/index.html', encoding='utf-8').read()
def hrep(o, n):
    global h; assert h.count(o) == 1, o[:80]; h = h.replace(o, n)
hrep('''<span class="muted small">oppure trascinali sulle immagini</span></div></details>''',
     '''<span class="muted small">oppure trascinali sulle immagini (anche .zip)</span><label>💾 Apri sessione…<input type="file" id="cl-sessione" accept=".json,.rqsess" hidden></label></div></details>''')
hrep('''  <label class="check"><input type="radio" name="ex-cosa" value="misure"> Misure (file di testo)</label>''',
     '''  <label class="check"><input type="radio" name="ex-cosa" value="misure"> Misure (file di testo)</label>
  <label class="check"><input type="radio" name="ex-cosa" value="sessione"> Sessione: misure, riquadri e finestre (file da riaprire o mandare)</label>
  <label class="check"><input type="radio" name="ex-cosa" value="gsps"> Annotazioni DICOM per il PACS (presentation state)</label>''')
i = h.index('<button id="btn-annulla"')
h = h[:i] + '<button id="btn-gsps" class="ico" hidden title="Salva frecce, misure e ROI in un file DICOM (presentation state) da aprire nel PACS con le immagini del caso" aria-label="Annotazioni DICOM"><b style="font-size:9px;line-height:18px">GSPS</b></button>\n        ' + h[i:]
hrep('<p class="cl-nota">CD con DICOMDIR, cartelle o file ·', '<p class="cl-nota">CD con DICOMDIR, cartelle, file o archivi .zip ·')
open(W + '/index.html', 'w', encoding='utf-8').write(h)
print('ok')
