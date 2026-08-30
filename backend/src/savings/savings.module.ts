import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { SavingsGoal, SavingsGoalSchema } from './savings-goal.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: SavingsGoal.name, schema: SavingsGoalSchema }])],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService],
})
export class SavingsModule {}
