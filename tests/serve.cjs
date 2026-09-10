const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const routes={'/':'tests/fixture.html','/core.js':'extension/core.js','/content.js':'extension/content.js','/ui-scenarios.js':'tests/ui-scenarios.js','/context-scenarios.js':'tests/context-scenarios.js','/runtime.html':'tests/runtime.html','/runtime-test.mjs':'tests/runtime-test.mjs'};
http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=routes[pathname]||(['/prefetch-runtime.html','/prefetch-runtime.mjs','/follow-runtime.html','/follow-runtime.js'].includes(pathname)?'tests'+pathname:null)||(/^\/(assets|runtime)\/[\w.-]+$/.test(pathname)||['/kokoro-worker.js','/offscreen.js'].includes(pathname)?'extension'+pathname:null);
 if(!file||!fs.existsSync(path.join(__dirname,'..',file))){res.writeHead(404);res.end();return;}
 const types={'.js':'application/javascript','.mjs':'application/javascript','.wasm':'application/wasm','.json':'application/json','.html':'text/html'};
 res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cross-Origin-Opener-Policy','same-origin');
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
 if(['/runtime.html','/prefetch-runtime.html'].includes(pathname))res.setHeader('Content-Security-Policy',"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'");
 if(pathname==='/content.js')res.end('((chrome)=>{'+fs.readFileSync(path.join(__dirname,'..',file),'utf8')+'})(window.fixtureChrome);');
 else fs.createReadStream(path.join(__dirname,'..',file)).pipe(res);
}).listen(18941,'127.0.0.1',()=>console.log('Fixture: http://127.0.0.1:18941'));
