import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { strToU8, zipSync } from 'fflate';
import type { ApiTransaction } from './api';
import { exportBinaryFile } from './export-file';
export async function exportReceiptZip(transactions: ApiTransaction[]) {
  const files: Record<string, Uint8Array> = {};
  const manifest: string[] = [];
  const seen = new Set<string>();
  let total = 0; let saved = 0; let missing = 0;
  for (const item of transactions) {
    const uri = item.receiptUri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    let bytes: Uint8Array;
    try {
      if (Platform.OS === 'web' || /^https?:/.test(uri)) {
        const response = await fetch(uri);
        if (!response.ok) throw new Error('Unavailable');
        bytes = new Uint8Array(await response.arrayBuffer());
      } else bytes = await new File(uri).bytes();
    } catch { missing++; manifest.push(`${item.id}: receipt unavailable on this device`); continue; }
    total += bytes.byteLength;
    if (total > 50 * 1024 * 1024) throw new Error('Receipt archive exceeds 50 MB. Export fewer receipts at a time.');
    const extension = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : bytes[0] === 0x89 && bytes[1] === 0x50 ? 'png' : 'webp';
    const name = `${item.date}-${item.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`;
    files[name] = bytes; saved++;
    manifest.push(`${name}: ${item.merchant || item.description}`);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  if (!saved) throw new Error('No receipt photos are available on this device.');
  files['receipts.txt'] = strToU8(manifest.join('\n'));
  await exportBinaryFile(`save-receipts-${Date.now()}.zip`, zipSync(files, { level: 0 }), 'application/zip');
  return { saved, missing };
}
