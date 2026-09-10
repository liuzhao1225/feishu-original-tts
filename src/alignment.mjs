// All offsets are UTF-16 offsets into the original DOM text.
export class MappedText {
  constructor(text, spans) {
    this.text = text;
    this.spans = spans ?? Array.from({ length: text.length }, (_, i) => ({ start: i, end: i + 1 }));
  }
  replace(pattern, replacement) {
    const spans = [];
    let cursor = 0;
    const text = this.text.replace(pattern, (...args) => {
      const hasGroups = typeof args.at(-1) === 'object';
      const offset = args.at(hasGroups ? -3 : -2);
      const match = args[0];
      let result;
      if (typeof replacement === 'function') result = String(replacement(...args));
      else result = replacement.replace(/\$(\$|&|`|'|\d{1,2})/g, (_, key) => {
        if (key === '$') return '$';
        if (key === '&') return match;
        if (key === '`') return this.text.slice(0, offset);
        if (key === "'") return this.text.slice(offset + match.length);
        return args[Number(key)] ?? '';
      });
      spans.push(...this.spans.slice(cursor, offset));
      if (result === match) spans.push(...this.spans.slice(offset, offset + match.length));
      else {
        const origin = this.span(offset, offset + match.length);
        for (let i = 0; i < result.length; i++) spans.push(origin);
      }
      cursor = offset + match.length;
      return result;
    });
    spans.push(...this.spans.slice(cursor));
    return new MappedText(text, spans);
  }
  trim() {
    const start = this.text.length - this.text.trimStart().length;
    return this.slice(start, this.text.trimEnd().length);
  }
  slice(start, end) { return new MappedText(this.text.slice(start, end), this.spans.slice(start, end)); }
  span(start, end) {
    const selected = this.spans.slice(start, end);
    if (!selected.length) return { start: this.spans[start]?.start ?? this.text.length, end: this.spans[start]?.start ?? this.text.length };
    return { start: Math.min(...selected.map(s => s.start)), end: Math.max(...selected.map(s => s.end)) };
  }
}

// The decoder emits 600 samples per duration frame at 24 kHz. Include BOS in
// the running clock. Punctuation/space durations remain real gaps in the audio.
export function wordTimings(tokens, durations, sampleCount, sampleRate = 24000) {
  if (durations.length !== tokens.length + 2) throw new Error(`音素时长数量不匹配：${durations.length}/${tokens.length + 2}`);
  const frames = Array.from(durations, Number);
  if (frames.some(n => !Number.isFinite(n) || n < 0)) throw new Error('模型返回了无效音素时长');
  const expected = frames.reduce((a, b) => a + b, 0) * 600;
  if (Math.abs(expected - sampleCount) > 1200) throw new Error(`音频与音素时长不匹配：${sampleCount}/${expected}`);
  let sample = frames[0] * 600;
  const words = [];
  for (let i = 0; i < tokens.length; i++) {
    const start = Math.min(sampleCount, sample) / sampleRate;
    sample += frames[i + 1] * 600;
    const end = Math.min(sampleCount, sample) / sampleRate;
    const token = tokens[i];
    if (!token.span || end <= start) continue;
    const last = words.at(-1);
    // Normalization may expand one source span into several spoken words.
    if (last && token.span.start < last.charIndex + last.length) {
      last.length = Math.max(last.charIndex + last.length, token.span.end) - last.charIndex;
      last.end = end;
    } else words.push({ charIndex: token.span.start, length: token.span.end - token.span.start, start, end });
  }
  return words;
}

export function wordAtTime(words, time) {
  let lo = 0, hi = words.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (time < words[mid].start) hi = mid - 1;
    else if (time >= words[mid].end) lo = mid + 1;
    else return mid;
  }
  return -1;
}
