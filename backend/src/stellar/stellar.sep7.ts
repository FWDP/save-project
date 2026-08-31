import { readFileSync, statSync } from 'node:fs';

import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

const SEP7_PREFIX = 'stellar.sep.7 - URI Scheme';

export function loadIntegritySigner(secretFile?: string): Keypair | undefined {
  if (!secretFile) return undefined;

  const stats = statSync(secretFile);
  if (!stats.isFile()) throw new Error('STELLAR_INTEGRITY_SIGNER_SECRET_FILE must reference a regular file');
  if (process.platform !== 'win32' && (stats.mode & 0o077) !== 0) {
    throw new Error('Stellar integrity signer secret file must not be accessible by group or other users');
  }

  return Keypair.fromSecret(readFileSync(secretFile, 'utf8').trim());
}

export function transactionHash(xdr: string, networkPassphrase: string): string {
  const transaction = TransactionBuilder.fromXDR(xdr, networkPassphrase);
  return Buffer.from(transaction.hash()).toString('hex');
}

export function assertMatchingSignedTransaction(
  unsignedXdr: string,
  signedXdr: string,
  networkPassphrase: string,
): void {
  const unsigned = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
  const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  if (!('signatures' in signed) || signed.signatures.length === 0) {
    throw new Error('Transaction has no signatures');
  }
  if (Buffer.from(unsigned.hash()).compare(Buffer.from(signed.hash())) !== 0) {
    throw new Error('Signed transaction does not match the prepared request');
  }
}

export function signSep7Uri(uri: string, signer: Keypair): string {
  const envelopeType = Buffer.alloc(36);
  envelopeType[35] = 4;
  const payload = Buffer.concat([envelopeType, Buffer.from(`${SEP7_PREFIX}${uri}`, 'utf8')]);
  return Buffer.from(signer.sign(payload)).toString('base64');
}

export function buildSep7SigningUrl(options: {
  xdr: string;
  source: string;
  action: string;
  callbackUrl?: string;
  originDomain?: string;
  signer?: Keypair;
}): string {
  const parameters = [
    `xdr=${encodeURIComponent(options.xdr)}`,
    `pubkey=${encodeURIComponent(options.source)}`,
    `msg=${encodeURIComponent(`SAVE Testnet: ${options.action.replaceAll('_', ' ')}`)}`,
  ];
  if (options.callbackUrl) parameters.push(`callback=${encodeURIComponent(`url:${options.callbackUrl}`)}`);
  if (options.originDomain && options.signer) {
    parameters.push(`origin_domain=${encodeURIComponent(options.originDomain)}`);
  }

  const unsignedUri = `web+stellar:tx?${parameters.join('&')}`;
  if (!options.originDomain || !options.signer) return unsignedUri;
  return `${unsignedUri}&signature=${encodeURIComponent(signSep7Uri(unsignedUri, options.signer))}`;
}
