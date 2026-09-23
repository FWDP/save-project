import { currentOwner } from '../auth/auth-context';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateBudgetDto, UpdateBudgetDto } from './budgets.dto';
import { Budget, BudgetDocument } from './budget.schema';

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
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private readonly model: Model<BudgetDocument>,
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
  async findAll(): Promise<BudgetResponse[]> {
    const userId = currentOwner();
    return (
      await this.db(() =>
        this.model.find({ userId }).sort({ createdAt: -1 }).lean(),
      )
    ).map(toBudgetResponse);
  }
  async findOne(id: string): Promise<BudgetResponse> {
    const userId = currentOwner();
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.model.findOne({ _id: id, userId }).lean(),
    );
    if (!row) throw new NotFoundException();
    return toBudgetResponse(row);
  }
  async create(dto: CreateBudgetDto): Promise<BudgetResponse> {
    const userId = currentOwner();
    const row = await this.db(() => new this.model({ ...dto, userId }).save());
    return toBudgetResponse(row.toObject());
  }
  async update(id: string, dto: UpdateBudgetDto): Promise<BudgetResponse> {
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
    return toBudgetResponse(row);
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
