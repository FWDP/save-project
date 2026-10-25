import { BadRequestException } from '@nestjs/common';
// Keep the native ESM import intact when Nest compiles this module as CommonJS.
const loadPdf = new Function('return import("pdfjs-dist/legacy/build/pdf.mjs")') as () => Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')>;
export type StatementTextItem = { str: string; transform: number[] };
const invalid = () => new BadRequestException('GCash columns or totals could not be verified. Nothing was imported. Use the original GCash PDF or CSV.');

/** Preserve empty debit/credit cells using their positions, never wording or balance differences. */
export function gcashTable(pages: StatementTextItem[][]): string {
  const rows: string[][] = [];
  let pending: string[] | undefined;
  let debitTotal = 0; let creditTotal = 0;
  let statedDebit: number | undefined; let statedCredit: number | undefined;
  const cents = (value: string) => {
    if (!/^\d[\d,]*\.\d{2}$/.test(value)) throw invalid();
    return Math.round(Number(value.replaceAll(',', '')) * 100);
  };
  const finish = () => {
    if (!pending) return;
    const [date, description, reference, debit, credit, balance] = pending;
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} [AP]M$/.test(date) || !description || !/^\d{8,}$/.test(reference) || !balance) throw invalid();
    const d = debit ? cents(debit) : 0; const c = credit ? cents(credit) : 0;
    cents(balance);
    if ((d > 0) === (c > 0)) throw invalid();
    debitTotal += d; creditTotal += c;
    const merchant = description.replace(/^(?:Payment to|Refund from|Received GCash from|Bills Payment to|Transfer from|Sent GCash to)\s+/i, '').slice(0, 120);
    rows.push([date.slice(0, 10), description, d ? 'expense' : 'income', ((d || c) / 100).toFixed(2), reference, date.slice(11), merchant]);
    pending = undefined;
  };
  for (const page of pages) {
    const items = page.filter(item => item.str.trim());
    const header = (name: string) => items.find(item => item.str.trim() === name);
    const dateHeader = header('Date and Time'); const ref = header('Reference No.');
    const debit = header('Debit'); const credit = header('Credit'); const balance = header('Balance');
    if (!dateHeader || !ref || !debit || !credit || !balance) throw invalid();
    const refStart = ref.transform[4] - (debit.transform[4] - ref.transform[4]) / 2;
    const edges = [(ref.transform[4] + debit.transform[4]) / 2, (debit.transform[4] + credit.transform[4]) / 2, (credit.transform[4] + balance.transform[4]) / 2];
    const lines: { y: number; items: StatementTextItem[] }[] = [];
    for (const item of items.filter(item => item.transform[5] < dateHeader.transform[5] - 2).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
      let line = lines.find(line => Math.abs(line.y - item.transform[5]) < 3);
      if (!line) { line = { y: item.transform[5], items: [] }; lines.push(line); }
      line.items.push(item);
    }
    for (const line of lines) {
      const parts = line.items.sort((a, b) => a.transform[4] - b.transform[4]);
      const label = parts.map(item => item.str.trim()).join(' ');
      if (/^(STARTING|ENDING) BALANCE\b/i.test(label)) { finish(); continue; }
      if (/^Total (Debit|Credit)\b/i.test(label)) {
        finish(); const amount = cents(parts[parts.length - 1].str.trim());
        if (/^Total Debit/i.test(label)) statedDebit = amount; else statedCredit = amount;
        continue;
      }
      const dated = parts.find(item => /^\d{4}-\d{2}-\d{2}\b/.test(item.str.trim()) && item.transform[4] < refStart);
      if (dated) { finish(); pending = ['', '', '', '', '', '']; }
      if (!pending) throw invalid();
      for (const part of parts) {
        const x = part.transform[4]; const value = part.str.trim();
        const column = part === dated ? 0 : x >= edges[2] ? 5 : x >= edges[1] ? 4 : x >= edges[0] ? 3 : x >= refStart ? 2 : 1;
        if (pending[column] && column !== 1) throw invalid();
        pending[column] = pending[column] ? `${pending[column]} ${value}` : value;
      }
    }
  }
  finish();
  if (!rows.length || statedDebit === undefined || statedCredit === undefined || debitTotal !== statedDebit || creditTotal !== statedCredit) throw invalid();
  return ['Date\tDescription\tType\tAmount\tGCash Reference\tTransaction Time\tMerchant or source', ...rows.map(row => row.map(value => value.replace(/[\t\r\n]/g, ' ')).join('\t'))].join('\n');
}

export async function extractGcashStatement(buffer: Buffer) {
  const pdf = await loadPdf();
  const task = pdf.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false });
  try {
    const document = await task.promise;
    if (document.numPages > 50) throw invalid();
    const pages: StatementTextItem[][] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.filter((item): item is StatementTextItem & typeof item => 'str' in item));
      page.cleanup();
    }
    return gcashTable(pages);
  } finally { await task.destroy(); }
}
