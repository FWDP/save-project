import '@walletconnect/react-native-compat';

import { SignClient } from '@walletconnect/sign-client';
import type { SessionTypes } from '@walletconnect/types';

const TESTNET_CHAIN = 'stellar:testnet';
const REQUIRED_METHOD = 'stellar_signXDR';
const FREIGHTER_DEEP_LINK = 'freighterwallet://wc?uri=';
const DEFAULT_METADATA_URL = 'https://github.com/FWDP/save-project';
const DEFAULT_METADATA_ICON = 'https://raw.githubusercontent.com/FWDP/save-project/main/assets/images/icon.png';

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

let clientPromise: ReturnType<typeof SignClient.init> | undefined;
const sessionListeners = new Set<(reason: string) => void>();

export function walletConnectConfiguration() {
  const projectId = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? '';
  const configuredMetadataUrl = process.env.EXPO_PUBLIC_WALLETCONNECT_METADATA_URL?.trim() ?? '';
  const hasValidMetadataUrl = /^https:\/\//.test(configuredMetadataUrl);
  return {
    configured: Boolean(projectId),
    projectId,
    metadataUrl: hasValidMetadataUrl ? configuredMetadataUrl : DEFAULT_METADATA_URL,
    usingDefaultMetadata: !hasValidMetadataUrl,
  };
}

function accountFromSession(session: SessionTypes.Struct) {
  const namespace = session.namespaces.stellar;
  const account = namespace?.accounts.find((value) => value.startsWith(`${TESTNET_CHAIN}:`));
  const address = account?.split(':')[2];
  if (!address) throw new Error('Freighter did not approve a Stellar Testnet account.');
  if (!namespace.methods.includes(REQUIRED_METHOD)) {
    throw new Error('The connected wallet did not approve Stellar XDR signing.');
  }
  return {
    topic: session.topic,
    address,
    walletName: session.peer.metadata.name || 'Freighter Mobile',
  };
}

async function getClient() {
  const config = walletConnectConfiguration();
  if (!config.configured) {
    throw new Error(
      'WalletConnect setup is incomplete. Add EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID, then restart Expo.',
    );
  }
  clientPromise ??= SignClient.init({
    projectId: config.projectId,
    metadata: {
      name: 'SAVE Finance',
      description: 'Non-custodial Stellar Testnet savings goals',
      url: config.metadataUrl,
      icons: config.usingDefaultMetadata
        ? [DEFAULT_METADATA_ICON]
        : [`${config.metadataUrl.replace(/\/$/, '')}/favicon.ico`],
      redirect: { native: 'saveproject://stellar' },
    },
  }).then((client) => {
    client.on('session_delete', () => sessionListeners.forEach((listener) => listener('Freighter disconnected the WalletConnect session.')));
    client.on('session_expire', () => sessionListeners.forEach((listener) => listener('The Freighter WalletConnect session expired. Reconnect to continue.')));
    client.on('session_event', ({ params }) => {
      if (params.event.name === 'accountsChanged') {
        sessionListeners.forEach((listener) => listener('Freighter changed accounts. Reconnect the matching Testnet account.'));
      }
    });
    client.on('proposal_expire', () => undefined);
    return client;
  });
  return clientPromise;
}

export function subscribeStellarWalletSession(listener: (reason: string) => void) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

export async function restoreStellarWalletSession() {
  const config = walletConnectConfiguration();
  if (!config.configured) return null;
  const client = await getClient();
  const session = client.session
    .getAll()
    .find((item) => item.expiry * 1000 > Date.now() && item.namespaces.stellar);
  if (!session) return null;
  try {
    return accountFromSession(session);
  } catch {
    return null;
  }
}

export async function createStellarWalletPairing(): Promise<StellarWalletConnectPairing> {
  const client = await getClient();
  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      stellar: {
        chains: [TESTNET_CHAIN],
        methods: [REQUIRED_METHOD],
        events: ['accountsChanged'],
      },
    },
  });
  if (!uri) throw new Error('WalletConnect did not create a pairing URI.');
  return {
    uri,
    freighterDeepLink: `${FREIGHTER_DEEP_LINK}${encodeURIComponent(uri)}`,
    approval: async () => accountFromSession(await approval()),
  };
}

export async function signStellarXdr(
  session: StellarWalletConnectSession,
  unsignedXdr: string,
  expectedAddress: string,
) {
  if (session.address !== expectedAddress) {
    throw new Error('The linked SAVE account does not match the connected Freighter account.');
  }
  const client = await getClient();
  const activeSession = client.session.get(session.topic);
  const activeAccount = accountFromSession(activeSession);
  if (activeAccount.address !== expectedAddress) {
    throw new Error('Freighter changed accounts. Reconnect the matching Testnet account.');
  }
  const result = await client.request<{ signedXDR: string; signer?: string }>({
    topic: session.topic,
    chainId: TESTNET_CHAIN,
    request: {
      method: REQUIRED_METHOD,
      params: { xdr: unsignedXdr },
    },
  });
  if (!result?.signedXDR) throw new Error('Freighter returned no signed transaction XDR.');
  if (result.signer && result.signer !== expectedAddress) {
    throw new Error('Freighter signed with a different account than the linked SAVE account.');
  }
  return result.signedXDR;
}

export async function disconnectStellarWallet(session: StellarWalletConnectSession) {
  const client = await getClient();
  if (!client.session.keys.includes(session.topic)) return;
  await client.disconnect({
    topic: session.topic,
    reason: { code: 6000, message: 'User disconnected SAVE Finance' },
  });
}
