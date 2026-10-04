import Link from "next/link";
import {
  BudgetForm,
  DeleteBudgetForm,
} from "@/components/personal-finance-forms";
import { api } from "@/lib/api";
import { money, today } from "@/lib/format";
import type {
  ApiBudget,
  ApiCategory,
  PersonalTransaction,
} from "@/lib/types";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {

  const search = await searchParams;
  const month =
    typeof search.month === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(search.month)
      ? search.month
      : today("Asia/Manila").slice(0, 7);
  const [budgets, categories, transactions] = await Promise.all([
    api<ApiBudget[]>("/budgets"),
    api<ApiCategory[]>("/categories"),
    api<PersonalTransaction[]>("/transactions"),
  ]);
  const monthly = budgets
    .filter((budget) => budget.period === "monthly")
    .map((budget) => {
      const spent = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.category === budget.category &&
            transaction.date.startsWith(`${month}-`),
        )
        .reduce((total, transaction) => total + Math.round(transaction.amount * 100), 0);
      const remaining = Math.round(budget.limit * 100) - spent;
      const percentage = budget.limit
        ? (spent / Math.round(budget.limit * 100)) * 100
        : 0;
      return {
        budget,
        spent,
        remaining,
        percentage,
        width: Math.min(Math.max(percentage, 0), 100),
      };
    })
    .sort((a, b) => b.percentage - a.percentage);
  const weeklyCount = budgets.filter((budget) => budget.period === "weekly").length;
  const availableCategories = categories.filter(
    (category) =>
      category.type === "expense" &&
      !budgets.some((budget) => budget.category === category.name),
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE PLAN GOES A LONG WAY</span>
          <h1>Your budgets.</h1>
          <p>Monthly spending limits shared with SAVE Mobile.</p>
        </div>
      </div>
      <div className="period-bar">
        <span className="section-label">Budget progress</span>
        <form className="period-form">
          <label>
            Month
            <input type="month" name="month" defaultValue={month} />
          </label>
          <button className="button small secondary">View month</button>
        </form>
      </div>
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>Add a monthly budget</h2>
            <p>Limits and transaction spending use PHP.</p>
          </div>
        </div>
        {availableCategories.length ? (
          <BudgetForm categories={availableCategories} />
        ) : (
          <p className="muted">
            Create an expense category or edit an existing budget before adding
            another limit.{" "}
            <Link className="subtle-link" href={`/categories`}>
              Manage categories
            </Link>
          </p>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>{month} progress</h2>
            <p>Calculated from your shared expense transactions.</p>
          </div>
        </div>
        {monthly.length ? (
          <div className="overview-grid">
            {monthly.map(({ budget, spent, remaining, percentage, width }) => {
              const editableCategories = categories.filter(
                (category) =>
                  category.type === "expense" &&
                  (category.name === budget.category ||
                    !monthly.some(
                      (row) => row.budget.category === category.name,
                    )),
              );
              return (
                <article className="panel" key={budget.id}>
                  <div className="panel-heading">
                    <div>
                      <h3>{budget.category}</h3>
                      <p>
                        {money(spent, "PHP")} of {money(
                          Math.round(budget.limit * 100),
                          "PHP",
                        )}
                      </p>
                    </div>
                    <strong
                      className={
                        remaining < 0 ? "amount expense" : "amount income"
                      }
                    >
                      {Math.round(percentage)}%
                    </strong>
                  </div>
                  <progress
                    max="100"
                    value={width}
                    aria-label={`${budget.category} budget progress`}
                  />
                  <p className="muted">
                    {money(Math.abs(remaining), "PHP")}{" "}
                    {remaining < 0 ? "over budget" : "remaining"}
                  </p>
                  <details className="delete-record">
                    <summary>Edit budget</summary>
                    <BudgetForm
                      categories={editableCategories}
                      budget={budget}
                    />
                  </details>
                  <DeleteBudgetForm budget={budget} />
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">
            No monthly budgets yet. Add a category limit to see your progress.
          </p>
        )}
        {weeklyCount > 0 && (
          <p className="notice">
            {weeklyCount} weekly budget(s) are not included in this monthly view.
            Their categories are already budgeted and can be managed in SAVE
            Mobile.
          </p>
        )}
      </section>
    </>
  );
}
