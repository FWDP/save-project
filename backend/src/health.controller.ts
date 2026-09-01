import { Controller, Get } from '@nestjs/common';

import { StellarService } from './stellar/stellar.service';

@Controller('health')
export class HealthController {
  constructor(private readonly stellar: StellarService) {}

  @Get()
  async health() {
    return {
      status: 'ok',
      service: 'save-api',
      stellar: await this.stellar.networkHealth(),
    };
  }
}
