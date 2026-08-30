import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateSavingsGoalDto } from './savings.dto';
import { SavingsService } from './savings.service';

@Controller('savings-goals')
export class SavingsController {
  constructor(private readonly savings: SavingsService) {}
  @Get() findAll() { return this.savings.findAll(); }
  @Post() create(@Body() dto: CreateSavingsGoalDto) { return this.savings.create(dto); }
}
