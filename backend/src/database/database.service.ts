import {
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

export class DatabaseQueryError extends Error {
  constructor(readonly code?: string) {
    super('Supabase database query failed.');
  }
}

export function newRecordId() {
  return randomBytes(12).toString('hex');
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly pool: Pool;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('SUPABASE_DB_URL');
    if (!connectionString) {
      throw new Error('SUPABASE_DB_URL is required for the Supabase database.');
    }
    this.pool = new Pool({
      connectionString,
      max: 5,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 30_000,
    });
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    try {
      return await this.pool.query<Row>(text, [...values]);
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (typeof code === 'string') throw new DatabaseQueryError(code);
      throw new ServiceUnavailableException('Supabase database unavailable. Please retry.');
    }
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await operation(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}