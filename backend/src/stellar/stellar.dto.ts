import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const AMOUNT_PATTERN = /^(0|[1-9]\d*)(\.\d{1,7})?$/;

export class LinkStellarAccountDto {
  @IsString()
  @IsNotEmpty()
  address: string;
}

export class PreparePaymentDto {
  @IsString()
  source: string;

  @IsString()
  destination: string;

  @IsString()
  @Matches(AMOUNT_PATTERN)
  amount: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

export class PrepareVaultInvocationDto {
  @IsString()
  source: string;

  @IsEnum(['create_goal', 'contribute', 'complete_goal', 'withdraw', 'cancel_goal'])
  action: 'create_goal' | 'contribute' | 'complete_goal' | 'withdraw' | 'cancel_goal';

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  contributor?: string;

  @IsOptional()
  @IsString()
  assetContractId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  goalId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  savingsGoalId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  targetAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  targetDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  amount?: string;
}

export class SubmitStellarTransactionDto {
  @IsString()
  @IsNotEmpty()
  signedXdr: string;

  @IsEnum(['classic', 'soroban'])
  kind: 'classic' | 'soroban';

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class Sep7CallbackDto {
  @IsString()
  @IsNotEmpty()
  xdr: string;
}

export class StellarEventsQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  startLedger?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
