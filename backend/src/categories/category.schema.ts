import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ['expense', 'income'] })
  type: string;

  @Prop({ default: '#6366F1' })
  color: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
