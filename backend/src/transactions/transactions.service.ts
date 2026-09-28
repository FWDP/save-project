import { currentOwner } from '../auth/auth-context';
import {
  ConflictException,
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
  revision: number;
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
    revision: doc.revision ?? 1,
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
    } catch (error) {
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException(
          "This transaction already exists. Refresh and retry.",
        );
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
    const { revision, userId: _userId, ...fields } = dto;
    const row = await this.db(() =>
      this.model
        .findOneAndUpdate(
          {
            _id: id,
            userId,
            ...(revision === undefined
              ? {}
              : {
                  $or: [
                    { revision },
                    ...(revision === 1 ? [{ revision: { $exists: false } }] : []),
                  ],
                }),
          },
          {
            $set: { ...fields, userId },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true },
        )
        .lean(),
    );
    if (!row) {
      if (revision !== undefined) {
        const existing = await this.db(() =>
          this.model.findOne({ _id: id, userId }).lean(),
        );
        if (existing)
          throw new ConflictException(
            'This record changed. Reload before editing.',
          );
      }
      throw new NotFoundException();
    }
    return toTransactionResponse(row);
  }
  async remove(
    id: string,
    revision?: number,
  ): Promise<{ deleted: boolean }> {
    const userId = currentOwner();
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.model
        .findOneAndDelete({
          _id: id,
          userId,
          ...(revision === undefined
            ? {}
            : {
                $or: [
                  { revision },
                  ...(revision === 1 ? [{ revision: { $exists: false } }] : []),
                ],
              }),
        })
        .lean(),
    );
    if (!row) {
      if (revision !== undefined) {
        const existing = await this.db(() =>
          this.model.findOne({ _id: id, userId }).lean(),
        );
        if (existing)
          throw new ConflictException(
            'This record changed. Reload before deleting.',
          );
      }
      throw new NotFoundException();
    }
    return { deleted: true };
  }

  async importWorkspaceTransaction(transaction: {
    id: string;
    clientMutationId: string;
    createdBy: string;
    type: 'income' | 'expense';
    amountMinor: number;
    description: string;
    category: string;
    merchant: string;
    date: string;
  }): Promise<void> {
    const userId = currentOwner();
    if (transaction.createdBy !== userId)
      throw new NotFoundException('Personal transaction not found.');
    if (
      !Types.ObjectId.isValid(transaction.id) ||
      !Number.isSafeInteger(transaction.amountMinor) ||
      transaction.amountMinor < 1
    )
      throw new ConflictException(
        'A personal Web transaction cannot be safely shared with Mobile.',
      );
    const row = await this.db(() =>
      this.model
        .findOneAndUpdate(
          { userId, clientMutationId: transaction.clientMutationId },
          {
            $setOnInsert: {
              _id: new Types.ObjectId(transaction.id),
              userId,
              clientMutationId: transaction.clientMutationId,
              type: transaction.type,
              amount: transaction.amountMinor / 100,
              description: transaction.description,
              category: transaction.category,
              merchant: transaction.merchant,
              date: transaction.date,
              revision: 1,
            },
          },
          { upsert: true, new: true, runValidators: true },
        )
        .lean(),
    );
    if (!row || String(row._id) !== transaction.id)
      throw new ConflictException(
        'A personal Web transaction conflicts with an existing sync record.',
      );
  }
}
