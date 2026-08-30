import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateSavingsGoalDto, UpdateSavingsGoalDto } from './savings.dto';
import { SavingsGoal, SavingsGoalDocument, SavingsGoalStatus } from './savings-goal.schema';
import { DEMO_SAVINGS_GOALS } from '../seed/demo-data';

export type SavingsGoalResponse = {
  id: string;
  name: string;
  targetAmount: number;
  fundedAmount: number;
  targetDate?: string;
  asset: string;
  status: SavingsGoalStatus;
  network?: string;
  ownerAddress?: string;
  contractId?: string;
  transactionHash?: string;
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
    network: doc.network ?? 'testnet',
    ownerAddress: doc.ownerAddress,
    contractId: doc.contractId,
    transactionHash: doc.transactionHash,
  };
}

@Injectable()
export class SavingsService implements OnModuleInit {
  private inMemoryGoals: SavingsGoalResponse[] = DEMO_SAVINGS_GOALS.map((g) => ({
    ...g,
    network: 'testnet',
  }));

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
            network: 'testnet',
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

  async findOne(id: string): Promise<SavingsGoalResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const goal = await this.savingsGoalModel.findById(id).lean();
        if (goal) return toSavingsGoalResponse(goal);
      }
    } catch {
      // Fallback
    }

    const fallback = this.inMemoryGoals.find((g) => g.id === id);
    if (fallback) return fallback;

    throw new NotFoundException(`Savings goal with id ${id} not found`);
  }

  async create(dto: CreateSavingsGoalDto): Promise<SavingsGoalResponse> {
    try {
      const goal = new this.savingsGoalModel({
        name: dto.name,
        targetAmount: dto.targetAmount,
        fundedAmount: dto.fundedAmount ?? 0,
        targetDate: dto.targetDate,
        asset: dto.asset ?? 'XLM',
        status: dto.status ?? 'draft',
        network: dto.network ?? 'testnet',
        ownerAddress: dto.ownerAddress,
        contractId: dto.contractId,
        transactionHash: dto.transactionHash,
      });
      const saved = await goal.save();
      return toSavingsGoalResponse(saved.toObject());
    } catch {
      const fallback: SavingsGoalResponse = {
        id: `goal_${Date.now()}`,
        name: dto.name,
        targetAmount: dto.targetAmount,
        fundedAmount: dto.fundedAmount ?? 0,
        targetDate: dto.targetDate,
        asset: dto.asset ?? 'XLM',
        status: dto.status ?? 'draft',
        network: dto.network ?? 'testnet',
        ownerAddress: dto.ownerAddress,
        contractId: dto.contractId,
        transactionHash: dto.transactionHash,
      };
      this.inMemoryGoals.unshift(fallback);
      return fallback;
    }
  }

  async update(id: string, dto: UpdateSavingsGoalDto): Promise<SavingsGoalResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const updated = await this.savingsGoalModel
          .findByIdAndUpdate(
            id,
            { $set: Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) },
            { new: true },
          )
          .lean();
        if (updated) return toSavingsGoalResponse(updated);
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryGoals.findIndex((g) => g.id === id);
    if (index !== -1) {
      this.inMemoryGoals[index] = {
        ...this.inMemoryGoals[index],
        ...Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
      };
      return this.inMemoryGoals[index];
    }

    throw new NotFoundException(`Savings goal with id ${id} not found`);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const deleted = await this.savingsGoalModel.findByIdAndDelete(id).lean();
        if (deleted) return { deleted: true };
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryGoals.findIndex((g) => g.id === id);
    if (index !== -1) {
      this.inMemoryGoals.splice(index, 1);
      return { deleted: true };
    }

    throw new NotFoundException(`Savings goal with id ${id} not found`);
  }
}
