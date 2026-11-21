import * as esbuild from 'esbuild';
const vuoti = { name: 'vuoti', setup(b) { b.onResolve({ filter: /^(events|url|fs|path|stream)$/ }, () => ({ path: new URL('./shim/vuoto.js', import.meta.url).pathname })); } };
await esbuild.build({ entryPoints: ['mpr3d.src.js'], bundle: true, format: 'esm', minify: true, target: 'es2020',
  outfile: 'out/mpr3d.js', legalComments: 'external', plugins: [vuoti], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning' });
