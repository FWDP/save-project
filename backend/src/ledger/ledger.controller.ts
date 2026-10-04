import { Controller, Get, Param, Query } from '@nestjs/common';
import { TransactionsService, type TransactionResponse } from '../transactions/transactions.service';
import { ConvertedReportQueryDto, TransactionQueryDto } from './ledger.dto';
import { ExchangeRatesService, convertMinor } from './exchange-rates.service';

export function ledgerTransaction(row: TransactionResponse) {
  return { ...row, createdBy: row.userId, amountMinor: Math.round(row.amount * 100) };
}
export function accountReport(records: TransactionResponse[], query: TransactionQueryDto) {
  const search = query.search?.toLowerCase();
  const rows = records.filter(row => (!query.month || row.date.startsWith(query.month)) &&
    (!query.type || row.type === query.type) && (!query.category || row.category === query.category) &&
    (!search || [row.description, row.category, row.merchant].some(value => value?.toLowerCase().includes(search))))
    .map(ledgerTransaction).sort((a, b) => (a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) * (query.sort === 'oldest' ? 1 : -1));
  let incomeMinor = 0, expenseMinor = 0;
  const categories = new Map<string, {name: string; amountMinor: number; count: number}>();
  for (const row of rows) {
    if (row.status === 'rejected') continue;
    if (row.type === 'income') incomeMinor += row.amountMinor;
    else {
      expenseMinor += row.amountMinor;
      const category = categories.get(row.category) ?? {name: row.category, amountMinor: 0, count: 0};
      category.amountMinor += row.amountMinor; category.count++; categories.set(row.category, category);
    }
  }
  const page = query.page ?? 1, pageSize = 25;
  return {items: rows.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: rows.length,
    summary: {incomeMinor, expenseMinor, balanceMinor: incomeMinor - expenseMinor},
    categories: [...categories.values()].sort((a,b) => b.amountMinor - a.amountMinor).slice(0,8)};
}
// Identity is supplied exclusively by AuthGuard/TransactionsService, never a route or form field.
@Controller('ledger')
export class LedgerController {
  constructor(private readonly transactions: TransactionsService, private readonly rates: ExchangeRatesService) {}
  @Get('transactions') async list(@Query() query: TransactionQueryDto) {
    return accountReport(await this.transactions.findAll(), query);
  }
  @Get('transactions/:id') async get(@Param('id') id: string) {
    return ledgerTransaction(await this.transactions.findOne(id));
  }
  @Get('reports/converted') async converted(@Query() query: ConvertedReportQueryDto) {
    const data = accountReport(await this.transactions.findAll(), query);
    const quote = await this.rates.quote('PHP', query.target);
    const convert = (amount: number) => convertMinor(amount, quote.base, quote.target, quote.rate);
    const incomeMinor = convert(data.summary.incomeMinor), expenseMinor = convert(data.summary.expenseMinor);
    return {quote, total: data.total, summary: {incomeMinor, expenseMinor, balanceMinor: incomeMinor - expenseMinor},
      categories: data.categories.map(category => ({...category, amountMinor: convert(category.amountMinor)}))};
  }
}
