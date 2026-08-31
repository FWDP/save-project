export type StellarWalletConnectSession = {
  topic: string;
  address: string;
  walletName: string;
};

export type StellarWalletConnectPairing = {
  uri: string;
  freighterDeepLink: string;
  approval: () => Promise<StellarWalletConnectSession>;
};

export function walletConnectConfiguration() {
  return { configured: false, projectId: '', metadataUrl: '', usingDefaultMetadata: true };
}

export async function restoreStellarWalletSession(): Promise<StellarWalletConnectSession | null> {
  return null;
}

export async function createStellarWalletPairing(): Promise<StellarWalletConnectPairing> {
  throw new Error('Freighter Mobile WalletConnect is available in the Android and iOS app.');
}

export async function signStellarXdr() {
  throw new Error('Freighter Mobile WalletConnect is available in the Android and iOS app.');
}

export async function disconnectStellarWallet() {}

export function subscribeStellarWalletSession(_listener: (reason: string) => void) {
  return () => {};
}
