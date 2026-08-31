import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { StellarController, StellarTomlController } from './stellar.controller';
import { StellarService } from './stellar.service';
import { StellarAccount, StellarAccountSchema, StellarContractEvent, StellarContractEventSchema, StellarSigningRequest, StellarSigningRequestSchema } from './stellar.schema';
import { SavingsModule } from '../savings/savings.module';

@Module({
  imports: [
    SavingsModule,
    MongooseModule.forFeature([
      { name: StellarAccount.name, schema: StellarAccountSchema },
      { name: StellarSigningRequest.name, schema: StellarSigningRequestSchema },
      { name: StellarContractEvent.name, schema: StellarContractEventSchema },
    ]),
  ],
  controllers: [StellarController, StellarTomlController],
  providers: [StellarService],
  exports: [StellarService],
})
export class StellarModule {}
