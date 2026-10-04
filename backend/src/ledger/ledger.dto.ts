import { SUPPORTED_CURRENCIES } from './currencies';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
export class TransactionQueryDto {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
  @IsOptional() @IsEnum(["income", "expense"]) type?: "income" | "expense";
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @IsEnum(["newest", "oldest"]) sort?: "newest" | "oldest";
}
export class ConvertedReportQueryDto extends TransactionQueryDto {
  @IsEnum(SUPPORTED_CURRENCIES) target: string;
}
