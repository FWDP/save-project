import {
    BadRequestException,
    ConflictException,
    HttpException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { currentOwner } from '../auth/auth-context';
import { DatabaseQueryError, DatabaseService, newRecordId } from '../database/database.service';
import { TransactionResponse, TransactionsService } from '../transactions/transactions.service';
import {
    CreateWorkspaceDto,
    EditWorkspaceTransactionDto,
    TransactionQueryDto,
    WorkspaceTransactionDto,
} from './workspaces.dto';
import { assertWrite, escapeSearch, validateRecord } from './workspaces.policy';

type WorkspaceRow = {
  id: string;
  name: string;
  kind: 'personal' | 'business';
  owner_id: string;
  client_mutation_id: string;
  currency: string;
  timezone: string;
  role: 'owner' | 'admin' | 'finance' | 'member' | 'viewer';
  member_count: number;
};

type WorkspaceLedgerRow = {
  id: string;
  workspace_id: string;
  created_by: string;
  client_mutation_id: string;
  type: 'income' | 'expense';
  amount_minor: number | string;
  description: string;
  category: string;
  merchant: string;
  date: string;
  revision: number;
};

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly personalTransactions: TransactionsService,
  ) {}

  private async db<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof DatabaseQueryError && error.code === '23505')
        throw new ConflictException('This record already exists. Refresh and retry.');
      throw new ServiceUnavailableException('Workspace storage is unavailable. Please retry.');
    }
  }

  private present(row: WorkspaceRow) {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      currency: row.currency,
      timezone: row.timezone,
      role: row.role,
      memberCount: Number(row.member_count),
    };
  }

  async list() {
    const userId = currentOwner();
    const rows = await this.db(async () => (await this.database.query<WorkspaceRow>(
      `select w.id, w.name, w.kind, w.owner_id, w.client_mutation_id, w.currency, w.timezone,
              m.role, count(active.user_id)::int as member_count
       from public.workspaces w
       join public.workspace_members m on m.workspace_id = w.id and m.user_id = $1 and m.status = 'active'
       left join public.workspace_members active on active.workspace_id = w.id and active.status = 'active'
       group by w.id, m.role
       order by w.kind desc, w.created_at asc`,
      [userId],
    )).rows);
    return rows.map(row => this.present(row));
  }

  async get(id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException('Workspace not found.');
    const userId = currentOwner();
    const row = await this.db(async () => (await this.database.query<WorkspaceRow>(
      `select w.id, w.name, w.kind, w.owner_id, w.client_mutation_id, w.currency, w.timezone,
              m.role, count(active.user_id)::int as member_count
       from public.workspaces w
       join public.workspace_members m on m.workspace_id = w.id and m.user_id = $2 and m.status = 'active'
       left join public.workspace_members active on active.workspace_id = w.id and active.status = 'active'
       where w.id = $1
       group by w.id, m.role`,
      [id, userId],
    )).rows[0]);
    if (!row) throw new NotFoundException('Workspace not found.');
    return this.present(row);
  }

  async create(dto: CreateWorkspaceDto) {
    const userId = currentOwner();
    if (!dto.name.trim()) throw new BadRequestException('Enter a workspace name.');
    if (dto.kind === 'personal' && dto.currency && dto.currency !== 'PHP')
      throw new BadRequestException('Personal workspaces must use PHP to share records with SAVE Mobile.');
    const workspace = await this.db(() => this.database.transaction(async client => {
      const id = newRecordId();
      const insertSql = dto.kind === 'personal'
        ? `insert into public.workspaces (id, name, kind, owner_id, client_mutation_id, currency, timezone)
           values ($1, $2, 'personal', $3, $4, 'PHP', 'Asia/Manila')
           on conflict (owner_id) where kind = 'personal' do nothing`
        : `insert into public.workspaces (id, name, kind, owner_id, client_mutation_id, currency, timezone)
           values ($1, $2, 'business', $3, $4, $5, 'Asia/Manila')
           on conflict (owner_id, client_mutation_id) do nothing`;
      await client.query(insertSql, dto.kind === 'personal'
        ? [id, dto.name.trim(), userId, dto.clientMutationId]
        : [id, dto.name.trim(), userId, dto.clientMutationId, dto.currency ?? 'PHP']);
      const found = dto.kind === 'personal'
        ? await client.query('select * from public.workspaces where owner_id = $1 and kind = $2', [userId, 'personal'])
        : await client.query('select * from public.workspaces where owner_id = $1 and client_mutation_id = $2', [userId, dto.clientMutationId]);
      const row = found.rows[0];
      if (!row) throw new ServiceUnavailableException('Workspace could not be saved.');
      await client.query(
        `insert into public.workspace_members (workspace_id, user_id, role, status)
         values ($1, $2, 'owner', 'active')
         on conflict (workspace_id, user_id) do update set role = 'owner', status = 'active', updated_at = now()`,
        [row.id, userId],
      );
      return row;
    }));
    return this.get(workspace.id);
  }

  private transaction(row: WorkspaceLedgerRow) {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      createdBy: row.created_by,
      clientMutationId: row.client_mutation_id,
      type: row.type,
      amountMinor: Number(row.amount_minor),
      description: row.description,
      category: row.category,
      merchant: row.merchant,
      date: row.date,
      revision: row.revision,
    };
  }

  private personalTransaction(row: TransactionResponse, workspaceId: string) {
    const amountMinor = Math.round(row.amount * 100);
    if (!Number.isSafeInteger(amountMinor))
      throw new ConflictException('A personal transaction cannot be represented in PHP minor units.');
    return {
      id: row.id,
      workspaceId,
      createdBy: row.userId,
      clientMutationId: row.clientMutationId ?? `legacy-${row.id}`,
      type: row.type,
      amountMinor,
      description: row.description,
      category: row.category,
      merchant: row.merchant ?? '',
      date: row.date.slice(0, 10),
      revision: row.revision,
    };
  }

  private async migratePersonalTransactions(workspaceId: string) {
    const userId = currentOwner();
    const rows = await this.db(async () => (await this.database.query<WorkspaceLedgerRow>(
      `select id, workspace_id, created_by, client_mutation_id, type, amount_minor, description, category, merchant, date, revision
       from public.workspace_transactions
       where workspace_id = $1 and created_by = $2 and shared_with_mobile = false
       order by id`,
      [workspaceId, userId],
    )).rows);
    for (const row of rows) {
      await this.personalTransactions.importWorkspaceTransaction({
        id: row.id,
        clientMutationId: row.client_mutation_id,
        createdBy: row.created_by,
        type: row.type,
        amountMinor: Number(row.amount_minor),
        description: row.description,
        category: row.category,
        merchant: row.merchant,
        date: row.date,
      });
      await this.db(() => this.database.query(
        'update public.workspace_transactions set shared_with_mobile = true, updated_at = now() where id = $1 and workspace_id = $2 and created_by = $3',
        [row.id, workspaceId, userId],
      ));
    }
  }

  private async listPersonalTransactions(workspaceId: string, query: TransactionQueryDto) {
    await this.migratePersonalTransactions(workspaceId);
    const search = query.search?.trim();
    const pattern = search ? new RegExp(escapeSearch(search), 'i') : null;
    const matching = (await this.personalTransactions.findAll())
      .map(row => this.personalTransaction(row, workspaceId))
      .filter(row => {
        if (query.month && !row.date.startsWith(`${query.month}-`)) return false;
        if (query.type && row.type !== query.type) return false;
        if (query.category && row.category !== query.category) return false;
        if (pattern && ![row.description, row.merchant, row.category].some(value => pattern.test(value))) return false;
        return true;
      })
      .sort((a, b) => {
        const order = a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
        return (query.sort === 'oldest' ? 1 : -1) * order;
      });
    const page = query.page ?? 1;
    const pageSize = 25;
    const incomeMinor = matching.reduce((sum, row) => sum + (row.type === 'income' ? row.amountMinor : 0), 0);
    const expenseMinor = matching.reduce((sum, row) => sum + (row.type === 'expense' ? row.amountMinor : 0), 0);
    const totals = new Map<string, { amountMinor: number; count: number }>();
    for (const row of matching) {
      if (row.type !== 'expense') continue;
      const total = totals.get(row.category) ?? { amountMinor: 0, count: 0 };
      total.amountMinor += row.amountMinor;
      total.count += 1;
      totals.set(row.category, total);
    }
    return {
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      total: matching.length,
      summary: { incomeMinor, expenseMinor, balanceMinor: incomeMinor - expenseMinor },
      categories: [...totals].map(([name, total]) => ({ name, ...total })).sort((a, b) => b.amountMinor - a.amountMinor).slice(0, 8),
    };
  }

  async listTransactions(id: string, query: TransactionQueryDto) {
    const workspace = await this.get(id);
    if (workspace.kind === 'personal' && workspace.currency === 'PHP')
      return this.listPersonalTransactions(id, query);
    const values: unknown[] = [id];
    const where = ['workspace_id = $1'];
    if (workspace.role === 'member') {
      values.push(currentOwner());
      where.push(`created_by = $${values.length}`);
    }
    if (query.month) {
      values.push(`${query.month}-01`);
      where.push(`date >= $${values.length}`);
      const [year, month] = query.month.split('-').map(Number);
      values.push(`${year + Math.floor(month / 12)}-${String(month % 12 + 1).padStart(2, '0')}-01`);
      where.push(`date < $${values.length}`);
    }
    if (query.type) {
      values.push(query.type);
      where.push(`type = $${values.length}`);
    }
    if (query.category) {
      values.push(query.category);
      where.push(`category = $${values.length}`);
    }
    if (query.search?.trim()) {
      values.push(query.search.trim().toLowerCase());
      const index = values.length;
      where.push(`(position($${index} in lower(description)) > 0 or position($${index} in lower(merchant)) > 0 or position($${index} in lower(category)) > 0)`);
    }
    const predicate = where.join(' and ');
    const page = query.page ?? 1;
    const pageSize = 25;
    const direction = query.sort === 'oldest' ? 'asc' : 'desc';
    const rowValues = [...values, pageSize, (page - 1) * pageSize];
    const [rowsResult, totalsResult, categoriesResult] = await Promise.all([
      this.db(() => this.database.query<WorkspaceLedgerRow>(
        `select id, workspace_id, created_by, client_mutation_id, type, amount_minor, description, category, merchant, date, revision
         from public.workspace_transactions where ${predicate} order by date ${direction}, id ${direction} limit $${rowValues.length - 1} offset $${rowValues.length}`,
        rowValues,
      )),
      this.db(() => this.database.query(
        `select count(*)::int as count,
                coalesce(sum(amount_minor) filter (where type = 'income'), 0)::bigint as income_minor,
                coalesce(sum(amount_minor) filter (where type = 'expense'), 0)::bigint as expense_minor
         from public.workspace_transactions where ${predicate}`,
        values,
      )),
      this.db(() => this.database.query(
        `select category as name, sum(amount_minor)::bigint as amount_minor, count(*)::int as count
         from public.workspace_transactions where ${predicate} and type = 'expense'
         group by category order by amount_minor desc limit 8`,
        values,
      )),
    ]);
    const totals = totalsResult.rows[0] ?? { count: 0, income_minor: 0, expense_minor: 0 };
    const incomeMinor = Number(totals.income_minor);
    const expenseMinor = Number(totals.expense_minor);
    return {
      items: rowsResult.rows.map(row => this.transaction(row)),
      page,
      pageSize,
      total: Number(totals.count),
      summary: { incomeMinor, expenseMinor, balanceMinor: incomeMinor - expenseMinor },
      categories: categoriesResult.rows.map(row => ({ name: row.name, amountMinor: Number(row.amount_minor), count: Number(row.count) })),
    };
  }

  async getTransaction(id: string, transactionId: string) {
    const workspace = await this.get(id);
    if (!/^[a-f0-9]{24}$/i.test(transactionId)) throw new NotFoundException();
    if (workspace.kind === 'personal' && workspace.currency === 'PHP') {
      await this.migratePersonalTransactions(id);
      return this.personalTransaction(await this.personalTransactions.findOne(transactionId), id);
    }
    const values: unknown[] = [transactionId, id];
    const visibility = workspace.role === 'member' ? ' and created_by = $3' : '';
    if (workspace.role === 'member') values.push(currentOwner());
    const row = await this.db(async () => (await this.database.query<WorkspaceLedgerRow>(
      `select id, workspace_id, created_by, client_mutation_id, type, amount_minor, description, category, merchant, date, revision
       from public.workspace_transactions where id = $1 and workspace_id = $2${visibility}`,
      values,
    )).rows[0]);
    if (!row) throw new NotFoundException();
    return this.transaction(row);
  }

  async createTransaction(id: string, dto: WorkspaceTransactionDto) {
    const workspace = await this.get(id);
    assertWrite(workspace.role);
    validateRecord(dto);
    const userId = currentOwner();
    if (workspace.kind === 'personal' && workspace.currency === 'PHP') {
      await this.migratePersonalTransactions(id);
      const row = await this.personalTransactions.create({
        clientMutationId: dto.clientMutationId,
        userId,
        type: dto.type,
        amount: dto.amountMinor / 100,
        description: dto.description,
        category: dto.category,
        merchant: dto.merchant,
        date: dto.date,
      });
      return this.personalTransaction(row, id);
    }
    const row = await this.db(async () => {
      const inserted = await this.database.query<WorkspaceLedgerRow>(
        `insert into public.workspace_transactions (id, workspace_id, created_by, client_mutation_id, type, amount_minor, description, category, merchant, date, revision)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
         on conflict (workspace_id, client_mutation_id) do nothing returning *`,
        [newRecordId(), id, userId, dto.clientMutationId, dto.type, dto.amountMinor, dto.description.trim(), dto.category.trim(), dto.merchant?.trim() ?? '', dto.date],
      );
      if (inserted.rows[0]) return inserted.rows[0];
      return (await this.database.query<WorkspaceLedgerRow>(
        'select * from public.workspace_transactions where workspace_id = $1 and client_mutation_id = $2',
        [id, dto.clientMutationId],
      )).rows[0];
    });
    if (!row || row.created_by !== userId)
      throw new ConflictException('This request ID belongs to another record.');
    return this.transaction(row);
  }

  async editTransaction(id: string, transactionId: string, dto: EditWorkspaceTransactionDto) {
    const workspace = await this.get(id);
    assertWrite(workspace.role);
    validateRecord(dto);
    if (!/^[a-f0-9]{24}$/i.test(transactionId)) throw new NotFoundException();
    const { revision, clientMutationId: _key, ...fields } = dto;
    if (workspace.kind === 'personal' && workspace.currency === 'PHP') {
      await this.migratePersonalTransactions(id);
      const row = await this.personalTransactions.update(transactionId, {
        type: fields.type,
        amount: fields.amountMinor / 100,
        description: fields.description,
        category: fields.category,
        merchant: fields.merchant,
        date: fields.date,
        revision,
      });
      return this.personalTransaction(row, id);
    }
    const values: unknown[] = [transactionId, id, revision, fields.type, fields.amountMinor, fields.description.trim(), fields.category.trim(), fields.merchant?.trim() ?? ''];
    let creator = '';
    if (workspace.role === 'member') {
      values.push(currentOwner());
      creator = ` and created_by = $${values.length}`;
    }
    const row = await this.db(async () => (await this.database.query<WorkspaceLedgerRow>(
      `update public.workspace_transactions set type = $4, amount_minor = $5, description = $6, category = $7, merchant = $8, revision = revision + 1, updated_at = now()
       where id = $1 and workspace_id = $2 and revision = $3${creator} returning *`,
      values,
    )).rows[0]);
    if (!row) throw new ConflictException('This record changed or is unavailable. Reload before editing.');
    return this.transaction(row);
  }

  async deleteTransaction(id: string, transactionId: string, revision: number) {
    const workspace = await this.get(id);
    assertWrite(workspace.role);
    if (!/^[a-f0-9]{24}$/i.test(transactionId)) throw new NotFoundException();
    if (workspace.kind === 'personal' && workspace.currency === 'PHP') {
      await this.migratePersonalTransactions(id);
      return this.personalTransactions.remove(transactionId, revision);
    }
    const values: unknown[] = [transactionId, id, revision];
    let creator = '';
    if (workspace.role === 'member') {
      values.push(currentOwner());
      creator = ` and created_by = $${values.length}`;
    }
    const row = await this.db(async () => (await this.database.query(
      `delete from public.workspace_transactions where id = $1 and workspace_id = $2 and revision = $3${creator} returning id`,
      values,
    )).rows[0]);
    if (!row) throw new ConflictException('This record changed or is unavailable. Reload before deleting.');
    return { deleted: true };
  }
}