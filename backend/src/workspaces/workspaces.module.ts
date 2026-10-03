import { Module } from "@nestjs/common";
import { TransactionsModule } from "../transactions/transactions.module";
import { ExchangeRatesService } from "./exchange-rates.service";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
@Module({
  imports: [TransactionsModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, ExchangeRatesService],
})
export class WorkspacesModule {}
