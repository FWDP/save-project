# SAVE adjustments — 26 October 2026

Implemented in the Expo mobile/web application and receipt API:

- Registration has Retrieve Password/User Name, email reset links, a reset-password screen, and an explanation that the sign-in user name is the registered email.
- Rotation is enabled in Expo configuration. Dashboard metrics precede Monthly Budget - [Month], immediately followed by Budget Progress - [Month]. Positive balance uses Remaining this month.
- Sidebar uses Transactions; Savings title is consistent; Categories no longer has the redundant floating plus; More no longer lists Stellar Testnet.
- Add Transaction requires Merchant or source and Merchant or source TIN, marks both with asterisks, and uses a keyboard-aware scrolling layout. Existing records can edit their TIN too.
- OCR explicitly inspects merchant VAT/NON-VAT registration labels in the header/footer, includes TIN in its tool schema, preserves leading zeros/branch suffixes, and excludes buyer TIN and unrelated numbers. Missing TIN remains editable and permits a retry; values are never invented.
- CSV and PDF report exports include merchant/source and TIN. CSV import preserves TIN. Compare stays on one line; export buttons use two lines.
- Small/Medium/Large text size is persisted and applied to mobile screen text and text inputs, alongside system accessibility scaling. The Appearance/Dark Mode setting was removed.
- PDF and CSV imports show a preview before writing. PDF support is for unprotected text tables with Date/Description/Debit/Credit or Date/Description/Amount/Type columns. Scanned, encrypted, and unrecognized layouts are rejected. GCash transaction-history PDFs use coordinate-based extraction to preserve blank debit/credit cells and wrapped descriptions. Repeated headers and balance/total rows are excluded, and debit/credit totals must match before preview. GCash reference numbers drive duplicate detection. The supplied six-page PDF was validated locally; it is not stored in the repository.
- Receipt ZIP export includes locally available images once, with a manifest listing unavailable images. Archive input is limited to 50 MB to bound memory use. Receipts remain device-local, as before.
- Full dates display/export as mm/dd/yyyy. Internal API/storage dates remain ISO for validation, ordering, and compatibility.
- Camera shutter sound is enabled, subject to device silent-mode/platform behavior.

## Performance changes

Concurrent refresh requests share the ongoing request instead of accumulating. Cache writes are debounced and run only when transaction/budget/category data changes. Receipt images are resized to a maximum 2560-pixel edge and stored as JPEG at 85% quality, with native image handles released and temporary resized files deleted. Camera previews do not retain a memory cache; transaction previews use disk caching.

## Verification and rollout

TypeScript and lint checks, application tests, 43 API tests, and Android/web JavaScript exports passed. Regression coverage includes date/TIN CSV round trips, PDF direction/ambiguity handling, actual PDF text extraction, ZIP contents/missing files, and native image resizing/release.

A new native build is required for the image-manipulator dependency, rotation, and keyboard configuration. Before release, verify portrait/landscape layout, large text, TIN typing with the keyboard open, shutter sound, real VAT/non-VAT receipts, and capture/navigation latency after 30 receipts on target devices. Physical-device tests and live OCR accuracy on the user's receipts were not performed here.
