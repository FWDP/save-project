"use client";
import { useRef, useActionState } from "react";
import Link from "next/link";
import { saveTransaction, removeTransaction } from "@/app/workspaces/actions";
import type { Transaction } from "@/lib/types";
import { currencyDigits, minorToDecimal } from "@/lib/currency";
import { Icon } from "./icon";
import { ReceiptScanner } from "./receipt-scanner";

export function TransactionForm({
  workspaceId,
  mutationId,
  currency,
  date,
  item,
  readOnly = false,
}: {
  workspaceId: string;
  mutationId: string;
  currency: string;
  date: string;
  item?: Transaction;
  readOnly?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(saveTransaction, {});

  return (
    <form ref={formRef} action={action} className="record-form">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="clientMutationId" value={mutationId} />
      {item && (
        <>
          <input type="hidden" name="transactionId" value={item.id} />
          <input type="hidden" name="revision" value={item.revision} />
        </>
      )}

      {/* ── AI Receipt Scanner ─────────────────────────────────────── */}
      {!readOnly && !item && (
        <>
          <div className="form-section-heading">
            <span className="form-step ai-step">✦</span>
            <div>
              <h2>AI Receipt Scan <span className="optional">optional</span></h2>
              <p>Photograph or upload a receipt — Gemini Flash will pre-fill the form below.</p>
            </div>
          </div>
          <ReceiptScanner formRef={formRef} currency={currency} />
          <div className="scanner-divider" aria-hidden="true" />
        </>
      )}

      {/* ── Essentials ─────────────────────────────────────────────── */}
      <fieldset disabled={readOnly || pending}>
        <legend className="sr-only">Transaction details</legend>
        <div className="form-section-heading">
          <span className="form-step">01</span>
          <div>
            <h2>The essentials</h2>
            <p>A few details to keep your records clear.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Transaction type
            <select name="type" defaultValue={item?.type ?? "expense"}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label>
            Amount ({currency})
            <input
              name="amount"
              type="text"
              inputMode="decimal"
              required
              pattern={
                currencyDigits(currency)
                  ? `[0-9]+(\\.[0-9]{1,${currencyDigits(currency)}})?`
                  : "[0-9]+"
              }
              defaultValue={
                item ? minorToDecimal(item.amountMinor, currency) : ""
              }
              placeholder={
                currencyDigits(currency)
                  ? `0.${"0".repeat(currencyDigits(currency))}`
                  : "0"
              }
            />
          </label>
          <label className="span-two">
            Description
            <input
              name="description"
              required
              maxLength={160}
              defaultValue={item?.description}
              placeholder="What was this transaction for?"
            />
          </label>
          <label>
            Date
            <input
              name="date"
              type="date"
              required
              defaultValue={item?.date || date}
            />
          </label>
          <label>
            Category
            <input
              name="category"
              required
              maxLength={80}
              list="categories"
              defaultValue={item?.category}
              placeholder="Choose or enter a category"
            />
            <datalist id="categories">
              {[
                "Food & dining",
                "Groceries",
                "Transport",
                "Shopping",
                "Utilities",
                "Health",
                "Salary",
                "Freelance",
                "Business expenses",
                "Sales",
                "Other",
              ].map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="span-two">
            Merchant or source <span className="optional">Optional</span>
            <input
              name="merchant"
              maxLength={120}
              defaultValue={item?.merchant}
              placeholder="e.g. Coffee shop, employer or client"
            />
          </label>
        </div>
      </fieldset>

      {state.error && (
        <p className="notice danger" role="alert">
          {state.error}
        </p>
      )}
      <div className="form-actions">
        <Link
          className="button secondary"
          href={`/w/${workspaceId}/transactions`}
        >
          {readOnly ? "Back to transactions" : "Cancel"}
        </Link>
        {!readOnly && (
          <button className="button primary" disabled={pending}>
            {pending ? "Saving…" : item ? "Save changes" : "Save transaction"}
            <Icon name="check" size={17} />
          </button>
        )}
      </div>
    </form>
  );
}

export function DeleteTransaction({ item }: { item: Transaction }) {
  const [state, action, pending] = useActionState(removeTransaction, {});
  return (
    <details className="delete-record">
      <summary>Delete this transaction</summary>
      <form action={action}>
        <input type="hidden" name="workspaceId" value={item.workspaceId} />
        <input type="hidden" name="transactionId" value={item.id} />
        <input type="hidden" name="revision" value={item.revision} />
        <p>This permanently removes the transaction from this workspace.</p>
        <label className="confirm-check">
          <input name="confirmed" type="checkbox" value="yes" required /> I want
          to delete this record.
        </label>
        {state.error && (
          <p role="alert" className="notice danger">
            {state.error}
          </p>
        )}
        <button className="button danger-button" disabled={pending}>
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
      </form>
    </details>
  );
}
