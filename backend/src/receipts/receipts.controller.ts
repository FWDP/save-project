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
    let categories = body?.categories || [];

    // If categories was sent as a comma-separated string in multipart form-data
    if (typeof categories === 'string') {
      categories = (categories as string)
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }

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
