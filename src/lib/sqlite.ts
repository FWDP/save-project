import * as SQLite from 'expo-sqlite';

import type { ApiBudget, ApiCategory, ApiTransaction } from './api';

const db = SQLite.openDatabaseSync('save.db');

export function initializeDatabase() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      userId TEXT,
      type TEXT,
      amount REAL,
      category TEXT,
      description TEXT,
      date TEXT,
      status TEXT,
      merchant TEXT,
      tags TEXT,
      recurring INTEGER,
      receiptUri TEXT,
      customFields TEXT
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      userId TEXT,
      category TEXT,
      budgetLimit REAL,
      spent REAL,
      period TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      color TEXT
    );
  `);

  const columns = new Set(
    db
      .getAllSync<{ name: string }>('PRAGMA table_info(transactions)')
      .map((column) => column.name),
  );
  const migrations = [
    ['merchant', 'ALTER TABLE transactions ADD COLUMN merchant TEXT'],
    ['tags', 'ALTER TABLE transactions ADD COLUMN tags TEXT'],
    ['recurring', 'ALTER TABLE transactions ADD COLUMN recurring INTEGER'],
    ['receiptUri', 'ALTER TABLE transactions ADD COLUMN receiptUri TEXT'],
    ['customFields', 'ALTER TABLE transactions ADD COLUMN customFields TEXT'],
  ] as const;
  for (const [name, sql] of migrations) {
    if (!columns.has(name)) db.execSync(sql);
  }
}

export function loadCachedTransactions(): ApiTransaction[] {
  const rows = db.getAllSync<
    Omit<ApiTransaction, 'tags' | 'customFields' | 'recurring'> & {
      tags: string | null;
      customFields: string | null;
      recurring: number | null;
    }
  >(
    `SELECT id, userId, type, amount, category, description, date, status, merchant, tags, recurring, receiptUri, customFields FROM transactions ORDER BY date DESC`,
  );
  return rows.map((row) => ({
    ...row,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : undefined,
    customFields: row.customFields
      ? (JSON.parse(row.customFields) as Record<string, string>)
      : undefined,
    recurring: Boolean(row.recurring),
  }));
}

export function saveTransactions(transactions: ApiTransaction[]) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM transactions');

    for (const transaction of transactions) {
      db.runSync(
        `INSERT INTO transactions (id, userId, type, amount, category, description, date, status, merchant, tags, recurring, receiptUri, customFields)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transaction.id,
          transaction.userId,
          transaction.type,
          transaction.amount,
          transaction.category,
          transaction.description,
          transaction.date,
          transaction.status ?? 'pending',
          transaction.merchant ?? null,
          transaction.tags ? JSON.stringify(transaction.tags) : null,
          transaction.recurring ? 1 : 0,
          transaction.receiptUri ?? null,
          transaction.customFields
            ? JSON.stringify(transaction.customFields)
            : null,
        ],
      );
    }
  });
}

export function clearCachedTransactions() {
  db.runSync('DELETE FROM transactions');
}

export function loadCachedBudgets(): ApiBudget[] {
  return db.getAllSync<ApiBudget>(
    `SELECT id, userId, category, budgetLimit AS "limit", spent, period FROM budgets ORDER BY category`,
  );
}

export function saveBudgets(budgets: ApiBudget[]) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM budgets');

    for (const budget of budgets) {
      db.runSync(
        `INSERT INTO budgets (id, userId, category, budgetLimit, spent, period)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          budget.id,
          budget.userId,
          budget.category,
          budget.limit,
          budget.spent,
          budget.period,
        ],
      );
    }
  });
}

export function loadCachedCategories(): ApiCategory[] {
  return db.getAllSync<ApiCategory>(
    `SELECT id, name, type, color FROM categories ORDER BY type, name`,
  );
}

export function saveCategories(categories: ApiCategory[]) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM categories');
    for (const category of categories) {
      db.runSync(
        `INSERT INTO categories (id, name, type, color) VALUES (?, ?, ?, ?)`,
        [category.id, category.name, category.type, category.color],
      );
    }
  });
}

export function loadAccountCache(
  userId: string,
): {
  transactions: ApiTransaction[];
  budgets: ApiBudget[];
  categories: ApiCategory[];
} | null {
  db.execSync(
    'CREATE TABLE IF NOT EXISTS account_cache (userId TEXT PRIMARY KEY, payload TEXT NOT NULL)',
  );
  const row = db.getFirstSync<{ payload: string }>(
    'SELECT payload FROM account_cache WHERE userId = ?',
    [userId],
  );
  return row ? JSON.parse(row.payload) : null;
}
export function saveAccountCache(
  userId: string,
  payload: {
    transactions: ApiTransaction[];
    budgets: ApiBudget[];
    categories: ApiCategory[];
  },
) {
  db.runSync(
    'INSERT OR REPLACE INTO account_cache (userId, payload) VALUES (?, ?)',
    [userId, JSON.stringify(payload)],
  );
}
export function clearPrivateCache() {
  db.execSync(
    'DELETE FROM transactions; DELETE FROM budgets; DELETE FROM categories; CREATE TABLE IF NOT EXISTS account_cache (userId TEXT PRIMARY KEY, payload TEXT NOT NULL); DELETE FROM account_cache;',
  );
}

export function pendingTransactions(userId: string): ApiTransaction[] {
  db.execSync(
    'CREATE TABLE IF NOT EXISTS transaction_outbox (id TEXT PRIMARY KEY, userId TEXT NOT NULL, payload TEXT NOT NULL)',
  );
  return db
    .getAllSync<{ payload: string }>(
      'SELECT payload FROM transaction_outbox WHERE userId = ?',
      [userId],
    )
    .map((row) => JSON.parse(row.payload));
}
export function enqueueTransaction(
  userId: string,
  transaction: ApiTransaction,
) {
  pendingTransactions(userId);
  db.runSync(
    'INSERT INTO transaction_outbox (id, userId, payload) VALUES (?, ?, ?)',
    [transaction.id, userId, JSON.stringify(transaction)],
  );
}
export function acknowledgeTransaction(id: string, userId: string) {
  db.runSync('DELETE FROM transaction_outbox WHERE id = ? AND userId = ?', [
    id,
    userId,
  ]);
}
