import { ExchangeRatesService } from "./exchange-rates.service";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Workspace,
  WorkspaceSchema,
  WorkspaceTransaction,
  WorkspaceTransactionSchema,
} from "./workspace.schema";
import { WorkspacesController } from "./workspaces.controller";
import { WorkspacesService } from "./workspaces.service";
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: WorkspaceTransaction.name, schema: WorkspaceTransactionSchema },
    ]),
  ],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, ExchangeRatesService],
})
export class WorkspacesModule {}
