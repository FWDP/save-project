import { randomUUID } from "node:crypto";
import Link from "next/link";
import { api } from "@/lib/api";
import { today } from "@/lib/format";
import { TransactionForm } from "@/components/transaction-form";
import type { Workspace } from "@/lib/types";
export default async function NewTransaction({
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
      <Link className="back-link" href={`/w/${id}/transactions`}>
        ← Transactions
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A SMALL STEP FORWARD</span>
          <h1>Add a transaction.</h1>
          <p>Record an expense or income in {workspace.name}.</p>
        </div>
      </div>
      {workspace.role === "viewer" ? (
        <p className="notice">
          Your role allows you to view records. Ask a workspace owner for
          editing access.
        </p>
      ) : (
        <div className="panel form-panel">
          <TransactionForm
            workspaceId={id}
            mutationId={randomUUID()}
            date={today(workspace.timezone)}
          />
        </div>
      )}
    </>
  );
}
