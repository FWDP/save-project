import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SavingsGoalDocument = SavingsGoal & Document;

@Schema({ timestamps: true })
export class SavingsGoal {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  targetAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  fundedAmount: number;

  @Prop()
  targetDate?: string;

  @Prop({ default: 'XLM' })
  asset: string;

  @Prop({ enum: ['draft'], default: 'draft' })
  status: string;

  @Prop()
  transactionHash?: string;

  @Prop()
  contractId?: string;
}

export const SavingsGoalSchema = SchemaFactory.createForClass(SavingsGoal);
