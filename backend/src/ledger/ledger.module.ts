import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module';
import { ExchangeRatesService } from './exchange-rates.service';
import { LedgerController } from './ledger.controller';
@Module({ imports: [TransactionsModule], controllers: [LedgerController], providers: [ExchangeRatesService] })
export class LedgerModule {}
