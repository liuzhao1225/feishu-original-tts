window.runContextScenarios=async()=>{
 const results=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 async function scenario(name,run){
  const frame=document.createElement('iframe');frame.style.cssText='position:fixed;left:-2000px;width:1280px;height:900px';
  const loaded=new Promise(resolve=>frame.onload=resolve);frame.src='/';document.body.append(frame);await loaded;await wait(50);
  const w=frame.contentWindow,ui=w.document.getElementById('feishu-original-tts').shadowRoot;
  const $=id=>ui.getElementById(id),d=()=>w.FeishuOriginalTTS.diagnostics(),errors=[];
  const check=(value,message)=>{if(!value)throw new Error(name+': '+message);};
  w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));w.console.error=(...args)=>errors.push(args.map(String).join(' '));
  async function play(){ $('play').click();for(let i=0;i<80&&!d().playing;i++)await wait(50);check(d().playing,'playback did not begin');}
  function terminal(){check(d().contextInvalidated&&!d().playing&&!d().scanning,'reader must enter stopped invalidated state');check($('play').disabled&&$('rate').disabled&&$('voice').disabled,'old controls must be disabled');check(!$('reload').hidden&&!$('reload').disabled&&d().status.includes('请刷新页面'),'refresh action and reason must be visible');}
  try{await run({w,$,d,check,play,terminal,frame});await wait(850);check(errors.length===0,'unexpected errors: '+errors.join('; '));results.push(name);}finally{frame.remove();}
 }
 try{
  await scenario('revoked runtime blocks playback and explicit page refresh restores the reader',async({w,$,check,terminal,frame})=>{
   w.fixtureChrome.runtime.id=undefined;$('play').click();terminal();
   const loaded=new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));$('reload').click();await loaded;await wait(60);
   check(!frame.contentWindow.FeishuOriginalTTS.diagnostics().contextInvalidated,'refresh did not create a fresh reader');
  });
  await scenario('pause send failure stops once without recursive stop messages',async({w,$,check,play,terminal})=>{
   await play();let calls=0;w.testBridge.port.postMessage=()=>{calls++;throw new Error('Extension context invalidated.');};
   $('play').click();terminal();$('play').click();check(calls===1,'invalid port was called repeatedly');
  });
  await scenario('connect failure after disconnect presents refresh instead of retrying old context',async({w,$,terminal,check})=>{
   w.testBridge.disconnect.forEach(fn=>fn());let calls=0;w.fixtureChrome.runtime.connect=()=>{calls++;throw new Error('Extension context invalidated.');};
   $('play').click();terminal();$('play').click();check(calls===1,'dead context was reconnected repeatedly');
  });
  await scenario('synchronous storage write failure is handled visibly',async({w,$,terminal})=>{
   w.fixtureChrome.storage.local.set=()=>{throw new Error('Extension context invalidated.');};$('rate').dispatchEvent(new w.Event('change'));await wait(50);terminal();
  });
  await scenario('synchronous storage read failure is handled visibly',async({w,terminal})=>{
   w.fixtureChrome.storage.local.get=()=>{throw new Error('Extension context invalidated.');};
   w.testBridge.listeners.forEach(fn=>fn({type:'voices',voices:[{voiceName:'test',lang:'zh-CN',eventTypes:['word','end']}]}));await wait(50);terminal();
  });
  await scenario('invalidation during scanning cancels work and never starts speech',async({w,$,d,check,terminal})=>{
   $('play').click();check(d().scanning,'expected active scan');w.fixtureChrome.runtime.id=undefined;w.testBridge.disconnect.forEach(fn=>fn());await wait(300);terminal();
   check(!w.testBridge.messages.some(m=>m.type==='speak'),'stale scan started speech');
  });
  await scenario('ordinary disconnect can reconnect on explicit play and reuse cache',async({w,$,d,check,play})=>{
   await play();const scans=d().scanCount;w.testBridge.disconnect.forEach(fn=>fn());check(!d().contextInvalidated&&!d().playing,'ordinary disconnect was treated as revoked context');
   await play();check(d().scanCount===scans,'ordinary reconnect lost cache');
  });
  return{ok:true,results};
 }catch(error){return{ok:false,results,error:error.stack};}
};
