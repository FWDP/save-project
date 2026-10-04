import { randomUUID } from "node:crypto";
import Link from "next/link";
import { api } from "@/lib/api";
import { today } from "@/lib/format";
import { TransactionForm } from "@/components/transaction-form";
import type { CategoryOption } from "@/lib/types";
export default async function NewTransaction() {

  const categories = await api<CategoryOption[]>("/categories");
  return (
    <>
      <Link className="back-link" href={`/transactions`}>
        ← Transactions
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A SMALL STEP FORWARD</span>
          <h1>Add a transaction.</h1>
          <p>Record an expense or income in your account.</p>
        </div>
      </div>
      <div className="panel form-panel">
          <TransactionForm
            categories={categories}
            currency={"PHP"}
            mutationId={randomUUID()}
            date={today("Asia/Manila")}
          />
        </div>
    </>
  );
}
