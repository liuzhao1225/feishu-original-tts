const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 let connect,receive,n=0;const commands=[];
 const chrome={runtime:{id:'fixture',getURL:p=>p,async getContexts(){return [{}];},async sendMessage(m){commands.push(m);return {ok:true};},onConnect:{addListener(fn){connect=fn;}},onMessage:{addListener(fn){receive=fn;}}},action:{onClicked:{addListener(){}}}};
 const context=vm.createContext({chrome,crypto:{randomUUID:()=>String(++n)},importScripts(){},KokoroVoices:[{voiceName:'voice',language:'z'}],console});
 vm.runInContext(fs.readFileSync('extension/background.js','utf8'),context);
 function port(){const messages=[];let send,disconnect;const p={name:'feishu-original-tts',onMessage:{addListener(fn){send=fn;}},onDisconnect:{addListener(fn){disconnect=fn;}},postMessage(m){messages.push(m);}};connect(p);return {messages,send:m=>send(m),disconnect:()=>disconnect()};}
 const speak=(id,sessionId=1)=>({type:'speak',id,sessionId,cacheKey:String(id),text:'text',voice:'voice',rate:1,ahead:[]});
 return {commands,port,speak,receive:(m,respond)=>receive({target:'kokoro-background',...m},{id:'fixture'},respond)};
}
test('voice catalog uses a one-shot request without opening a playback session',()=>{
 const f=fixture();let response;
 f.receive({type:'voices'},value=>{response=value;});
 assert.equal(response.type,'voices');assert.equal(response.voices[0].voiceName,'voice');
 assert.equal(f.commands.length,0,'metadata must not create offscreen audio work');
});
test('background retains session cache identity across end and maps events to current sentence',async()=>{
 const f=fixture(),p=f.port();await p.send(f.speak(1));const first=f.commands.at(-1);
 f.receive({requestKey:first.requestKey,type:'event',event:{type:'end'}});
 await p.send(f.speak(2));const second=f.commands.at(-1);
 assert.equal(second.sessionKey,first.sessionKey);assert.notEqual(second.requestKey,first.requestKey);
 const count=p.messages.length;f.receive({requestKey:first.requestKey,type:'event',event:{type:'word'}});assert.equal(p.messages.length,count);
 f.receive({requestKey:second.requestKey,type:'event',event:{type:'word'}});assert.equal(p.messages.at(-1).id,2);
 await p.send({type:'stop'});await p.send(f.speak(3));assert.notEqual(f.commands.at(-1).sessionKey,first.sessionKey);
});
test('new reading epoch or another document gets a new cache session and interrupts old owner',async()=>{
 const f=fixture(),p=f.port(),other=f.port();await p.send(f.speak(1));const first=f.commands.at(-1);
 await p.send(f.speak(2,2));const second=f.commands.at(-1);assert.notEqual(second.sessionKey,first.sessionKey);
 await other.send(f.speak(1,2));assert.notEqual(f.commands.at(-1).sessionKey,second.sessionKey);
 assert.equal(p.messages.at(-1).type,'interrupted');
 await p.send({type:'stop'});assert.equal(f.commands.at(-1).type,'speak','old page cannot stop new page');
});

test('background forwards a character-budgeted window larger than two sentences',async()=>{
 const f=fixture(),p=f.port(),message=f.speak(1);
 message.ahead=[2,3,4,5].map(id=>({cacheKey:String(id),text:'next '+id}));
 await p.send(message);
 assert.equal(f.commands.at(-1).ahead.length,4);
 assert.ok(!p.messages.some(m=>m.type==='error'));
});
