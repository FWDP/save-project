import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateBudgetDto, UpdateBudgetDto } from './budgets.dto';
import { Budget, BudgetDocument } from './budget.schema';
import { DEMO_BUDGETS } from '../seed/demo-data';

export type BudgetResponse = {
  id: string;
  userId: string;
  category: string;
  limit: number;
  spent: number;
  period: 'monthly' | 'weekly';
};

function toBudgetResponse(doc: any): BudgetResponse {
  return {
    id: doc._id?.toString() ?? doc.id,
    userId: doc.userId,
    category: doc.category,
    limit: doc.limit,
    spent: doc.spent ?? 0,
    period: doc.period ?? 'monthly',
  };
}

@Injectable()
export class BudgetsService implements OnModuleInit {
  private inMemoryBudgets: BudgetResponse[] = DEMO_BUDGETS.map(toBudgetResponse);

  constructor(@InjectModel(Budget.name) private readonly budgetModel: Model<BudgetDocument>) {}

  async onModuleInit() {
    try {
      const count = await this.budgetModel.countDocuments();
      if (count === 0) {
        await this.budgetModel.insertMany(
          DEMO_BUDGETS.map(({ category, limit, spent, period }) => ({
            userId: 'usr_2',
            category,
            limit,
            spent,
            period,
          })),
        );
      }
    } catch {
      // Ignore if DB offline
    }
  }

  async findAll(): Promise<BudgetResponse[]> {
    try {
      const budgets = await this.budgetModel.find().sort({ category: 1 }).lean();
      if (budgets.length > 0) return budgets.map(toBudgetResponse);
    } catch {
      // Fallback
    }
    return this.inMemoryBudgets;
  }

  async findOne(id: string): Promise<BudgetResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const budget = await this.budgetModel.findById(id).lean();
        if (budget) return toBudgetResponse(budget);
      }
    } catch {
      // Fallback
    }

    const fallback = this.inMemoryBudgets.find((b) => b.id === id);
    if (fallback) return fallback;

    throw new NotFoundException(`Budget with id ${id} not found`);
  }

  async create(dto: CreateBudgetDto): Promise<BudgetResponse> {
    try {
      const budget = new this.budgetModel({
        userId: dto.userId,
        category: dto.category,
        limit: dto.limit,
        spent: dto.spent ?? 0,
        period: dto.period ?? 'monthly',
      });
      const saved = await budget.save();
      return toBudgetResponse(saved.toObject());
    } catch {
      const fallback: BudgetResponse = {
        id: `bud_${Date.now()}`,
        userId: dto.userId,
        category: dto.category,
        limit: dto.limit,
        spent: dto.spent ?? 0,
        period: dto.period ?? 'monthly',
      };
      this.inMemoryBudgets.push(fallback);
      return fallback;
    }
  }

  async update(id: string, dto: UpdateBudgetDto): Promise<BudgetResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const updated = await this.budgetModel
          .findByIdAndUpdate(
            id,
            { $set: Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) },
            { new: true },
          )
          .lean();
        if (updated) return toBudgetResponse(updated);
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryBudgets.findIndex((b) => b.id === id);
    if (index !== -1) {
      this.inMemoryBudgets[index] = {
        ...this.inMemoryBudgets[index],
        ...Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
      };
      return this.inMemoryBudgets[index];
    }

    throw new NotFoundException(`Budget with id ${id} not found`);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const deleted = await this.budgetModel.findByIdAndDelete(id).lean();
        if (deleted) return { deleted: true };
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryBudgets.findIndex((b) => b.id === id);
    if (index !== -1) {
      this.inMemoryBudgets.splice(index, 1);
      return { deleted: true };
    }

    throw new NotFoundException(`Budget with id ${id} not found`);
  }
}
