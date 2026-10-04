import Link from "next/link";
import { api } from "@/lib/api";
import { filters, monthLabel } from "@/lib/format";
import {
  Summary,
  TransactionTable,
  EmptyTransactions,
  CategoryBreakdown,
} from "@/components/finance-view";
import { Icon } from "@/components/icon";
import type { TransactionPage } from "@/lib/types";
export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {

  const query = filters(await searchParams, "Asia/Manila");
  query.delete("page");
  const data = await api<TransactionPage>(
    `/ledger/transactions?${query}`,
  );
  const month = query.get("month")!;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE BIG PICTURE</span>
          <h1>A little more clarity.</h1>
          <p>
            Here’s how your{" "}
            money is doing in{" "}
            {monthLabel(month)}.
          </p>
        </div>
        <Link className="button primary" href={`/transactions/new`}>
            <Icon name="plus" /> Add transaction
          </Link>
      </div>
      <div className="period-bar">
        <span className="section-label">Overview</span>
        <form className="period-form">
          <label className="sr-only" htmlFor="overview-month">
            Month
          </label>
          <input
            id="overview-month"
            type="month"
            name="month"
            defaultValue={month}
          />
          <button className="button small secondary">Apply</button>
        </form>
      </div>

      <Summary data={data} currency={"PHP"} />
      <div className="overview-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Recent transactions</h2>
              <p>Your latest money moves.</p>
            </div>
            <Link
              className="subtle-link"
              href={`/transactions?month=${month}`}
            >
              View all <Icon name="arrow" size={15} />
            </Link>
          </div>
          {data.items.length ? (
            <TransactionTable
              currency={"PHP"}
              items={data.items.slice(0, 6)}
            />
          ) : (
            <EmptyTransactions />
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Where it goes</h2>
              <p>Spending by category.</p>
            </div>
          </div>
          <CategoryBreakdown data={data} currency={"PHP"} />
        </section>
      </div>
      <div className="insight-banner">
        <span className="insight-icon">
          <Icon name="check" />
        </span>
        <div>
          <strong>
            {data.total
              ? `${data.total} ${data.total === 1 ? "record" : "records"}. One clearer picture.`
              : "Good habits start with showing up."}
          </strong>
          <p>
            {data.total
              ? "Your totals include every record in the selected period, across all pages."
              : "Record the little things. They add up to a better understanding of your money."}
          </p>
        </div>
        <span className="insight-pill">One step at a time</span>
      </div>
    </>
  );
}
