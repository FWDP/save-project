const test = require('node:test');
const assert = require('node:assert/strict');
const {
  monthTransactions,
  totalsFor,
  budgetProgress,
  merchantTotals,
  validDate,
  localDate,
  shiftMonth,
} = require('./load-typescript.cjs')('src/lib/finance.ts');
const transaction = (overrides = {}) => ({
  id: '1',
  userId: 'a',
  type: 'expense',
  amount: 25,
  date: '2026-09-01',
  description: 'Lunch',
  category: 'Food',
  status: 'approved',
  ...overrides,
});
test('monthly totals exclude other months and rejected records, and preserve cents', () => {
  const rows = [
    transaction({ amount: 0.1 }),
    transaction({ amount: 0.2 }),
    transaction({ amount: 900, date: '2026-08-31' }),
    transaction({ status: 'rejected' }),
    transaction({ type: 'income', amount: 1 }),
  ];
  assert.deepEqual(totalsFor(monthTransactions(rows, '2026-09')), {
    income: 1,
    expenses: 0.3,
    balance: 0.7,
  });
});
test('overspending is not capped in the label, only in the visual bar', () => {
  assert.deepEqual(budgetProgress(150, 100), {
    percent: 150,
    width: 100,
    remaining: -50,
  });
  assert.deepEqual(budgetProgress(0, 0), {
    percent: 0,
    width: 0,
    remaining: 0,
  });
});
test('merchants aggregate repeated purchases regardless of case', () => {
  assert.deepEqual(
    merchantTotals([
      transaction({ merchant: ' Cafe ' }),
      transaction({ merchant: 'cafe', amount: 5 }),
      transaction({ type: 'income', merchant: 'Cafe' }),
    ]),
    [{ name: 'Cafe', amount: 30, count: 2 }],
  );
});
test('dates reject impossible dates and keep local month boundaries', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(localDate(new Date(2026, 8, 1, 0)), '2026-09-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});
