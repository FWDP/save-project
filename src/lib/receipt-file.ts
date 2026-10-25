import { ImageManipulator, SaveFormat, type ImageRef, type ImageResult } from 'expo-image-manipulator';
import { File, Paths, Directory } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
export async function persistReceipt(uri: string, mimeType?: string) {
  if (Platform.OS === 'web') return uri;
  const folder = new Directory(Paths.document, 'receipts');
  folder.create({ idempotent: true, intermediates: true });
  // Bound decoded image memory while retaining enough detail for small receipt text.
  const context = ImageManipulator.manipulate(uri);
  let image: ImageRef | undefined;
  let output: ImageResult;
  try {
    image = await context.renderAsync();
    if (image.width > 2560 || image.height > 2560) {
      context.resize(image.width >= image.height ? { width: 2560 } : { height: 2560 });
      image.release();
      image = undefined;
      image = await context.renderAsync();
    }
    output = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  } finally { image?.release(); context.release(); }
  const file = new File(folder, `${randomUUID()}.jpg`);
  const temporary = new File(output.uri);
  try { await temporary.copy(file); }
  finally { temporary.delete(); }
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
  return file.base64();
}
