importScripts('voices.js');
let owner = null;
let creating = null;
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL('offscreen.html')] });
  if (contexts.length) return;
  if (!creating) creating = chrome.offscreen.createDocument({
    url: 'offscreen.html', reasons: ['WORKERS'],
    justification: '在扩展独立 Worker 中运行 Kokoro 本地语音模型并播放带时间戳的音频。',
  }).finally(() => { creating = null; });
  await creating;
}
async function command(job, message) {
  await ensureOffscreen();
  if (message.type !== 'stop' && owner !== job) return;
  const result = await chrome.runtime.sendMessage({ target: 'kokoro-offscreen', requestKey: job.requestKey, ...message });
  if (result?.error) throw new Error(result.error);
}
function post(port, data) {
  try { port.postMessage(data); } catch (e) { console.error('朗读连接已关闭', e); }
}
chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !/^https:\/\/[^/]+\.(feishu\.cn|larksuite\.com)\/(docx|wiki)\//.test(tab.url || '')) {
    await chrome.action.setBadgeText({tabId: tab.id, text: '飞书'});
    return;
  }
  try {
    await chrome.action.setBadgeText({tabId: tab.id, text: ''});
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['core.js','content.js']});
  } catch (e) {
    console.error('无法打开飞书朗读', e);
    await chrome.action.setBadgeText({tabId: tab.id, text: '错误'});
  }
});
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'feishu-original-tts') return;
  port.onMessage.addListener(async msg => {
    try {
      if (msg.type === 'voices') {
        post(port, {type:'voices', voices:KokoroVoices});
      } else if (msg.type === 'speak') {
        const voice = KokoroVoices.find(v => v.voiceName === msg.voice);
        if (!voice || typeof msg.text !== 'string' || !msg.text.trim() || !Number.isFinite(msg.rate) || msg.rate < .5 || msg.rate > 3 || !Number.isInteger(msg.sessionId) || typeof msg.cacheKey !== 'string' || !Array.isArray(msg.ahead) || msg.ahead.some(item => typeof item.cacheKey !== 'string' || typeof item.text !== 'string' || !item.text.trim())) throw new Error('无效的 Kokoro 朗读参数');
        const continuing = owner?.port === port && owner.sessionId === msg.sessionId && owner.voice === msg.voice;
        const sessionKey = continuing ? owner.sessionKey : crypto.randomUUID();
        if (owner && owner.port !== port) post(owner.port,{type:'interrupted',reason:'另一篇文档开始朗读'});
        const job = owner = { port, id: msg.id, sessionId: msg.sessionId, sessionKey, voice: msg.voice, requestKey: crypto.randomUUID() };
        await command(job, {...msg, sessionKey, language:voice.language});
      } else if (owner?.port === port) {
        const job = owner;
        if (msg.type === 'stop') { owner = null; await command(job, {type:'stop'}); }
        else if (['pause','resume'].includes(msg.type)) await command(job, {type:msg.type});
      }
    } catch(e) { post(port,{type:'error',message:e.message}); }
  });
  port.onDisconnect.addListener(() => {
    if (owner?.port === port) {
      const job = owner; owner = null;
      command(job, {type:'stop'}).catch(error => console.error('停止 Kokoro 失败', error));
    }
  });
});
chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id || message.target !== 'kokoro-background' || message.requestKey !== owner?.requestKey) return;
  if (message.type === 'alive') return;
  const job = owner;
  post(job.port, {...message, id:job.id});
  // Keep the session's cache identity across natural sentence transitions.
  // Completion, seeking and document changes explicitly send stop.
});
