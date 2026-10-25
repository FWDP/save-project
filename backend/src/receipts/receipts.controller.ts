import { extractGcashStatement } from './gcash-statement';
import { PDFParse } from 'pdf-parse';
import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ReceiptsService } from './receipts.service';
import { ParsedReceiptResult, ScanReceiptDto } from './receipts.dto';

interface UploadedFileBuffer {
  buffer: Buffer;
  mimetype: string;
}

@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post('statement')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async statement(@UploadedFile() file?: UploadedFileBuffer) {
    if (!file?.buffer || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new BadRequestException('Choose a PDF statement up to 10 MB.');
    }
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    try {
      const info = await parser.getInfo();
      if (info.total > 50) throw new BadRequestException('Import up to 50 PDF pages at a time.');
      const result = await parser.getText({ cellSeparator: '\t' });
      if (!result.text.trim()) throw new BadRequestException('This PDF has no readable text. Use a text PDF or CSV.');
      return { text: /GCash Transaction History/.test(result.text) ? await extractGcashStatement(file.buffer) : result.text };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Cannot read this PDF. Remove its password locally or export an unprotected text PDF/CSV.');
    } finally { await parser.destroy(); }
  }

  @Post('scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Scan a receipt or invoice image using Gemini AI' })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiResponse({
    status: 200,
    description: 'Extracted transaction details',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
      },
    }),
  )
  async scanReceipt(
    @UploadedFile() file?: UploadedFileBuffer,
    @Body() body?: ScanReceiptDto,
  ): Promise<ParsedReceiptResult> {
    let base64 = body?.imageBase64;
    let mimeType = body?.mimeType || 'image/jpeg';
    const categories = body?.categories || [];

    if (file && file.buffer) {
      base64 = file.buffer.toString('base64');
      if (file.mimetype) {
        mimeType = file.mimetype;
      }
    }

    if (!base64) {
      throw new BadRequestException(
        'Please provide an image file or an imageBase64 payload.',
      );
    }

    return this.receiptsService.scanReceipt(base64, mimeType, categories);
  }
}
