const test=require('node:test');
const assert=require('node:assert/strict');
require('../extension/core.js');
const C=globalThis.FeishuTTSCore;
test('virtual snapshots keep document order and insert table cells before later paragraphs',()=>{
  let order=C.mergeOrder([],['title','p1','cell1','after']);
  order=C.mergeOrder(order,['cell1','cell2','cell3','after','p2']);
  order=C.mergeOrder(order,['cell3','after','p2']);
  assert.deepEqual(order,['title','p1','cell1','cell2','cell3','after','p2']);
});
test('sentence offsets reconstruct original selected text including mixed Chinese, links and emoji',()=>{
  const source='前言。题库😀与 PDF。链接标题：教师端 2.0！后记。';
  const start=3,end=source.length-3;
  const chunks=C.chunks(source,start,end);
  assert.equal(chunks.map(x=>x.text).join(''),source.slice(start,end));
  for(const x of chunks)assert.equal(source.slice(x.start,x.end),x.text);
});
test('long utterances retain every character and never split a surrogate pair',()=>{
  const source='题'.repeat(179)+'😀'+'知识点，'.repeat(100);
  const chunks=C.chunks(source);
  assert.equal(chunks.map(x=>x.text).join(''),source);
  for(const x of chunks){assert.ok(x.text.length<=180);assert.ok(!/[\uD800-\uDBFF]$/.test(x.text));assert.ok(!/^[\uDC00-\uDFFF]/.test(x.text));}
});
test('voice-supplied word offsets use UTF-16 and explicit length',()=>{
  const source='😀题库导入';
  assert.deepEqual(C.wordRange(source,2,2),[2,4]);
  assert.equal(source.slice(...C.wordRange(source,2,2)),'题库');
});
test('missing event length is resolved by segmentation, not a synthetic timer',()=>{
  assert.equal('选择开始播放的位置'.slice(...C.wordRange('选择开始播放的位置',2,-1)),'开始');
});
test('normalization retains readable whitespace and removes Feishu invisible markers',()=>{
  assert.equal(C.normalize('词\u200b\u2060级\u00a0高亮😀'),'词级 高亮😀');
});
test('virtualized unmounts and remounts do not invalidate cached text',()=>{
  const records=new Map([['a',{text:'标题'}],['b',{text:'表格链接'}],['c',{text:'最后一句'}]]);
  assert.equal(C.snapshotChanged(records,[{key:'a',text:'标题'},{key:'c',text:'最后一句'}]),false);
  assert.equal(C.snapshotChanged(records,[]),false);
  assert.equal(C.snapshotChanged(records,[{key:'b',text:'表格链接'}]),false);
  assert.equal(C.snapshotChanged(records,[{key:'b',text:'修改的链接'}]),true);
  assert.equal(C.snapshotChanged(records,[{key:'d',text:'新增段落'}]),true);
});
test('full-document character positions cross table block boundaries and preserve emoji',()=>{
  const order=['a','b','c'];
  const records=new Map([['a',{key:'a',text:'题库'}],['b',{key:'b',text:'😀表格'}],['c',{key:'c',text:'结束'}]]);
  assert.equal(C.characterIndex(order,records),8);
  assert.deepEqual(C.locateCharacter(order,records,0),{key:'a',offset:0});
  assert.deepEqual(C.locateCharacter(order,records,2),{key:'b',offset:0});
  assert.deepEqual(C.locateCharacter(order,records,3),{key:'b',offset:0});
  assert.deepEqual(C.locateCharacter(order,records,6),{key:'c',offset:0});
  assert.deepEqual(C.locateCharacter(order,records,8),{key:'c',offset:1});
});

test('lookahead covers both the statistical floor and the next uncached sentence',()=>{
 const queue=[60,5,10,20,40,100,8].map(n=>({text:'字'.repeat(n)}));
 assert.equal(C.lookaheadEnd(queue,0),6,'current playback must not count toward the buffer');
 assert.equal(C.lookaheadEnd([{text:'当前'},{text:'长'.repeat(100)},{text:'短'.repeat(5)}],0),2,'one long sentence is enough');
 assert.equal(C.lookaheadEnd([{text:'当前句'},{text:'一二三'},{text:'四五六'}],0),2,'equal lengths meet the target');
 assert.equal(C.lookaheadEnd(queue,queue.length-1),queue.length,'end of document has no lookahead');
 assert.equal(C.lookaheadEnd([{text:'当前'},{text:'末句'}],0),2,'include remaining final sentence');
 assert.equal(C.characterCount(' 中 文\n😀 A\t'),4,'count Unicode characters without whitespace');
});

test('queue statistics use population standard deviation and are bounded by the reading selection',()=>{
 const queue=[10,20,30].map(n=>({text:'字'.repeat(n)}));
 const stats=C.lookaheadStats(queue);
 assert.equal(stats.mean,20);assert.ok(Math.abs(stats.std-Math.sqrt(200/3))<1e-12);
 assert.equal(stats.targetCharacters,29);
 assert.deepEqual(C.lookaheadStats(queue.slice(1,2)),{mean:20,std:0,targetCharacters:20});
 assert.deepEqual(C.lookaheadStats([]),{mean:0,std:0,targetCharacters:0});
});

test('a statistical floor crosses descending short sentences and repeated one-character prefixes',()=>{
 for(const lengths of [[10,5,4,100],[1,1,1,1,1,1,1,100]]){
  const queue=lengths.map(n=>({text:'字'.repeat(n)}));
  assert.equal(C.lookaheadEnd(queue,0),queue.length,'long sentence must enter the initial prefetch window');
 }
 const queue=[10,...Array(100).fill(1),100].map(n=>({text:'字'.repeat(n)}));
 const {targetCharacters}=C.lookaheadStats(queue),end=C.lookaheadEnd(queue,0);
 assert.equal(end,1+targetCharacters,'a longer short run stops when it provides enough statistical buffer');
 assert.ok(end<queue.length,'statistical buffer need not include a distant outlier immediately');
 assert.equal(C.lookaheadEnd([{text:'当前'},{text:'长'.repeat(100)},{text:'短'}],0,120),3,'the statistical floor still applies when the next sentence is short');
});

test('advancing playback never discards unplayed audio already selected by the character budget',()=>{
 const queue=[8,5,10,20,40,100,8,3,90,2].map(n=>({text:'字'.repeat(n)}));
 let previousEnd=0;
 for(let cursor=0;cursor<queue.length;cursor++){
  const end=C.lookaheadEnd(queue,cursor);
  assert.ok(end>=previousEnd,'unplayed prefetch must remain in the next window');previousEnd=end;
 }
});
