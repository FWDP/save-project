import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { SavingsModule } from './savings/savings.module';
import { StellarModule } from './stellar/stellar.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/save'),
        // Stellar routes do not depend on MongoDB. Start the API even when the
        // local database is temporarily offline so network and vault health
        // checks remain available.
        lazyConnection: true,
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    TransactionsModule,
    CategoriesModule,
    BudgetsModule,
    SavingsModule,
    StellarModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
