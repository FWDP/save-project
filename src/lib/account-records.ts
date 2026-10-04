import type { ApiTransaction } from './api';
import { currencyDigits } from './money';
export function accountTransactionsCsv(rows: ApiTransaction[], currency = 'PHP') {
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  return ['currency,date,type,amount,category,description,merchant', ...rows.map(row => [
    currency, row.date, row.type,
    row.amount.toFixed(currencyDigits(currency)), row.category, row.description, row.merchant,
  ].map(escape).join(','))].join('\r\n');
}
