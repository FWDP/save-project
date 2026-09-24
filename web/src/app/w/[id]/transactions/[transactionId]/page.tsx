import Link from "next/link";
import { api } from "@/lib/api";
import {
  TransactionForm,
  DeleteTransaction,
} from "@/components/transaction-form";
import type { Workspace, Transaction } from "@/lib/types";
export default async function TransactionDetail({
  params,
}: {
  params: Promise<{ id: string; transactionId: string }>;
}) {
  const { id, transactionId } = await params;
  const [workspace, item] = await Promise.all([
    api<Workspace>(`/workspaces/${encodeURIComponent(id)}`),
    api<Transaction>(
      `/workspaces/${encodeURIComponent(id)}/transactions/${encodeURIComponent(transactionId)}`,
    ),
  ]);
  return (
    <>
      <Link href={`/w/${id}/transactions`} className="back-link">
        ← Transactions
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">IN THE DETAILS</span>
          <h1>{item.description}</h1>
          <p>Review this record in {workspace.name}.</p>
        </div>
        <span className="kind-badge">{item.type}</span>
      </div>
      <div className="panel form-panel">
        <TransactionForm
          currency={workspace.currency}
          workspaceId={id}
          mutationId={item.clientMutationId}
          date={item.date}
          item={item}
          readOnly={workspace.role === "viewer"}
        />
      </div>
      {workspace.role !== "viewer" && <DeleteTransaction item={item} />}
    </>
  );
}
