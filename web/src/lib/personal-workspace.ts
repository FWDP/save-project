import { notFound } from "next/navigation";
import { api } from "./api";
import type { Workspace } from "./types";

export async function requirePersonalWorkspace(id: string) {
  const workspace = await api<Workspace>(`/workspaces/${encodeURIComponent(id)}`);
  if (workspace.kind !== "personal" || workspace.currency !== "PHP")
    notFound();
  return workspace;
}
