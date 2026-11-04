# SAVE Web

The dedicated customer Web app uses server-backed Supabase authentication and browser-local financial storage. Transactions, budgets, categories, savings trackers and photos do not sync to the database or to Mobile. Receipt photos are sent through the authenticated backend to Google's Gemini service for reading; extracted fields return for review and local saving.

See the consolidated [S.A.V.E. Project Handbook](../docs/SAVE.md) for [development/authentication setup](../docs/SAVE.md#development-and-authentication-setup), [local storage and the testing reset](../docs/SAVE.md#local-storage-and-account-reset), [OCR security and privacy](../docs/SAVE.md#ocr-security-and-privacy-review), and [verification](../docs/SAVE.md#verification-runbook).

From the repository root, run `npm run web:dev` after configuration. Customer Web uses port 3002. `npm run web` starts the separate Expo browser preview.

Legacy workspace, cross-device synchronization, external currency conversion and Stellar application flows are outside the current launch behavior. Historical plans and evidence are labeled in the handbook.
