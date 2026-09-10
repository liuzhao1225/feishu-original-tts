(() => {
  if (globalThis.FeishuTTSCore) return;
  const invisible = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/;
  const normalize = text => [...text].filter(c=>!invisible.test(c)).join('').replace(/\u00a0/g,' ');
  // Merge ordered, partially rendered DOM snapshots without moving already seen blocks.
  function mergeOrder(order, observed) {
    const out = order.slice();
    for (let i=0;i<observed.length;i++) {
      const id=observed[i];
      if(out.includes(id)) continue;
      const next=observed.slice(i+1).find(x=>out.includes(x));
      if(next) out.splice(out.indexOf(next),0,id);
      else {
        const prev=observed.slice(0,i).reverse().find(x=>out.includes(x));
        out.splice(prev ? out.indexOf(prev)+1 : out.length,0,id);
      }
    }
    return out;
  }
  function chunks(text, start=0, end=text.length) {
    const result=[];
    const sentence=new Intl.Segmenter('zh-CN',{granularity:'sentence'});
    for(const seg of sentence.segment(text.slice(start,end))) {
      let offset=start+seg.index;
      let rest=seg.segment;
      while(rest.length) {
        let size=Math.min(180,rest.length);
        if(size<rest.length) {
          const cut=Math.max(rest.lastIndexOf('，',size-1),rest.lastIndexOf('；',size-1),rest.lastIndexOf('、',size-1),rest.lastIndexOf(' ',size-1));
          if(cut>40) size=cut+1;
          if(/[\uD800-\uDBFF]/.test(rest[size-1])) size--;
        }
        const part=rest.slice(0,size);
        if(part.trim()) result.push({text:part,start:offset,end:offset+size});
        offset+=size;rest=rest.slice(size);
      }
    }
    return result;
  }
  function wordRange(text,index,length) {
    index=Math.max(0,Math.min(index,text.length));
    if(length>0) return [index,Math.min(text.length,index+length)];
    for(const s of new Intl.Segmenter('zh-CN',{granularity:'word'}).segment(text)) {
      if(s.index<=index && s.index+s.segment.length>index) return [s.index,s.index+s.segment.length];
    }
    return [index,Math.min(text.length,index+1)];
  }
  function characterCount(text) {
    return [...text].filter(char=>!/\s/u.test(char)).length;
  }
  function lookaheadStats(queue) {
    const lengths=queue.map(item=>characterCount(item.text));
    const mean=lengths.length?lengths.reduce((sum,length)=>sum+length,0)/lengths.length:0;
    const std=lengths.length?Math.sqrt(lengths.reduce((sum,length)=>sum+(length-mean)**2,0)/lengths.length):0;
    return {mean,std,targetCharacters:Math.ceil(mean+std)};
  }
  function lookaheadEnd(queue,cursor,targetCharacters=lookaheadStats(queue).targetCharacters) {
    let end=cursor+1,buffered=0;
    // Exclude current playback: its remaining audio shrinks continuously.
    // A fixed queue-wide mean + std floor carries the buffer past short runs.
    // Also cover the next uncached sentence if it exceeds that floor.
    while(end<queue.length){
      buffered+=characterCount(queue[end].text);
      end++;
      if(end===queue.length||buffered>=Math.max(targetCharacters,characterCount(queue[end].text)))break;
    }
    return end;
  }
  // Virtualization removes DOM nodes while leaving the document unchanged.
  // Only new blocks or changed text in a rendered block invalidate a full index.
  function snapshotChanged(records, snapshot) {
    return snapshot.some(item=>!records.has(item.key)||records.get(item.key).text!==item.text);
  }
  function characterIndex(order, records) {
    let total=0;
    for(const key of order){const record=records.get(key);record.absolute=total;total+=record.text.length;}
    return total;
  }
  function locateCharacter(order, records, absolute) {
    for(let i=0;i<order.length;i++) {
      const record=records.get(order[i]);
      if(absolute<record.absolute+record.text.length || i===order.length-1) {
        let offset=Math.max(0,Math.min(record.text.length-1,absolute-record.absolute));
        if(/[\uDC00-\uDFFF]/.test(record.text[offset])&&offset>0)offset--;
        return {key:record.key,offset};
      }
    }
    return null;
  }
  globalThis.FeishuTTSCore={normalize,invisible,mergeOrder,chunks,wordRange,characterCount,lookaheadStats,lookaheadEnd,snapshotChanged,characterIndex,locateCharacter};
})();
