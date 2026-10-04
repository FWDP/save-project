import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LedgerModule } from './ledger/ledger.module';

import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { ReceiptsModule } from './receipts/receipts.module';
import { SavingsModule } from './savings/savings.module';
import { StellarModule } from './stellar/stellar.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    DatabaseModule,
    LedgerModule,
    UsersModule,
    TransactionsModule,
    CategoriesModule,
    BudgetsModule,
    SavingsModule,
    StellarModule,
    ReceiptsModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
