const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const root = path.resolve(__dirname, '..');
(async () => {
  for (const [entry, output] of [['src/worker.mjs','kokoro-worker.js'], ['src/offscreen.mjs','offscreen.js']]) {
    await build({ entryPoints: [path.join(root, entry)], outfile: path.join(root,'extension',output), bundle: true, format: 'esm', platform: 'browser', target: 'chrome135', minify: true, legalComments: 'eof' });
  }
  const runtime = path.join(root,'extension/runtime');
  fs.mkdirSync(runtime, { recursive: true });
  for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
    fs.copyFileSync(path.join(root,'node_modules/onnxruntime-web/dist',file), path.join(runtime,file));
  }
  console.log('Built Kokoro worker, audio player and local WASM runtime.');
})().catch(error => { console.error(error); process.exitCode = 1; });
