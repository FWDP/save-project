import * as SQLite from 'expo-sqlite';

import type { ApiTransaction } from './api';

const db = SQLite.openDatabaseSync('save.db');

export function initializeDatabase() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      userId TEXT,
      type TEXT,
      amount REAL,
      category TEXT,
      description TEXT,
      date TEXT,
      status TEXT
    );
  `);
}

export function loadCachedTransactions(): ApiTransaction[] {
  return db.getAllSync<ApiTransaction>(
    `SELECT id, userId, type, amount, category, description, date, status FROM transactions ORDER BY date DESC`,
  );
}

export function saveTransactions(transactions: ApiTransaction[]) {
  db.runSync('DELETE FROM transactions');

  for (const transaction of transactions) {
    db.runSync(
      `INSERT INTO transactions (id, userId, type, amount, category, description, date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transaction.id,
        transaction.userId,
        transaction.type,
        transaction.amount,
        transaction.category,
        transaction.description,
        transaction.date,
        transaction.status ?? 'pending',
      ],
    );
  }
}
