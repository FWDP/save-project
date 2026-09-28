# Receipt scanning

Set `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.8-live` in `backend/.env`.
Restart the backend after changing configuration. Source changes require a backend build.

The browser/mobile client uploads to authenticated `POST /receipts/scan`.
The backend opens a dedicated Gemini Live WebSocket session for that upload,
sends the receipt image, and collects the `extract_receipt` function arguments.
Gemini Live uses audio response mode; generated audio is ignored. Financial fields
are validated before being returned for user review. No transaction is saved by
the function call, and the API key never reaches the browser.

Each session closes on extraction, error, interruption, or the 25-second deadline.
There is no shared conversation history and no automatic paid retry or model fallback.
The web/API timeout is longer than the session deadline.

Scanning accepts JPEG, PNG, and WebP images up to 10 MB. Convert PDFs and HEIC
files to a supported image before scanning; mobile PDF attachments can still be
stored and entered manually. Gemini Live does not use `generateContent` or
`responseSchema`: extraction uses a declared function plus local Zod validation.

Categories are served from the API's built-in catalog alongside personal custom
categories. Parent/subcategory choices are stored as readable labels such as
`Food & Dining / Groceries`, without rewriting existing records.

Validation: backend tests cover multipart parsing, model output validation,
successful Live extraction, premature close, errors, interruptions, timeout,
and connections that complete after the deadline. A live provider smoke test
used a synthetic receipt with a PHP 150 total, never private user receipts.
