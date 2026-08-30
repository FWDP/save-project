import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SavingsGoalDocument = SavingsGoal & Document;

export type SavingsGoalStatus = 'draft' | 'pending' | 'active' | 'completed' | 'withdrawn';

@Schema({ timestamps: true })
export class SavingsGoal {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  targetAmount: number;

  @Prop({ required: true, min: 0, default: 0 })
  fundedAmount: number;

  @Prop({ trim: true })
  targetDate?: string;

  @Prop({ required: true, default: 'XLM', trim: true })
  asset: string;

  @Prop({
    required: true,
    enum: ['draft', 'pending', 'active', 'completed', 'withdrawn'],
    default: 'draft',
  })
  status: SavingsGoalStatus;

  @Prop({ trim: true, default: 'testnet' })
  network: string;

  @Prop({ trim: true })
  ownerAddress?: string;

  @Prop({ trim: true })
  contractId?: string;

  @Prop({ trim: true })
  transactionHash?: string;
}

export const SavingsGoalSchema = SchemaFactory.createForClass(SavingsGoal);
SavingsGoalSchema.index({ status: 1, createdAt: -1 });
SavingsGoalSchema.index({ ownerAddress: 1, status: 1 });
