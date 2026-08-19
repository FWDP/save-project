import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    UsersModule,
    TransactionsModule,
    CategoriesModule,
    BudgetsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
