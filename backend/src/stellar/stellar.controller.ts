import { Body, Controller, Get, Header, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';

import { LinkStellarAccountDto, PreparePaymentDto, PrepareVaultInvocationDto, Sep7CallbackDto, StellarEventsQueryDto, SubmitStellarTransactionDto } from './stellar.dto';
import { StellarService } from './stellar.service';

@Controller('stellar')
export class StellarController {
  constructor(private readonly stellar: StellarService) {}

  @Get('network')
  network() { return this.stellar.networkHealth(); }

  @Post('accounts/link')
  linkAccount(@Body() dto: LinkStellarAccountDto) { return this.stellar.linkAccount(dto); }

  @Get('accounts/:address')
  portfolio(@Param('address') address: string) { return this.stellar.getPortfolio(address); }

  @Get('accounts/:address/payments')
  payments(@Param('address') address: string, @Query('limit', new ParseIntPipe({ optional: true })) limit?: number) { return this.stellar.getPayments(address, limit); }

  @Post('payments/prepare')
  preparePayment(@Body() dto: PreparePaymentDto) { return this.stellar.preparePayment(dto); }

  @Post('vault/prepare')
  prepareVault(@Body() dto: PrepareVaultInvocationDto) { return this.stellar.prepareVaultInvocation(dto); }

  @Get('vault/goals/:owner')
  vaultGoals(@Param('owner') owner: string) { return this.stellar.listVaultGoals(owner); }

  @Get('vault/events')
  vaultEvents(@Query() query: StellarEventsQueryDto) { return this.stellar.getVaultEvents(query); }

  @Post('transactions/submit')
  submit(@Body() dto: SubmitStellarTransactionDto) { return this.stellar.submitTransaction(dto); }

  @Get('signing-requests/:idempotencyKey')
  signingRequest(@Param('idempotencyKey') idempotencyKey: string) { return this.stellar.getSigningRequest(idempotencyKey); }

  @Post('signing-requests/:idempotencyKey/callback')
  @HttpCode(200)
  signingCallback(@Param('idempotencyKey') idempotencyKey: string, @Body() dto: Sep7CallbackDto) {
    return this.stellar.receiveSep7Callback(idempotencyKey, dto.xdr);
  }

  @Get('transactions/:hash')
  transaction(@Param('hash') hash: string, @Query('kind') kind: 'classic' | 'soroban' = 'soroban') { return this.stellar.getTransaction(hash, kind); }
}

@Controller('.well-known')
export class StellarTomlController {
  constructor(private readonly stellar: StellarService) {}

  @Get('stellar.toml')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  stellarToml() { return this.stellar.stellarToml(); }
}
