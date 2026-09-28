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

  service.aiClient = liveResult({
    merchant: 'Starbucks Coffee', amount: 250.75, currency: 'PHP',
    date: '2026-09-25', category: 'Food & Dining', tax: 26.87,
    notes: 'Caramel Macchiato, Croissant', confidence: 0.98,
  });

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

  service.aiClient = liveResult({ merchant: 'Random Store', amount: 0, date: '2026-09-25' });

  await assert.rejects(
    () => service.scanReceipt('dummyBase64Data'),
    {
      name: 'BadRequestException',
      message: /invalid receipt details/,
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

test('receipt categories are normalized before the global validation pipe', async () => {
  const { ValidationPipe } = require('@nestjs/common');
  const { ScanReceiptDto } = require('../dist/receipts/receipts.dto');
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const parse = categories => pipe.transform({ categories }, { type: 'body', metatype: ScanReceiptDto });
  const labels = ['Food & Dining / Groceries', 'Custom, with comma'];
  assert.deepEqual((await parse(JSON.stringify(labels))).categories, labels);
  assert.deepEqual((await parse(labels)).categories, labels);
  assert.deepEqual((await parse('Groceries, Fuel')).categories, ['Groceries', 'Fuel']);
  assert.deepEqual((await parse('')).categories, []);
  for (const invalid of ['[broken', '{"name":"Food"}', '["Food",12]', 123, [''], Array(201).fill('Food')]) {
    await assert.rejects(parse(invalid), { status: 400 });
  }
});

test('multipart receipt upload passes through Nest validation to the scanner', async () => {
  const { Module, ValidationPipe } = require('@nestjs/common');
  const { NestFactory } = require('@nestjs/core');
  const labels = ['Food & Dining / Groceries'];
  let calls = 0;
  class TestModule {}
  Module({ controllers: [ReceiptsController], providers: [{ provide: ReceiptsService, useValue: {
    scanReceipt: async (base64, mimeType, categories) => {
      calls++;
      assert.equal(base64, Buffer.from('receipt').toString('base64'));
      assert.equal(mimeType, 'image/png');
      assert.deepEqual(categories, labels);
      return { merchant: 'Shop', amount: 50, date: '2026-09-28', category: labels[0] };
    },
  } }] })(TestModule);
  const app = await NestFactory.create(TestModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, '127.0.0.1');
  try {
    const url = await app.getUrl();
    for (const [categories, status] of [[JSON.stringify(labels), 200], ['[123]', 400]]) {
      const form = new FormData();
      form.append('file', new Blob(['receipt'], { type: 'image/png' }), 'receipt.png');
      form.append('categories', categories);
      const response = await fetch(`${url}/receipts/scan`, { method: 'POST', body: form });
      assert.equal(response.status, status);
      if(status === 200) assert.equal((await response.json()).category, labels[0]);
    }
    assert.equal(calls, 1);
  } finally { await app.close(); }
});

function liveResult(args) {
  return { live: { connect: async ({callbacks}) => ({
    sendClientContent() { queueMicrotask(() => callbacks.onmessage({toolCall:{functionCalls:[{name:'extract_receipt',args}]}})); },
    close() {},
  }) } };
}

test('Live rejects unsupported PDFs before contacting the provider', async () => {
  const service = new ReceiptsService(mockConfig({}));
  await assert.rejects(service.scanReceipt('dummy', 'application/pdf'), /Convert PDFs/);
});

test('Live receipt output is validated before returning financial fields', async () => {
  const valid = {merchant:'Shop', amount:25, date:'2026-09-28'};
  for(const patch of [{merchant:42}, {date:'2026-02-30'}, {confidence:2}, {amount:'25'}, {tax:-1}]) {
    const service = new ReceiptsService(mockConfig({}));
    service.aiClient = liveResult({...valid,...patch});
    await assert.rejects(service.scanReceipt('dummy'), /invalid receipt details/);
  }
});
