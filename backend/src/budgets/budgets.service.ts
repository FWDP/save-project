import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateBudgetDto, UpdateBudgetDto } from './budgets.dto';

export type Budget = {
  id: string;
  userId: string;
  category: string;
  limit: number;
  spent: number;
  period: 'monthly' | 'weekly';
};

@Injectable()
export class BudgetsService {
  private readonly budgets: Budget[] = [
    {
      id: 'bud_1',
      userId: 'usr_2',
      category: 'Food & Dining',
      limit: 700,
      spent: 420,
      period: 'monthly',
    },
    {
      id: 'bud_2',
      userId: 'usr_2',
      category: 'Transportation',
      limit: 300,
      spent: 140,
      period: 'monthly',
    },
  ];

  findAll(): Budget[] {
    return this.budgets;
  }

  findOne(id: string): Budget {
    const budget = this.budgets.find((item) => item.id === id);

    if (!budget) {
      throw new NotFoundException(`Budget with id ${id} not found`);
    }

    return budget;
  }

  create(dto: CreateBudgetDto): Budget {
    const budget: Budget = {
      id: `bud_${Date.now()}`,
      userId: dto.userId,
      category: dto.category,
      limit: dto.limit,
      spent: dto.spent ?? 0,
      period: dto.period ?? 'monthly',
    };

    this.budgets.push(budget);
    return budget;
  }

  update(id: string, dto: UpdateBudgetDto): Budget {
    const index = this.budgets.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`Budget with id ${id} not found`);
    }

    this.budgets[index] = {
      ...this.budgets[index],
      ...dto,
    };

    return this.budgets[index];
  }

  remove(id: string): { deleted: boolean } {
    const index = this.budgets.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`Budget with id ${id} not found`);
    }

    this.budgets.splice(index, 1);
    return { deleted: true };
  }
}
