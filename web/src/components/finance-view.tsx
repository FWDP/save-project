import Link from "next/link";
import { money } from "@/lib/format";
import type { TransactionPage, Transaction, Workspace } from "@/lib/types";
import { Icon } from "./icon";
export function Summary({ data }: { data: TransactionPage }) {
  const cards = [
    {
      label: "Recorded balance",
      value: data.summary.balanceMinor,
      tone: "balance",
      note: "Income minus expenses",
      icon: "wallet",
    },
    {
      label: "Total income",
      value: data.summary.incomeMinor,
      tone: "income",
      note: "Money coming in",
      icon: "arrow",
    },
    {
      label: "Total expenses",
      value: data.summary.expenseMinor,
      tone: "expense",
      note: "Money going out",
      icon: "transactions",
    },
  ] as const;
  return (
    <div className="metric-grid">
      {cards.map((card) => (
        <article className={`metric ${card.tone}`} key={card.label}>
          <div className="metric-label">
            {card.label}
            <Icon name={card.icon} />
          </div>
          <strong>{money(card.value)}</strong>
          <span>{card.note}</span>
        </article>
      ))}
    </div>
  );
}
export function TransactionTable({
  items,
  workspaceId,
}: {
  items: Transaction[];
  workspaceId: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Transaction</th>
            <th scope="col">Category</th>
            <th scope="col">Date</th>
            <th scope="col" className="numeric">
              Amount
            </th>
            <th scope="col">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="transaction-name">
                  <span className={`transaction-icon ${item.type}`}>
                    <Icon
                      name={item.type === "income" ? "arrow" : "transactions"}
                      size={18}
                    />
                  </span>
                  <div>
                    <Link href={`/w/${workspaceId}/transactions/${item.id}`}>
                      {item.description}
                    </Link>
                    <span>
                      {item.merchant ||
                        (item.type === "income" ? "Income" : "Expense")}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <span className="category-chip">{item.category}</span>
              </td>
              <td className="muted">
                {new Date(`${item.date}T12:00:00Z`).toLocaleDateString(
                  "en-PH",
                  {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                )}
              </td>
              <td className={`numeric amount ${item.type}`}>
                {item.type === "income" ? "+" : "−"}
                {money(item.amountMinor)}
              </td>
              <td>
                <Link
                  className="row-link"
                  href={`/w/${workspaceId}/transactions/${item.id}`}
                  aria-label={`Open ${item.description}`}
                >
                  <Icon name="arrow" size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function EmptyTransactions({
  workspace,
  filtered = false,
}: {
  workspace: Workspace;
  filtered?: boolean;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="transactions" size={28} />
      </span>
      <h3>
        {filtered
          ? "No matches in this view."
          : "Your story starts with one record."}
      </h3>
      <p>
        {filtered
          ? "Try another month or clear your search filters."
          : "Add an expense or income to start building a clearer picture of your finances."}
      </p>
      {workspace.role !== "viewer" && (
        <Link
          className="button secondary"
          href={`/w/${workspace.id}/transactions/new`}
        >
          <Icon name="plus" size={17} /> Add transaction
        </Link>
      )}
    </div>
  );
}
export function CategoryBreakdown({ data }: { data: TransactionPage }) {
  return (
    <div className="category-list">
      {data.categories.length ? (
        data.categories.map((category, index) => (
          <div className="category-item" key={category.name}>
            <div>
              <span>
                <i className={`category-dot dot-${index % 4}`} />
                {category.name}
              </span>
              <strong>{money(category.amountMinor)}</strong>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill dot-${index % 4}`}
                style={{
                  width: `${data.summary.expenseMinor ? (category.amountMinor / data.summary.expenseMinor) * 100 : 0}%`,
                }}
              />
            </div>
            <small>
              {category.count}{" "}
              {category.count === 1 ? "transaction" : "transactions"} ·{" "}
              {Math.round(
                data.summary.expenseMinor
                  ? (category.amountMinor / data.summary.expenseMinor) * 100
                  : 0,
              )}
              % of spending
            </small>
          </div>
        ))
      ) : (
        <p className="quiet-empty">
          Your spending categories will appear here once you add an expense.
        </p>
      )}
    </div>
  );
}
