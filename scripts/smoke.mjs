import { KokoroEngine } from '../src/engine.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const baseUrl=new URL('../extension/',import.meta.url);
const engine=new KokoroEngine({baseUrl:baseUrl.href,readAsset:path=>readFile(new URL(path,baseUrl)),onStatus:console.log});
const outputDir=new URL('../work/smoke/',import.meta.url);await mkdir(outputDir,{recursive:true});
try{
 const results=[];
 for(const [name,text,voice,language]of [['zh','你好，欢迎使用原文朗读。','zf_001','z'],['en','Hello, welcome to Kokoro.','af_maple','a'],['mixed','今天学习 English，完成12.5%的内容。','zf_001','z']]){
  const start=performance.now(),result=await engine.synthesize(text,voice,language),seconds=result.pcm.length/result.sampleRate;
  assert.ok(seconds>0&&result.words.length>0);assert.ok(result.pcm.some(x=>Math.abs(x)>.01));
  let previous=0;for(const word of result.words){assert.ok(word.start>=previous&&word.end>word.start&&word.end<=seconds);assert.ok(word.charIndex>=0&&word.charIndex+word.length<=text.length);previous=word.end;}
  const wav=Buffer.alloc(44+result.pcm.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(result.pcm.length*2,40);
  for(let i=0;i<result.pcm.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,result.pcm[i]))*32767),44+i*2);
  await writeFile(new URL(name+'.wav',outputDir),wav);
  const summary={name,text,seconds,inferenceSeconds:(performance.now()-start)/1000,words:result.words.map(w=>({...w,text:text.slice(w.charIndex,w.charIndex+w.length)}))};
  results.push(summary);console.log(JSON.stringify(summary));
 }
 await writeFile(new URL('results.json',outputDir),JSON.stringify(results,null,2));
}catch(error){console.error(error.stack);process.exitCode=1;}
