import { SUPPORTED_CURRENCIES } from "./currencies";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
export type WorkspaceRole = "owner" | "admin" | "finance" | "member" | "viewer";
@Schema({ _id: false })
export class WorkspaceMember {
  @Prop({ required: true }) userId: string;
  @Prop({
    required: true,
    enum: ["owner", "admin", "finance", "member", "viewer"],
  })
  role: WorkspaceRole;
  @Prop({ required: true, enum: ["active", "suspended"], default: "active" })
  status: string;
}
const MemberSchema = SchemaFactory.createForClass(WorkspaceMember);
@Schema({ timestamps: true })
export class Workspace {
  @Prop({ required: true, trim: true, maxlength: 80 }) name: string;
  @Prop({ required: true, enum: ["personal", "business"] }) kind:
    "personal" | "business";
  @Prop({ required: true, index: true }) ownerId: string;
  @Prop({ required: true }) clientMutationId: string;
  @Prop({ default: "PHP", enum: SUPPORTED_CURRENCIES, immutable: true })
  currency: string;
  @Prop({ default: "Asia/Manila" }) timezone: string;
  @Prop({ type: [MemberSchema], required: true }) members: WorkspaceMember[];
}
export type WorkspaceDocument = HydratedDocument<Workspace>;
export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
WorkspaceSchema.index(
  { ownerId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { kind: "personal" } },
);
WorkspaceSchema.index({ ownerId: 1, clientMutationId: 1 }, { unique: true });
WorkspaceSchema.index({ "members.userId": 1 });

@Schema({ timestamps: true, collection: "workspace_transactions" })
export class WorkspaceTransaction {
  @Prop({ required: true, index: true }) workspaceId: string;
  @Prop({ required: true }) createdBy: string;
  @Prop({ required: true }) clientMutationId: string;
  @Prop({ required: true, enum: ["income", "expense"] }) type:
    "income" | "expense";
  @Prop({ required: true, min: 1 }) amountMinor: number;
  @Prop({ required: true, maxlength: 160 }) description: string;
  @Prop({ required: true, maxlength: 80 }) category: string;
  @Prop({ maxlength: 120, default: "" }) merchant: string;
  @Prop({ required: true }) date: string;
  @Prop({ required: true, default: 1 }) revision: number;
}
export type WorkspaceTransactionDocument =
  HydratedDocument<WorkspaceTransaction>;
export const WorkspaceTransactionSchema =
  SchemaFactory.createForClass(WorkspaceTransaction);
WorkspaceTransactionSchema.index(
  { workspaceId: 1, clientMutationId: 1 },
  { unique: true },
);
WorkspaceTransactionSchema.index({ workspaceId: 1, date: -1, _id: -1 });
