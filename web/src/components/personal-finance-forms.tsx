"use client";
import { useActionState } from "react";
import {
  createSavingsGoal,
  deleteBudget,
  deleteCategory,
  deleteSavingsGoal,
  saveBudget,
  saveCategory,
} from "@/app/w/[id]/personal-finance-actions";
import type { ApiBudget, ApiCategory, ApiSavingsGoal } from "@/lib/types";

const colors = [
  "#5ca9ff",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#64748b",
];

function Result({ error, message }: { error?: string; message?: string }) {
  if (error)
    return (
      <p className="notice danger" role="alert">
        {error}
      </p>
    );
  if (message)
    return (
      <p className="notice" role="status">
        {message}
      </p>
    );
  return null;
}

export function CategoryForm({
  workspaceId,
  category,
}: {
  workspaceId: string;
  category?: ApiCategory;
}) {
  const [state, action, pending] = useActionState(saveCategory, {});
  return (
    <form action={action} className="record-form">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {category && (
        <input type="hidden" name="categoryId" value={category.id} />
      )}
      <div className="form-grid">
        <label>
          Category name
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={category?.name}
          />
        </label>
        <label>
          Type
          <select name="type" defaultValue={category?.type ?? "expense"}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label>
          Color
          <select name="color" defaultValue={category?.color ?? colors[0]}>
            {colors.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Result {...state} />
      <button className="button secondary" disabled={pending}>
        {pending
          ? "Saving…"
          : category
            ? "Save category"
            : "Add category"}
      </button>
    </form>
  );
}

export function DeleteCategoryForm({
  workspaceId,
  category,
}: {
  workspaceId: string;
  category: ApiCategory;
}) {
  const [state, action, pending] = useActionState(deleteCategory, {});
  return (
    <details className="delete-record">
      <summary>Delete category</summary>
      <form action={action}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="categoryId" value={category.id} />
        <p>Transactions keep their existing “{category.name}” label.</p>
        <label>
          <span>
            <input type="checkbox" name="confirmed" value="yes" required /> I
            want to delete this category.
          </span>
        </label>
        <Result {...state} />
        <button className="button secondary" disabled={pending}>
          {pending ? "Deleting…" : "Delete category"}
        </button>
      </form>
    </details>
  );
}

export function BudgetForm({
  workspaceId,
  categories,
  budget,
}: {
  workspaceId: string;
  categories: ApiCategory[];
  budget?: ApiBudget;
}) {
  const [state, action, pending] = useActionState(saveBudget, {});
  const expenseCategories = categories.filter(
    (category) => category.type === "expense",
  );
  return (
    <form action={action} className="record-form">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      {budget && <input type="hidden" name="budgetId" value={budget.id} />}
      <div className="form-grid">
        <label>
          Expense category
          <select
            name="category"
            required
            defaultValue={budget?.category ?? ""}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Monthly limit (PHP)
          <input
            name="limit"
            type="text"
            inputMode="decimal"
            required
            pattern="[0-9]+(\.[0-9]{1,2})?"
            defaultValue={budget?.limit}
          />
        </label>
      </div>
      <Result {...state} />
      <button
        className="button secondary"
        disabled={pending || expenseCategories.length === 0}
      >
        {pending ? "Saving…" : budget ? "Save budget" : "Add monthly budget"}
      </button>
    </form>
  );
}

export function DeleteBudgetForm({
  workspaceId,
  budget,
}: {
  workspaceId: string;
  budget: ApiBudget;
}) {
  const [state, action, pending] = useActionState(deleteBudget, {});
  return (
    <details className="delete-record">
      <summary>Delete budget</summary>
      <form action={action}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="budgetId" value={budget.id} />
        <p>Transactions in {budget.category} will be kept.</p>
        <label>
          <span>
            <input type="checkbox" name="confirmed" value="yes" required /> I
            want to delete this budget.
          </span>
        </label>
        <Result {...state} />
        <button className="button secondary" disabled={pending}>
          {pending ? "Deleting…" : "Delete budget"}
        </button>
      </form>
    </details>
  );
}

export function SavingsGoalForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState(createSavingsGoal, {});
  return (
    <form action={action} className="record-form">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <div className="form-grid">
        <label>
          Goal name
          <input name="name" required maxLength={80} />
        </label>
        <label>
          Target amount (XLM)
          <input
            name="targetAmount"
            type="number"
            min="0.0000001"
            step="any"
            required
          />
        </label>
        <label>
          Target date (optional)
          <input name="targetDate" type="date" />
        </label>
      </div>
      <p className="muted">
        This creates a tracker only; no funds move and no wallet is connected.
      </p>
      <Result {...state} />
      <button className="button primary" disabled={pending}>
        {pending ? "Creating…" : "Create savings tracker"}
      </button>
    </form>
  );
}

export function DeleteSavingsGoalForm({
  workspaceId,
  goal,
}: {
  workspaceId: string;
  goal: ApiSavingsGoal;
}) {
  const [state, action, pending] = useActionState(deleteSavingsGoal, {});
  return (
    <details className="delete-record">
      <summary>Delete goal</summary>
      <form action={action}>
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="goalId" value={goal.id} />
        <p>This permanently removes “{goal.name}”.</p>
        <label>
          <span>
            <input type="checkbox" name="confirmed" value="yes" required /> I
            want to delete this goal.
          </span>
        </label>
        <Result {...state} />
        <button className="button secondary" disabled={pending}>
          {pending ? "Deleting…" : "Delete goal"}
        </button>
      </form>
    </details>
  );
}
