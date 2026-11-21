// primo avvio della versione client: registra il service worker (che poi serve il visualizzatore anche offline) e ricarica
(async () => {
  const m0 = document.getElementById('m');
  const m = { set textContent(t) { m0.textContent = t; document.querySelector('.giro')?.remove(); } };
  if (!('serviceWorker' in navigator)) { m.textContent = 'Questo browser non può installare il visualizzatore: usa Chrome, Edge, Firefox o Safari aggiornati.'; return; }
  try {
    await navigator.serviceWorker.register('/client/sw.js', { scope: '/client/' });
    await navigator.serviceWorker.ready;
    let n = 0; try { n = +(sessionStorage.getItem('rq-avvio') || 0); sessionStorage.setItem('rq-avvio', String(n + 1)); } catch {}
    if (n > 2) { m.textContent = 'Il visualizzatore non si avvia: ricarica la pagina; se il problema resta, svuota la cache del sito.'; return; }
    location.reload();
  } catch (e) { m.textContent = 'Avvio non riuscito: ' + e.message; }
})();
