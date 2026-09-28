import { currentOwner } from '../auth/auth-context';
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { Category, CategoryDocument } from './category.schema';
import { BUILTIN_CATEGORIES } from './category-catalog';

export type CategoryResponse = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
  parentCategory?: string;
  subcategory?: string;
  builtIn?: boolean;
};

function toCategoryResponse(doc: any): CategoryResponse {
  return {
    id: doc._id?.toString() ?? doc.id,
    name: doc.name,
    type: doc.type,
    color: doc.color,
  };
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly model: Model<CategoryDocument>,
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
  async findAll(): Promise<CategoryResponse[]> {
    const userId = currentOwner();
    const custom = (
      await this.db(() =>
        this.model.find({ userId }).sort({ createdAt: -1 }).lean(),
      )
    ).map(toCategoryResponse);
    const names = new Set(custom.map((category) => `${category.type}:${category.name.toLowerCase()}`));
    return [...BUILTIN_CATEGORIES.filter((category) => !names.has(`${category.type}:${category.name.toLowerCase()}`)), ...custom];
  }
  async findOne(id: string): Promise<CategoryResponse> {
    const userId = currentOwner();
    const builtIn = BUILTIN_CATEGORIES.find((category) => category.id === id);
    if (builtIn) return builtIn;
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException();
    const row = await this.db(() =>
      this.model.findOne({ _id: id, userId }).lean(),
    );
    if (!row) throw new NotFoundException();
    return toCategoryResponse(row);
  }
  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    const userId = currentOwner();
    const row = await this.db(() => new this.model({ ...dto, userId }).save());
    return toCategoryResponse(row.toObject());
  }
  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
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
    return toCategoryResponse(row);
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
}
