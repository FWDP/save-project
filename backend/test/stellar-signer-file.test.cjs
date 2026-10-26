const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Keypair } = require('@stellar/stellar-sdk');
const { loadIntegritySigner } = require('../dist/stellar/stellar.sep7');

test('integrity signer validates permissions and reads the same opened file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-signer-'));
  const file = path.join(dir, 'key');
  const replacement = path.join(dir, 'replacement');
  const signer = Keypair.random();
  const fstat = fs.fstatSync;
  try {
    fs.writeFileSync(file, signer.secret(), { mode: 0o600 });
    fs.writeFileSync(replacement, Keypair.random().secret(), { mode: 0o600 });
    fs.fstatSync = fd => {
      const result = fstat(fd);
      fs.renameSync(replacement, file);
      return result;
    };
    assert.equal(loadIntegritySigner(file).publicKey(), signer.publicKey());
    fs.fstatSync = fstat;
    if (process.platform !== 'win32') {
      fs.chmodSync(file, 0o644);
      assert.throws(() => loadIntegritySigner(file), /must not be accessible/);
    }
    assert.throws(() => loadIntegritySigner(dir), /regular file/);
    assert.equal(loadIntegritySigner(), undefined);
  } finally {
    fs.fstatSync = fstat;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
