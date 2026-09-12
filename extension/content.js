(() => {
  if(globalThis.FeishuTTSLoader){globalThis.FeishuTTSLoader.sync();return;}
  function mount(root,documentKey){
  const C=globalThis.FeishuTTSCore;
  if(!CSS.highlights||!globalThis.Highlight){alert('请更新 Chrome 以使用原文高亮。');return;}
  function findScroller(){
    for(let node=root.parentElement;node&&node!==document.body;node=node.parentElement){
      if(/^(auto|scroll)$/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight)return node;
    }
    return document.scrollingElement;
  }
  let scroller=findScroller();
  function scrollRect(){
    // The document element's DOM rect spans the page, not the visible viewport.
    return scroller===document.scrollingElement?{top:0,left:0,right:document.documentElement.clientWidth,bottom:document.documentElement.clientHeight}:scroller.getBoundingClientRect();
  }
  const scrollEvents=()=>scroller===document.scrollingElement?document:scroller;
  const host=document.createElement('div');
  host.id='feishu-original-tts';
  host.style.cssText='position:fixed;left:0;right:0;bottom:0;width:100%;z-index:2147483647;';
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>
    :host{all:initial;--tts-primary:#1456f0;--tts-primary-hover:#4e83fd;--tts-primary-active:#245bdb;--tts-selected:#e1eaff;--tts-text:#1f2329;--tts-secondary:#646a73;--tts-muted:#8f959e;--tts-border:#dee0e3;--tts-hover:#eff0f1;font:13px/1.5 system-ui,-apple-system,"PingFang SC",sans-serif;color:var(--tts-text)}
    *{box-sizing:border-box}button,select,input{font:inherit}button,select{color:inherit}button{cursor:pointer;border:0;background:transparent;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}button:disabled,input:disabled{opacity:.38;cursor:default}button:hover:not(:disabled){background:var(--tts-hover)}button:focus-visible,select:focus-visible,input:focus-visible{outline:2px solid var(--tts-primary);outline-offset:3px}
    .player{position:relative;background:#fff;border-top:1px solid var(--tts-border);box-shadow:0 -5px 25px #1f23290d;padding:16px 24px 13px}
    .seek{--progress:0%;appearance:none;position:absolute;left:0;top:-8px;width:100%;height:16px;margin:0;background:transparent;cursor:pointer;z-index:2}
    .seek::-webkit-slider-runnable-track{height:4px;background:linear-gradient(to right,var(--tts-primary) var(--progress),var(--tts-border) var(--progress));border-radius:0}
    .seek::-webkit-slider-thumb{appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;background:var(--tts-primary);box-shadow:0 0 0 3px #fff;transition:transform .12s}.seek:hover::-webkit-slider-thumb{transform:scale(1.2)}
    .bar{position:relative;z-index:3;display:grid;grid-template-columns:minmax(180px,1fr) auto minmax(220px,1fr);align-items:center;gap:24px;min-height:54px}
    .info{min-width:0}.heading{display:flex;align-items:center;gap:10px}.title{font-weight:500;font-size:14px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.counter{font-size:12px;color:var(--tts-secondary);font-variant-numeric:tabular-nums}.status{margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--tts-muted);font-size:12px}.status.error{color:#f54a45}
    .transport,.options{display:flex;align-items:center;gap:12px}.transport{justify-content:center}.options{justify-content:flex-end;gap:10px}.icon svg{width:18px;height:18px;fill:currentColor}.icon{width:34px;height:34px;border-radius:50%;font-size:17px}.play{width:48px;height:48px;border-radius:50%;background:var(--tts-primary);color:white;font-size:18px;box-shadow:0 3px 8px #1456f01a}.play:hover:not(:disabled){background:var(--tts-primary-active)}.play svg{width:21px;height:21px;fill:currentColor}.text-btn{border-radius:7px;padding:7px 9px;font-size:12px}.point{background:var(--tts-selected)!important;color:var(--tts-primary)}.divider{height:22px;width:1px;background:var(--tts-border);margin:0 2px}.dropdown{border:1px solid transparent;border-radius:6px;background:transparent;padding:6px 9px;min-height:32px;gap:8px;font-size:13px;cursor:pointer;white-space:nowrap}.dropdown:hover{background:#eff0f1}.voice{width:158px;overflow:hidden;text-overflow:ellipsis}.dropdown,.dropdown::picker(select){appearance:base-select}.dropdown::picker-icon{color:#8f959e;width:12px}.dropdown::picker(select){top:auto;bottom:anchor(top);left:auto;right:anchor(right);margin:0 0 10px;min-width:max(120px,anchor-size(width));width:max-content;max-width:min(340px,calc(100vw - 24px));max-height:min(246px,calc(100vh - 112px));overflow:auto;padding:4px;border:1px solid #dee0e3;border-radius:8px;background:#fff;color:#1f2329;box-shadow:0 4px 16px rgba(31,35,41,.16)}.dropdown option{min-height:34px;padding:7px 12px;gap:10px;border-radius:4px;cursor:pointer}.dropdown option:hover{background:#eff0f1}.dropdown option:checked{background:#e1eaff;color:#1456f0}.dropdown option::checkmark{color:#1456f0}.refresh{font-size:19px;color:#646a73}

    [hidden]{display:none!important}@media(max-width:1000px){.bar{gap:12px;grid-template-columns:minmax(150px,1fr) auto auto}.player{padding-left:16px;padding-right:16px}.transport,.options{gap:6px}.counter{font-size:11px}.heading{gap:6px}.title{font-size:13px}}@media(max-width:600px){.options{grid-column:1/-1!important;grid-row:3!important;justify-content:center}.transport{grid-column:1/-1!important;justify-content:center!important}}@media(max-width:700px){.bar{grid-template-columns:1fr auto;gap:8px}.transport{grid-column:1;grid-row:2;justify-content:flex-start}.options{grid-column:2;grid-row:2}.info{grid-column:1/-1}.player{padding-top:12px;padding-bottom:8px}.play{width:40px;height:40px}.status{max-width:calc(100vw - 40px)}}
    .follow-return{position:absolute;bottom:calc(100% + 14px);left:50%;transform:translateX(-50%);border:1px solid var(--tts-border);border-radius:20px;padding:8px 16px;background:#fff;color:var(--tts-primary);box-shadow:0 3px 12px #1f23291f;white-space:nowrap;font-size:13px}
    </style>
    <section class="player" aria-label="飞书原文朗读播放器">
      <input class="seek" id="seek" type="range" min="0" max="1" value="0" step="1" disabled aria-label="全文朗读进度">
      <div class="bar">
        <div class="info"><div class="heading"><span id="document-title" class="title">原文朗读</span><span id="counter" class="counter">准备就绪</span></div><div id="status" class="status" role="status">点击播放，或选择正文起点</div></div>
        <div class="transport"><button id="prev" class="icon" title="上一句" aria-label="上一句" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h3v14H5zm14 0v14L8 12z"/></svg></button><button id="play" class="play" title="播放" aria-label="播放"></button><button id="next" class="icon" title="下一句" aria-label="下一句" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h3v14h-3zM5 5l11 7-11 7z"/></svg></button></div>
        <div class="options"><span class="divider"></span><button id="pick" class="text-btn">选起点</button><button id="selection" class="text-btn" hidden>只读选区</button><select id="rate" class="dropdown" aria-label="播放速度"><option value="0.8">0.8×</option><option value="1" selected>1.0×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option><option value="2">2.0×</option></select><select id="voice" class="dropdown voice" aria-label="朗读声音"><option value="">选择声音</option></select><button id="rescan" class="icon refresh" title="重新读取正文" aria-label="重新读取正文" disabled>↻</button></div>
      </div>
    </section>`;
  document.documentElement.append(host);
  const style=document.createElement('style');
  style.textContent='::highlight(feishu-tts-sentence){background-color:#f0f4ff;color:inherit}::highlight(feishu-tts-word){background-color:#bacefd;color:#1f2329}';
  document.documentElement.append(style);
  const $=id=>shadow.getElementById(id);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4.8v14.4L19.2 12z"/></svg>';
  const pauseIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  let port,connected=false,disposed=false,contextInvalidated=false,voices=[],chosen=null,armed=false,epoch=0;
  let playing=false,paused=false,queue=[],cursor=0,current=null,utteranceId=0,lastWord=null,bufferTarget=0;
  let records=new Map(),order=[],total=0,absolute=0,scanning=false,scanSaved=null,indexReady=false,scanCount=0;
  let observerTimer=null,seeking=false,selectionMode=false;
  let following=true,paintTimer=null;
  const status=(text,error=false)=>{$('status').textContent=text;$('status').title=text;$('status').classList.toggle('error',error);};
  const invalidContext=error=>/Extension context invalidated/i.test(error?.message||String(error));
  function contextReady(){
    if(contextInvalidated||disposed)return false;
    if(!chrome.runtime?.id){contextLost();return false;}
    return true;
  }
  function send(msg){
    if(!contextReady()||!connected)return false;
    try{port.postMessage(msg);return true;}
    catch(error){connected=false;port=null;fail(error);return false;}
  }
  const reloadButton=document.createElement('button');
  reloadButton.id='reload';reloadButton.className='text-btn point';reloadButton.textContent='刷新页面';reloadButton.hidden=true;
  reloadButton.onclick=()=>location.reload();
  shadow.querySelector('.options').append(reloadButton);
  const followButton=document.createElement('button');
  followButton.id='follow';followButton.className='follow-return';
  followButton.textContent='回到跟随';
  followButton.title='回到当前播放位置';
  shadow.append(followButton);
  function setFollowing(value){
    following=value;
    followButton.hidden=value;
    if(value)requestPaint();
  }
  function requestPaint(){
    if(disposed||scanning||!current)return;
    clearTimeout(paintTimer);const token=epoch;
    paintTimer=setTimeout(()=>{if(token===epoch)renderCurrent(token).catch(fail);},50);
  }
  function onManualScroll(event){
    if(!playing||scanning||event.composedPath().includes(host))return;
    if(event.type==='keydown'&&(!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)||event.target.closest?.('input,textarea,select,[contenteditable="true"]')))return;
    setFollowing(false);
  }
  function onScrollbar(event){
    if(!scroller||event.target!==scroller)return;
    const rect=scrollRect();
    if(event.clientX>=rect.right-Math.max(16,scroller.offsetWidth-scroller.clientWidth))onManualScroll(event);
  }
  document.addEventListener('wheel',onManualScroll,{passive:true,capture:true});
  document.addEventListener('touchmove',onManualScroll,{passive:true,capture:true});
  document.addEventListener('keydown',onManualScroll,true);
  document.addEventListener('pointerdown',onScrollbar,true);
  scrollEvents()?.addEventListener('scroll',requestPaint,{passive:true});
  followButton.onclick=()=>setFollowing(true);
  setFollowing(true);
  function clearHighlights(){CSS.highlights.delete('feishu-tts-word');CSS.highlights.delete('feishu-tts-sentence');}
  function zoneOf(node){return(node?.nodeType===1?node:node?.parentElement)?.closest('.text-editor[data-zone-container]');}
  function keyOf(zone){return zone?.closest('.block[data-record-id]')?.getAttribute('data-record-id')||(zone?'zone:'+zone.getAttribute('data-zone-id'):null);}
  function zones(){return[...root.querySelectorAll('.text-editor[data-zone-container]')].filter(e=>!e.closest('.bear-virtual-pre-renderer')&&e.getClientRects().length);}
  function mapText(zone){
    const walker=document.createTreeWalker(zone,NodeFilter.SHOW_TEXT,{acceptNode(node){return node.parentElement.closest('script,style,[data-zero-space],.docx-block-zero-space')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}});
    let text='',points=[],node;
    while((node=walker.nextNode()))for(let offset=0;offset<node.data.length;offset++){
      const char=node.data[offset];if(C.invisible.test(char))continue;
      text+=char==='\u00a0'?' ':char;points.push({node,offset});
    }
    return{text,points};
  }
  function rangeOf(map,start,end){
    if(end<=start||!map.points[start]||!map.points[end-1])return null;
    const a=map.points[start],b=map.points[end-1],range=document.createRange();
    range.setStart(a.node,a.offset);range.setEnd(b.node,b.offset+1);return range;
  }
  function position(node,offset){
    const zone=zoneOf(node);if(!zone||!root.contains(zone))return null;
    const prefix=document.createRange();prefix.selectNodeContents(zone);prefix.setEnd(node,offset);
    return{key:keyOf(zone),offset:C.normalize(prefix.toString()).length};
  }
  function drawProgress(value=absolute){
    value=Math.max(0,Math.min(total,value));
    $('seek').max=Math.max(1,total);$('seek').disabled=!indexReady||scanning;
    $('seek').value=value;$('seek').style.setProperty('--progress',(total?value/total*100:0)+'%');
    $('seek').setAttribute('aria-valuetext',`${Math.round(value)} / ${total} 字符`);
    $('counter').textContent=total?`${Math.floor(total?value/total*100:0)}% · ${Math.round(value).toLocaleString()} / ${total.toLocaleString()} 字`:'准备就绪';
  }
  function buttons(){
    if(contextInvalidated){
      for(const control of shadow.querySelectorAll('button,select,input'))control.disabled=true;
      reloadButton.disabled=false;reloadButton.hidden=false;followButton.hidden=true;
      $('play').innerHTML=playIcon;$('play').title='请刷新页面';$('play').setAttribute('aria-label','请刷新页面');
      return;
    }
    const label=scanning?'取消读取':playing&&!paused?'暂停':paused?'继续':'播放';
    $('play').innerHTML=scanning?'×':playing&&!paused?pauseIcon:playIcon;
    $('play').title=label;$('play').setAttribute('aria-label',label);
    $('prev').disabled=!indexReady||scanning;$('next').disabled=!indexReady||scanning;
    $('pick').disabled=scanning;$('selection').disabled=scanning;$('selection').hidden=!chosen?.hasSelection;
    $('seek').disabled=!indexReady||scanning;$('rescan').disabled=!indexReady||scanning;
  }
  function stop(message){
    ++epoch;
    clearTimeout(paintTimer);
    if(scanning&&scanSaved!==null&&scroller)scroller.scrollTop=scanSaved;
    scanSaved=null;scanning=false;playing=false;paused=false;current=null;lastWord=null;
    clearHighlights();buttons();if(message)status(message);
    send({type:'stop'});
    // A port belongs to playback, not idle UI or a potentially long DOM scan.
    const active=port;connected=false;port=null;
    if(active)try{active.disconnect();}catch(error){fail(error);}
  }
  function contextLost(){
    if(contextInvalidated||disposed)return;
    contextInvalidated=true;connected=false;port=null;armed=false;
    stop();detach();
    status('扩展已更新或停用，当前页面连接已失效。请刷新页面后继续朗读。',true);
  }
  function fail(error){
    if(disposed||contextInvalidated)return;
    if(invalidContext(error)||!chrome.runtime?.id){contextLost();return;}
    console.error('[飞书原文朗读]',error);stop();
    if(!contextInvalidated)status(error.message||String(error),true);
  }
  function invalidate(message='正文有更新，下次播放时重新读取'){
    if(!indexReady)return;
    indexReady=false;queue=[];stop(message);drawProgress();
  }
  function snapshot(){
    const top=scrollRect().top;
    return zones().map(zone=>({key:keyOf(zone),text:mapText(zone).text,top:zone.getBoundingClientRect().top-top+scroller.scrollTop})).filter(item=>item.text.trim());
  }
  function checkCache(){
    if(!indexReady||scanning||!scroller)return;
    const visible=snapshot();
    if(C.snapshotChanged(records,visible)){invalidate();return;}
    for(const item of visible)records.get(item.key).top=item.top;
  }
  const observer=new MutationObserver(()=>{
    if(!indexReady||scanning)return;
    clearTimeout(observerTimer);observerTimer=setTimeout(()=>{checkCache();requestPaint();},300);
  });
  observer.observe(root,{subtree:true,childList:true,characterData:true});
  function onEdit(){invalidate('正文正在编辑，下次播放时重新读取');}
  root.addEventListener('input',onEdit,true);
  function saveSelection(){
    if(armed||scanning)return;
    const selection=getSelection();if(!selection?.rangeCount)return;
    const range=selection.getRangeAt(0),start=position(range.startContainer,range.startOffset),end=position(range.endContainer,range.endOffset);
    if(!start||!end)return;
    chosen={start,end,hasSelection:!range.collapsed};buttons();
    if(!playing)status(range.collapsed?'已选择起点，点击播放':'已选中文字，点击播放从这里开始');
  }
  document.addEventListener('selectionchange',saveSelection);
  function pick(event){
    if(!armed||event.composedPath().includes(host))return;
    const zone=zoneOf(event.target);if(!zone||!root.contains(zone))return;
    event.preventDefault();event.stopImmediatePropagation();
    const range=document.caretRangeFromPoint(event.clientX,event.clientY);
    const start=range&&position(range.startContainer,range.startOffset);if(!start)return;
    armed=false;$('pick').classList.remove('point');$('pick').textContent='选起点';
    chosen={start,end:start,hasSelection:false};begin(false);
  }
  document.addEventListener('click',pick,true);
  async function settled(token){
    const started=performance.now(),timeout=15000;
    await sleep(180);if(token!==epoch)throw new Error('已取消');
    for(;;){
      const rect=scrollRect();
      const pending=[...root.querySelectorAll('.bear-virtual-renderUnit-placeholder')].filter(e=>{
        const r=e.getBoundingClientRect();return r.height>4&&r.width>4&&r.bottom>rect.top+10&&r.top<rect.bottom-10&&r.right>rect.left&&r.left<rect.right&&!e.closest('.bear-virtual-pre-renderer');
      });
      if(!pending.length)return;
      const elapsed=performance.now()-started;
      const progress=Math.min(100,Math.round(scroller.scrollTop/Math.max(1,scroller.scrollHeight-scroller.clientHeight)*100));
      if(elapsed>=timeout){
        const error=new Error(`正文读取到 ${progress}% 时等待渲染超过 15 秒，读取已停止。请确认此处正文正常显示后重试。`);
        error.details={scrollTop:scroller.scrollTop,scrollHeight:scroller.scrollHeight,elapsedMs:Math.round(elapsed),pending:pending.map(e=>{
          const r=e.getBoundingClientRect();return{parentId:e.getAttribute('data-parent-id'),top:r.top,bottom:r.bottom,height:r.height};
        })};
        throw error;
      }
      if(elapsed>=1000)status(`首次读取正文 ${progress}% · 等待飞书渲染 ${Math.floor(elapsed/1000)} 秒（可取消）`);
      // Check the DOM again after every wait, including the deadline wait.
      await sleep(Math.min(160,timeout-elapsed));if(token!==epoch)throw new Error('已取消');
    }
  }
  async function ensureIndex(token){
    if(location.origin+location.pathname!==documentKey)throw new Error('文档已切换，请重新点击扩展图标。');
    if(indexReady)return;
    if(!root.isConnected)throw new Error('正文尚未加载，请等待飞书加载完成。');
    if(!scroller)throw new Error('未识别到飞书正文滚动容器。');
    const saved=scroller.scrollTop;scanSaved=saved;records=new Map();order=[];scanning=true;scanCount++;buttons();
    try{
      scroller.scrollTop=0;
      for(let n=0;n<1200;n++){
        await settled(token);
        const visible=snapshot();for(const item of visible)records.set(item.key,item);
        order=C.mergeOrder(order,visible.map(x=>x.key));
        const max=scroller.scrollHeight-scroller.clientHeight,here=scroller.scrollTop;
        status(`首次读取正文 ${Math.min(100,Math.round(here/Math.max(1,max)*100))}%`);
        if(here>=max-2)break;
        if(n===1199)throw new Error('文档过长，本次读取未完成。');
        scroller.scrollTop=Math.min(max,here+Math.max(100,scroller.clientHeight*.55));
      }
      if(!order.length)throw new Error('没有读取到可朗读的正文。');
      total=C.characterIndex(order,records);indexReady=true;absolute=Math.min(absolute,total);drawProgress();
    }finally{if(token===epoch){scroller.scrollTop=saved;scanSaved=null;scanning=false;buttons();}}
  }
  function buildQueue(onlySelection,startAbsolute){
    selectionMode=onlySelection;queue=[];
    for(const key of order){
      const record=records.get(key);
      queue.push(...C.chunks(record.text).map(part=>({...part,key,absolute:record.absolute+part.start,endAbsolute:record.absolute+part.end})));
    }
    if(onlySelection){
      const a=records.get(chosen.start.key),b=records.get(chosen.end.key);
      if(!a||!b)throw new Error('所选位置已变化，请重新选择正文。');
      const from=a.absolute+chosen.start.offset,to=b.absolute+chosen.end.offset;
      queue=queue.filter(x=>x.endAbsolute>from&&x.absolute<to).map(x=>{
        const record=records.get(x.key),start=Math.max(x.start,from-record.absolute),end=Math.min(x.end,to-record.absolute);
        return{...x,start,end,text:record.text.slice(start,end),absolute:record.absolute+start,endAbsolute:record.absolute+end};
      });
      startAbsolute=from;
    }
    if(!queue.length)throw new Error('当前位置没有可朗读的文字。');
    bufferTarget=C.lookaheadStats(queue).targetCharacters;
    cursor=queue.findIndex(x=>x.endAbsolute>startAbsolute);
    if(cursor<0)cursor=0;
    absolute=Math.max(queue[cursor].absolute,Math.min(queue[cursor].endAbsolute-1,startAbsolute));
    drawProgress();buttons();
  }
  function findZone(key){return zones().find(zone=>keyOf(zone)===key);}
  async function renderCurrent(token){
    const item=current;
    if(!item||token!==epoch||disposed)return;
    const zone=findZone(item.key);
    if(!zone){
      clearHighlights();
      // Playback owns cached text. A missing virtualized node only defers paint.
      if(following&&scroller?.isConnected){
        const s=scrollRect(),bottom=Math.min(s.bottom,host.getBoundingClientRect().top);
        scroller.scrollTop=Math.max(0,records.get(item.key).top-(bottom-s.top)/2);
      }
      return;
    }
    const map=mapText(zone);
    if(map.text!==records.get(item.key).text){invalidate();throw new Error('正文内容已变化，请重新播放。');}
    const sentence=rangeOf(map,item.start,item.end);
    if(!sentence){clearHighlights();return;}
    CSS.highlights.set('feishu-tts-sentence',new Highlight(sentence));
    const word=lastWord&&rangeOf(map,lastWord.start,lastWord.end);
    if(word)CSS.highlights.set('feishu-tts-word',new Highlight(word));
    else CSS.highlights.delete('feishu-tts-word');
    if(following&&scroller?.isConnected){
      // Keep the reading position independent of transient word highlights.
      // A whole sentence/word can span lines; its midpoint would jump forward
      // before the first word, then jump back again during a word gap.
      const start=item.followStart,end=Math.min(item.end,start+(map.text.codePointAt(start)>0xffff?2:1));
      const anchor=rangeOf(map,start,end);
      if(!anchor)return;
      const r=anchor.getBoundingClientRect(),s=scrollRect();
      const top=Math.max(0,s.top)+20,bottom=Math.min(s.bottom,host.getBoundingClientRect().top)-20;
      const delta=(r.top+r.bottom-top-bottom)/2;
      if(Math.abs(delta)>2)scroller.scrollTop+=delta;
    }
  }
  function makeCurrent(){
    const chunk=queue[cursor],record=records.get(chunk.key);
    const start=Math.max(chunk.start,Math.min(chunk.end-1,absolute-record.absolute));
    return{...chunk,start,followStart:start,text:record.text.slice(start,chunk.end),id:++utteranceId};
  }
  async function speakCurrent(token=epoch,startPaused=false){
    if(token!==epoch)return;
    current=makeCurrent();lastWord=null;clearHighlights();
    await renderCurrent(token);if(token!==epoch)return;
    const voice=voices.find(v=>v.voiceName===$('voice').value);
    if(!voice)throw new Error('没有可用的 Kokoro 音色。');
    if(!connect())return;
    playing=true;paused=startPaused;buttons();drawProgress();status(paused?'已暂停':current.text);
    const ahead=queue.slice(cursor+1,C.lookaheadEnd(queue,cursor,bufferTarget)).map((chunk,i)=>({
      cacheKey:String(cursor+i+1),text:records.get(chunk.key).text.slice(chunk.start,chunk.end),
    }));
    send({type:'speak',id:current.id,sessionId:epoch,cacheKey:String(cursor),ahead,paused,text:current.text,voice:voice.voiceName,lang:voice.lang,rate:Number($('rate').value)});
  }
  async function begin(onlySelection=false){
    if(!contextReady())return;
    if(onlySelection&&!chosen?.hasSelection){status('请先拖选正文。',true);return;}
    if(!voices.some(v=>v.voiceName===$('voice').value)){status('Kokoro 音色尚未加载。',true);return;}
    checkCache();const target=chosen;stop();const token=epoch;
    try{
      await ensureIndex(token);if(token!==epoch)return;
      let startAbsolute=absolute>=total?0:absolute;
      if(target){const record=records.get(target.start.key);if(!record)throw new Error('未找到所选位置，请重新选起点。');startAbsolute=record.absolute+target.start.offset;}
      buildQueue(onlySelection,startAbsolute);chosen=null;await speakCurrent(token);
    }catch(e){if(token===epoch)fail(e);}
  }
  function highlightWord(event){
    const record=records.get(current.key),[a,b]=C.wordRange(current.text,event.charIndex,event.length);
    lastWord={start:current.start+a,end:current.start+b,text:record.text.slice(current.start+a,current.start+b)};
    if(b>a)current.followStart=lastWord.start;
    absolute=record.absolute+current.start+a;if(!seeking)drawProgress();
    renderCurrent(epoch).catch(fail);
  }
  function onMessage(msg){
    if(!contextReady())return;
    if(msg.type==='voices'){
      const selected=$('voice').value;
      voices=msg.voices.filter(v=>v.eventTypes?.includes('word')&&v.eventTypes?.includes('end'));
      voices.sort((a,b)=>Number(b.lang==='zh-CN')-Number(a.lang==='zh-CN'));$('voice').replaceChildren();
      for(const voice of voices){const option=document.createElement('option');option.value=voice.voiceName;option.textContent=voice.label||voice.voiceName+' · '+voice.lang;$('voice').append(option);}
      restorePreferences(selected);
      if(!voices.length)status('Kokoro 音色尚未加载。',true);
    }else if(msg.type==='error')fail(new Error(msg.message));
    else if(msg.type==='status'&&current&&msg.id===current.id&&!paused)status(msg.message);
    else if(msg.type==='interrupted')stop(msg.reason);
    else if(msg.type==='event'&&current&&msg.id===current.id){
      try{
        if(msg.event.type==='word')highlightWord(msg.event);
        else if(msg.event.type==='word-end'){lastWord=null;CSS.highlights.delete('feishu-tts-word');}
        else if(msg.event.type==='start'&&!paused)status(current.text);
        else if(msg.event.type==='end'){
          absolute=queue[cursor].endAbsolute;cursor++;drawProgress();
          if(cursor>=queue.length){stop(selectionMode?'选区朗读完成':'全文朗读完成');return;}
          absolute=queue[cursor].absolute;const token=epoch;speakCurrent(token).catch(e=>{if(token===epoch)fail(e);});
        }else if(msg.event.type==='error')fail(new Error(msg.event.errorMessage||'Kokoro 朗读引擎错误'));
        else if(['interrupted','cancelled'].includes(msg.event.type))stop('朗读已中断');
      }catch(e){fail(e);}
    }
  }
  function connect(){
    if(!contextReady())return false;
    if(connected)return true;
    try{
      const active=chrome.runtime.connect({name:'feishu-original-tts'});port=active;connected=true;
      active.onMessage.addListener(onMessage);
      active.onDisconnect.addListener(()=>{
        const error=chrome.runtime.lastError;
        if(port!==active||disposed||contextInvalidated)return;
        connected=false;port=null;
        if(error&&invalidContext(error)){contextLost();return;}
        if(!contextReady())return;
        stop();status(error?.message||'扩展连接已断开，点击播放重新连接。',true);
      });
      return true;
    }catch(error){connected=false;port=null;fail(error);return false;}
  }
  async function loadVoices(){
    if(!contextReady())return;
    try{
      // One-shot metadata does not need to hold the MV3 worker open.
      const response=await chrome.runtime.sendMessage({target:'kokoro-background',type:'voices'});
      if(!response||response.type!=='voices')throw new Error('未能读取 Kokoro 音色。');
      onMessage(response);
    }catch(error){fail(error);}
  }
  async function restorePreferences(selected){
    try{
      if(!contextReady())return;
      const saved=await chrome.storage.local.get(['voice','rate']);
      if(!contextReady())return;
      const name=selected||saved.voice;
      if(voices.some(v=>v.voiceName===name))$('voice').value=name;
      if(saved.rate)$('rate').value=saved.rate;
    }catch(error){fail(error);}
  }
  async function seekTo(value,autoplay){
    if(!indexReady)return;
    stop();chosen=null;const token=epoch;
    const pos=C.locateCharacter(order,records,Math.min(value,total-1));
    const target=records.get(pos.key).absolute+pos.offset;
    try{
      buildQueue(false,target);
      if(autoplay)await speakCurrent(token);
      else{current=makeCurrent();await renderCurrent(token);if(token===epoch){status('已定位 · 点击播放继续');current=null;}}
    }catch(e){if(token===epoch)fail(e);}
  }
  $('play').onclick=()=>{
    if(!contextReady())return;
    if(scanning){stop('读取已取消');return;}
    if(playing){paused=!paused;if(!send({type:paused?'pause':'resume'}))return;buttons();status(paused?'已暂停':current?.text||'继续朗读');return;}
    begin(false);
  };
  $('pick').onclick=()=>{armed=!armed;$('pick').classList.toggle('point',armed);$('pick').textContent=armed?'取消点选':'选起点';status(armed?'点击正文中的一个词，立即从那里播放':'已取消点选');};
  $('selection').onclick=()=>begin(true);
  async function skip(delta){
    if(!indexReady)return;
    const autoplay=playing&&!paused;
    if(!queue.length)buildQueue(false,absolute);
    const next=Math.max(0,Math.min(queue.length-1,cursor+delta));
    await seekTo(queue[next].absolute,autoplay);
  }
  $('prev').onclick=()=>skip(-1);$('next').onclick=()=>skip(1);
  $('seek').oninput=()=>{seeking=true;drawProgress(Number($('seek').value));};
  $('seek').onchange=()=>{const target=Number($('seek').value),autoplay=playing&&!paused;seeking=false;seekTo(target,autoplay);};
  $('seek').addEventListener('pointercancel',()=>{seeking=false;drawProgress();});
  $('rescan').onclick=async()=>{
    invalidate('重新读取正文');stop();const token=epoch;
    try{await ensureIndex(token);if(token===epoch){queue=[];drawProgress();status('正文已更新 · 点击播放');}}catch(e){if(token===epoch)fail(e);}
  };
  for(const name of ['voice','rate'])$(name).onchange=async()=>{
    if(!contextReady())return;
    try{
      await chrome.storage.local.set({voice:$('voice').value,rate:$('rate').value});
      if(!contextReady())return;
      if(playing){const wasPaused=paused;stop();const token=epoch;await speakCurrent(token,wasPaused);}
    }catch(error){fail(error);}
  };
  function detach(){
    observer.disconnect();clearTimeout(observerTimer);clearTimeout(paintTimer);
    document.removeEventListener('selectionchange',saveSelection);document.removeEventListener('click',pick,true);root.removeEventListener('input',onEdit,true);
    document.removeEventListener('wheel',onManualScroll,true);document.removeEventListener('touchmove',onManualScroll,true);
    document.removeEventListener('keydown',onManualScroll,true);document.removeEventListener('pointerdown',onScrollbar,true);
    scrollEvents()?.removeEventListener('scroll',requestPaint);
  }
  function dispose(){
    stop();detach();
    disposed=true;host.remove();style.remove();delete globalThis.FeishuOriginalTTS;
  }
  globalThis.FeishuOriginalTTS={
    matches(node,key){
      if(documentKey!==key||disposed)return false;
      // Feishu may replace the entire editor while keeping this document open.
      if(node&&node!==root){
        observer.disconnect();root.removeEventListener('input',onEdit,true);scrollEvents()?.removeEventListener('scroll',requestPaint);
        root=node;scroller=findScroller();
        observer.observe(root,{subtree:true,childList:true,characterData:true});root.addEventListener('input',onEdit,true);
        scrollEvents()?.addEventListener('scroll',requestPaint,{passive:true});checkCache();requestPaint();
      }else if(!node)clearHighlights();
      else{
        const next=findScroller();
        if(next!==scroller){scrollEvents()?.removeEventListener('scroll',requestPaint);scroller=next;scrollEvents()?.addEventListener('scroll',requestPaint,{passive:true});}
        requestPaint();
      }
      return true;
    },
    show(){if(!contextReady())return;host.style.display='';checkCache();buttons();drawProgress();},dispose,contextLost,isContextInvalidated:()=>contextInvalidated,
    diagnostics(){return{contextInvalidated,indexReady,scanCount,total,absolute,order:order.slice(),records:[...records.values()],queue:queue.map(x=>({...x})),cursor,scanning,playing,paused,following,lastWord,current:current&&{...current},status:$('status').textContent};}
  };
  $('document-title').textContent=C.normalize(document.title).replace(/\s*[-|｜]\s*飞书云文档.*$/,'');$('document-title').title=$('document-title').textContent;
  buttons();drawProgress();saveSelection();loadVoices();
  }
  // Feishu loads the editor asynchronously and can navigate without a page refresh.
  function sync(){
    if(!chrome.runtime?.id||globalThis.FeishuOriginalTTS?.isContextInvalidated()){
      clearInterval(poll);globalThis.FeishuOriginalTTS?.contextLost();return;
    }
    const root=document.querySelector('.root-block');
    const key=location.origin+location.pathname;
    const current=globalThis.FeishuOriginalTTS;
    if(current?.matches(root,key))return;
    current?.dispose();
    if(root)mount(root,key);
  }
  globalThis.FeishuTTSLoader={sync};
  const poll=setInterval(sync,750);
  sync();
})();
