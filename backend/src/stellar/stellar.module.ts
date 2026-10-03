import { Module } from '@nestjs/common';

import { SavingsModule } from '../savings/savings.module';
import { StellarController, StellarTomlController } from './stellar.controller';
import { StellarService } from './stellar.service';

@Module({
  imports: [SavingsModule],
  controllers: [StellarController, StellarTomlController],
  providers: [StellarService],
  exports: [StellarService],
})
export class StellarModule {}
