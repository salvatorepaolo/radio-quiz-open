// 1.249: chi sono e tipo di piattaforma si chiedono subito, mentre app.js arriva; app.js usa queste risposte una
// volta sola (rispostaPrima), poi chiede da sé. File a parte e non nella pagina: la Content Security Policy del sito
// non permette script scritti dentro l'HTML. Mai nel visualizzatore scaricabile: lì nessuna richiesta parte da sola.
(function () {
  if (location.pathname.indexOf('/client/') === 0 || /[?&]client\b/.test(location.search)) return;
  if (window.__rqAppAvviato) return;   // app.js è già partito e ha chiesto da sé: niente doppioni
  var o = { credentials: 'same-origin' }, n = function () { return null; };
  window.__rqPrima = { io: fetch('/api/io', o).catch(n), istanza: fetch('/api/istanza', o).catch(n) };
})();
