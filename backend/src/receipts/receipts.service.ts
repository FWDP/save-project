import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';

import { ParsedReceiptResult } from './receipts.dto';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);
  private aiClient: GoogleGenAI | null = null;
  private readonly defaultModel = 'gemini-2.0-flash';

  constructor(private readonly config: ConfigService) {}

  private getClient(): GoogleGenAI {
    if (this.aiClient) return this.aiClient;
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Gemini API key is not configured. Set GEMINI_API_KEY in environment.',
      );
    }
    this.aiClient = new GoogleGenAI({ apiKey });
    return this.aiClient;
  }

  async scanReceipt(
    base64Data: string,
    mimeType = 'image/jpeg',
    categories: string[] = [],
  ): Promise<ParsedReceiptResult> {
    if (!base64Data || typeof base64Data !== 'string') {
      throw new BadRequestException('Image data must be a valid base64 string.');
    }

    // Strip data URL scheme prefix if present (e.g., data:image/png;base64,...)
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '').trim();
    if (!cleanBase64) {
      throw new BadRequestException('Image base64 content is empty.');
    }

    const ai = this.getClient();
    const model = this.config.get<string>('GEMINI_MODEL', this.defaultModel);

    const today = new Date().toISOString().slice(0, 10);
    const categoryInstruction =
      categories && categories.length > 0
        ? `Available expense categories: ${categories.join(', ')}. Match the purchase to the closest category from this list.`
        : 'Infer the most appropriate general expense category (e.g., Food & Dining, Transportation, Utilities, Groceries, Shopping, Health).';

    const prompt = [
      'You are an expert financial receipt and invoice parser for the SAVE personal finance platform.',
      `Today's date is ${today}.`,
      'Analyze the provided receipt or invoice image and extract the key transaction details accurately.',
      categoryInstruction,
      'Rules:',
      '1. amount must be a positive number representing the final total amount paid.',
      '2. merchant must be the primary business, store, or vendor name.',
      '3. date must be formatted strictly as YYYY-MM-DD. If year is missing from the receipt, assume current year.',
      '4. currency should be the 3-letter currency code if indicated (e.g., PHP, USD, EUR, JPY).',
      '5. tax should be the tax or VAT amount if explicitly itemized, otherwise omit or 0.',
      '6. notes should contain a short summary of purchased items or service description.',
    ].join('\n');

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType,
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchant: {
                type: Type.STRING,
                description: 'Store, vendor, or merchant name',
              },
              amount: {
                type: Type.NUMBER,
                description: 'Final total amount paid as a positive number',
              },
              currency: {
                type: Type.STRING,
                description: '3-letter currency code, e.g. PHP, USD, EUR',
              },
              date: {
                type: Type.STRING,
                description: 'Transaction date formatted strictly as YYYY-MM-DD',
              },
              category: {
                type: Type.STRING,
                description: 'Best matching expense category',
              },
              tax: {
                type: Type.NUMBER,
                description: 'Tax or VAT amount if identified',
              },
              notes: {
                type: Type.STRING,
                description: 'Brief summary of goods or services purchased',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Confidence score between 0.0 and 1.0',
              },
            },
            required: ['merchant', 'amount', 'date'],
          },
        },
      });

      const responseText = response.text?.trim();
      if (!responseText) {
        throw new BadRequestException('AI reader returned an empty response.');
      }

      const parsed = JSON.parse(responseText) as ParsedReceiptResult;

      // Validate and clean results
      const amount = Number(parsed.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new BadRequestException('AI reader could not detect a valid transaction amount.');
      }

      return {
        merchant: parsed.merchant?.trim() || 'Unknown Merchant',
        amount: Math.round(amount * 100) / 100,
        currency: parsed.currency?.trim()?.toUpperCase() || undefined,
        date: parsed.date || today,
        category: parsed.category?.trim() || undefined,
        tax: typeof parsed.tax === 'number' && Number.isFinite(parsed.tax) ? Math.round(parsed.tax * 100) / 100 : undefined,
        notes: parsed.notes?.trim() || undefined,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
      };
    } catch (err: unknown) {
      this.logger.error('Failed to parse receipt with Gemini', err);
      if (err instanceof BadRequestException || err instanceof ServiceUnavailableException) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Failed to scan receipt with AI: ${message}`);
    }
  }
}
