import Link from "next/link";
import { api } from "@/lib/api";
import {
  TransactionForm,
  DeleteTransaction,
} from "@/components/transaction-form";
import type { Transaction, CategoryOption } from "@/lib/types";
export default async function TransactionDetail({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  const item = await api<Transaction>(`/ledger/transactions/${encodeURIComponent(transactionId)}`);
  const categories = await api<CategoryOption[]>("/categories");
  return (
    <>
      <Link href={`/transactions`} className="back-link">
        ← Transactions
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">IN THE DETAILS</span>
          <h1>{item.description}</h1>
          <p>Review this record in your account.</p>
        </div>
        <span className="kind-badge">{item.type}</span>
      </div>
      <div className="panel form-panel">
        <TransactionForm
          categories={categories}
          currency={"PHP"}
          mutationId={item.clientMutationId}
          date={item.date}
          item={item}
        />
      </div>
      <DeleteTransaction item={item} />
    </>
  );
}
