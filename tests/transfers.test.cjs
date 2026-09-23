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
