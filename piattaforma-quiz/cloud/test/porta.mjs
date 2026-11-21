// Porta libera per il simulatore dei test (1.272): la sceglie il sistema (porta 0), così i file di test che node --test
// fa girare insieme non si scontrano mai (prima: numeri a caso in intervalli che si sovrapponevano → EADDRINUSE).
import net from 'node:net';
export const portaLibera = () => new Promise((ok, no) => {
  const s = net.createServer(); s.unref(); s.on('error', no);
  s.listen(0, () => { const { port } = s.address(); s.close(() => ok(port)); });
});
