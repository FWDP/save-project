import { currentOwner } from '../auth/auth-context';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateSavingsGoalDto, UpdateSavingsGoalDto } from './savings.dto';
import {
  SavingsGoal,
  SavingsGoalDocument,
  SavingsGoalStatus,
} from './savings-goal.schema';

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
  vaultGoalId?: string;
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
    vaultGoalId: doc.vaultGoalId,
    transactionHash: doc.transactionHash,
  };
}

@Injectable()
export class SavingsService {
  constructor(
    @InjectModel(SavingsGoal.name)
    private readonly model: Model<SavingsGoalDocument>,
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
  async findAll(): Promise<SavingsGoalResponse[]> {
    const userId = currentOwner();
    return (
      await this.db(() =>
        this.model.find({ userId }).sort({ createdAt: -1 }).lean(),
      )
    ).map(toSavingsGoalResponse);
  }
  async findOne(id: string): Promise<SavingsGoalResponse> {
    const userId = currentOwner();
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.model.findOne({ _id: id, userId }).lean(),
    );
    if (!row) throw new NotFoundException();
    return toSavingsGoalResponse(row);
  }
  async create(dto: CreateSavingsGoalDto): Promise<SavingsGoalResponse> {
    const userId = currentOwner();
    const row = await this.db(() => new this.model({ ...dto, userId }).save());
    return toSavingsGoalResponse(row.toObject());
  }
  async update(
    id: string,
    dto: UpdateSavingsGoalDto,
  ): Promise<SavingsGoalResponse> {
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
    return toSavingsGoalResponse(row);
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

  async updateVerified(
    id: string,
    dto: UpdateSavingsGoalDto,
    ownerAddress: string,
  ): Promise<SavingsGoalResponse> {
    const row = await this.db(() =>
      this.model
        .findOneAndUpdate(
          { _id: id, ownerAddress },
          { $set: dto },
          { new: true, runValidators: true },
        )
        .lean(),
    );
    if (!row) throw new NotFoundException();
    return toSavingsGoalResponse(row);
  }
}
