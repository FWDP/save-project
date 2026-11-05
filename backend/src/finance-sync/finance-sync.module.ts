import { Module } from '@nestjs/common';
import { FinanceSyncController } from './finance-sync.controller';
import { FinanceSyncService } from './finance-sync.service';
@Module({ controllers: [FinanceSyncController], providers: [FinanceSyncService] })
export class FinanceSyncModule {}
