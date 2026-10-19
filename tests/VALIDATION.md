# v1.6.4 image export validation

Validated 2026-10-19 using Chromium 153.0.8010.0 (Linux), html2canvas 1.4.1 and Noto Sans KR test font. All inputs are synthetic; no user receipts were retrieved.

| Entries | CSS height | Fixed 3x output | Desktop adaptive output | iPhone-policy output in Chromium |
|---|---:|---|---|---|
| 20 | 4257 | 2160 × 12771 | 2160 × 12771 (3x) | 1418 × 8386 (1.97x) |
| 50 | 8307 | 2160 × 24921 | 1663 × 19189 (2.31x) | 1015 × 11712 (1.41x) |
| 100 | 15057 | 2160 × 45171 | 1231 × 25747 (1.71x) | 756 × 15809 (1.05x) |
| 200 | 28557 | 2160 × 85671 | 820 × 32554 (1.14x) | Safely refused |

Heights vary with memo length, distinct dates and device fonts. The app measures the actual completed layout rather than estimating height from entry count.

Policy budgets: iOS/iPadOS or reported deviceMemory ≤4 GB: 12 million pixels (about 46 MiB RGBA); desktop: 32 million pixels (about 122 MiB RGBA). iOS side policy: 16,384px; desktop: 32,767px. These are application safety ceilings, not claims about universal browser limits or available RAM. Browser memory APIs are incomplete, particularly on Safari. Actual allocation is checked by drawing/reading the last pixel; rendering/encoding failures retry at 75% scale down to 1x. Lower limits on older devices can therefore cause a safe refusal even within the policy budget. Total memory also includes DOM, image preview and encoding buffers.

The html2canvas FAQ documents Chrome limits of 32,767px per side / 268,435,456 pixels and explicitly says limits vary by browser, OS and hardware. Its 3/5MP iOS numbers describe old devices and are not treated as modern universal limits: https://html2canvas.hertzen.com/faq/

Checks passed locally: 10 unit regressions; 20/50/100/200 entry desktop and iPhone-UA Chromium exports; actual PNG download streams, PNG dimensions, date order, unchanged stored data/calculated balances, synthetic IndexedDB receipt unchanged, active-user-click share invocation, cancellation, share-denied download fallback and URL cleanup. Desktop 200 entries saves one image; the iPhone policy refuses 200 entries before allocation. Top/bottom ink and canvas dimensions are checked before presenting a download; null/empty/blank outputs are rejected. A 20-entry PNG was visually inspected with Korean glyphs.

Native iPhone Safari / Photos / share-sheet hardware validation is NOT completed. Chromium with an iPhone UA only tests layout and policy selection. Linux WebKit dependencies were unavailable locally; the GitHub workflow additionally runs the browser suite under WebKit, which still does not replace iPhone hardware validation.

Manual iPhone follow-up: open 20/50/100-entry synthetic fixtures, export, tap Save/Share and save to Photos; inspect first/last entries at full zoom; cancel/retry sharing; attempt a document beyond the policy budget and verify refusal with data intact. No receipt backup or cache feature was added.
