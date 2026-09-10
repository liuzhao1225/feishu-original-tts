import { wordAtTime } from './alignment.mjs';

const worker = new Worker('kokoro-worker.js', { type: 'module' });
const audio = new Audio();
audio.preload = 'auto';
let job = null, sessionKey = null, generating = null, lastWord = -1;
let windowItems = [];
const cache = new Map();
const post = message => chrome.runtime.sendMessage({ target: 'kokoro-background', ...message }).catch(error => console.error('[Kokoro connection]', error));
const event = data => job && post({ type: 'event', requestKey: job.requestKey, event: data });
function stopAudio() {
  job = null;
  audio.pause(); audio.removeAttribute('src'); audio.load();
  lastWord = -1;
}
function stop() {
  stopAudio();
  for (const item of cache.values()) if (item.url) URL.revokeObjectURL(item.url);
  cache.clear(); windowItems = []; sessionKey = null; generating = null;
  worker.postMessage({ type: 'cancel' });
}
function fail(error) {
  const active = job;
  stop();
  if (active) post({ type: 'error', requestKey: active.requestKey, message: error.message || String(error) });
}
function pump() {
  if (generating || !job) return;
  const item = windowItems.find(item => !item.url);
  if (!item) return;
  generating = item;
  worker.postMessage({ type: 'speak', requestKey: item.taskKey, text: item.text, voice: item.voice, language: item.language });
}
async function playReady(active) {
  if (job !== active || !active.item.url) return;
  active.words = active.item.words;
  audio.src = active.item.url;
  audio.playbackRate = active.rate;
  audio.preservesPitch = true;
  if (!active.paused) {
    try { await audio.play(); }
    catch (error) {
      if (job !== active || (active.paused && error.name === 'AbortError')) return;
      throw error;
    }
    if (job === active) event({ type: 'start' });
  }
}
async function speak(message) {
  // Only natural progression within the same voice/session may reuse audio.
  if (sessionKey !== message.sessionKey || windowItems[0]?.voice !== message.voice || windowItems[0]?.language !== message.language) stop();
  else stopAudio();
  sessionKey = message.sessionKey;
  const requested = [{ cacheKey: message.cacheKey, text: message.text }, ...message.ahead];
  const keep = new Set(requested.map(item => item.cacheKey));
  for (const [key, item] of cache) if (!keep.has(key)) {
    if (item.url) URL.revokeObjectURL(item.url);
    cache.delete(key);
  }
  windowItems = requested.map(({ cacheKey, text }) => {
    let item = cache.get(cacheKey);
    if (item && item.text !== text) throw new Error('缓存正文已变化，请重新播放。');
    if (!item) {
      item = { cacheKey, text, voice: message.voice, language: message.language, taskKey: crypto.randomUUID() };
      cache.set(cacheKey, item);
    }
    return item;
  });
  // A discontinuous request may remove the in-flight item from the window.
  if (generating && !windowItems.includes(generating)) {
    worker.postMessage({ type: 'cancel' }); generating = null;
  }
  const active = job = { requestKey: message.requestKey, rate: message.rate, paused: Boolean(message.paused), words: null, item: windowItems[0] };
  if (!active.item.url) post({ type: 'status', requestKey: active.requestKey, message: '正在生成语音' });
  const playing = playReady(active);
  pump();
  await playing;
}
function wav(pcm, sampleRate) {
  const bytes = new ArrayBuffer(44 + pcm.length * 2), view = new DataView(bytes);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), true);
  return new Blob([bytes], { type: 'audio/wav' });
}
function tick() {
  if (!job?.words || audio.paused) return;
  const index = wordAtTime(job.words, audio.currentTime);
  if (index === lastWord) return;
  lastWord = index;
  if (index >= 0) event({ type: 'word', ...job.words[index], audioTime: audio.currentTime });
  else event({ type: 'word-end' });
}
// Poll the media clock; timestamps themselves always come from model durations.
// Unlike requestAnimationFrame, this also runs in an offscreen document.
setInterval(tick, 25);
// Offscreen -> runtime messages keep the MV3 worker's routing state alive during
// a long synthesis or pause, where no word events are emitted.
setInterval(() => { if (job) post({ type: 'alive', requestKey: job.requestKey }); }, 20000);
audio.onended = () => { if (job) { job.ended = true; event({ type: 'end' }); } };
audio.onerror = () => { if (job) fail(new Error('音频播放失败：' + audio.error?.message)); };
worker.onerror = error => {
  console.error('[Kokoro worker]', error);
  fail(new Error(error.message || 'Kokoro 推理进程异常'));
};
worker.onmessage = async ({ data }) => {
  if (!generating || data.requestKey !== generating.taskKey) return;
  const item = generating;
  if (data.type === 'status') {
    if (job?.item === item) post({ ...data, requestKey: job.requestKey });
    return;
  }
  if (data.type === 'error') {
    fail(new Error((job?.item === item ? '' : '预生成后续句子失败：') + data.message));
    return;
  }
  if (data.type !== 'audio') return;
  generating = null;
  const active = job;
  try {
    item.words = data.words;
    item.url = URL.createObjectURL(wav(data.pcm, data.sampleRate));
    const playing = active?.item === item ? playReady(active) : Promise.resolve();
    pump();
    await playing;
  } catch (error) {
    if (job === active) fail(error);
  }
};
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.target !== 'kokoro-offscreen' || sender.id !== chrome.runtime.id) return;
  (async () => {
    if (message.type === 'speak') {
      await speak(message);
    } else if (job && message.requestKey === job.requestKey) {
      if (message.type === 'stop') stop();
      else if (message.type === 'pause') { job.paused = true; audio.pause(); }
      else if (message.type === 'resume') {
        job.paused = false;
        if (job.words) { await audio.play(); tick(); }
      }
    }
  })().then(() => respond({ ok: true }), error => respond({ error: error.message }));
  return true;
});
