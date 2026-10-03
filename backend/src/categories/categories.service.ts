import {
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { currentOwner } from '../auth/auth-context';
import { DatabaseService, newRecordId } from '../database/database.service';

import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { BUILTIN_CATEGORIES } from './category-catalog';

export type CategoryResponse = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
  parentCategory?: string;
  subcategory?: string;
  builtIn?: boolean;
  replacesBuiltInId?: string;
};

function toCategoryResponse(doc: any): CategoryResponse {
  return {
    id: doc.id,
    name: doc.name,
    type: doc.type,
    color: doc.color,
    builtIn: doc.builtIn,
    replacesBuiltInId: doc.replaces_built_in_id,
  };
}

@Injectable()
export class CategoriesService {
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
  async findAll(): Promise<CategoryResponse[]> {
    const userId = currentOwner();
    const custom = (
      await this.db(() => this.database.query(
        'select id, name, type, color, replaces_built_in_id from public.categories where user_id = $1 order by created_at desc',
        [userId],
      ).then(result => result.rows))
    ).map(toCategoryResponse);
    const replaced = new Set(custom.map((category: any) => category.replacesBuiltInId).filter(Boolean));
    const names = new Set(custom.map((category) => `${category.type}:${category.name.toLowerCase()}`));
    return [...BUILTIN_CATEGORIES.filter((category) => !replaced.has(category.id) && !names.has(`${category.type}:${category.name.toLowerCase()}`)), ...custom];
  }
  async findOne(id: string): Promise<CategoryResponse> {
    const userId = currentOwner();
    const builtIn = BUILTIN_CATEGORIES.find((category) => category.id === id);
    if (builtIn) return builtIn;
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.database.query(
        'select id, name, type, color, replaces_built_in_id from public.categories where id = $1 and user_id = $2',
        [id, userId],
      ).then(result => result.rows[0]),
    );
    if (!row) throw new NotFoundException();
    return toCategoryResponse(row);
  }
  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    const userId = currentOwner();
    const row = await this.db(() => this.database.query(
      'insert into public.categories (id, user_id, name, type, color, replaces_built_in_id) values ($1, $2, $3, $4, $5, $6) returning id, name, type, color, replaces_built_in_id',
      [newRecordId(), userId, dto.name, dto.type, dto.color ?? '#6366F1', dto.replacesBuiltInId ?? null],
    ).then(result => result.rows[0]));
    return toCategoryResponse(row);
  }
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.database.query(
        'update public.categories set name = coalesce($3, name), type = coalesce($4, type), color = coalesce($5, color), replaces_built_in_id = coalesce($6, replaces_built_in_id), updated_at = now() where id = $1 and user_id = $2 returning id, name, type, color, replaces_built_in_id',
        [id, userId, dto.name ?? null, dto.type ?? null, dto.color ?? null, null],
      ).then(result => result.rows[0]),
    );
    if (!row) throw new NotFoundException();
    return toCategoryResponse(row);
  }
  async remove(id: string): Promise<{ deleted: boolean }> {
    const userId = currentOwner();
    if (!/^[a-f0-9]{24}$/i.test(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.database.query(
        'delete from public.categories where id = $1 and user_id = $2 returning id',
        [id, userId],
      ).then(result => result.rows[0]),
    );
    if (!row) throw new NotFoundException();
    return { deleted: true };
  }
}
