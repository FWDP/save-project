const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const { parseCsv, csvRows, importPreview, transactionsCsv } = load(
  'src/lib/transfers.ts',
);
test('CSV parser preserves quoted commas, quotes, multiline descriptions and CRLF', () => {
  assert.deepEqual(parseCsv('a,b\r\n"one, two","line 1\nline ""2"""'), [
    ['a', 'b'],
    ['one, two', 'line 1\nline "2"'],
  ]);
  assert.throws(() => parseCsv('a,"unfinished'));
});
test('invalid import is rejected before any mutation', () => {
  assert.throws(() => csvRows('date,amount\n2026-02-30,10'));
  assert.throws(() => csvRows('date,amount,type\n2026-09-01,10,transfer'));
  assert.throws(() => csvRows('date,amount\n2026-09-01,-1'));
});
test('import preview skips duplicate file rows and existing records', () => {
  const rows = csvRows(
    'date,amount,description\n2026-09-01,10,Coffee\n2026-09-01,10,Coffee\n2026-09-02,20,Lunch',
  );
  const result = importPreview(rows, [rows[0]]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.duplicates, 2);
});
test('CSV export neutralizes spreadsheet formulas', () => {
  const csv = transactionsCsv([
    {
      date: '2026-09-01',
      amount: 10,
      type: 'expense',
      description: '=1+1',
      category: 'Food',
    },
  ]);
  assert.ok(csv.includes('"\'=1+1"'));
});

test('CSV round-trip preserves merchant TIN and displays US-style dates', () => {
  const original = { date: '2026-10-26', type: 'expense', amount: 25, category: 'Food', description: 'Coffee', merchant: 'Shop', customFields: { TIN: '001-234-567-00000' } };
  const csv = transactionsCsv([original]);
  assert.match(csv, /10\/26\/2026/);
  assert.match(csv, /merchant or source tin/);
  const [row] = csvRows(csv);
  assert.equal(row.date, original.date);
  assert.equal(row.merchant, original.merchant);
  assert.equal(row.customFields.TIN, original.customFields.TIN);
  assert.throws(() => csvRows('date,amount\n02/30/2026,25'));
});

test('PDF statement preview preserves direction and rejects ambiguous rows', () => {
  const { statementRows } = load('src/lib/statement-import.ts');
  const rows = statementRows('Date\tDescription\tDebit\tCredit\n10/26/2026\tCoffee\t25.00\t0\n10/25/2026\tDeposit\t0\t1,000.00');
  assert.deepEqual(rows.map(row => [row.date, row.type, row.amount]), [['2026-10-26','expense',25],['2026-10-25','income',1000]]);
  assert.throws(() => statementRows('Date\tDescription\tDebit\tCredit\n10/26/2026\tAmbiguous\t25\t25'));
  assert.throws(() => statementRows('unrecognized statement'));
});

test('GCash references preserve distinct same-day payments and deduplicate reimports', () => {
  const { statementRows } = load('src/lib/statement-import.ts');
  const header = 'Date\tDescription\tType\tAmount\tGCash Reference\tTransaction Time\tMerchant or source';
  const text = header + '\n2026-10-01\tCoffee\texpense\t25.00\t000000000001\t09:00 AM\tShop\n2026-10-01\tCoffee\texpense\t25.00\t000000000002\t09:05 AM\tShop';
  const rows = statementRows(text);
  assert.equal(importPreview(rows, []).rows.length, 2);
  assert.equal(importPreview(rows, rows).duplicates, 2);
  assert.equal(rows[0].customFields.TIN, '');
  assert.equal(rows[0].customFields['Reference No.'], '000000000001');
  assert.equal(importPreview(csvRows(transactionsCsv(rows)), rows).duplicates, 2);
  assert.equal(importPreview(rows, [{ ...rows[0], category: 'Dining', description: 'Edited' }]).duplicates, 1);
});
