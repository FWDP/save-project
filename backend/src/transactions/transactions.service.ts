import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';

export type TransactionType = 'expense' | 'income';

export type Transaction = {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
};

@Injectable()
export class TransactionsService {
  private readonly transactions: Transaction[] = [
    {
      id: 'txn_1',
      userId: 'usr_2',
      type: 'expense',
      amount: 250.0,
      category: 'Food & Dining',
      description: 'Groceries',
      date: '2026-08-19',
      status: 'approved',
    },
    {
      id: 'txn_2',
      userId: 'usr_2',
      type: 'income',
      amount: 3200.0,
      category: 'Salary',
      description: 'Monthly salary',
      date: '2026-08-01',
      status: 'approved',
    },
  ];

  findAll(): Transaction[] {
    return this.transactions;
  }

  findOne(id: string): Transaction {
    const transaction = this.transactions.find((item) => item.id === id);

    if (!transaction) {
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }

    return transaction;
  }

  create(dto: CreateTransactionDto): Transaction {
    const transaction: Transaction = {
      id: `txn_${Date.now()}`,
      userId: dto.userId,
      type: dto.type,
      amount: dto.amount,
      category: dto.category,
      description: dto.description,
      date: dto.date,
      status: dto.status ?? 'pending',
    };

    this.transactions.push(transaction);
    return transaction;
  }

  update(id: string, dto: UpdateTransactionDto): Transaction {
    const index = this.transactions.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }

    this.transactions[index] = {
      ...this.transactions[index],
      ...dto,
    };

    return this.transactions[index];
  }

  remove(id: string): { deleted: boolean } {
    const index = this.transactions.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }

    this.transactions.splice(index, 1);
    return { deleted: true };
  }
}
