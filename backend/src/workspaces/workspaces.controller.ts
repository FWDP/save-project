import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CreateWorkspaceDto,
  EditWorkspaceTransactionDto,
  RevisionDto,
  TransactionQueryDto,
  WorkspaceTransactionDto,
} from "./workspaces.dto";
import { WorkspacesService } from "./workspaces.service";
@Controller("workspaces")
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}
  @Get() list() {
    return this.service.list();
  }
  @Post() create(@Body() dto: CreateWorkspaceDto) {
    return this.service.create(dto);
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.service.get(id);
  }
  @Get(":id/transactions") transactions(
    @Param("id") id: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.service.listTransactions(id, query);
  }
  @Post(":id/transactions") createTransaction(
    @Param("id") id: string,
    @Body() dto: WorkspaceTransactionDto,
  ) {
    return this.service.createTransaction(id, dto);
  }
  @Get(":id/transactions/:transactionId") transaction(
    @Param("id") id: string,
    @Param("transactionId") transactionId: string,
  ) {
    return this.service.getTransaction(id, transactionId);
  }
  @Patch(":id/transactions/:transactionId") edit(
    @Param("id") id: string,
    @Param("transactionId") transactionId: string,
    @Body() dto: EditWorkspaceTransactionDto,
  ) {
    return this.service.editTransaction(id, transactionId, dto);
  }
  @Delete(":id/transactions/:transactionId") delete(
    @Param("id") id: string,
    @Param("transactionId") transactionId: string,
    @Body() dto: RevisionDto,
  ) {
    return this.service.deleteTransaction(id, transactionId, dto.revision);
  }
}
