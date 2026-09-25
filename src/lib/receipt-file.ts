import { File, Paths, Directory } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
export function persistReceipt(uri: string) {
  if (Platform.OS === 'web') return uri;
  const folder = new Directory(Paths.document, 'receipts');
  folder.create({ idempotent: true, intermediates: true });
  const extension = uri.split('.').pop()?.split('?')[0];
  const file = new File(
    folder,
    `${randomUUID()}.${extension && /^[a-zA-Z0-9]+$/.test(extension) ? extension : 'jpg'}`,
  );
  new File(uri).copy(file);
  return file.uri;
}

export async function readReceiptAsBase64(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = (reader.result as string) || '';
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const file = new File(uri);
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
