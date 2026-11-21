import { createRequire } from 'node:module'; import fs from 'node:fs';
const { chromium } = createRequire('/Volumes/Caloggero/piattaforma-quiz/cloud/test/package.json')('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
import http from 'node:http';
const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<html></html>'); }).listen(18977);
const p = await b.newPage(); await p.goto('http://localhost:18977/');
for (const [W, H, hw, codec] of [[1484, 644, 'no-preference', 'avc1.640034'], [1488, 640, 'no-preference', 'avc1.640034'], [1484, 644, 'prefer-software', 'avc1.640034'], [1484, 644, 'no-preference', 'avc1.640028']]) {
  const r = await p.evaluate(async ([W, H, hw, codec]) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const sup = await VideoEncoder.isConfigSupported({ codec, width: W, height: H, bitrate: 4e6, framerate: 5, hardwareAcceleration: hw });
    if (!sup.supported) return 'non supportato';
    let byte = 0, n = 0; const enc = new VideoEncoder({ output: (ch) => { byte += ch.byteLength; n++; }, error: (e) => { byte = -1; } });
    enc.configure({ codec, width: W, height: H, bitrate: 4e6, framerate: 5, hardwareAcceleration: hw });
    for (let i = 0; i < 10; i++) { c.fillStyle = `rgb(${i * 25},100,200)`; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.fillRect(i * 50, 100, 200, 200);
      const vf = new VideoFrame(cv, { timestamp: i * 200000 }); enc.encode(vf, { keyFrame: i === 0 }); vf.close(); }
    await enc.flush(); return { byte, n };
  }, [W, H, hw, codec]);
  console.log(W, H, hw, codec, JSON.stringify(r));
}
await b.close(); srv.close();
