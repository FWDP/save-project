import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';
import { Transaction, TransactionDocument } from './transaction.schema';
import { DEMO_TRANSACTIONS } from '../seed/demo-data';

export type TransactionResponse = {
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
export class TransactionsService implements OnModuleInit {
  private inMemoryTransactions: TransactionResponse[] = DEMO_TRANSACTIONS.map(toTransactionResponse);

  constructor(@InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>) {}

  async onModuleInit() {
    try {
      const count = await this.transactionModel.countDocuments();
      if (count === 0) {
        await this.transactionModel.insertMany(
          DEMO_TRANSACTIONS.map(
            ({ type, amount, category, description, date, status, merchant, tags, recurring, receiptUri, customFields }) => ({
              userId: 'usr_2',
              type,
              amount,
              category,
              description,
              date,
              status,
              merchant,
              tags,
              recurring,
              receiptUri,
              customFields,
            }),
          ),
        );
      }
    } catch {
      // Ignore if DB offline
    }
  }

  async findAll(): Promise<TransactionResponse[]> {
    try {
      const transactions = await this.transactionModel.find().sort({ date: -1, createdAt: -1 }).lean();
      if (transactions.length > 0) return transactions.map(toTransactionResponse);
    } catch {
      // Fallback
    }
    return this.inMemoryTransactions;
  }

  async findOne(id: string): Promise<TransactionResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const transaction = await this.transactionModel.findById(id).lean();
        if (transaction) return toTransactionResponse(transaction);
      }
    } catch {
      // Fallback
    }

    const fallback = this.inMemoryTransactions.find((t) => t.id === id);
    if (fallback) return fallback;

    throw new NotFoundException(`Transaction with id ${id} not found`);
  }

  async create(dto: CreateTransactionDto): Promise<TransactionResponse> {
    try {
      const transaction = new this.transactionModel({
        userId: dto.userId,
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        date: dto.date,
        status: dto.status ?? 'pending',
        merchant: dto.merchant,
        tags: dto.tags ?? [],
        recurring: dto.recurring ?? false,
        receiptUri: dto.receiptUri,
        customFields: dto.customFields,
      });
      const saved = await transaction.save();
      return toTransactionResponse(saved.toObject());
    } catch {
      const fallback: TransactionResponse = {
        id: `txn_${Date.now()}`,
        userId: dto.userId,
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        date: dto.date,
        status: dto.status ?? 'pending',
        merchant: dto.merchant,
        tags: dto.tags ?? [],
        recurring: dto.recurring ?? false,
        receiptUri: dto.receiptUri,
        customFields: dto.customFields,
      };
      this.inMemoryTransactions.unshift(fallback);
      return fallback;
    }
  }

  async update(id: string, dto: UpdateTransactionDto): Promise<TransactionResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const updated = await this.transactionModel
          .findByIdAndUpdate(
            id,
            { $set: Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) },
            { new: true },
          )
          .lean();
        if (updated) return toTransactionResponse(updated);
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryTransactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.inMemoryTransactions[index] = {
        ...this.inMemoryTransactions[index],
        ...Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
      };
      return this.inMemoryTransactions[index];
    }

    throw new NotFoundException(`Transaction with id ${id} not found`);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const deleted = await this.transactionModel.findByIdAndDelete(id).lean();
        if (deleted) return { deleted: true };
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryTransactions.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.inMemoryTransactions.splice(index, 1);
      return { deleted: true };
    }

    throw new NotFoundException(`Transaction with id ${id} not found`);
  }
}
