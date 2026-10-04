import {
    ConflictException,
    HttpException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { currentOwner } from '../auth/auth-context';
import { DatabaseQueryError, DatabaseService, newRecordId } from '../database/database.service';

import { CreateTransactionDto, UpdateTransactionDto } from './transactions.dto';

export type TransactionResponse = {
  clientMutationId?: string;
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
  revision: number;
};

function toTransactionResponse(doc: any): TransactionResponse {
  return {
    id: doc.id,
    userId: doc.user_id,
    clientMutationId: doc.client_mutation_id,
    type: doc.type,
    amount: Number(doc.amount),
    category: doc.category,
    description: doc.description,
    date: doc.date,
    status: doc.status,
    merchant: doc.merchant,
    tags: doc.tags ?? [],
    recurring: doc.recurring ?? false,
    receiptUri: doc.receipt_uri,
    customFields: doc.custom_fields,
    revision: doc.revision ?? 1,
  };
}

@Injectable()
export class TransactionsService {
  constructor(private readonly database: DatabaseService) {}
  private async db<T>(operation: () => PromiseLike<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof DatabaseQueryError && error.code === '23505')
        throw new ConflictException(
          "This transaction already exists. Refresh and retry.",
        );
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException(
        'Database unavailable. Please retry.',
      );
    }
  }
  async findAll(): Promise<TransactionResponse[]> {
    const userId = currentOwner();
    return (
      await this.db(() => this.database.query(
        'select * from public.transactions where user_id = $1 order by created_at desc',
        [userId],
      ).then(result => result.rows))
    ).map(toTransactionResponse);
  }
  async findOne(id: string): Promise<TransactionResponse> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      'select * from public.transactions where id = $1 and user_id = $2',
      [id, userId],
    ).then(result => result.rows[0]));
    if (!row) throw new NotFoundException();
    return toTransactionResponse(row);
  }
  async create(dto: CreateTransactionDto): Promise<TransactionResponse> {
    const userId = currentOwner();
    if (dto.clientMutationId) {
      const row = await this.db(() => this.database.query(
        `insert into public.transactions (id, user_id, client_mutation_id, type, amount, category, description, date, revision, status, merchant, tags, recurring, receipt_uri, custom_fields)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         on conflict (user_id, client_mutation_id) where client_mutation_id is not null
         do update set client_mutation_id = excluded.client_mutation_id
         returning *`,
        [newRecordId(), userId, dto.clientMutationId, dto.type, dto.amount, dto.category, dto.description, dto.date, 1, dto.status ?? 'pending', dto.merchant ?? null, dto.tags ?? [], dto.recurring ?? false, dto.receiptUri ?? null, dto.customFields ?? null],
      ).then(result => result.rows[0]));
      return toTransactionResponse(row);
    }
    const row = await this.db(() => this.database.query(
      `insert into public.transactions (id, user_id, type, amount, category, description, date, revision, status, merchant, tags, recurring, receipt_uri, custom_fields)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) returning *`,
      [newRecordId(), userId, dto.type, dto.amount, dto.category, dto.description, dto.date, 1, dto.status ?? 'pending', dto.merchant ?? null, dto.tags ?? [], dto.recurring ?? false, dto.receiptUri ?? null, dto.customFields ?? null],
    ).then(result => result.rows[0]));
    return toTransactionResponse(row);
  }
  async update(
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionResponse> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const { revision, userId: _userId, ...fields } = dto;
    const row = await this.db(() => this.database.query(
      `update public.transactions set type = coalesce($4, type), amount = coalesce($5, amount), category = coalesce($6, category), description = coalesce($7, description), date = coalesce($8, date), status = coalesce($9, status), merchant = coalesce($10, merchant), tags = coalesce($11, tags), recurring = coalesce($12, recurring), receipt_uri = coalesce($13, receipt_uri), custom_fields = coalesce($14, custom_fields), revision = revision + 1, updated_at = now()
       where id = $1 and user_id = $2 and ($3::integer is null or revision = $3 or ($3 = 1 and revision is null)) returning *`,
      [id, userId, revision ?? null, fields.type ?? null, fields.amount ?? null, fields.category ?? null, fields.description ?? null, fields.date ?? null, fields.status ?? null, fields.merchant ?? null, fields.tags ?? null, fields.recurring ?? null, fields.receiptUri ?? null, fields.customFields ?? null],
    ).then(result => result.rows[0]));
    if (!row) {
      if (revision !== undefined) {
        const existing = await this.db(() => this.database.query(
          'select id from public.transactions where id = $1 and user_id = $2',
          [id, userId],
        ).then(result => result.rows[0]));
        if (existing)
          throw new ConflictException(
            'This record changed. Reload before editing.',
          );
      }
      throw new NotFoundException();
    }
    return toTransactionResponse(row);
  }
  async remove(
    id: string,
    revision?: number,
  ): Promise<{ deleted: boolean }> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() => this.database.query(
      'delete from public.transactions where id = $1 and user_id = $2 and ($3::integer is null or revision = $3) returning id',
      [id, userId, revision ?? null],
    ).then(result => result.rows[0]));
    if (!row) {
      if (revision !== undefined) {
        const existing = await this.db(() => this.database.query(
          'select id from public.transactions where id = $1 and user_id = $2',
          [id, userId],
        ).then(result => result.rows[0]));
        if (existing)
          throw new ConflictException(
            'This record changed. Reload before deleting.',
          );
      }
      throw new NotFoundException();
    }
    return { deleted: true };
  }

}
