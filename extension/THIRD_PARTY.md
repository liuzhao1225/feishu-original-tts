# Third-party components

All executable code and inference assets are local to this extension. Dependency versions are pinned in package-lock.json.

Original project code is Copyright (C) 2026 Zhao Liu and licensed under GPL-3.0-or-later. The source and build scripts are available at [liuzhao1225/feishu-original-tts](https://github.com/liuzhao1225/feishu-original-tts). Third-party components retain the licenses and copyright notices listed below; model weights are separately licensed.

- **Kokoro-82M-v1.1-zh ONNX** — [onnx-community model repository](https://huggingface.co/onnx-community/Kokoro-82M-v1.1-zh-ONNX), revision `6cc0f0d2ebe369a68b0df87c2b65c1af8c0ac3e3`. Original model by [hexgrad](https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh). Apache-2.0. Includes model, tokenizer vocabulary and five voice style arrays. See `licenses/kokoro-model.txt`.
- **ONNX Runtime Web 1.29.0** — [Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime), MIT. See `licenses/onnxruntime.txt`.
- **Chinese phonemization frontend / data** — [uzen-zone/kokoro-js](https://github.com/uzen-zone/kokoro-js/tree/bbc3b5da19965257db0c8e6c9fb9381175b165a7), revision `bbc3b5da19965257db0c8e6c9fb9381175b165a7`, Apache-2.0. Adapted `src/phonemize.js` and `src/zh-data.js` in `src/vendor/`. Changes add source-span callbacks and exported normalization helpers for timestamp alignment. The upstream Transformers.js inference wrapper is not included. See `licenses/kokoro-js.txt`.
- **pinyin-pro 3.28.1** — [zh-lx/pinyin-pro](https://github.com/zh-lx/pinyin-pro), MIT. See `licenses/pinyin-pro.txt`.
- **phonemizer 1.2.1** — [xenova/phonemizer.js](https://github.com/xenova/phonemizer.js), wrapper Apache-2.0; includes compiled eSpeak NG and language data. See `licenses/phonemizer.txt`. eSpeak NG is GPL-3.0-or-later; see `licenses/espeak-ng.txt` and [eSpeak NG sources](https://github.com/espeak-ng/espeak-ng).

Timing conversion follows the model's duration output. [Kokoro pipeline](https://github.com/hexgrad/kokoro/blob/main/kokoro/pipeline.py) documents 600 samples per predicted frame at 24 kHz; [kokoro-onnx token_edges](https://github.com/thewh1teagle/kokoro-onnx/blob/3596b26764286a7de9d90c363e988d50578918e5/src/kokoro_onnx/sliding.py) preserves the leading pad in phoneme boundaries. Word spans here are produced by the JavaScript frontend and refer to original UTF-16 offsets, including normalized dates/numbers.
