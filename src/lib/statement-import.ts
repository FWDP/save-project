import { importDate, validMoney } from './finance';
import type { ImportRow } from './transfers';
/** Import text PDFs with an explicit amount/type or debit/credit table. Never guess direction. */
export function statementRows(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const split = (line: string) => (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}/)).map(part => part.trim());
  const header = lines.findIndex(line => {
    const cells = split(line).map(cell => cell.toLowerCase());
    return cells.includes('date') && ((cells.includes('debit') && cells.includes('credit')) || (cells.includes('amount') && cells.includes('type')));
  });
  if (header < 0) throw new Error('PDF table not recognized. Use a text PDF with Date, Description, Debit and Credit columns (or Date, Description, Amount and Type), or import CSV.');
  const columns = split(lines[header]).map(cell => cell.toLowerCase());
  const rows: ImportRow[] = [];
  for (const line of lines.slice(header + 1)) {
    if (!/^\d{2}\/\d{2}\/\d{4}|^\d{4}-\d{2}-\d{2}/.test(line)) continue;
    const cells = split(line);
    if (!line.includes('\t') && cells.length !== columns.length) throw new Error('PDF columns are incomplete or ambiguous. Nothing was imported; use CSV.');
    const get = (name: string) => cells[columns.indexOf(name)] || '';
    const number = (value: string) => Number(value.replace(/PHP|₱|,/gi, '').trim());
    const debit = number(get('debit')); const credit = number(get('credit'));
    const type = columns.includes('type') ? get('type').toLowerCase() : debit > 0 && !credit ? 'expense' : credit > 0 && !debit ? 'income' : '';
    const amount = columns.includes('amount') ? number(get('amount')) : type === 'expense' ? debit : credit;
    if (!['expense', 'income'].includes(type) || !validMoney(amount)) throw new Error('A PDF row has an ambiguous amount or direction. Nothing was imported; use CSV for this statement.');
    rows.push({ date: importDate(get('date')), type: type as 'expense' | 'income', amount, category: get('category') || 'Imported', description: (get('description') || 'Imported transaction').slice(0, 160), merchant: get('merchant or source') || get('merchant'), customFields: { TIN: get('merchant or source tin') || get('tin'), ...(get('gcash reference') ? { 'Import Source': 'GCash', 'Reference No.': get('gcash reference'), 'Transaction Time': get('transaction time'), 'Original Description': get('description') } : {}) }, status: 'approved' });
  }
  if (!rows.length) throw new Error('No readable transaction rows found. Scanned or unsupported PDFs need conversion to CSV.');
  return rows;
}
