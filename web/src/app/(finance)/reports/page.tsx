import { CategoryBreakdown, EmptyTransactions, Summary, TransactionTable } from "@/components/finance-view";
import { LiveConversion } from "@/components/live-conversion";
import { api } from "@/lib/api";
import { filters, money, monthLabel } from "@/lib/format";
import type { TransactionPage } from "@/lib/types";
import Link from "next/link";
export default async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {

  const query = filters(await searchParams, "Asia/Manila");
  const data = await api<TransactionPage>(
    `/ledger/transactions?${query}`,
  );
  const pageHref = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return `/reports?${next}`;
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">LOOK A LITTLE CLOSER</span>
          <h1>Understand your spending.</h1>
          <p>Your financial summary for {monthLabel(query.get("month")!)}.</p>
        </div>
        <div className="button-row" style={{ flexWrap: "wrap" }}>
          <a className="button secondary" href={`/reports/export?${query}`}>
            Export CSV
          </a>
          <a className="button secondary" href={`/reports/export/pdf?${query}`}>
            Export PDF
          </a>
        </div>
      </div>
      <form className="period-form report-period">
        <label>
          Reporting month
          <input type="month" name="month" defaultValue={query.get("month")!} />
        </label>
        <button className="button secondary">View report</button>
      </form>
      <Summary data={data} currency={"PHP"} />
      <LiveConversion
        key={query.toString()}
        currency={"PHP"}
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
          <CategoryBreakdown data={data} currency={"PHP"} />
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
              <dd>{money(data.summary.incomeMinor, "PHP")}</dd>
            </div>
            <div>
              <dt>Expenses</dt>
              <dd>{money(data.summary.expenseMinor, "PHP")}</dd>
            </div>
            <div>
              <dt>Net recorded balance</dt>
              <dd className={data.summary.balanceMinor >= 0 ? "mint" : "coral"}>
                {money(data.summary.balanceMinor, "PHP")}
              </dd>
            </div>
          </dl>
          <div className="panel-bottom">
            <Link
              className="subtle-link"
              href={`/transactions?${query}`}
            >
              Explore the transactions behind this report →
            </Link>
          </div>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Transactions in this report</h2>
            <p>{data.total} matching records for {monthLabel(query.get("month")!)}.</p>
          </div>
        </div>
        {data.items.length ? (
          <TransactionTable items={data.items} currency="PHP" />
        ) : (
          <EmptyTransactions filtered />
        )}
        {data.total > data.pageSize ? (
          <div className="pagination">
            <span>
              {`${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} records`}
            </span>
            <div>
              {data.page > 1 ? (
                <Link className="button small secondary" href={pageHref(data.page - 1)}>
                  Previous
                </Link>
              ) : null}
              {data.page * data.pageSize < data.total ? (
                <Link className="button small secondary" href={pageHref(data.page + 1)}>
                  Next
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
