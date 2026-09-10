import * as ort from 'onnxruntime-web/wasm';
import { textToTokens, splitTokens } from './frontend.mjs';
import { wordTimings } from './alignment.mjs';

export class KokoroEngine {
  constructor({ baseUrl, readAsset, onStatus = () => {} }) {
    this.baseUrl = baseUrl;
    this.readAsset = readAsset ?? (async path => {
      const response = await fetch(new URL(path, baseUrl));
      if (!response.ok) throw new Error(`无法加载语音资源 ${path}：HTTP ${response.status}`);
      return new Uint8Array(await response.arrayBuffer());
    });
    this.onStatus = onStatus;
    this.voices = new Map();
    ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmPaths = new URL('runtime/', baseUrl).href;
  }
  async load() {
    if (!this.loading) this.loading = (async () => {
      this.onStatus('正在加载 Kokoro 中文模型，首次播放需要稍候');
      const [model, vocab] = await Promise.all([this.readAsset('assets/kokoro.onnx'), this.readAsset('assets/vocab.json')]);
      this.vocab = JSON.parse(new TextDecoder().decode(vocab));
      this.session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      if (!this.session.outputNames.includes('duration')) throw new Error('Kokoro 模型未提供音素时长，无法同步高亮');
    })();
    return this.loading;
  }
  async synthesize(text, voice = 'zf_001', language = 'z', isCancelled = () => false) {
    await this.load();
    if (isCancelled()) return null;
    this.onStatus('正在生成语音');
    if (!this.voices.has(voice)) {
      const bytes = await this.readAsset(`assets/${voice}.bin`);
      this.voices.set(voice, new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
    }
    const styles = this.voices.get(voice);
    const tokens = await textToTokens(text, this.vocab, language);
    const audio = [], words = [];
    let samples = 0;
    for (const batch of splitTokens(tokens)) {
      if (isCancelled()) return null;
      const row = batch.length - 1;
      const style = styles.slice(row * 256, (row + 1) * 256);
      if (style.length !== 256) throw new Error('音色文件长度不正确：' + voice);
      const feeds = {
        input_ids: new ort.Tensor('int64', BigInt64Array.from([0, ...batch.map(t => t.id), 0], BigInt), [1, batch.length + 2]),
        style: new ort.Tensor('float32', style, [1, 256]),
        speed: new ort.Tensor('float32', Float32Array.of(1), [1]),
      };
      const output = await this.session.run(feeds);
      try {
        if (isCancelled()) return null;
        const pcm = Float32Array.from(output.waveform.data);
        if (!pcm.length || pcm.some(x => !Number.isFinite(x))) throw new Error('Kokoro 返回了无效音频');
        const timings = wordTimings(batch, output.duration.data, pcm.length);
        for (const word of timings) words.push({ ...word, start: word.start + samples / 24000, end: word.end + samples / 24000 });
        audio.push(pcm);
        samples += pcm.length;
      } finally {
        Object.values(feeds).forEach(t => t.dispose());
        Object.values(output).forEach(t => t.dispose());
      }
    }
    const pcm = new Float32Array(samples);
    let offset = 0;
    for (const part of audio) { pcm.set(part, offset); offset += part.length; }
    return { pcm, words, sampleRate: 24000 };
  }
}
