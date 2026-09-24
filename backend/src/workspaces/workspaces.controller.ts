import { ExchangeRatesService, convertMinor } from "./exchange-rates.service";
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
  ConvertedReportQueryDto,
  CreateWorkspaceDto,
  EditWorkspaceTransactionDto,
  RevisionDto,
  TransactionQueryDto,
  WorkspaceTransactionDto,
} from "./workspaces.dto";
import { WorkspacesService } from "./workspaces.service";
@Controller("workspaces")
export class WorkspacesController {
  constructor(
    private readonly service: WorkspacesService,
    private readonly rates: ExchangeRatesService,
  ) {}
  @Get() list() {
    return this.service.list();
  }
  @Post() create(@Body() dto: CreateWorkspaceDto) {
    return this.service.create(dto);
  }
  @Get(":id") get(@Param("id") id: string) {
    return this.service.get(id);
  }
  @Get(":id/reports/converted") async convertedReport(
    @Param("id") id: string,
    @Query() query: ConvertedReportQueryDto,
  ) {
    const workspace = await this.service.get(id);
    const data = await this.service.listTransactions(id, query);
    const quote = await this.rates.quote(workspace.currency, query.target);
    const convert = (amount: number) =>
      convertMinor(amount, quote.base, quote.target, quote.rate);
    const incomeMinor = convert(data.summary.incomeMinor);
    const expenseMinor = convert(data.summary.expenseMinor);
    return {
      quote,
      total: data.total,
      summary: {
        incomeMinor,
        expenseMinor,
        balanceMinor: incomeMinor - expenseMinor,
      },
      categories: data.categories.map((category: {name: string; amountMinor: number; count: number}) => ({
        ...category,
        amountMinor: convert(category.amountMinor),
      })),
    };
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
