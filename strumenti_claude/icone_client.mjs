import { createRequire } from 'node:module'; import fs from 'node:fs';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const svg = fs.readFileSync('/Volumes/Caloggero/piattaforma-quiz/cloud/web/logo.svg', 'utf8');
const b = await chromium.launch();
for (const n of [192, 512]) {
  const p = await b.newPage({ viewport: { width: n, height: n } });
  await p.setContent(`<html><body style="margin:0;background:#0f1419;display:flex;align-items:center;justify-content:center;width:${n}px;height:${n}px"><div style="width:${Math.round(n * 0.72)}px;height:${Math.round(n * 0.72)}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await p.screenshot({ path: `/Volumes/Caloggero/piattaforma-quiz/cloud/web/client/icona-${n}.png` });
}
await b.close(); console.log('icone ok');
