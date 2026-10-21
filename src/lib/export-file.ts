import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const ANDROID_DOWNLOADS_URI_KEY = 'save.export-downloads-uri';

function downloadOnWeb(name: string, contents: BlobPart, mimeType: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

async function androidDownloadsUri() {
  const existing = await AsyncStorage.getItem(ANDROID_DOWNLOADS_URI_KEY);
  if (existing) return existing;
  const suggested = FileSystemLegacy.StorageAccessFramework.getUriForDirectoryInRoot('Download');
  const permission = await FileSystemLegacy.StorageAccessFramework.requestDirectoryPermissionsAsync(suggested);
  if (!permission.granted) throw new Error('Choose a Downloads folder to save exports.');
  await AsyncStorage.setItem(ANDROID_DOWNLOADS_URI_KEY, permission.directoryUri);
  return permission.directoryUri;
}

async function saveNativeFile(name: string, bytes: Uint8Array, mimeType: string) {
  const filename = safeFileName(name);
  if (Platform.OS === 'android') {
    const directoryUri = await androidDownloadsUri();
    const extensionIndex = filename.lastIndexOf('.');
    const fileNameWithoutExtension = extensionIndex > 0 ? filename.slice(0, extensionIndex) : filename;
    const existingUris = await FileSystemLegacy.StorageAccessFramework.readDirectoryAsync(directoryUri);
    const existingUri = existingUris.find((uri) => decodeURIComponent(uri.split('/').pop() ?? '').includes(filename));
    const fileUri = existingUri ?? await FileSystemLegacy.StorageAccessFramework.createFileAsync(
      directoryUri,
      fileNameWithoutExtension,
      mimeType,
    );
    const encoded = bytesToBase64(bytes);
    await FileSystemLegacy.writeAsStringAsync(fileUri, encoded, {
      encoding: FileSystemLegacy.EncodingType.Base64,
    });
    return;
  }

  const file = new File(Paths.document, filename);
  file.create({ overwrite: true });
  file.write(bytes);
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export async function exportFile(
  name: string,
  contents: string,
  mimeType: string,
) {
  if (Platform.OS === 'web') {
    downloadOnWeb(name, contents, mimeType);
    return;
  }
  await saveNativeFile(name, new TextEncoder().encode(contents), mimeType);
}

export async function exportBinaryFile(name: string, bytes: Uint8Array, mimeType: string) {
  if (Platform.OS === 'web') {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    downloadOnWeb(name, buffer, mimeType);
    return;
  }
  await saveNativeFile(name, bytes, mimeType);
}
