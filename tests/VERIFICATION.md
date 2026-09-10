# 0.4.0 verification — 2026-09-10

- Node unit checks: 14 passing. Covers original UTF-16 offsets, Chinese numbers/dates, mixed English, unequal predicted durations, silence, long phoneme splitting, virtualized cache and document order.
- Browser UI fixture: 30 assertions passed. Includes first-play-only scan, pause/seek, manual scroll entering free browsing, return button outside/above player and horizontally centered, hidden button in follow mode, vertical centering, word updates without scrolling in free mode, current node removal while word progress and next sentence continue, remount retaining cache, editor removal retaining player, and genuine text edits invalidating the cache.
- Actual browser wheel and return-button click: visually confirmed the floating button and its disappearance after return.
- Real browser inference and playback: local bundled Worker + ONNX Runtime WASM under the extension-equivalent script CSP and COOP/COEP headers. Chinese, English and mixed text generated nonempty audio; all three pause/resume checks passed; word events matched their original text spans and active audio-time intervals at 1.2x playback.
- Browser four-thread first-audio times for the test samples: cold Chinese 2.910 s; warm English 1.446 s; warm mixed text 2.531 s. This is one desktop run, not a cross-device benchmark.
- Node single-thread waveform smoke checks passed; generated WAV and word JSON are under `work/smoke/`. Audio durations: Chinese 3.175 s, English 2.825 s, mixed 5.125 s.
- FP32 model and five voices matched the pinned upstream LFS SHA-256 values. The q8 model returned all-NaN PCM in the tested WASM runtime and is not used in the release.

Scope: browser integration used the local fixture with mocked Chrome message routing. The browser security policy blocked chrome://extensions/, so actual extension reload, MV3 offscreen lifecycle, and a live Feishu document have not been verified in this run. Word boundaries come from model durations; no manually annotated acoustic alignment accuracy was measured.

Package: ZIP integrity passed; packaged extension copied to the project-recorded original installation directory, with every file compared byte-for-byte. Reload remains a manual step.

# 0.4.1 context invalidation fix — 2026-09-10

The browser fixture passed seven new context-loss scenarios: revoked runtime followed by explicit page refresh; a pause message throwing synchronously (one attempted send, no recursive stop send); failed connect after disconnect; synchronous storage read/write failures; revocation during scanning without stale speech; and ordinary disconnect followed by explicit reconnect reusing the cache. Each scenario collected uncaught errors, unhandled rejections and console errors and found none. The original 30 UI checks also passed after the change.

A lost extension context now stops local work, detaches document listeners, disables stale controls and presents a page-refresh action. It performs no automatic page reload or context-recovery attempt. Browser policy still prevents direct verification through chrome://extensions/; reload the extension and Feishu page to activate the updated files.

# 0.4.2 rhotic schwa fix — 2026-09-10

- Reproduced `模型词表缺少音素：ɚ` with `textToTokens('teacher', vocab, 'a')`. eSpeak also produced this phoneme for water, computer, server and better. The packaged model lacks `ɚ` and includes `ə` and `ɹ`.
- Added the `ɚ → əɹ` conversion used by Misaki's EspeakFallback. The conversion occurs before vocabulary lookup; both resulting phonemes keep the complete original word span.
- Seven alignment/frontend tests passed, including English and Chinese/English input with an emoji prefix, valid vocabulary IDs and preservation of a single word timestamp after phoneme expansion. Build and syntax checks passed.
- Real browser test used the rebuilt local Worker, WASM model and audio player. Chinese baseline, English containing teacher/computer/water/better, and Chinese/English containing computer/server all completed with `ok: true`. All pause/resume checks, media-clock intervals, source offsets and required English word events passed. This checks generated audio and timing contracts, not human-rated pronunciation or alignment accuracy.
- Browser test still mocks Chrome message routing; the live Feishu page and actual extension reload were not verified. Reload the extension and refresh Feishu to activate 0.4.2.
- The 0.4.2 ZIP passed archive integrity validation. All 26 extension files and the ZIP matched the project-recorded original installation copy byte-for-byte.

# 0.5.0 two-sentence prefetch and circled numbers — 2026-09-10

- 25 unit tests passed. Seven queue tests cover two-ahead bounds, cached audio and timestamp reuse, advancing during in-flight inference without duplication, status isolation, pause/resume, stop and late results, new session/voice invalidation, paused voice changes, selection boundaries and explicit prefetch errors. Two background routing tests cover stable session identity and stale/cross-document event isolation. Frontend tests cover ①–⑳, adjacent markers, English, emoji UTF-16 offsets and the earlier ɚ fix.
- Browser UI fixture: 33 assertions passed, including two lookahead texts taken from cached document records, stable sentence identities during natural advancement, no prefetch outside a selection, and existing follow/free browsing, virtualized removal and text-edit behavior.
- Real browser Worker + WASM + audio test: four sentences generated exactly once each. The second and third finished synthesis while the first was still playing. Pause/resume and word/media-clock checks passed; all four original markers (①, ②, ③, ⑩), computer and server emitted matching word spans. No browser console errors were captured.
- Measured end-to-next-start gaps in this local fixture were 27.215 ms, 29.065 ms and 27.155 ms. This is one desktop sample with cached audio and mocked Chrome message routing, not a guarantee for live MV3 routing or slower devices. Cold first-sentence generation still takes time, and short sentences/high playback rates can exhaust the two-sentence buffer.
- Syntax and bundle build checks passed. Actual extension reload and the live Feishu document remain unverified because the browser policy blocks access to the extensions management page.
- The 0.5.0 ZIP passed archive integrity validation. All 26 extension files matched the source, distribution and original installation directory byte-for-byte; the original installation ZIP also matched.

# 0.5.1 stable follow position — 2026-09-10

- Reproduced the reported jump in a real browser layout with multiline sentences and simulated TTS events. Before the fix, the first word moved scrollTop back by 108 px after whole-sentence centering; clearing the word highlight and repainting during a word gap also moved it back by 108 px.
- Follow positioning now uses the first character of the current spoken position, independently of the transient word highlight. A new sentence begins at its first line; word-end retains the previous spoken position; words spanning lines use their starting character. UTF-16 surrogate pairs are kept together for the positioning range.
- The same sample passed seven checks after the fix: sentence-start centering error 0.1875 px, first-word scroll delta 0 px, word-gap scroll delta 0 px, multiline-word positioning, free browsing, return to follow and application error collection. The fixture captured no uncaught errors or rejected promises.
- All 33 existing browser UI assertions and syntax checks passed. Audio/model code was unchanged, so synthesis benchmarks were not repeated.
- The browser automation log separately reports a MutationObserver.observe error without source location on iframe page creation; it was not captured by the fixture's application error listeners. No claim of a clean global browser console is made. The live Feishu document and actual extension reload remain unverified; browser policy prevents opening extension management.
- The 0.5.1 ZIP passed integrity validation and all 26 extension files matched the original installation copy byte-for-byte.

# 0.5.2 voice display names — 2026-09-10

- Verified the official v1.0 voice table lists the eight named Chinese voices. Both the official v1.1-zh voice directory and the pinned ONNX repository contain 103 voices (55 Chinese female, 45 Chinese male, three English female), with none of those eight v1.0 IDs.
- The five packaged voice IDs and asset files remain unchanged. Display labels now use 清禾 · 女, 云川 · 男, Maple · 女 · 美式英语, Sol · 女 · 美式英语, and Vale · 女 · 英式英语. The two Chinese names are documented local nicknames for zf_001 and zm_010.
- Loaded the catalog directly, checked each label has gender and each ID resolves to its packaged binary. Syntax check passed. No synthesis or UI regression suite was rerun for this display-only change.

# 0.5.3 character-budgeted prefetch — 2026-09-10

- Replaced the fixed two-sentence window with the smallest consecutive lookahead whose total non-whitespace Unicode character count covers the next uncached sentence. Current playback is excluded; punctuation counts as a character. The target is recalculated on each natural sentence transition, preserving unplayed cache entries and stopping at the selection/document boundary.
- 29 unit checks passed, including one long buffered sentence, exact equality, a sequence requiring five buffered sentences, Unicode/whitespace counting, monotonic lookahead endpoints, variable-length message routing, cache reuse/release and cancellation. Syntax checks passed.
- All 33 browser UI assertions passed, including the character coverage contract in the actual content-script request, virtualized paragraph removal, follow/free browsing and selection boundaries.
- Real browser Worker/WASM/audio test passed six sentences, each synthesized once. Requested future window sizes were 4, 3, 2, 1, 1, 0; all four initial lookahead sentences finished while sentence zero was playing. Each requested window covered its next uncached sentence. Six original circled-number markers, computer/server word spans, media-clock bounds and pause/resume passed. No console errors were captured in that runtime page.
- This fixture's cached end-to-start transitions measured 29.5, 27.59, 27.805, 28.025 and 27.82 ms. The character rule sets a prefetch target; during initial generation/refill, actual ready audio can be below the target. These are local fixture observations with mocked Chrome routing, not live Feishu or actual extension reload verification.
- The 0.5.3 ZIP passed archive integrity validation. All 26 extension files matched the source and original installation copy byte-for-byte; both ZIP copies matched.

# 0.5.4 statistical character buffer — 2026-09-10

- The former immediate-next-sentence rule stopped early for 10, 5, 4, 100. Queue construction now computes non-whitespace sentence lengths once, using the population mean and standard deviation. The fixed floor is ceil(mean + std), with n = 1. The smallest consecutive future window must cover max(floor, next uncached sentence length), or reach the reading boundary. Current playback contributes to the statistics but not the buffered character sum. Selection statistics use only the clipped selection.
- 32 unit tests and extension syntax checks passed. Added both exact counterexamples (10, 5, 4, 100 and seven one-character sentences followed by 100), a longer short prefix that reaches the floor before the distant outlier, population statistics, selection scope, and in-flight long-sentence preservation across playback advancement. An old equality test used unequal 2, 3, 3 lengths; it now uses three equal lengths.
- All 33 browser UI assertions passed after fixing a duplicate variable name in the updated test script. The actual content-script message satisfied both the statistical floor and immediate next-sentence coverage; existing selection, follow/free browsing, virtual removal and cache invalidation checks passed.
- Real browser Worker/WASM/audio test passed six sentences, each generated once. Two descending short sentences before a long mixed-language sentence were included in the initial three-sentence lookahead; all three finished while sentence zero played. Window sizes were 3, 2, 1, 2, 1, 0. Pause/resume, all six original circled-number spans, computer/server offsets and audio-clock bounds passed. No runtime-page console errors were captured.
- Measured cached end-to-start gaps were 27.26, 27.31, 27.56, 28.47 and 28.77 ms. This is a local fixture with mocked Chrome routing; actual Feishu/MV3 routing and extension reload remain unverified. The statistical buffer is a heuristic target, not a guarantee that synthesis keeps up with every device or playback rate. Startup/refill can be below target, and an arbitrarily long short-sentence prefix need not immediately include its distant longest sentence.
- Version 0.5.4 was packaged without rebundling unchanged model/audio modules. ZIP integrity passed; all 26 extension files matched source, distribution and the original installation directory byte-for-byte, and both ZIP copies matched. Browser policy prevents automatic extension-management access; manual reload and page refresh are needed to activate the release.
