import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { CreateUserDto, UpdateUserDto } from './users.dto';
import { User, UserDocument } from './user.schema';

export type UserResponse = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

const DEMO_USERS: UserResponse[] = [
  {
    id: 'usr_1',
    name: 'Super Admin',
    email: 'admin@save.app',
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

function toUserResponse(doc: any): UserResponse {
  return {
    id: doc._id?.toString() ?? doc.id,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt || new Date().toISOString()),
  };
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async onModuleInit() {
    try {
      const count = await this.userModel.countDocuments();
      if (count === 0) {
        await this.userModel.insertMany(
          DEMO_USERS.map(({ name, email, role }) => ({ name, email, role })),
        );
      }
    } catch {
      // Ignore if DB is offline during module init
    }
  }

  async findAll(): Promise<UserResponse[]> {
    try {
      const users = await this.userModel.find().sort({ createdAt: -1 }).lean();
      if (users.length > 0) return users.map(toUserResponse);
    } catch {
      // Fallback
    }
    return DEMO_USERS;
  }

  async findOne(id: string): Promise<UserResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const user = await this.userModel.findById(id).lean();
        if (user) return toUserResponse(user);
      }
    } catch {
      // Fallback
    }

    const fallback = DEMO_USERS.find((u) => u.id === id);
    if (fallback) return fallback;

    throw new NotFoundException(`User with id ${id} not found`);
  }

  async create(dto: CreateUserDto): Promise<UserResponse> {
    try {
      const user = new this.userModel(dto);
      const saved = await user.save();
      return toUserResponse(saved.toObject());
    } catch {
      const fallback: UserResponse = {
        id: `usr_${Date.now()}`,
        name: dto.name,
        email: dto.email,
        role: dto.role,
        createdAt: new Date().toISOString(),
      };
      DEMO_USERS.push(fallback);
      return fallback;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const updated = await this.userModel
          .findByIdAndUpdate(id, { $set: dto }, { new: true })
          .lean();
        if (updated) return toUserResponse(updated);
      }
    } catch {
      // Fallback
    }

    const index = DEMO_USERS.findIndex((u) => u.id === id);
    if (index !== -1) {
      DEMO_USERS[index] = { ...DEMO_USERS[index], ...dto };
      return DEMO_USERS[index];
    }

    throw new NotFoundException(`User with id ${id} not found`);
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    try {
      if (Types.ObjectId.isValid(id)) {
        const deleted = await this.userModel.findByIdAndDelete(id).lean();
        if (deleted) return { deleted: true };
      }
    } catch {
      // Fallback
    }

    const index = DEMO_USERS.findIndex((u) => u.id === id);
    if (index !== -1) {
      DEMO_USERS.splice(index, 1);
      return { deleted: true };
    }

    throw new NotFoundException(`User with id ${id} not found`);
  }
}
