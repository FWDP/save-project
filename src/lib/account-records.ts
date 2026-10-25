import { displayDate } from './finance';
import type { ApiTransaction } from './api';
import { currencyDigits } from './money';
export function accountTransactionsCsv(rows: ApiTransaction[], currency = 'PHP') {
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return ['currency,date,type,amount,category,description,merchant or source,merchant or source tin,import source,reference no.,transaction time', ...rows.map(row => [
    currency, displayDate(row.date), row.type,
    row.amount.toFixed(currencyDigits(currency)), row.category, row.description, row.merchant, row.customFields?.TIN, row.customFields?.['Import Source'], row.customFields?.['Reference No.'], row.customFields?.['Transaction Time'],
  ].map(escape).join(','))].join('\r\n');
}
