import Link from "next/link";
import { api } from "@/lib/api";
import { filters } from "@/lib/format";
import {
  Summary,
  TransactionTable,
  EmptyTransactions,
} from "@/components/finance-view";
import { Icon } from "@/components/icon";
import type { TransactionPage, Workspace } from "@/lib/types";
export default async function Transactions({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const workspace = await api<Workspace>(
    `/workspaces/${encodeURIComponent(id)}`,
  );
  const query = filters(await searchParams, workspace.timezone);
  const data = await api<TransactionPage>(
    `/workspaces/${id}/transactions?${query}`,
  );
  const pageHref = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `?${next}`;
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">EVERY LITTLE DETAIL</span>
          <h1>Your transactions.</h1>
          <p>Keep track of what comes in and what goes out.</p>
        </div>
        {workspace.role !== "viewer" && (
          <Link className="button primary" href={`/w/${id}/transactions/new`}>
            <Icon name="plus" /> Add transaction
          </Link>
        )}
      </div>
      <Summary data={data} />
      <section className="panel">
        <form className="filter-bar">
          <label className="search-field">
            Search
            <input
              type="search"
              name="search"
              defaultValue={query.get("search") || ""}
              placeholder="Description, merchant or category"
              maxLength={100}
            />
          </label>
          <label>
            Month
            <input
              type="month"
              name="month"
              defaultValue={query.get("month")!}
            />
          </label>
          <label>
            Type
            <select name="type" defaultValue={query.get("type") || ""}>
              <option value="">All transactions</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={query.get("sort") || "newest"}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          <button className="button secondary">Apply filters</button>
          <Link className="text-button" href={`/w/${id}/transactions`}>
            Reset
          </Link>
        </form>
        {data.items.length ? (
          <TransactionTable items={data.items} workspaceId={id} />
        ) : (
          <EmptyTransactions
            workspace={workspace}
            filtered={Boolean(query.get("search") || query.get("type"))}
          />
        )}
        <div className="pagination">
          <span>
            {data.total
              ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} records`
              : "0 records"}
          </span>
          <div>
            {data.page > 1 && (
              <Link
                className="button small secondary"
                href={pageHref(data.page - 1)}
              >
                Previous
              </Link>
            )}
            {data.page * data.pageSize < data.total && (
              <Link
                className="button small secondary"
                href={pageHref(data.page + 1)}
              >
                Next
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
