import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TransactionDocument = Transaction & Document;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true, trim: true })
  userId: string;

  @Prop({ required: true, enum: ['expense', 'income'] })
  type: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ required: true })
  date: string;

  @Prop({ required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  status: string;

  @Prop({ trim: true })
  merchant?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: false })
  recurring?: boolean;

  @Prop({ trim: true })
  receiptUri?: string;

  @Prop({ type: Object })
  customFields?: Record<string, string>;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1, date: -1 });
TransactionSchema.index({ userId: 1, category: 1, date: -1 });
