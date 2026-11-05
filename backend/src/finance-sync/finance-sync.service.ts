import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { currentOwner } from '../auth/auth-context';
import { DatabaseService } from '../database/database.service';
import type { SyncRequest } from './finance-sync.schema';

@Injectable()
export class FinanceSyncService {
  constructor(private readonly database: DatabaseService) {}
  async read() {
    const owner = currentOwner();
    try {
      const result = await this.database.query('select revision, snapshot from public.finance_sync_snapshots where user_id = $1', [owner]);
      return result.rows[0] ?? { revision: 0, snapshot: { transactions: [], budgets: [], categories: [], goals: [] } };
    } catch { throw new ServiceUnavailableException('Database sync is unavailable. Your device records are unchanged.'); }
  }
  async write(data: SyncRequest) {
    const owner = currentOwner();
    try {
      const result = data.revision === 0
        ? await this.database.query('insert into public.finance_sync_snapshots (user_id, revision, snapshot) values ($1, 1, $2::jsonb) on conflict (user_id) do nothing returning revision, snapshot', [owner, JSON.stringify(data.snapshot)])
        : await this.database.query('update public.finance_sync_snapshots set snapshot = $3::jsonb, revision = revision + 1, updated_at = now() where user_id = $1 and revision = $2 returning revision, snapshot', [owner, data.revision, JSON.stringify(data.snapshot)]);
      if (!result.rows.length) throw new ConflictException('Database records changed. Download the latest revision and retry.');
      return result.rows[0];
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('Database sync could not save. Your local records are still available.');
    }
  }
}
