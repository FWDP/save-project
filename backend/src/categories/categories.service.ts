import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

export type Category = {
  id: string;
  name: string;
  type: 'expense' | 'income';
  color: string;
};

@Injectable()
export class CategoriesService {
  private readonly categories: Category[] = [
    { id: 'cat_1', name: 'Food & Dining', type: 'expense', color: '#F59E0B' },
    { id: 'cat_2', name: 'Housing', type: 'expense', color: '#8B5CF6' },
    { id: 'cat_3', name: 'Salary', type: 'income', color: '#10B981' },
    { id: 'cat_4', name: 'Investments', type: 'income', color: '#3B82F6' },
  ];

  findAll(): Category[] {
    return this.categories;
  }

  findOne(id: string): Category {
    const category = this.categories.find((item) => item.id === id);

    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    return category;
  }

  create(dto: CreateCategoryDto): Category {
    const category: Category = {
      id: `cat_${Date.now()}`,
      name: dto.name,
      type: dto.type,
      color: dto.color ?? '#6366F1',
    };

    this.categories.push(category);
    return category;
  }

  update(id: string, dto: UpdateCategoryDto): Category {
    const index = this.categories.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    this.categories[index] = {
      ...this.categories[index],
      ...dto,
    };

    return this.categories[index];
  }

  remove(id: string): { deleted: boolean } {
    const index = this.categories.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    this.categories.splice(index, 1);
    return { deleted: true };
  }
}
