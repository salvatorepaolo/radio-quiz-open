import { createRequire } from 'node:module';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch(); const p = await b.newPage();
p.on('crash', () => console.log('CRASH'));
await p.goto('data:text/html,<p>x</p>');
console.log(await p.evaluate(() => [typeof window.SpeechRecognition, typeof window.webkitSpeechRecognition, typeof window.SpeechRecognition?.available, navigator.userAgent].join(' | ')));
console.log(await p.evaluate(async () => { try { return await Promise.race([window.SpeechRecognition.available({ langs: ['it-IT'], processLocally: true }), new Promise((r) => setTimeout(() => r('timeout'), 3000))]); } catch (e) { return 'err ' + e.message; } }).catch((e) => 'EVAL ' + e.message));
await b.close();
