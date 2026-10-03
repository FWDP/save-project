import {
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { currentOwner } from '../auth/auth-context';
import { DatabaseService, newRecordId } from '../database/database.service';

import { CreateSavingsGoalDto, UpdateSavingsGoalDto } from './savings.dto';
import { SavingsGoalStatus } from './savings.types';

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
    id: doc.id,
    name: doc.name,
    targetAmount: Number(doc.target_amount),
    fundedAmount: Number(doc.funded_amount ?? 0),
    targetDate: doc.target_date,
    asset: doc.asset ?? 'XLM',
    status: doc.status ?? 'draft',
    network: doc.network ?? 'testnet',
    ownerAddress: doc.owner_address,
    contractId: doc.contract_id,
    vaultGoalId: doc.vault_goal_id,
    transactionHash: doc.transaction_hash,
  };
}

@Injectable()
export class SavingsService {
  constructor(private readonly database: DatabaseService) {}
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
      await this.db(() => this.database.query(
        'select * from public.savings_goals where user_id = $1 order by created_at desc',
        [userId],
      ).then(result => result.rows))
    ).map(toSavingsGoalResponse);
  }
  async findOne(id: string): Promise<SavingsGoalResponse> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      'select * from public.savings_goals where id = $1 and user_id = $2',
      [id, userId],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return toSavingsGoalResponse(row);
  }
  async create(dto: CreateSavingsGoalDto): Promise<SavingsGoalResponse> {
    const userId = currentOwner();
    const row = await this.db(() => this.database.query(
      `insert into public.savings_goals (id, user_id, name, target_amount, funded_amount, target_date, asset, status, network, owner_address, contract_id, vault_goal_id, transaction_hash)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning *`,
      [newRecordId(), userId, dto.name, dto.targetAmount, dto.fundedAmount ?? 0, dto.targetDate ?? null, dto.asset ?? 'XLM', dto.status ?? 'draft', dto.network ?? 'testnet', dto.ownerAddress ?? null, dto.contractId ?? null, dto.vaultGoalId ?? null, dto.transactionHash ?? null],
    ).then(result => result.rows[0]));
    return toSavingsGoalResponse(row);
  }
  async update(
    id: string,
    dto: UpdateSavingsGoalDto,
  ): Promise<SavingsGoalResponse> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      `update public.savings_goals set name = coalesce($3, name), target_amount = coalesce($4, target_amount), funded_amount = coalesce($5, funded_amount), target_date = coalesce($6, target_date), asset = coalesce($7, asset), status = coalesce($8, status), network = coalesce($9, network), owner_address = coalesce($10, owner_address), contract_id = coalesce($11, contract_id), vault_goal_id = coalesce($12, vault_goal_id), transaction_hash = coalesce($13, transaction_hash), updated_at = now()
       where id = $1 and user_id = $2 returning *`,
      [id, userId, dto.name ?? null, dto.targetAmount ?? null, dto.fundedAmount ?? null, dto.targetDate ?? null, dto.asset ?? null, dto.status ?? null, dto.network ?? null, dto.ownerAddress ?? null, dto.contractId ?? null, dto.vaultGoalId ?? null, dto.transactionHash ?? null],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return toSavingsGoalResponse(row);
  }
  async remove(id: string): Promise<{ deleted: boolean }> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      'delete from public.savings_goals where id = $1 and user_id = $2 returning id',
      [id, userId],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return { deleted: true };
  }

  async updateVerified(
    id: string,
    dto: UpdateSavingsGoalDto,
    ownerAddress: string,
  ): Promise<SavingsGoalResponse> {
    const row = await this.db(() => this.database.query(
      `update public.savings_goals set name = coalesce($3, name), target_amount = coalesce($4, target_amount), funded_amount = coalesce($5, funded_amount), target_date = coalesce($6, target_date), asset = coalesce($7, asset), status = coalesce($8, status), network = coalesce($9, network), contract_id = coalesce($10, contract_id), vault_goal_id = coalesce($11, vault_goal_id), transaction_hash = coalesce($12, transaction_hash), updated_at = now()
       where id = $1 and owner_address = $2 returning *`,
      [id, ownerAddress, dto.name ?? null, dto.targetAmount ?? null, dto.fundedAmount ?? null, dto.targetDate ?? null, dto.asset ?? null, dto.status ?? null, dto.network ?? null, dto.contractId ?? null, dto.vaultGoalId ?? null, dto.transactionHash ?? null],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return toSavingsGoalResponse(row);
  }
}
