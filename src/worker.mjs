import { KokoroEngine } from './engine.mjs';

let wanted = null;
let serial = Promise.resolve();
const engine = new KokoroEngine({
  baseUrl: new URL('./', self.location.href).href,
  onStatus: message => self.postMessage({ type: 'status', requestKey: wanted, message }),
});
self.onmessage = ({ data }) => {
  if (data.type === 'cancel') { wanted = null; return; }
  wanted = data.requestKey;
  const run = async () => {
    if (wanted !== data.requestKey) return;
    try {
      const result = await engine.synthesize(data.text, data.voice, data.language, () => wanted !== data.requestKey);
      if (result && wanted === data.requestKey) self.postMessage({ type: 'audio', requestKey: data.requestKey, ...result }, [result.pcm.buffer]);
    } catch (error) {
      console.error('[Kokoro]', error);
      if (wanted === data.requestKey) self.postMessage({ type: 'error', requestKey: data.requestKey, message: error.message || String(error) });
    }
  };
  serial = serial.then(run);
};
