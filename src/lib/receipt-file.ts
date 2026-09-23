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
