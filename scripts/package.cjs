const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const crypto=require('node:crypto');
const assets=JSON.parse(fs.readFileSync(path.join(root,'extension/assets-manifest.json')));
for(const asset of assets.files){
  const data=fs.readFileSync(path.join(root,'extension',asset.path));
  if(data.length!==asset.size||crypto.createHash('sha256').update(data).digest('hex')!==asset.sha256)throw new Error('语音资源校验失败：'+asset.path);
}
for(const file of ['kokoro-worker.js','offscreen.js','runtime/ort-wasm-simd-threaded.wasm','runtime/ort-wasm-simd-threaded.mjs'])fs.accessSync(path.join(root,'extension',file));
const destination=path.resolve(process.argv[2]||path.join(root,'dist'));
const extension=path.join(destination,'feishu-original-tts');
fs.mkdirSync(destination,{recursive:true});
fs.cpSync(path.join(root,'extension'),extension,{recursive:true});
const zip=path.join(destination,'feishu-original-tts.zip');
fs.rmSync(zip,{force:true});
const result=spawnSync('zip',['-qr',zip,'feishu-original-tts','-x','*.DS_Store'],{cwd:destination,stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status||1);
console.log(extension+'\n'+zip);
