import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({ timestamps: true })
export class StellarAccount {
  @Prop({ required: true, unique: true, index: true }) address: string;
  @Prop({ required: true, default: 'testnet', index: true }) network: string;
  @Prop({ required: true, default: 'watch-only' }) signingMode: string;
  @Prop() lastSyncedAt?: Date;
}
export type StellarAccountDocument = HydratedDocument<StellarAccount>;
export const StellarAccountSchema = SchemaFactory.createForClass(StellarAccount);

@Schema({ timestamps: true })
export class StellarSigningRequest {
  @Prop({ required: true, unique: true, index: true }) idempotencyKey: string;
  @Prop({ required: true, enum: ['classic', 'soroban'] }) kind: string;
  @Prop({ required: true }) action: string;
  @Prop({ required: true, index: true }) source: string;
  @Prop({ required: true }) unsignedXdr: string;
  @Prop({ required: true, enum: ['prepared', 'submitted', 'pending', 'success', 'failed'], index: true }) status: string;
  @Prop({ index: true }) hash?: string;
  @Prop() fee?: string;
  @Prop() error?: string;
}
export type StellarSigningRequestDocument = HydratedDocument<StellarSigningRequest>;
export const StellarSigningRequestSchema = SchemaFactory.createForClass(StellarSigningRequest);

@Schema({ timestamps: true })
export class StellarContractEvent {
  @Prop({ required: true, unique: true, index: true }) eventId: string;
  @Prop({ required: true, index: true }) contractId: string;
  @Prop({ required: true, index: true }) ledger: number;
  @Prop({ required: true, index: true }) transactionHash: string;
  @Prop() ledgerClosedAt?: string;
  @Prop({ type: [SchemaTypes.Mixed], default: [] }) topics: unknown[];
  @Prop({ type: SchemaTypes.Mixed }) value: unknown;
  @Prop({ required: true, default: true }) successful: boolean;
}
export type StellarContractEventDocument = HydratedDocument<StellarContractEvent>;
export const StellarContractEventSchema = SchemaFactory.createForClass(StellarContractEvent);
