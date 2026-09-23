import type { ApiTransaction } from './api';
import { validDate, validMoney } from './finance';
export type ImportRow = Omit<ApiTransaction, 'id' | 'userId' | 'syncState'>;
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted field.');
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function csvRows(text: string): ImportRow[] {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const headers =
    rows.shift()?.map((value) => value.trim().toLowerCase()) ?? [];
  if (!headers.includes('date') || !headers.includes('amount'))
    throw new Error('CSV requires date and amount columns.');
  return rows.map((row, index) => {
    const field = (name: string) => row[headers.indexOf(name)]?.trim() ?? '';
    const type = field('type') || 'expense';
    if (
      !validDate(field('date')) ||
      !validMoney(Number(field('amount'))) ||
      !['expense', 'income'].includes(type)
    )
      throw new Error(
        `Invalid date, amount or type in CSV row ${index + 2}. No rows have been imported.`,
      );
    return {
      date: field('date'),
      amount: Number(field('amount')),
      type: type as 'expense' | 'income',
      category: field('category') || 'Imported',
      description: field('description') || 'Imported transaction',
      merchant: field('merchant'),
      tags: field('tags').split('|').filter(Boolean),
      status: 'approved',
    };
  });
}
export function transactionFingerprint(
  row: Pick<
    ApiTransaction,
    'date' | 'type' | 'amount' | 'category' | 'description' | 'merchant'
  >,
) {
  return JSON.stringify([
    row.date,
    row.type,
    Math.round(row.amount * 100),
    row.category.trim().toLowerCase(),
    row.description.trim().toLowerCase(),
    row.merchant?.trim().toLowerCase() ?? '',
  ]);
}
export function importPreview(rows: ImportRow[], existing: ApiTransaction[]) {
  const seen = new Set(existing.map(transactionFingerprint));
  const unique: ImportRow[] = [];
  let duplicates = 0;
  for (const row of rows) {
    const key = transactionFingerprint(row);
    if (seen.has(key)) duplicates++;
    else {
      unique.push(row);
      seen.add(key);
    }
  }
  return { rows: unique, duplicates };
}
export function transactionsCsv(rows: ApiTransaction[]) {
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return [
    'date,type,amount,category,description,merchant,tags',
    ...rows.map((row) =>
      [
        row.date,
        row.type,
        row.amount,
        row.category,
        row.description,
        row.merchant,
        row.tags?.join('|'),
      ]
        .map(escape)
        .join(','),
    ),
  ].join('\r\n');
}
