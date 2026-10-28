const test = require('node:test');
const assert = require('node:assert/strict');
const { ReceiptsService } = require('../dist/receipts/receipts.service');

// Characterize the transport/validation contract, not image-recognition accuracy.
// Model outputs below are test doubles; no real receipts or provider are used.
function scanner(tin) {
  const state = {};
  const service = new ReceiptsService({ get: (_key, fallback) => fallback });
  service.aiClient = { live: { connect: async options => {
    state.options = options;
    return {
      close() {},
      sendClientContent() {
        queueMicrotask(() => options.callbacks.onmessage({ toolCall: { functionCalls: [{
          name: 'extract_receipt',
          args: { merchant: 'Shop', amount: 125.5, date: '2026-10-28', tin },
        }] } }));
      },
    };
  } } };
  return { service, state };
}

for (const [label, tin] of [
  ['VAT Reg TIN', '001-234-567-00000'],
  ['Non-VAT Reg TIN', '000-123-456-000'],
]) {
  test(`${label} leading zeros and branch suffix reach the client unchanged`, async () => {
    const { service } = scanner(` ${tin} `);
    const result = await service.scanReceipt('dGVzdA==');
    assert.equal(result.tin, tin);
  });
}

for (const tin of [undefined, '', '   ']) {
  test(`unreadable TIN (${JSON.stringify(tin)}) does not invalidate a receipt`, async () => {
    const { service } = scanner(tin);
    const result = await service.scanReceipt('dGVzdA==');
    assert.equal(result.tin, undefined);
    assert.equal(result.merchant, 'Shop');
    assert.equal(result.amount, 125.5);
  });
}

test('TIN extraction instructions cover VAT/non-VAT and exclude unrelated provider or customer IDs', async () => {
  const { service, state } = scanner('');
  await service.scanReceipt('dGVzdA==');
  const prompt = state.options.config.systemInstruction;
  for (const label of ['VAT REG TIN', 'NON-VAT REG TIN', 'HEADER', 'FOOTER', 'POS Provider', 'buyer/customer TIN', 'do not invent digits']) {
    assert.ok(prompt.includes(label), `Missing receipt instruction: ${label}`);
  }
  const schema = state.options.config.tools[0].functionDeclarations[0].parameters;
  assert.equal(schema.properties.tin.type, 'STRING');
  assert.match(schema.properties.tin.description, /empty string only if absent or unreadable/);
});
