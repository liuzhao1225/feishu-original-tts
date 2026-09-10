const result=document.getElementById('result');
let listener,resolveEvent,rejectEvent,events=[],paused=false;
const output=value=>{result.textContent+=JSON.stringify(value)+'\n';};
globalThis.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){listener=fn;}},async sendMessage(message){
 if(message.type==='status')output(message.message);
 if(message.type==='event'&&message.event.type==='start')output({firstAudioAfterSeconds:(performance.now()-startedAt)/1000});
 if(message.type==='error'){output(message);rejectEvent?.(new Error(message.message));}
 if(message.type==='event'){
   events.push(message.event);
   if(message.event.type==='word'){
     output(message.event);
     if(!paused){paused=true;await command('pause');const count=events.length;setTimeout(async()=>{
       if(events.length!==count){rejectEvent(new Error('paused playback emitted events'));return;}
       output('pause verified');await command('resume');
     },350);}
   }
   if(message.event.type==='end')resolveEvent();
 }
}}};
let requestKey,startedAt;
const command=(type,extra={})=>new Promise((resolve,reject)=>listener({target:'kokoro-offscreen',requestKey,type,...extra},{id:'fixture'},r=>r.error?reject(new Error(r.error)):resolve(r)));
await import('/offscreen.js');
document.getElementById('run').onclick=async()=>{
 document.getElementById('run').disabled=true;result.textContent='';
 try{
  for(const [text,voice,language]of [['你好，欢迎使用原文朗读。','zf_001','z'],['The teacher uses a computer, water is better.','af_maple','a'],['今天学习 English，老师使用 computer 和 server，完成12.5%的内容。','zf_001','z']]){
   events=[];paused=false;requestKey=crypto.randomUUID();const done=new Promise((a,b)=>{resolveEvent=a;rejectEvent=b;});const started=startedAt=performance.now();
   await command('speak',{text,voice,language,rate:1.2,sessionKey:requestKey,cacheKey:'0',ahead:[]});await done;
   const words=events.filter(e=>e.type==='word');if(!words.length)throw new Error('No word events');
   if(words.some(w=>w.start>w.audioTime||w.end<=w.audioTime||w.charIndex+w.length>text.length))throw new Error('Invalid word clock or offsets');
   for(const match of text.matchAll(/teacher|computer|water|better|server/g))if(!words.some(w=>w.charIndex===match.index&&w.length===match[0].length))throw new Error('Missing word event: '+match[0]);
   output({passed:true,text,words:words.map(w=>text.slice(w.charIndex,w.charIndex+w.length)),elapsedSeconds:(performance.now()-started)/1000});
  }
  await command('stop');output({ok:true});
 }catch(error){output({ok:false,error:String(error)});}
};
