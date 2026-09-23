import { randomUUID } from "node:crypto";
import Link from "next/link";
import { api } from "@/lib/api";
import { signOut } from "@/app/auth/actions";
import { Brand } from "@/components/icon";
import { WorkspaceForm } from "@/components/workspace-form";
import type { Workspace } from "@/lib/types";
export default async function NewWorkspace() {
  const workspaces = await api<Workspace[]>("/workspaces");
  return (
    <main className="workspace-setup">
      <header>
        <Brand />
        <form action={signOut}>
          <button className="text-button">Sign out</button>
        </form>
      </header>
      <div className="setup-body">
        <span className="eyebrow">A PLACE FOR EVERY PLAN</span>
        <h1>Let’s make some space.</h1>
        <p className="muted">
          Keep personal and business finances organized in their own workspaces.
        </p>
        <WorkspaceForm
          mutationId={randomUUID()}
          hasPersonal={workspaces.some((w) => w.kind === "personal")}
        />
        {workspaces[0] && (
          <Link className="back-link" href={`/w/${workspaces[0].id}/overview`}>
            Back to my workspace
          </Link>
        )}
      </div>
    </main>
  );
}
