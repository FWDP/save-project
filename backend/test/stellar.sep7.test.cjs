const assert = require('node:assert/strict');
const test = require('node:test');

const { Account, Keypair, Networks, Operation, TransactionBuilder } = require('@stellar/stellar-sdk');
const {
  assertMatchingSignedTransaction,
  buildSep7SigningUrl,
  signSep7Uri,
  transactionHash,
} = require('../dist/stellar/stellar.sep7');

function transaction(keypair, sequence, value) {
  return new TransactionBuilder(new Account(keypair.publicKey(), sequence), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: 'save-test', value }))
    .setTimeout(60)
    .build();
}

test('accepts signatures only for the prepared transaction body', () => {
  const signer = Keypair.random();
  const prepared = transaction(signer, '1', 'expected');
  const signed = TransactionBuilder.fromXDR(prepared.toXDR(), Networks.TESTNET);
  signed.sign(signer);

  assert.doesNotThrow(() => assertMatchingSignedTransaction(prepared.toXDR(), signed.toXDR(), Networks.TESTNET));
  assert.equal(transactionHash(prepared.toXDR(), Networks.TESTNET), transactionHash(signed.toXDR(), Networks.TESTNET));

  const substituted = transaction(signer, '2', 'different');
  substituted.sign(signer);
  assert.throws(
    () => assertMatchingSignedTransaction(prepared.toXDR(), substituted.toXDR(), Networks.TESTNET),
    /does not match/,
  );
});

test('builds a callback-enabled SEP-7 request for the intended signer', () => {
  const source = Keypair.random();
  const prepared = transaction(source, '1', 'callback');
  const url = buildSep7SigningUrl({
    xdr: prepared.toXDR(),
    source: source.publicKey(),
    action: 'contribute',
    callbackUrl: 'https://save.example/stellar/callback/request-1',
  });

  assert.match(url, /^web\+stellar:tx\?/);
  assert.match(url, new RegExp(`pubkey=${source.publicKey()}`));
  assert.match(url, /callback=url%3Ahttps%3A%2F%2Fsave\.example/);
  assert.doesNotMatch(url, /signature=/);
});

test('signs SEP-7 origin requests with the dedicated integrity key', () => {
  const user = Keypair.random();
  const integritySigner = Keypair.random();
  const prepared = transaction(user, '1', 'signed-request');
  const url = buildSep7SigningUrl({
    xdr: prepared.toXDR(),
    source: user.publicKey(),
    action: 'create_goal',
    originDomain: 'save.example',
    signer: integritySigner,
  });
  const [unsignedUri, encodedSignature] = url.split('&signature=');
  const signature = Buffer.from(decodeURIComponent(encodedSignature), 'base64');
  const envelopeType = Buffer.alloc(36); envelopeType[35] = 4;
  const payload = Buffer.concat([envelopeType, Buffer.from(`stellar.sep.7 - URI Scheme${unsignedUri}`)]);

  assert.equal(signSep7Uri(unsignedUri, integritySigner), signature.toString('base64'));
  assert.equal(integritySigner.verify(payload, signature), true);
});
