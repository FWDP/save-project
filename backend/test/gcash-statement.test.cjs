const test = require('node:test');
const assert = require('node:assert/strict');
const { gcashTable } = require('../dist/receipts/gcash-statement');
const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
const headers = () => ['Date and Time', 'Description', 'Reference No.', 'Debit', 'Credit', 'Balance'].map((s, i) => item(s, [50, 210, 340, 427, 475, 523][i], 800));
const sample = () => [
  [...headers(), item('STARTING BALANCE',125,785),item('500.00',523,785),
    item('2026-10-01 09:00 AM',50,770),item('Payment to Example Shop',125,770),item('000000000001',329,770),item('25.00',427,770),item('475.00',523,770),
    item('2026-10-01 09:05 AM',50,747.6),item('Received GCash from Example Bank',125,750),item('000000000002',329,750),item('100.00',475,750),item('575.00',523,750),item('additional description',125,740)],
  [...headers(),item('Total Debit',125,785),item('25.00',427,785),item('Total Credit',125,770),item('100.00',475,770)],
];
test('GCash positions preserve blank debit/credit cells, wrapped text and reference zeros', () => {
  const lines = gcashTable(sample()).split('\n');
  assert.equal(lines.length, 3);
  assert.match(lines[1], /expense\t25.00\t000000000001/);
  assert.match(lines[2], /Example Bank additional description\tincome\t100.00\t000000000002/);
});
test('GCash rejects incomplete pages, ambiguous amounts and total mismatches', () => {
  const mismatch = sample(); mismatch[1][7].str = '26.00';
  assert.throws(() => gcashTable(mismatch), /totals could not be verified/);
  const ambiguous = sample(); ambiguous[0].push(item('25.00',475,770));
  assert.throws(() => gcashTable(ambiguous));
  assert.throws(() => gcashTable([sample()[0]]));
  const missing = sample(); missing[0] = missing[0].filter(i => i.str !== '000000000001');
  assert.throws(() => gcashTable(missing));
});
