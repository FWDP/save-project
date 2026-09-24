import Link from "next/link";
import { api } from "@/lib/api";
import type { Workspace } from "@/lib/types";
export default async function WorkspaceSettings({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await api<Workspace>(
    `/workspaces/${encodeURIComponent(id)}`,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR CONTEXT</span>
          <h1>{workspace.name}</h1>
          <p>A home for your {workspace.kind} financial records.</p>
        </div>
        <Link className="button secondary" href="/workspaces/new">
          Create another workspace
        </Link>
      </div>
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Workspace details</h2>
            <p>Keep your financial context clear.</p>
          </div>
        </div>
        <dl className="report-stats">
          <div>
            <dt>Workspace type</dt>
            <dd className="capitalize">{workspace.kind}</dd>
          </div>
          <div>
            <dt>Your role</dt>
            <dd className="capitalize">
              {workspace.role === "finance"
                ? "Finance manager"
                : workspace.role}
            </dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{workspace.currency}</dd>
          </div>
          <div>
            <dt>Timezone</dt>
            <dd>{workspace.timezone}</dd>
          </div>
          <div>
            <dt>Active members</dt>
            <dd>{workspace.memberCount}</dd>
          </div>
        </dl>
        <div className="panel-bottom">
          <p className="muted">
            {workspace.kind === "business"
              ? "This release supports business record tracking. Team invitations and approval workflows are planned next."
              : "Your personal workspace keeps everyday spending separate from your business records."}
          </p>
        </div>
      </section>
    </>
  );
}
