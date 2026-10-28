const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const load = require('./load-typescript.cjs');

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const reads = [];
  const sqlite = load('src/lib/sqlite.ts', {
    'expo-sqlite': {
      openDatabaseSync: () => ({
        execSync: (sql) => db.exec(sql),
        runSync: (sql, params = []) => db.prepare(sql).run(...params),
        getAllSync: (sql, params = []) => {
          const rows = db.prepare(sql).all(...params);
          reads.push({ sql, count: rows.length });
          return rows;
        },
      }),
    },
  });
  return { ...sqlite, reads };
}

function receipt(index, userId = 'alice') {
  return {
    id: `local_${userId}_${index}`,
    clientMutationId: `${userId}_${index}`,
    userId,
    type: 'expense',
    amount: 10.5,
    category: 'Food',
    description: `Receipt ${index}`,
    date: '2026-10-01',
    receiptUri: `file:///documents/receipts/${userId}_${index}.jpg`,
    customFields: { TIN: '123-456-789-000' },
    syncState: 'pending',
  };
}

test('saving 60 receipt transactions does not read earlier queued payloads', (t) => {
  const f = fixture(t);
  const rows = Array.from({ length: 60 }, (_, index) => receipt(index));
  for (const row of rows) f.enqueueTransaction('alice', row);
  const payloadReads = f.reads.filter(({ sql }) => /SELECT payload FROM transaction_outbox/i.test(sql));
  const rowsRead = payloadReads.reduce((sum, read) => sum + read.count, 0);
  t.diagnostic(`enqueue payload SELECTs: ${payloadReads.length}; previous payloads read: ${rowsRead}`);
  assert.equal(payloadReads.length, 0, 'enqueue must not synchronously read/parse the growing queue');
  assert.deepEqual(f.pendingTransactions('alice'), rows);
});

test('outbox remains durable and account-scoped when acknowledging receipt transactions', (t) => {
  const f = fixture(t);
  const alice = receipt(1);
  const bob = receipt(1, 'bob');
  f.enqueueTransaction('alice', alice);
  f.enqueueTransaction('bob', bob);
  f.acknowledgeTransaction(alice.id, 'bob');
  assert.deepEqual(f.pendingTransactions('alice'), [alice]);
  assert.deepEqual(f.pendingTransactions('bob'), [bob]);
  f.acknowledgeTransaction(alice.id, 'alice');
  assert.deepEqual(f.pendingTransactions('alice'), []);
  assert.deepEqual(f.pendingTransactions('bob'), [bob]);
});

test('reading a fresh outbox still initializes the table', (t) => {
  const f = fixture(t);
  assert.deepEqual(f.pendingTransactions('alice'), []);
});
