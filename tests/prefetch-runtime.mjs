const output=document.getElementById('result');
const log=value=>{output.textContent+=JSON.stringify(value)+'\n';};
let listener,requestKey,index=0,finished,failed,paused=false,startedAt,previousEnd=0;
const generated=[],tasks=new Map(),ends=[],starts=[],events=[];
const lines=['①现在开始检查连续朗读。播放这一段的时候，后台会按照后续句子的字数提前准备声音和词时间戳，让我们在阅读中文和英文内容时，可以更连贯地听下去。','②开始。','③好。','④老师使用 computer，检查 server 的运行情况，然后继续朗读后面的中文内容，确认连续短句之后的长句也会提前生成。','⑤继续检查。','⑩所有内容朗读完成。'];
const queue=lines.map(text=>({text})),windows=[],targetCharacters=FeishuTTSCore.lookaheadStats(queue).targetCharacters;
const NativeWorker=window.Worker;
window.Worker=class extends NativeWorker{
 constructor(...args){super(...args);this.addEventListener('message',({data})=>{
  if(data.type==='audio'){const task=tasks.get(data.requestKey);generated.push({text:task.text,at:performance.now()});log({generated:task.text,whilePlaying:index,seconds:(performance.now()-startedAt)/1000});}
 });}
 postMessage(message,...args){if(message.type==='speak')tasks.set(message.requestKey,message);return super.postMessage(message,...args);}
};
window.chrome={runtime:{id:'fixture',onMessage:{addListener(fn){listener=fn;}},async sendMessage(message){
 if(message.requestKey!==requestKey)return;
 if(message.type==='error'){log(message);failed(new Error(message.message));return;}
 if(message.type!=='event')return;
 const event=message.event;events.push({index,...event});
 if(event.type==='start'){
  starts[index]=performance.now();log({started:index,gapSeconds:previousEnd?(starts[index]-previousEnd)/1000:null});
 }
 if(event.type==='word'&&!paused){paused=true;await command('pause');const count=events.length;setTimeout(async()=>{try{if(events.length!==count)throw new Error('Paused playback emitted events');await command('resume');log('pause verified');}catch(error){failed(error);}},350);}
 if(event.type==='end'){
  ends[index]=performance.now();previousEnd=ends[index];index++;
  if(index===lines.length)finished();else await speak();
 }
}}};
const command=(type,extra={})=>new Promise((resolve,reject)=>listener({target:'kokoro-offscreen',requestKey,type,...extra},{id:'fixture'},response=>response.error?reject(new Error(response.error)):resolve()));
const speak=async()=>{
 requestKey='play-'+index;
 const end=FeishuTTSCore.lookaheadEnd(queue,index,targetCharacters),ahead=lines.slice(index+1,end).map((text,j)=>({cacheKey:String(index+j+1),text}));
 const bufferedCharacters=ahead.reduce((sum,item)=>sum+FeishuTTSCore.characterCount(item.text),0),nextCharacters=end<lines.length?FeishuTTSCore.characterCount(lines[end]):0;
 if(end<lines.length&&bufferedCharacters<Math.max(targetCharacters,nextCharacters))throw new Error('Insufficient character buffer');
 windows.push(ahead.length);log({windowAt:index,ahead: ahead.length,bufferedCharacters,nextCharacters,targetCharacters});
 await command('speak',{sessionKey:'prefetch-test',cacheKey:String(index),text:lines[index],ahead,voice:'zf_001',language:'z',rate:1});
};
await import('/offscreen.js');
document.getElementById('run').onclick=async()=>{
 document.getElementById('run').disabled=true;output.textContent='';startedAt=performance.now();
 try{
  const done=new Promise((resolve,reject)=>{finished=resolve;failed=reject;});await speak();await done;
  if(generated.length!==lines.length||new Set(generated.map(g=>g.text)).size!==lines.length)throw new Error('Duplicate or missing synthesis');
  if(windows[0]<=2||!generated.slice(1,windows[0]+1).every(g=>g.at>starts[0]&&g.at<ends[0]))throw new Error('Dynamic lookahead did not complete while first sentence played');
  for(let i=0;i<lines.length;i++){
   const words=events.filter(e=>e.index===i&&e.type==='word');
   for(const match of lines[i].matchAll(/[①-⑳]|computer|server/gu))if(!words.some(w=>w.charIndex===match.index&&w.length===match[0].length))throw new Error('Missing original word: '+match[0]);
   if(!words.length||words.some(w=>w.start>w.audioTime||w.end<=w.audioTime||w.charIndex+w.length>lines[i].length))throw new Error('Invalid word timestamps');
  }
  await command('stop');log({ok:true,sentences:lines.length,generatedOnceEach:true,dynamicWindowSizes:windows,transitionGapsSeconds:starts.slice(1).map((t,i)=>(t-ends[i])/1000),highlightedMarkers:events.filter(e=>e.type==='word'&&/[①-⑳]/u.test(lines[e.index].slice(e.charIndex,e.charIndex+e.length))).length});
 }catch(error){await command('stop');log({ok:false,error:String(error)});}
};
