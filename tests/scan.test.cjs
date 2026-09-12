const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('extension/content.js','utf8');
// Run the actual scan functions with a virtual clock and controlled DOM readiness.
const scanSource=source.slice(source.indexOf('  async function settled('),source.indexOf('  function buildQueue('));
function fixture({readyAt=0,cancelAt=Infinity,preRendered=false,outside=false}={}){
  let now=0;const messages=[];
  const placeholder={getBoundingClientRect:()=>({top:outside?900:120,bottom:1000,left:20,right:200,width:180,height:outside?100:880}),closest:()=>preRendered?{}:null,getAttribute:()=> 'block-parent'};
  const scroller={scrollTop:80,scrollHeight:500,clientHeight:500,getBoundingClientRect:()=>({top:0,bottom:500,left:0,right:300})};
  const context=vm.createContext({performance:{now:()=>now},scroller,location:{origin:'https://fixture',pathname:'/docx/test'},documentKey:'https://fixture/docx/test',
    scrollRect:()=>scroller.getBoundingClientRect(),
    root:{isConnected:true,querySelectorAll:()=>now<readyAt?[placeholder]:[]},
    epoch:1,indexReady:false,scanSaved:null,records:new Map(),order:[],scanning:false,scanCount:0,total:0,absolute:0,
    status:message=>messages.push(message),buttons(){},drawProgress(){},
    snapshot:()=>[{key:'body',text:'完整正文。',top:0}],
    C:{mergeOrder:(_order,visible)=>visible,characterIndex:(order,records)=>order.reduce((sum,key)=>sum+records.get(key).text.length,0)},
    sleep:async ms=>{now+=ms;if(now>=cancelAt)context.epoch++;}
  });
  vm.runInContext(scanSource,context);
  return{context,messages,now:()=>now,scan:()=>context.ensureIndex(1),wait:()=>context.settled(1)};
}
test('slow rendering completes the full index after the former two-second cutoff',async()=>{
  const f=fixture({readyAt:3000});await f.scan();
  assert.equal(f.context.indexReady,true);assert.equal(f.context.total,5);
  assert.equal(f.context.scroller.scrollTop,80);assert.equal(f.context.scanning,false);
  assert.ok(f.messages.some(message=>message.includes('等待飞书渲染')));
});
test('rendering completed during the final wait is checked before reporting a timeout',async()=>{
  for(const readyAt of [2050,15000]){
    const f=fixture({readyAt});await f.wait();assert.ok(f.now()>=readyAt);
  }
});
test('an unresolved placeholder stops with position details and no completed index',async()=>{
  const f=fixture({readyAt:Infinity});
  await assert.rejects(f.scan(),error=>{
    assert.match(error.message,/15 秒/);assert.equal(error.details.elapsedMs,15000);
    assert.equal(error.details.scrollTop,0);assert.equal(error.details.pending[0].parentId,'block-parent');return true;
  });
  assert.equal(f.context.indexReady,false);assert.equal(f.context.total,0);
  assert.equal(f.context.scanning,false);assert.equal(f.context.scroller.scrollTop,80);
});
test('cancelling a slow render prevents indexing without waiting for the deadline',async()=>{
  const f=fixture({readyAt:Infinity,cancelAt:500});
  await assert.rejects(f.scan(),/已取消/);
  assert.equal(f.context.indexReady,false);assert.ok(f.now()<1000);
});
test('offscreen and pre-render placeholders do not delay ready text',async()=>{
  for(const options of [{outside:true},{preRendered:true}]){
    const f=fixture({readyAt:Infinity,...options});await f.scan();
    assert.equal(f.context.indexReady,true);assert.equal(f.now(),180);
  }
});
test('a full-height mobile wrapper uses page scrolling and viewport bounds',()=>{
  const html={clientWidth:400,clientHeight:764,scrollHeight:35000,getBoundingClientRect:()=>({top:-1000,bottom:34000})};
  const document={body:{},documentElement:html,scrollingElement:html};
  const wrapper={overflowY:'auto',clientHeight:35000,scrollHeight:35000,parentElement:document.body};
  const context=vm.createContext({document,root:{parentElement:wrapper},getComputedStyle:node=>node});
  vm.runInContext(source.slice(source.indexOf('  function findScroller('),source.indexOf("  const host=document.createElement('div');")),context);
  assert.equal(vm.runInContext('scroller',context),html);
  assert.equal(vm.runInContext('scrollEvents()',context),document);
  assert.equal(context.scrollRect().top,0);assert.equal(context.scrollRect().bottom,764);
});
test('desktop scanning uses the overflowing editor ancestor and its scroll events',()=>{
  const document={body:{},scrollingElement:{}};
  const wrapper={overflowY:'auto',clientHeight:700,scrollHeight:35000,parentElement:document.body,getBoundingClientRect:()=>({top:64,bottom:764})};
  const context=vm.createContext({document,root:{parentElement:{overflowY:'visible',parentElement:wrapper}},getComputedStyle:node=>node});
  vm.runInContext(source.slice(source.indexOf('  function findScroller('),source.indexOf("  const host=document.createElement('div');")),context);
  assert.equal(vm.runInContext('scroller',context),wrapper);
  assert.equal(vm.runInContext('scrollEvents()',context),wrapper);
  assert.equal(context.scrollRect().top,64);
});
