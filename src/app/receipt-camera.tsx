import { persistReceipt, readReceiptAsBase64 } from '@/lib/receipt-file';
import { scanReceiptWithAi } from '@/lib/api';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useExpenseDraftStore } from '@/store/expense-draft-store';
import { useFinanceStore } from '@/store/finance-store';

export default function ReceiptCameraScreen() {
  const router = useRouter();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { categories } = useFinanceStore();
  const { draft, patchDraft } = useExpenseDraftStore();

  const capture = async () => {
    if (!camera.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch {
      Alert.alert(
        'Photo unavailable',
        'Could not take the photo. Please retry.',
      );
    } finally {
      setCapturing(false);
    }
  };
  if (!permission)
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionText}>Checking camera permission…</Text>
      </View>
    );
  if (!permission.granted)
    return (
      <View style={styles.permission}>
        <Text style={styles.permissionTitle}>Camera access is required</Text>
        <Text style={styles.permissionText}>
          SAVE uses the camera only when you choose to photograph a receipt.
        </Text>
        <Pressable
          style={styles.permissionButton}
          onPress={() =>
            permission.canAskAgain
              ? requestPermission()
              : Linking.openSettings()
          }
        >
          <Text style={styles.permissionButtonText}>Allow Camera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.preview}
          contentFit="contain"
        />
      ) : (
        <CameraView ref={camera} style={styles.preview} facing="back" />
      )}
      {photoUri ? (
        <View style={styles.confirmBar}>
          <Pressable
            disabled={analyzing}
            style={styles.confirmButton}
            onPress={() => setPhotoUri(null)}
          >
            <Text style={styles.confirmText}>Retry</Text>
          </Pressable>
          <Pressable
            disabled={analyzing}
            style={[styles.confirmButton, styles.confirmButtonPrimary]}
            onPress={async () => {
              try {
                const localUri = persistReceipt(photoUri);
                patchDraft({ receiptUri: localUri });
                setAnalyzing(true);
                try {
                  const base64 = await readReceiptAsBase64(localUri);
                  const categoryNames = categories
                    .filter((c) => c.type === draft.type)
                    .map((c) => c.name);
                  const parsed = await scanReceiptWithAi(
                    base64,
                    'image/jpeg',
                    categoryNames,
                  );

                  const updates: Partial<typeof draft> = {};
                  if (parsed.amount) updates.amount = parsed.amount.toString();
                  if (parsed.merchant) updates.merchant = parsed.merchant;
                  if (parsed.date) updates.date = parsed.date;
                  if (parsed.notes && !draft.description)
                    updates.description = parsed.notes;
                  else if (parsed.merchant && !draft.description)
                    updates.description = `Purchase at ${parsed.merchant}`;

                  if (parsed.category) {
                    const matched = categories.find(
                      (c) =>
                        c.name.toLowerCase() ===
                        parsed.category?.toLowerCase(),
                    );
                    if (matched) updates.category = matched.name;
                    else if (!draft.category) updates.category = parsed.category;
                  }
                  patchDraft(updates);
                } catch {
                  // If AI parsing is offline/fails, the photo remains safely attached locally
                }
                router.back();
              } catch {
                Alert.alert(
                  'Attachment failed',
                  'Could not store the receipt. Please retry.',
                );
              } finally {
                setAnalyzing(false);
              }
            }}
          >
            {analyzing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.confirmText}>AI Scanning…</Text>
              </View>
            ) : (
              <Text style={styles.confirmText}>Use Photo</Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={styles.captureBar}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.captureCancel}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Take receipt photo"
            disabled={capturing}
            style={styles.shutterOuter}
            onPress={capture}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.spacer} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1, backgroundColor: '#000' },
  confirmBar: {
    height: 86,
    backgroundColor: 'rgba(18,18,18,0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  confirmButton: { flex: 1, alignItems: 'center', padding: 18 },
  confirmButtonPrimary: { backgroundColor: 'rgba(59, 130, 246, 0.4)', borderRadius: 8, marginHorizontal: 8 },
  confirmText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  captureBar: {
    height: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 24,
  },
  captureCancel: { color: '#fff', fontSize: 16, width: 70 },
  spacer: { width: 70 },
  shutterOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  permission: {
    flex: 1,
    backgroundColor: '#070d1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 18,
  },
  permissionTitle: { color: '#f4f7fb', fontSize: 22, fontWeight: '800' },
  permissionText: { color: '#96a3b8', textAlign: 'center', lineHeight: 21 },
  permissionButton: {
    backgroundColor: '#5ca9ff',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 13,
  },
  permissionButtonText: { color: '#07111f', fontWeight: '800' },
  cancelText: { color: '#aeb9cb' },
});
