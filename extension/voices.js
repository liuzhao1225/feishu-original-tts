globalThis.KokoroVoices = [
  // v1.1-zh's numbered Chinese voices have no official names; these are local nicknames.
  { voiceName: 'zf_001', label: '清禾 · 女', lang: 'zh-CN', language: 'z' },
  { voiceName: 'zm_010', label: '云川 · 男', lang: 'zh-CN', language: 'z' },
  { voiceName: 'af_maple', label: 'Maple · 女 · 美式英语', lang: 'en-US', language: 'a' },
  { voiceName: 'af_sol', label: 'Sol · 女 · 美式英语', lang: 'en-US', language: 'a' },
  { voiceName: 'bf_vale', label: 'Vale · 女 · 英式英语', lang: 'en-GB', language: 'b' },
].map(voice => ({ ...voice, eventTypes: ['start', 'word', 'end'] }));
