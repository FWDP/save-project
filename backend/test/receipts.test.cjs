const test = require('node:test');
const assert = require('node:assert/strict');

const { ReceiptsService } = require('../dist/receipts/receipts.service');
const { ReceiptsController } = require('../dist/receipts/receipts.controller');

function mockConfig(env = {}) {
  return {
    get: (key, defaultValue) => (key in env ? env[key] : defaultValue),
  };
}

test('ReceiptsService throws ServiceUnavailableException when GEMINI_API_KEY is not configured', async () => {
  const service = new ReceiptsService(mockConfig({}));
  await assert.rejects(
    () => service.scanReceipt('validbase64string'),
    {
      name: 'ServiceUnavailableException',
      message: /Gemini API key is not configured/,
    },
  );
});

test('ReceiptsService throws BadRequestException when base64 is missing or empty', async () => {
  const service = new ReceiptsService(mockConfig({ GEMINI_API_KEY: 'test-key' }));
  await assert.rejects(
    () => service.scanReceipt(''),
    {
      name: 'BadRequestException',
      message: /Image data must be a valid base64 string/,
    },
  );
  await assert.rejects(
    () => service.scanReceipt('   '),
    {
      name: 'BadRequestException',
      message: /Image base64 content is empty/,
    },
  );
});

test('ReceiptsService successfully parses valid receipt from Gemini response', async () => {
  const service = new ReceiptsService(mockConfig({ GEMINI_API_KEY: 'test-key' }));

  // Mock internal AI client
  service.aiClient = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          merchant: 'Starbucks Coffee',
          amount: 250.75,
          currency: 'PHP',
          date: '2026-09-25',
          category: 'Food & Dining',
          tax: 26.87,
          notes: 'Caramel Macchiato, Croissant',
          confidence: 0.98,
        }),
      }),
    },
  };

  const result = await service.scanReceipt('dummyBase64Data', 'image/jpeg', ['Food & Dining', 'Transportation']);
  assert.equal(result.merchant, 'Starbucks Coffee');
  assert.equal(result.amount, 250.75);
  assert.equal(result.currency, 'PHP');
  assert.equal(result.date, '2026-09-25');
  assert.equal(result.category, 'Food & Dining');
  assert.equal(result.tax, 26.87);
  assert.equal(result.confidence, 0.98);
});

test('ReceiptsService handles invalid or zero amount in AI output gracefully', async () => {
  const service = new ReceiptsService(mockConfig({ GEMINI_API_KEY: 'test-key' }));

  service.aiClient = {
    models: {
      generateContent: async () => ({
        text: JSON.stringify({
          merchant: 'Random Store',
          amount: 0,
          date: '2026-09-25',
        }),
      }),
    },
  };

  await assert.rejects(
    () => service.scanReceipt('dummyBase64Data'),
    {
      name: 'BadRequestException',
      message: /could not detect a valid transaction amount/,
    },
  );
});

test('ReceiptsController processes uploaded file buffer as base64', async () => {
  const dummyResult = {
    merchant: 'Shell Station',
    amount: 1200,
    currency: 'PHP',
    date: '2026-09-25',
    category: 'Transportation',
  };

  const mockService = {
    scanReceipt: async (base64, mimeType, categories) => {
      assert.equal(base64, Buffer.from('fake-receipt-bytes').toString('base64'));
      assert.equal(mimeType, 'image/png');
      assert.deepEqual(categories, ['Transportation']);
      return dummyResult;
    },
  };

  const controller = new ReceiptsController(mockService);
  const file = {
    buffer: Buffer.from('fake-receipt-bytes'),
    mimetype: 'image/png',
  };

  const result = await controller.scanReceipt(file, { categories: ['Transportation'] });
  assert.deepEqual(result, dummyResult);
});

test('ReceiptsController rejects requests without file or base64', async () => {
  const mockService = {
    scanReceipt: async () => {},
  };
  const controller = new ReceiptsController(mockService);

  await assert.rejects(
    () => controller.scanReceipt(undefined, {}),
    {
      name: 'BadRequestException',
      message: /Please provide an image file or an imageBase64 payload/,
    },
  );
});
