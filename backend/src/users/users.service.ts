import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateUserDto, UpdateUserDto } from './users.dto';

export type UserRole = 'admin' | 'user';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

@Injectable()
export class UsersService {
  private readonly users: User[] = [
    {
      id: 'usr_1',
      name: 'Aaliyah Reed',
      email: 'aaliyah@save.app',
      role: 'admin',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_2',
      name: 'Marcus Lee',
      email: 'marcus@save.app',
      role: 'user',
      createdAt: new Date().toISOString(),
    },
  ];

  findAll(): User[] {
    return this.users;
  }

  findOne(id: string): User {
    const user = this.users.find((item) => item.id === id);

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  create(dto: CreateUserDto): User {
    const user: User = {
      id: `usr_${Date.now()}`,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      createdAt: new Date().toISOString(),
    };

    this.users.push(user);
    return user;
  }

  update(id: string, dto: UpdateUserDto): User {
    const index = this.users.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    this.users[index] = {
      ...this.users[index],
      ...dto,
    };

    return this.users[index];
  }

  remove(id: string): { deleted: boolean } {
    const index = this.users.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    this.users.splice(index, 1);
    return { deleted: true };
  }
}
