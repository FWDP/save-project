import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateSavingsGoalDto {
  @IsString() name: string;
  @IsNumber() @IsPositive() targetAmount: number;
  @IsOptional() @IsString() targetDate?: string;
  @IsOptional() @IsString() asset?: string;
}
