import { SUPPORTED_CURRENCIES } from "./currencies";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
export class CreateWorkspaceDto {
  @IsOptional() @IsEnum(SUPPORTED_CURRENCIES) currency?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name: string;
  @IsEnum(["personal", "business"]) kind: "personal" | "business";
  @IsString() @Matches(/^[a-zA-Z0-9_-]{8,100}$/) clientMutationId: string;
}
export class WorkspaceTransactionDto {
  @IsString() @Matches(/^[a-zA-Z0-9_-]{8,100}$/) clientMutationId: string;
  @IsEnum(["income", "expense"]) type: "income" | "expense";
  @IsInt() @Min(1) @Max(999999999999) amountMinor: number;
  @IsString() @IsNotEmpty() @MaxLength(160) description: string;
  @IsString() @IsNotEmpty() @MaxLength(80) category: string;
  @IsOptional() @IsString() @MaxLength(120) merchant?: string;
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
}
export class EditWorkspaceTransactionDto extends WorkspaceTransactionDto {
  @IsInt() @Min(1) revision: number;
}
export class TransactionQueryDto {
  @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month?: string;
  @IsOptional() @IsEnum(["income", "expense"]) type?: "income" | "expense";
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(80) category?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @IsEnum(["newest", "oldest"]) sort?: "newest" | "oldest";
}
export class RevisionDto {
  @IsInt() @Min(1) revision: number;
}

export class ConvertedReportQueryDto extends TransactionQueryDto {
  @IsEnum(SUPPORTED_CURRENCIES) target: string;
}
