import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { SavingsGoalStatus } from './savings-goal.schema';

export class CreateSavingsGoalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsPositive()
  targetAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fundedAmount?: number;

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  asset?: string;

  @IsOptional()
  @IsEnum(['draft', 'pending', 'active', 'completed', 'withdrawn', 'cancelled'])
  status?: SavingsGoalStatus;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  ownerAddress?: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  vaultGoalId?: string;

  @IsOptional()
  @IsString()
  transactionHash?: string;
}

export class UpdateSavingsGoalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fundedAmount?: number;

  @IsOptional()
  @IsString()
  targetDate?: string;

  @IsOptional()
  @IsString()
  asset?: string;

  @IsOptional()
  @IsEnum(['draft', 'pending', 'active', 'completed', 'withdrawn', 'cancelled'])
  status?: SavingsGoalStatus;

  @IsOptional()
  @IsString()
  network?: string;

  @IsOptional()
  @IsString()
  ownerAddress?: string;

  @IsOptional()
  @IsString()
  contractId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  vaultGoalId?: string;

  @IsOptional()
  @IsString()
  transactionHash?: string;
}
