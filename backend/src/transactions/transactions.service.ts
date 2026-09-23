import { currentOwner } from '../auth/auth-context';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';
import { Transaction, TransactionDocument } from './transaction.schema';

export type TransactionResponse = {
  clientMutationId?: string;
  id: string;
  userId: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  merchant?: string;
  tags?: string[];
  recurring?: boolean;
  receiptUri?: string;
  customFields?: Record<string, string>;
};

function toTransactionResponse(doc: any): TransactionResponse {
  return {
    id: doc._id?.toString() ?? doc.id,
    userId: doc.userId,
    clientMutationId: doc.clientMutationId,
    type: doc.type,
    amount: doc.amount,
    category: doc.category,
    description: doc.description,
    date: doc.date,
    status: doc.status,
    merchant: doc.merchant,
    tags: doc.tags ?? [],
    recurring: doc.recurring ?? false,
    receiptUri: doc.receiptUri,
    customFields: doc.customFields,
  };
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly model: Model<TransactionDocument>,
  ) {}
  private async db<T>(operation: () => PromiseLike<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw new ServiceUnavailableException(
        'Database unavailable. Please retry.',
      );
    }
  }
  async findAll(): Promise<TransactionResponse[]> {
    const userId = currentOwner();
    return (
      await this.db(() =>
        this.model.find({ userId }).sort({ createdAt: -1 }).lean(),
      )
    ).map(toTransactionResponse);
  }
  async findOne(id: string): Promise<TransactionResponse> {
    const userId = currentOwner();
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.model.findOne({ _id: id, userId }).lean(),
    );
    if (!row) throw new NotFoundException();
    return toTransactionResponse(row);
  }
  async create(dto: CreateTransactionDto): Promise<TransactionResponse> {
    const userId = currentOwner();
    if (dto.clientMutationId) {
      const row = await this.db(() =>
        this.model
          .findOneAndUpdate(
            { userId, clientMutationId: dto.clientMutationId },
            { $setOnInsert: { ...dto, userId } },
            { upsert: true, new: true, runValidators: true },
          )
          .lean(),
      );
      return toTransactionResponse(row);
    }
    const row = await this.db(() => new this.model({ ...dto, userId }).save());
    return toTransactionResponse(row.toObject());
  }
  async update(
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    const userId = currentOwner();
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.model
        .findOneAndUpdate(
          { _id: id, userId },
          { $set: { ...dto, userId } },
          { new: true, runValidators: true },
        )
        .lean(),
    );
    if (!row) throw new NotFoundException();
    return toTransactionResponse(row);
  }
  async remove(id: string): Promise<{ deleted: boolean }> {
    const userId = currentOwner();
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.model.findOneAndDelete({ _id: id, userId }).lean(),
    );
    if (!row) throw new NotFoundException();
    return { deleted: true };
  }
}
