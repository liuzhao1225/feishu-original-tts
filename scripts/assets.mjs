import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
const root=new URL('../extension/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('assets-manifest.json',root)));
const base=process.env.KOKORO_ASSET_SOURCE||'https://hf-mirror.com';
async function hash(file){const h=createHash('sha256');for await(const chunk of createReadStream(file))h.update(chunk);return h.digest('hex');}
for(const asset of manifest.files){
 const target=new URL(asset.path,root);await mkdir(new URL('./',target),{recursive:true});
 const exists=await stat(target).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
 if(exists){if(await hash(target)!==asset.sha256)throw new Error(`资源校验失败，请检查后移除该文件再下载：${target.pathname}`);console.log('Verified',asset.path);continue;}
 const url=`${base}/${manifest.repository}/resolve/${manifest.revision}/${asset.source}`;
 console.log('Downloading',asset.path);
 const response=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);
 const temporary=new URL(asset.path+'.download',root);
 if(asset.transform==='vocab')await writeFile(temporary,JSON.stringify((await response.json()).model.vocab));
 else await pipeline(response.body,createWriteStream(temporary));
 if(await hash(temporary)!==asset.sha256)throw new Error(`下载内容校验失败：${asset.path}`);
 await rename(temporary,target);
}
