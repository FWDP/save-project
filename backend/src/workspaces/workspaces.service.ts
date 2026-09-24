import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { currentOwner } from "../auth/auth-context";
import {
  CreateWorkspaceDto,
  EditWorkspaceTransactionDto,
  TransactionQueryDto,
  WorkspaceTransactionDto,
} from "./workspaces.dto";
import {
  Workspace,
  WorkspaceDocument,
  WorkspaceTransaction,
  WorkspaceTransactionDocument,
} from "./workspace.schema";
import {
  assertWrite,
  escapeSearch,
  validateRecord,
  visibleTransactions,
} from "./workspaces.policy";

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectModel(Workspace.name)
    private readonly workspaces: Model<WorkspaceDocument>,
    @InjectModel(WorkspaceTransaction.name)
    private readonly transactions: Model<WorkspaceTransactionDocument>,
  ) {}
  private async db<T>(fn: () => PromiseLike<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if ((error as { code?: number }).code === 11000)
        throw new ConflictException(
          "This record already exists. Refresh and retry.",
        );
      throw new ServiceUnavailableException(
        "Workspace storage is unavailable. Please retry.",
      );
    }
  }
  private present(
    workspace: WorkspaceDocument | (Workspace & { _id: Types.ObjectId }),
    userId: string,
  ) {
    const membership = workspace.members.find(
      (member) => member.userId === userId && member.status === "active",
    );
    if (!membership) throw new NotFoundException("Workspace not found.");
    return {
      id: String(workspace._id),
      name: workspace.name,
      kind: workspace.kind,
      currency: workspace.currency,
      timezone: workspace.timezone,
      role: membership.role,
      memberCount: workspace.members.filter((m) => m.status === "active")
        .length,
    };
  }
  async list() {
    const userId = currentOwner();
    const rows = await this.db(() =>
      this.workspaces
        .find({ members: { $elemMatch: { userId, status: "active" } } })
        .sort({ kind: -1, createdAt: 1 })
        .lean(),
    );
    return rows.map((row) => this.present(row, userId));
  }
  async get(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new NotFoundException("Workspace not found.");
    const userId = currentOwner();
    const row = await this.db(() =>
      this.workspaces
        .findOne({
          _id: id,
          members: { $elemMatch: { userId, status: "active" } },
        })
        .lean(),
    );
    if (!row) throw new NotFoundException("Workspace not found.");
    return this.present(row, userId);
  }
  async create(dto: CreateWorkspaceDto) {
    const userId = currentOwner();
    if (!dto.name.trim())
      throw new BadRequestException("Enter a workspace name.");
    const filter =
      dto.kind === "personal"
        ? { ownerId: userId, kind: "personal" }
        : { ownerId: userId, clientMutationId: dto.clientMutationId };
    const row = await this.db(() =>
      this.workspaces
        .findOneAndUpdate(
          filter,
          {
            $setOnInsert: {
              ...dto,
              name: dto.name.trim(),
              ownerId: userId,
              currency: dto.currency ?? "PHP",
              timezone: "Asia/Manila",
              members: [{ userId, role: "owner", status: "active" }],
            },
          },
          { upsert: true, new: true, runValidators: true },
        )
        .lean(),
    );
    if (!row) throw new ServiceUnavailableException();
    return this.present(row, userId);
  }
  private transaction(row: WorkspaceTransaction & { _id: Types.ObjectId }) {
    return {
      id: String(row._id),
      workspaceId: row.workspaceId,
      createdBy: row.createdBy,
      clientMutationId: row.clientMutationId,
      type: row.type,
      amountMinor: row.amountMinor,
      description: row.description,
      category: row.category,
      merchant: row.merchant,
      date: row.date,
      revision: row.revision,
    };
  }
  async listTransactions(id: string, query: TransactionQueryDto) {
    const workspace = await this.get(id);
    const filter: Record<string, unknown> = {
      ...visibleTransactions(id, currentOwner(), workspace.role),
    };
    if (query.month)
      filter.date = { $gte: `${query.month}-01`, $lt: `${query.month}-32` };
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;
    if (query.search?.trim())
      filter.$or = ["description", "merchant", "category"].map((field) => ({
        [field]: { $regex: escapeSearch(query.search!.trim()), $options: "i" },
      }));
    const page = query.page ?? 1;
    const pageSize = 25;
    const direction = query.sort === "oldest" ? 1 : -1;
    const [rows, summary] = await Promise.all([
      this.db(() =>
        this.transactions
          .find(filter)
          .sort({ date: direction, _id: direction })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
      ),
      this.db(() =>
        this.transactions.aggregate([
          { $match: filter },
          {
            $facet: {
              totals: [
                {
                  $group: {
                    _id: null,
                    count: { $sum: 1 },
                    incomeMinor: {
                      $sum: {
                        $cond: [
                          { $eq: ["$type", "income"] },
                          "$amountMinor",
                          0,
                        ],
                      },
                    },
                    expenseMinor: {
                      $sum: {
                        $cond: [
                          { $eq: ["$type", "expense"] },
                          "$amountMinor",
                          0,
                        ],
                      },
                    },
                  },
                },
              ],
              categories: [
                { $match: { type: "expense" } },
                {
                  $group: {
                    _id: "$category",
                    amountMinor: { $sum: "$amountMinor" },
                    count: { $sum: 1 },
                  },
                },
                { $sort: { amountMinor: -1 } },
                { $limit: 8 },
              ],
            },
          },
        ]),
      ),
    ]);
    const totals = summary[0]?.totals[0] ?? {
      count: 0,
      incomeMinor: 0,
      expenseMinor: 0,
    };
    return {
      items: rows.map((row) => this.transaction(row)),
      page,
      pageSize,
      total: totals.count,
      summary: {
        incomeMinor: totals.incomeMinor,
        expenseMinor: totals.expenseMinor,
        balanceMinor: totals.incomeMinor - totals.expenseMinor,
      },
      categories: (summary[0]?.categories ?? []).map(
        (row: { _id: string; amountMinor: number; count: number }) => ({
          name: row._id,
          amountMinor: row.amountMinor,
          count: row.count,
        }),
      ),
    };
  }
  async getTransaction(id: string, transactionId: string) {
    const workspace = await this.get(id);
    if (!Types.ObjectId.isValid(transactionId)) throw new NotFoundException();
    const row = await this.db(() =>
      this.transactions
        .findOne({
          _id: transactionId,
          ...visibleTransactions(id, currentOwner(), workspace.role),
        })
        .lean(),
    );
    if (!row) throw new NotFoundException();
    return this.transaction(row);
  }
  async createTransaction(id: string, dto: WorkspaceTransactionDto) {
    const workspace = await this.get(id);
    assertWrite(workspace.role);
    validateRecord(dto);
    const userId = currentOwner();
    const row = await this.db(() =>
      this.transactions
        .findOneAndUpdate(
          { workspaceId: id, clientMutationId: dto.clientMutationId },
          {
            $setOnInsert: {
              ...dto,
              workspaceId: id,
              createdBy: userId,
              description: dto.description.trim(),
              category: dto.category.trim(),
              merchant: dto.merchant?.trim() ?? "",
              revision: 1,
            },
          },
          { upsert: true, new: true, runValidators: true },
        )
        .lean(),
    );
    if (!row || row.createdBy !== userId)
      throw new ConflictException("This request ID belongs to another record.");
    return this.transaction(row);
  }
  async editTransaction(
    id: string,
    transactionId: string,
    dto: EditWorkspaceTransactionDto,
  ) {
    const workspace = await this.get(id);
    assertWrite(workspace.role);
    validateRecord(dto);
    if (!Types.ObjectId.isValid(transactionId)) throw new NotFoundException();
    const { revision, clientMutationId: _key, ...fields } = dto;
    const row = await this.db(() =>
      this.transactions
        .findOneAndUpdate(
          {
            _id: transactionId,
            revision,
            ...visibleTransactions(id, currentOwner(), workspace.role),
          },
          {
            $set: {
              ...fields,
              description: dto.description.trim(),
              category: dto.category.trim(),
              merchant: dto.merchant?.trim() ?? "",
            },
            $inc: { revision: 1 },
          },
          { new: true, runValidators: true },
        )
        .lean(),
    );
    if (!row)
      throw new ConflictException(
        "This record changed or is unavailable. Reload before editing.",
      );
    return this.transaction(row);
  }
  async deleteTransaction(id: string, transactionId: string, revision: number) {
    const workspace = await this.get(id);
    assertWrite(workspace.role);
    if (!Types.ObjectId.isValid(transactionId)) throw new NotFoundException();
    const row = await this.db(() =>
      this.transactions
        .findOneAndDelete({
          _id: transactionId,
          revision,
          ...visibleTransactions(id, currentOwner(), workspace.role),
        })
        .lean(),
    );
    if (!row)
      throw new ConflictException(
        "This record changed or is unavailable. Reload before deleting.",
      );
    return { deleted: true };
  }
}
