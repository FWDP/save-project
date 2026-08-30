import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { Category, CategoryDocument } from './category.schema';
import { DEMO_CATEGORIES } from '../seed/demo-data';

export type CategoryResponse = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
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
export class CategoriesService implements OnModuleInit {
  private inMemoryCategories: CategoryResponse[] = DEMO_CATEGORIES.map(toCategoryResponse);

  constructor(@InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>) {}

  async onModuleInit() {
    try {
      const count = await this.categoryModel.countDocuments();
      if (count === 0) {
        await this.categoryModel.insertMany(
          DEMO_CATEGORIES.map(({ name, type, color }) => ({ name, type, color })),
        );
      }
    } catch {
      // Ignore if DB offline
    }
  }

  async findAll(): Promise<CategoryResponse[]> {
    try {
      const categories = await this.categoryModel.find().sort({ name: 1 }).lean();
      if (categories.length > 0) return categories.map(toCategoryResponse);
    } catch {
      // Fallback
    }
    return this.inMemoryCategories;
  }

  async findOne(id: string): Promise<CategoryResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const category = await this.categoryModel.findById(id).lean();
        if (category) return toCategoryResponse(category);
      }
    } catch {
      // Fallback
    }

    const fallback = this.inMemoryCategories.find((c) => c.id === id);
    if (fallback) return fallback;

    throw new NotFoundException(`Category with id ${id} not found`);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryResponse> {
    try {
      const category = new this.categoryModel({
        name: dto.name,
        type: dto.type,
        color: dto.color ?? '#6366F1',
      });
      const saved = await category.save();
      return toCategoryResponse(saved.toObject());
    } catch {
      const fallback: CategoryResponse = {
        id: `cat_${Date.now()}`,
        name: dto.name,
        type: dto.type,
        color: dto.color ?? '#6366F1',
      };
      this.inMemoryCategories.push(fallback);
      return fallback;
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const updated = await this.categoryModel
          .findByIdAndUpdate(
            id,
            { $set: Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) },
            { new: true },
          )
          .lean();
        if (updated) return toCategoryResponse(updated);
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryCategories.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.inMemoryCategories[index] = {
        ...this.inMemoryCategories[index],
        ...Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)),
      };
      return this.inMemoryCategories[index];
    }

    throw new NotFoundException(`Category with id ${id} not found`);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const deleted = await this.categoryModel.findByIdAndDelete(id).lean();
        if (deleted) return { deleted: true };
      }
    } catch {
      // Fallback
    }

    const index = this.inMemoryCategories.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.inMemoryCategories.splice(index, 1);
      return { deleted: true };
    }

    throw new NotFoundException(`Category with id ${id} not found`);
  }
}
