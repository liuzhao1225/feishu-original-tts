import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { wordAtTime } from '../src/alignment.mjs';
import '../extension/core.js';

function fixture() {
  let listener, worker, audio, sequence=0;
  const messages=[], tasks=[], urls=new Set(), timers=[];
  class Audio {
    constructor(){audio=this;this.paused=true;this.currentTime=0;this.plays=[];}
    pause(){this.paused=true;}
    removeAttribute(){this.src='';}
    load(){this.currentTime=0;}
    async play(){this.paused=false;this.plays.push(this.src);}
  }
  class Worker {
    constructor(){worker=this;}
    postMessage(message){tasks.push(message);}
  }
  const context=vm.createContext({Audio,Worker,wordAtTime,Blob,URL:{createObjectURL(){const url='blob:'+ ++sequence;urls.add(url);return url;},revokeObjectURL(url){urls.delete(url);}},crypto:{randomUUID:()=>String(++sequence)},setInterval(fn){timers.push(fn);},console,chrome:{runtime:{id:'fixture',onMessage:{addListener(fn){listener=fn;}},async sendMessage(message){messages.push(message);}}}});
  vm.runInContext(fs.readFileSync(new URL('../src/offscreen.mjs',import.meta.url),'utf8').replace(/^import[^\n]+\n/,''),context);
  const command=(type,data={})=>new Promise((resolve,reject)=>listener({target:'kokoro-offscreen',requestKey:'play-0',type,...data},{id:'fixture'},result=>result.error?reject(new Error(result.error)):resolve(result)));
  const sentence=i=>({cacheKey:String(i),text:'Sentence '+i});
  const speak=(i,extra={})=>command('speak',{requestKey:'play-'+i,sessionKey:'session',...sentence(i),ahead:[sentence(i+1),sentence(i+2)],voice:'zf_001',language:'z',rate:1,...extra});
  const complete=async(task,words=[{charIndex:0,length:4,start:0,end:1}])=>worker.onmessage({data:{type:'audio',requestKey:task.requestKey,pcm:new Float32Array(24000),sampleRate:24000,words}});
  return {command,speak,complete,messages,tasks,urls,timers,get worker(){return worker;},get audio(){return audio;},get generated(){return tasks.filter(t=>t.type==='speak');}};
}

test('plays current audio while filling the requested window, then reuses cached audio and timestamps',async()=>{
  const f=fixture();await f.speak(0);
  assert.deepEqual(f.generated.map(t=>t.text),['Sentence 0']);
  await f.complete(f.generated[0]);
  assert.equal(f.audio.paused,false);
  assert.deepEqual(f.generated.map(t=>t.text),['Sentence 0','Sentence 1']);
  const words=[{charIndex:5,length:3,start:.1,end:.8}];
  await f.complete(f.generated[1],words);await f.complete(f.generated[2]);
  assert.equal(f.generated.length,3);assert.equal(f.urls.size,3);
  const plays=f.audio.plays.length;
  f.audio.onended();await f.speak(1);
  assert.equal(f.audio.plays.length,plays+1,'cached sentence starts without another inference');
  assert.equal(f.urls.size,2,'finished sentence audio released');
  assert.deepEqual(f.generated.map(t=>t.text),['Sentence 0','Sentence 1','Sentence 2','Sentence 3']);
  f.audio.currentTime=.3;f.timers[0]();
  const word=f.messages.findLast(m=>m.event?.type==='word');
  assert.equal(word.requestKey,'play-1');assert.equal(word.event.charIndex,5);assert.equal(word.event.length,3);
  await f.complete(f.generated[3]);assert.equal(f.urls.size,3);
});

test('dynamic character budget expands beyond two, refills on advance and releases only played audio',async()=>{
  const f=fixture(),C=globalThis.FeishuTTSCore;
  const lines=[60,5,10,20,40,100,8].map((n,i)=>({cacheKey:String(i),text:String(i).repeat(n)}));
  const request=i=>f.speak(i,{text:lines[i].text,ahead:lines.slice(i+1,C.lookaheadEnd(lines,i))});
  await request(0);
  let completed=0;
  while(completed<f.generated.length)await f.complete(f.generated[completed++]);
  assert.equal(f.generated.length,6,'five future sentences needed for this character budget');
  assert.equal(f.urls.size,6);
  const generatedTexts=new Set(f.generated.map(t=>t.text));
  for(let i=1;i<lines.length;i++){
    f.audio.onended();await request(i);
    assert.equal(f.audio.paused,false,'already buffered current sentence starts immediately');
    while(completed<f.generated.length){
      const task=f.generated[completed++];assert.ok(!generatedTexts.has(task.text),'no regenerated cached sentence');generatedTexts.add(task.text);await f.complete(task);
    }
    assert.equal(f.urls.size,C.lookaheadEnd(lines,i)-i,'played audio released, requested window retained');
  }
  assert.equal(f.generated.length,lines.length);
  await f.command('stop',{requestKey:'play-6'});assert.equal(f.urls.size,0);
});

test('advancing while next sentence is still generating keeps the same inference and suppresses ahead status',async()=>{
  const f=fixture();await f.speak(0);await f.complete(f.generated[0]);
  const next=f.generated[1];const before=f.messages.length;
  await f.worker.onmessage({data:{type:'status',requestKey:next.requestKey,message:'ahead status'}});
  assert.equal(f.messages.length,before);
  f.audio.onended();await f.speak(1);
  assert.equal(f.generated.length,2,'must not launch duplicate inference');
  await f.worker.onmessage({data:{type:'status',requestKey:next.requestKey,message:'current status'}});
  assert.equal(f.messages.at(-1).requestKey,'play-1');
  await f.complete(next);assert.equal(f.audio.paused,false);assert.equal(f.generated.length,3);
});

test('long sentence after short prefixes starts prefetch before playback advances and survives the transition',async()=>{
 for(const lengths of [[10,5,4,100],[1,1,1,1,1,1,1,100]]){
  const f=fixture(),C=globalThis.FeishuTTSCore;
  const lines=lengths.map((n,i)=>({cacheKey:String(i),text:String(i).repeat(n)}));
  const target=C.lookaheadStats(lines).targetCharacters;
  const request=i=>f.speak(i,{text:lines[i].text,ahead:lines.slice(i+1,C.lookaheadEnd(lines,i,target))});
  await request(0);
  for(let i=0;i<lines.length-1;i++)await f.complete(f.generated[i]);
  const longTask=f.generated.at(-1);
  assert.equal(longTask.text,lines.at(-1).text,'long sentence inference is already scheduled');
  const count=f.generated.length,cancels=f.tasks.filter(t=>t.type==='cancel').length;
  f.audio.onended();await request(1);
  assert.equal(f.audio.paused,false,'next cached short sentence starts immediately');
  assert.equal(f.generated.length,count,'retain in-flight long sentence without duplicate inference');
  assert.equal(f.tasks.filter(t=>t.type==='cancel').length,cancels);
  await f.complete(longTask);assert.equal(f.urls.size,lines.length-1);
  await f.command('stop',{requestKey:'play-1'});assert.equal(f.urls.size,0);
 }
});

test('pause keeps bounded prefetch running, resume uses cached current audio, and stop rejects late results',async()=>{
  const f=fixture();await f.speak(0);await f.complete(f.generated[0]);
  await f.command('pause');await f.complete(f.generated[1]);await f.complete(f.generated[2]);
  assert.equal(f.audio.paused,true);assert.equal(f.generated.length,3);
  const count=f.messages.length;f.timers[0]();assert.equal(f.messages.length,count);
  await f.command('resume');assert.equal(f.audio.paused,false);
  const old=f.generated[2];await f.command('stop');
  assert.equal(f.urls.size,0);assert.equal(f.audio.paused,true);
  const stopped=f.messages.length;await f.complete(old);assert.equal(f.messages.length,stopped);assert.equal(f.urls.size,0);
});

test('seek, new document or voice change discards old cache and cannot play an old in-flight result',async()=>{
  for(const extra of [{sessionKey:'new-session'},{voice:'af_maple',language:'a'}]){
    const f=fixture();await f.speak(0);await f.complete(f.generated[0]);
    const old=f.generated[1];await f.speak(0,extra);
    assert.equal(f.urls.size,0);assert.equal(f.audio.paused,true);
    assert.equal(f.generated.length,3);const fresh=f.generated[2];
    await f.complete(old);assert.equal(f.urls.size,0);
    await f.complete(fresh);assert.equal(f.audio.paused,false);
    assert.equal(f.generated.at(-1).voice,extra.voice||'zf_001');
  }
});

test('selection/document end with no ahead does not synthesize outside the requested window',async()=>{
  const f=fixture();await f.speak(0,{ahead:[]});await f.complete(f.generated[0]);
  f.audio.onended();await f.command('stop');
  assert.equal(f.generated.length,1);assert.equal(f.urls.size,0);
});
test('changing voice while paused prepares the replacement queue without starting playback',async()=>{
  const f=fixture();await f.speak(0);await f.complete(f.generated[0]);await f.command('pause');
  await f.speak(0,{sessionKey:'changed',voice:'af_maple',paused:true});
  await f.complete(f.generated.at(-1));assert.equal(f.audio.paused,true);
  await f.command('resume');assert.equal(f.audio.paused,false);
});

test('prefetch failure is surfaced and stops the session without a silent retry',async()=>{
  const f=fixture();await f.speak(0);await f.complete(f.generated[0]);
  await f.worker.onmessage({data:{type:'error',requestKey:f.generated[1].requestKey,message:'bad phoneme'}});
  assert.equal(f.messages.at(-1).type,'error');assert.match(f.messages.at(-1).message,/预生成后续句子失败：bad phoneme/);
  assert.equal(f.audio.paused,true);assert.equal(f.urls.size,0);assert.equal(f.generated.length,2);
});
