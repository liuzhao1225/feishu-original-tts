import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MappedText, wordTimings, wordAtTime } from '../src/alignment.mjs';
import { textToTokens, splitTokens } from '../src/frontend.mjs';
import { normalize_chinese_numbers, normalize_text } from '../src/vendor/phonemize.mjs';
const vocab = JSON.parse(fs.readFileSync(new URL('../extension/assets/vocab.json', import.meta.url)));

test('normalization retains original number/date spans, including reordered fractions', () => {
  const text = '😀在2026年9月10日，完成12.5%，比例为1/3。';
  const result = normalize_chinese_numbers(new MappedText(text));
  for (const [spoken, source] of [['二零二六年九月十日','2026年9月10日'],['百分之十二点五','12.5%'],['三分之一','1/3']]) {
    const i = result.text.indexOf(spoken);
    assert.ok(i >= 0, result.text);
    const span = result.span(i, i + spoken.length);
    assert.equal(text.slice(span.start, span.end), source);
  }
  const suffix = result.text.indexOf('比例为');
  const span = result.span(suffix, suffix + 3);
  assert.equal(text.slice(span.start, span.end), '比例为');
});
test('English normalization maps abbreviation and decimal expansion to source', () => {
  const original = ' Dr. Smith paid $12.50. ';
  const mapped = normalize_text(new MappedText(original));
  assert.ok(mapped.text.startsWith('Doctor Smith'));
  assert.deepEqual(mapped.span(0,6), {start:1,end:4});
  const i = mapped.text.indexOf('12 dollars');
  assert.ok(i >= 0);
  assert.equal(original.slice(...Object.values(mapped.span(i,i+10))), '$12.50');
});
test('Chinese, mixed English and emoji retain monotonic UTF-16 word offsets', async () => {
  const text = '😀今天学习 English，完成12.5%的内容。';
  const tokens = await textToTokens(text,vocab);
  const spans = tokens.filter(t=>t.span).map(t=>t.span);
  assert.equal(spans[0].start,2);
  assert.ok(spans.some(s=>text.slice(s.start,s.end)==='English'));
  assert.ok(spans.some(s=>text.slice(s.start,s.end)==='12.5%'));
  for(let i=1;i<spans.length;i++)assert.ok(spans[i].start>=spans[i-1].start);
  assert.ok(!tokens.map(t=>t.phone).join('').includes('  '));
});
test('American rhotic schwa is pronounceable and retains the complete original word span', async () => {
  for (const [text,language] of [['teacher water computer server better','a'],['😀老师使用 computer 和 server。','z']]) {
    const tokens = await textToTokens(text,vocab,language);
    assert.ok(tokens.every(t=>Number.isInteger(t.id)));
    assert.ok(!tokens.some(t=>t.phone==='ɚ'));
    for (const match of text.matchAll(/teacher|water|computer|server|better/g)) {
      const span={start:match.index,end:match.index+match[0].length};
      const word=tokens.filter(t=>t.span?.start===span.start&&t.span?.end===span.end);
      assert.equal(word.slice(-2).map(t=>t.phone).join(''),'əɹ',match[0]);
    }
    const durations=Array(tokens.length+2).fill(2);
    const words=wordTimings(tokens,durations,durations.length*2*600);
    for(const match of text.matchAll(/teacher|water|computer|server|better/g)) {
      const aligned=words.filter(w=>w.charIndex===match.index);
      assert.equal(aligned.length,1);
      assert.equal(text.slice(aligned[0].charIndex,aligned[0].charIndex+aligned[0].length),match[0]);
    }
  }
});
test('timestamps use unequal model durations and leave punctuation as silence', () => {
  const tokens = [{span:{start:2,end:4}},{span:{start:2,end:4}},{span:null},{span:{start:5,end:10}}];
  const durations = BigInt64Array.from([2n,3n,7n,4n,9n,1n]);
  const words = wordTimings(tokens,durations,26*600);
  assert.deepEqual(words,[{charIndex:2,length:2,start:.05,end:.3},{charIndex:5,length:5,start:.4,end:.625}]);
  assert.equal(wordAtTime(words,.02),-1);
  assert.equal(wordAtTime(words,.1),0);
  assert.equal(wordAtTime(words,.35),-1);
  assert.equal(wordAtTime(words,.5),1);
  assert.equal(wordAtTime(words,.625),-1);
});
test('circled list numbers are spoken and highlighted at the original glyph in Chinese and English',async()=>{
  for(const [text,language] of [['😀①准备②执行，⑩总结。','z'],['① First, ⑩ review.','a'],['①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳','z']]){
    const tokens=await textToTokens(text,vocab,language);
    assert.ok(tokens.every(t=>Number.isInteger(t.id)));
    const durations=Array(tokens.length+2).fill(2);
    const words=wordTimings(tokens,durations,durations.length*2*600);
    for(const match of text.matchAll(/[①-⑳]/gu)){
      const aligned=words.filter(w=>w.charIndex===match.index);
      assert.equal(aligned.length,1,match[0]);assert.equal(aligned[0].length,1);
      assert.equal(text.slice(aligned[0].charIndex,aligned[0].charIndex+aligned[0].length),match[0]);
    }
    if(text==='😀①准备②执行，⑩总结。'){
      const expected=await textToTokens('一',vocab,'z');
      assert.equal(tokens.filter(t=>t.span?.start===2).map(t=>t.phone).join(''),expected.map(t=>t.phone).join(''));
    }
  }
});
test('expanded original spans remain one highlight and invalid timing contracts fail', () => {
  const tokens = [{span:{start:3,end:8}},{span:null},{span:{start:3,end:8}}];
  const words = wordTimings(tokens,[1,4,2,6,1],14*600);
  assert.equal(words.length,1);assert.equal(words[0].length,5);
  assert.throws(()=>wordTimings(tokens,[1,2],2000),/数量不匹配/);
  assert.throws(()=>wordTimings(tokens,[1,2,3,4,5],1),/不匹配/);
});
test('long input is split at phoneme boundaries without truncation or splitting words', () => {
  const tokens = Array.from({length:1100},(_,i)=>({id:1,phone:'a',span:{start:Math.floor(i/5),end:Math.floor(i/5)+1}}));
  const batches = splitTokens(tokens);
  assert.deepEqual(batches.flat(),tokens);
  assert.ok(batches.every(b=>b.length<=480));
  for(let i=1;i<batches.length;i++)assert.notEqual(batches[i-1].at(-1).span.start,batches[i][0].span.start);
});
