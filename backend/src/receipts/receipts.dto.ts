import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// Multipart fields arrive as strings. Normalize before ValidationPipe runs.
function parseCategories(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return [];
  if (/^[\[{"]/.test(text)) {
    try { return JSON.parse(text); } catch { return value; }
  }
  // Compatibility with older clients that sent comma-separated labels.
  return text.split(',').map((category) => category.trim()).filter(Boolean);
}

export class ScanReceiptDto {
  @IsOptional()
  @IsString()
  imageBase64?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Transform(({ value }) => parseCategories(value))
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(80, { each: true })
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
