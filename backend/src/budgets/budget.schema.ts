import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BudgetDocument = Budget & Document;

@Schema({ timestamps: true })
export class Budget {
  @Prop({ required: true, trim: true })
  userId: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, min: 0 })
  limit: number;

  @Prop({ required: true, min: 0, default: 0 })
  spent: number;

  @Prop({ required: true, enum: ['monthly', 'weekly'], default: 'monthly' })
  period: string;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);
BudgetSchema.index({ userId: 1, category: 1 }, { unique: true });
