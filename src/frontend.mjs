import { MappedText } from './alignment.mjs';
import { phonemize, phonemize_zh_text, normalize_text, normalize_chinese_numbers, normalize_chinese_punctuation } from './vendor/phonemize.mjs';

export async function textToTokens(text, vocab, language = 'z') {
  // Expand each list marker independently so ①② stays two numbered items.
  // MappedText keeps both digits of ⑩ (and their spoken expansion) on that glyph.
  const mapped = new MappedText(text).replace(/[①-⑳]/gu, marker => ` ${marker.normalize('NFKC')} `);
  const tokens = [];
  const append = (phones, span) => {
    for (const phone of phones) {
      const id = vocab[phone];
      if (id === undefined) {
        if (/\p{L}|\p{N}/u.test(phone)) throw new Error('模型词表缺少音素：' + phone);
        continue;
      }
      tokens.push({ id, phone, span });
    }
  };
  const english = async (mapped) => {
    const normalized = normalize_text(mapped);
    for (const segment of new Intl.Segmenter('en', { granularity: 'word' }).segment(normalized.text)) {
      if (segment.isWordLike) {
        const phones = await phonemize(segment.segment, language === 'b' ? 'b' : 'a', false);
        append(phones, normalized.span(segment.index, segment.index + segment.segment.length));
      } else append(segment.segment, null);
    }
  };
  // Route Han through the Chinese frontend even when an English voice is chosen.
  if (/\p{Script=Han}/u.test(text) || language === 'z') {
    const normalized = normalize_chinese_numbers(normalize_chinese_punctuation(mapped));
    let sectionIndex = 0;
    for (const match of normalized.text.matchAll(/[\u4E00-\u9FFF]+|[^\u4E00-\u9FFF]+/g)) {
      if (sectionIndex++) append(' ', null);
      if (/^[\u4E00-\u9FFF]/.test(match[0])) {
        let wordIndex = 0;
        phonemize_zh_text(match[0], (start, end, phones) => {
          if (wordIndex++) append('/', null);
          append(phones, normalized.span(match.index + start, match.index + end));
        });
      } else if (/[A-Za-z]/.test(match[0])) await english(normalized.slice(match.index, match.index + match[0].length));
      else append(match[0], null);
    }
  } else await english(mapped);
  for (let i = tokens.length - 1; i > 0; i--) {
    if ((tokens[i].phone === ' ' || /[,.;:!?]/.test(tokens[i].phone)) && tokens[i - 1].phone === ' ') tokens.splice(i - 1, 1);
  }
  while (tokens[0]?.phone === ' ') tokens.shift();
  while (tokens.at(-1)?.phone === ' ') tokens.pop();
  if (!tokens.some(t => t.span)) throw new Error('这段文字没有可合成的中英文内容');
  return tokens;
}

export function splitTokens(tokens, limit = 480) {
  const batches = [];
  let start = 0;
  while (start < tokens.length) {
    let end = Math.min(start + limit, tokens.length);
    if (end < tokens.length) {
      // Never cut an expanded number, an English word, or a Chinese G2P word.
      while (end > start && tokens[end]?.span && tokens[end - 1]?.span && tokens[end].span.start < tokens[end - 1].span.end) end--;
      if (end === start) throw new Error('单个词展开后超过模型长度，请缩短该词或数字');
      const pause = tokens.slice(start, end).findLastIndex(t => /[.!?;:,]/.test(t.phone));
      if (pause > (end - start) / 2) end = start + pause + 1;
    }
    batches.push(tokens.slice(start, end));
    start = end;
  }
  return batches;
}
