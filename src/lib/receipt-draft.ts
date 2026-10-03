import type { ApiParsedReceipt } from './api';
import { validDate } from './finance';

// Both camera and file scans populate the same editable transaction fields.
export function receiptDraftFields(
  receipt: ApiParsedReceipt,
  categories: { name: string }[],
  currency = 'PHP',
) {
  if (receipt.currency && receipt.currency.toUpperCase() !== currency.toUpperCase()) {
    throw new Error(`Receipt currency is ${receipt.currency}; this form uses ${currency}. Enter a converted amount manually.`);
  }
  if (!Number.isFinite(receipt.amount) || receipt.amount <= 0 || !validDate(receipt.date)) {
    throw new Error('The receipt amount or date could not be read. Try a clearer image.');
  }
  const category = receipt.category?.trim();
  const merchant = receipt.merchant?.trim() || '';
  return {
    amount: String(receipt.amount),
    date: receipt.date,
    merchant: merchant.slice(0, 120),
    description: (receipt.notes?.trim() || (merchant ? `Purchase at ${merchant}` : '')).slice(0, 160),
    ...(category ? { category: (categories.find(item => item.name.toLowerCase() === category.toLowerCase())?.name ?? category).slice(0, 80) } : {}),
  };
}
