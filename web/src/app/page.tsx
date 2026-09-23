import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
export default async function Home() {
  const workspaces = await api<Workspace[]>("/workspaces");
  redirect(
    workspaces.length ? `/w/${workspaces[0].id}/overview` : "/workspaces/new",
  );
}
