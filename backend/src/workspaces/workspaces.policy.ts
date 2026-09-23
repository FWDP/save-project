import { ForbiddenException, BadRequestException } from "@nestjs/common";
import type { WorkspaceRole } from "./workspace.schema";
export function assertWrite(role: WorkspaceRole) {
  if (role === "viewer")
    throw new ForbiddenException("This workspace is read-only for your role.");
}
export function visibleTransactions(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
) {
  return role === "member"
    ? { workspaceId, createdBy: userId }
    : { workspaceId };
}
export function validateRecord(dto: {
  date: string;
  description: string;
  category: string;
}) {
  const date = new Date(`${dto.date}T12:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dto.date ||
    !dto.description.trim() ||
    !dto.category.trim()
  ) {
    throw new BadRequestException(
      "Use a real calendar date, description and category.",
    );
  }
}
export function escapeSearch(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
