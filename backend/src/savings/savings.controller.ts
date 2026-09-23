import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateSavingsGoalDto, UpdateSavingsGoalDto } from './savings.dto';
import { SavingsService } from './savings.service';

@Controller('savings-goals')
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get()
  findAll() {
    return this.savingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.savingsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSavingsGoalDto) {
    return this.savingsService.create({
      name: dto.name,
      targetAmount: dto.targetAmount,
      targetDate: dto.targetDate,
      asset: dto.asset,
      status: 'draft',
      fundedAmount: 0,
      network: 'testnet',
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSavingsGoalDto) {
    return this.savingsService.update(id, {
      name: dto.name,
      targetAmount: dto.targetAmount,
      targetDate: dto.targetDate,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.savingsService.remove(id);
  }
}
