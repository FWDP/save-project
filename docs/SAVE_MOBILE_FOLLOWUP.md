# Mobile release follow-up

## Rotation and camera sound

- The root native Stack explicitly uses `orientation: 'default'`; Expo configuration also retains `orientation: 'default'`. Dashboard content already responds to window-width changes.
- Receipt capture passes `shutterSound: false` to Expo Camera. Some devices or jurisdictions may enforce a system camera sound independently of the app.
- The local, gitignored Android manifest was found with `android:screenOrientation="portrait"` left over from an older generated project. Regenerate native projects with Expo prebuild as part of the next native build; do not ship an older binary expecting app.json changes alone to update its manifest.

## Optional TIN and receipt-count performance

- Add Transaction now labels TIN as optional and accepts a blank TIN, including after an unreadable scan. Manual entry, leading zeros, branch suffixes, and the required merchant/source field are preserved.
- Existing OCR instructions already cover VAT/NON-VAT registration labels. No new live recognition defect was reproduced, so recognition code is unchanged. Backend characterization tests verify that returned TIN values survive validation and missing TIN does not invalidate a scan; they use model doubles.
- Saving a pending native transaction no longer reads and parses every previous queued transaction merely to initialize its table. The 60-receipt regression workload performs zero previous-payload reads during enqueue. This removes growing synchronous work, but does not establish a physical-device latency improvement. Whole-account snapshot serialization remains unchanged.

## Verification scope

`tests/mobile-device-settings.test.cjs` checks the actual Stack/camera configuration in source. It does not simulate device rotation or native camera audio.

Release acceptance on physical devices remains required:

1. Install a fresh native build, enable OS auto-rotate, and rotate Dashboard between portrait and both landscape directions. Check navigation and readable/scrollable content, including large text.
2. Capture, retry, and accept receipt photos; confirm no app-requested photo sound.
3. Save expenses with blank and manually entered TIN values. Scan representative VAT and NON-VAT receipts; do not interpret parser tests as proof of live OCR accuracy.
4. Repeat capture/save/navigation beyond 50 receipts, including offline operation and subsequent sync. Record latency and memory on the affected device; local automated tests cannot prove the reported 3–4-second lag is resolved.
