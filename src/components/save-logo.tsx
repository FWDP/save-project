import { Image } from 'expo-image';

export function SaveLogo({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/save-logo.jpg')}
      accessibilityLabel="SAVE logo"
      contentFit="contain"
      style={{ width: size, height: size, borderRadius: size * 0.2 }}
    />
  );
}
