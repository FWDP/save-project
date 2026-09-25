import { IsArray, IsOptional, IsString } from 'class-validator';

export class ScanReceiptDto {
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];
}

export interface ParsedReceiptResult {
  merchant: string;
  amount: number;
  currency?: string;
  date: string;
  category?: string;
  tax?: number;
  notes?: string;
  confidence?: number;
}
