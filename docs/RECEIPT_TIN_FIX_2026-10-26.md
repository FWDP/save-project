# Receipt TIN extraction — 26 October 2026

Live testing of the five user-supplied receipts reproduced an extraction failure before OCR: the configured Gemini Live model closed the connection with code 1007 because TEXT response modality was unsupported. The request now uses AUDIO mode while consuming only structured function-call data; audio events are ignored and never played or returned.

High media resolution improves small printed text. Extraction instructions now distinguish the primary merchant or legal operator from POS/software providers, customer fields, and secondary billers. Transaction dates exclude permit issue/validity dates.

## Validation

After the user's explicit permission to send these samples to Gemini, all five returned nonempty merchant TINs with the corrected configuration. High-resolution runs took approximately 2.1–3.5 seconds per receipt in this environment. Those figures are server-side sample timings, not an on-device performance benchmark.

The Robinsons sample's initial digit errors improved with high resolution. The faint Pancake House header produced differing digits across runs, so its exact TIN still needs manual confirmation or a clearer photo. The form explicitly asks users to verify scanned digits against the merchant registration line. No sample-specific TIN values are hardcoded and no private receipt images are committed.

Backend build and all 45 backend tests pass; the Live test asserts supported modality, high-resolution input, function-result handling, and session cleanup. Existing running backend processes must be restarted or redeployed to load the fix.

Reference: [Gemini media-resolution documentation](https://ai.google.dev/gemini-api/docs/media-resolution).
