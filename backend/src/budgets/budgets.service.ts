import {
    ConflictException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { currentOwner } from '../auth/auth-context';
import { DatabaseQueryError, DatabaseService, newRecordId } from '../database/database.service';

import { CreateBudgetDto, UpdateBudgetDto } from './budgets.dto';

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
    id: doc.id,
    userId: doc.user_id,
    category: doc.category,
    limit: Number(doc.budget_limit),
    spent: Number(doc.spent ?? 0),
    period: doc.period ?? 'monthly',
  };
}

@Injectable()
export class BudgetsService {
  constructor(private readonly database: DatabaseService) {}
  private async db<T>(operation: () => PromiseLike<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DatabaseQueryError && error.code === '23505')
        throw new ConflictException(
          'A budget for this category already exists.',
        );
      if (error instanceof DatabaseQueryError)
        throw new ServiceUnavailableException('Database unavailable. Please retry.');
      throw error;
    }
  }
  async findAll(): Promise<BudgetResponse[]> {
    const userId = currentOwner();
    return (
      await this.db(() => this.database.query(
        'select id, user_id, category, budget_limit, spent, period from public.budgets where user_id = $1 order by created_at desc',
        [userId],
      ).then(result => result.rows))
    ).map(toBudgetResponse);
  }
  async findOne(id: string): Promise<BudgetResponse> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      'select id, user_id, category, budget_limit, spent, period from public.budgets where id = $1 and user_id = $2',
      [id, userId],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return toBudgetResponse(row);
  }
  async create(dto: CreateBudgetDto): Promise<BudgetResponse> {
    const userId = currentOwner();
    const row = await this.db(() => this.database.query(
      'insert into public.budgets (id, user_id, category, budget_limit, spent, period) values ($1, $2, $3, $4, $5, $6) returning id, user_id, category, budget_limit, spent, period',
      [newRecordId(), userId, dto.category, dto.limit, dto.spent ?? 0, dto.period ?? 'monthly'],
    ).then(result => result.rows[0]));
    return toBudgetResponse(row);
  }
  async update(id: string, dto: UpdateBudgetDto): Promise<BudgetResponse> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      'update public.budgets set category = coalesce($3, category), budget_limit = coalesce($4, budget_limit), spent = coalesce($5, spent), period = coalesce($6, period), updated_at = now() where id = $1 and user_id = $2 returning id, user_id, category, budget_limit, spent, period',
      [id, userId, dto.category ?? null, dto.limit ?? null, dto.spent ?? null, dto.period ?? null],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return toBudgetResponse(row);
  }
  async remove(id: string): Promise<{ deleted: boolean }> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      'delete from public.budgets where id = $1 and user_id = $2 returning id',
      [id, userId],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return { deleted: true };
  }
}
