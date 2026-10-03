import {
    Injectable,
    NotFoundException,
    OnModuleInit,
    ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService, newRecordId } from '../database/database.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

export type UserResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const DEMO_USERS = [
  { name: 'Super Admin', email: 'admin@save.app', role: 'admin' },
  { name: 'Marcus Lee', email: 'marcus@save.app', role: 'user' },
] as const;

function toUserResponse(row: any): UserResponse {
  return {
    id: row.legacy_id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : String(row.created_at),
  };
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly database: DatabaseService) {}

  private async db<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch {
      throw new ServiceUnavailableException('Database unavailable. Please retry.');
    }
  }

  async onModuleInit() {
    if (process.env.SAVE_DEMO_MODE !== 'true') return;
    await this.db(async () => {
      const count = await this.database.query('select count(*)::int as count from public.user_profiles');
      if (count.rows[0].count > 0) return;
      for (const user of DEMO_USERS) {
        await this.database.query(
          'insert into public.user_profiles (legacy_id, name, email, role) values ($1, $2, $3, $4) on conflict do nothing',
          [newRecordId(), user.name, user.email, user.role],
        );
      }
    });
  }

  async findAll(): Promise<UserResponse[]> {
    const rows = await this.db(async () => (await this.database.query(
      'select legacy_id, name, email, role, created_at from public.user_profiles order by created_at desc',
    )).rows);
    return rows.map(toUserResponse);
  }

  async findOne(id: string): Promise<UserResponse> {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException(`User with id ${id} not found`);
    const row = await this.db(async () => (await this.database.query(
      'select legacy_id, name, email, role, created_at from public.user_profiles where legacy_id = $1',
      [id],
    )).rows[0]);
    if (!row) throw new NotFoundException(`User with id ${id} not found`);
    return toUserResponse(row);
  }

  async create(dto: CreateUserDto): Promise<UserResponse> {
    const row = await this.db(async () => (await this.database.query(
      'insert into public.user_profiles (legacy_id, name, email, role) values ($1, $2, $3, $4) returning legacy_id, name, email, role, created_at',
      [newRecordId(), dto.name.trim(), dto.email.trim().toLowerCase(), dto.role],
    )).rows[0]);
    return toUserResponse(row);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException(`User with id ${id} not found`);
    const row = await this.db(async () => (await this.database.query(
      'update public.user_profiles set name = coalesce($2, name), email = coalesce($3, email), role = coalesce($4, role), updated_at = now() where legacy_id = $1 returning legacy_id, name, email, role, created_at',
      [id, dto.name?.trim() ?? null, dto.email?.trim().toLowerCase() ?? null, dto.role ?? null],
    )).rows[0]);
    if (!row) throw new NotFoundException(`User with id ${id} not found`);
    return toUserResponse(row);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException(`User with id ${id} not found`);
    const row = await this.db(async () => (await this.database.query(
      'delete from public.user_profiles where legacy_id = $1 returning legacy_id',
      [id],
    )).rows[0]);
    if (!row) throw new NotFoundException(`User with id ${id} not found`);
    return { deleted: true };
  }
}