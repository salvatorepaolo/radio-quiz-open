// 1.249 — non regressione della RM cardiaca dopo lo spostamento dell'interfaccia in cmr-ui.js:
// cifre e testo della scheda sui casi 070, 071 e 108 uguali alla fotografia presa prima (fotografia_cmr.mjs).
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, [new URL('./fotografia_cmr.mjs', import.meta.url).pathname, '--confronta'], { stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
