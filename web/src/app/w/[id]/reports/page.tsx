import { LiveConversion } from "@/components/live-conversion";
import Link from "next/link";
import { api } from "@/lib/api";
import { filters, money, monthLabel } from "@/lib/format";
import { Summary, CategoryBreakdown } from "@/components/finance-view";
import type { TransactionPage, Workspace } from "@/lib/types";
export default async function Reports({
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
  query.delete("page");
  const data = await api<TransactionPage>(
    `/workspaces/${id}/transactions?${query}`,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOOK A LITTLE CLOSER</span>
          <h1>Understand your spending.</h1>
          <p>Your financial summary for {monthLabel(query.get("month")!)}.</p>
        </div>
        <a
          className="button secondary"
          href={`/w/${id}/reports/export?${query}`}
        >
          Export summary CSV
        </a>
      </div>
      <form className="period-form report-period">
        <label>
          Reporting month
          <input type="month" name="month" defaultValue={query.get("month")!} />
        </label>
        <button className="button secondary">View report</button>
      </form>
      <Summary data={data} currency={workspace.currency} />
      <LiveConversion
        key={`${id}:${query}`}
        workspaceId={id}
        currency={workspace.currency}
        query={query.toString()}
      />
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Top spending categories</h2>
              <p>Up to eight categories in this view.</p>
            </div>
          </div>
          <CategoryBreakdown data={data} currency={workspace.currency} />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>The numbers behind the month</h2>
              <p>All matching records, across every page.</p>
            </div>
          </div>
          <dl className="report-stats">
            <div>
              <dt>Total records</dt>
              <dd>{data.total}</dd>
            </div>
            <div>
              <dt>Income</dt>
              <dd>{money(data.summary.incomeMinor, workspace.currency)}</dd>
            </div>
            <div>
              <dt>Expenses</dt>
              <dd>{money(data.summary.expenseMinor, workspace.currency)}</dd>
            </div>
            <div>
              <dt>Net recorded balance</dt>
              <dd className={data.summary.balanceMinor >= 0 ? "mint" : "coral"}>
                {money(data.summary.balanceMinor, workspace.currency)}
              </dd>
            </div>
          </dl>
          <div className="panel-bottom">
            <Link
              className="subtle-link"
              href={`/w/${id}/transactions?${query}`}
            >
              Explore the transactions behind this report →
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
