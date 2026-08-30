import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateSavingsGoalDto } from './savings.dto';
import { SavingsGoal, SavingsGoalDocument } from './savings-goal.schema';
import { DEMO_SAVINGS_GOALS } from '../seed/demo-data';

export type SavingsGoalResponse = {
  id: string;
  name: string;
  targetAmount: number;
  fundedAmount: number;
  targetDate?: string;
  asset: string;
  status: 'draft';
  transactionHash?: string;
  contractId?: string;
};

function toSavingsGoalResponse(doc: any): SavingsGoalResponse {
  return {
    id: doc._id?.toString() ?? doc.id,
    name: doc.name,
    targetAmount: doc.targetAmount,
    fundedAmount: doc.fundedAmount ?? 0,
    targetDate: doc.targetDate,
    asset: doc.asset ?? 'XLM',
    status: doc.status ?? 'draft',
    transactionHash: doc.transactionHash,
    contractId: doc.contractId,
  };
}

@Injectable()
export class SavingsService implements OnModuleInit {
  private inMemoryGoals: SavingsGoalResponse[] = DEMO_SAVINGS_GOALS.map(toSavingsGoalResponse);

  constructor(@InjectModel(SavingsGoal.name) private readonly savingsGoalModel: Model<SavingsGoalDocument>) {}

  async onModuleInit() {
    try {
      const count = await this.savingsGoalModel.countDocuments();
      if (count === 0) {
        await this.savingsGoalModel.insertMany(
          DEMO_SAVINGS_GOALS.map(({ name, targetAmount, fundedAmount, targetDate, asset, status }) => ({
            name,
            targetAmount,
            fundedAmount,
            targetDate,
            asset,
            status,
          })),
        );
      }
    } catch {
      // Ignore if DB offline
    }
  }

  async findAll(): Promise<SavingsGoalResponse[]> {
    try {
      const goals = await this.savingsGoalModel.find().sort({ createdAt: -1 }).lean();
      if (goals.length > 0) return goals.map(toSavingsGoalResponse);
    } catch {
      // Fallback
    }
    return this.inMemoryGoals;
  }

  async create(dto: CreateSavingsGoalDto): Promise<SavingsGoalResponse> {
    try {
      const goal = new this.savingsGoalModel({
        name: dto.name,
        targetAmount: dto.targetAmount,
        fundedAmount: 0,
        targetDate: dto.targetDate,
        asset: dto.asset ?? 'XLM',
        status: 'draft',
      });
      const saved = await goal.save();
      return toSavingsGoalResponse(saved.toObject());
    } catch {
      const fallback: SavingsGoalResponse = {
        id: `goal_${Date.now()}`,
        name: dto.name,
        targetAmount: dto.targetAmount,
        fundedAmount: 0,
        targetDate: dto.targetDate,
        asset: dto.asset ?? 'XLM',
        status: 'draft',
      };
      this.inMemoryGoals.unshift(fallback);
      return fallback;
    }
  }
}
