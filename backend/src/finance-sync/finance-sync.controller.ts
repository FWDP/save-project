import { BadRequestException, Body, Controller, Get, Header, Put } from '@nestjs/common';
import { FinanceSyncService } from './finance-sync.service';
import { syncRequestSchema } from './finance-sync.schema';

@Controller('finance-sync')
export class FinanceSyncController {
  constructor(private readonly sync: FinanceSyncService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  read() { return this.sync.read(); }
  @Put()
  @Header('Cache-Control', 'no-store')
  write(@Body() body: unknown) {
    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid sync data. Explicit consent, a revision and valid financial records are required. Photos and account identifiers cannot be synced.');
    return this.sync.write(parsed.data);
  }
}
