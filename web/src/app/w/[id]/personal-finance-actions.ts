"use server";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { api } from "@/lib/api";
import { decimalToMinor } from "@/lib/format";
import { requirePersonalWorkspace } from "@/lib/personal-workspace";
import type { ActionState } from "@/lib/types";

const categoryColors = new Set([
  "#5ca9ff",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#64748b",
]);

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function recordId(form: FormData, key: string) {
  const id = value(form, key);
  if (!/^[a-f0-9]{24}$/i.test(id))
    throw new Error("Invalid record. Reload and try again.");
  return id;
}

function errorState(error: unknown): ActionState {
  unstable_rethrow(error);
  return {
    error: error instanceof Error ? error.message : "Could not save. Try again.",
  };
}

function revalidate(workspaceId: string) {
  revalidatePath(`/w/${workspaceId}`, "layout");
}

export async function saveCategory(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  try {
    workspaceId = recordId(form, "workspaceId");
    await requirePersonalWorkspace(workspaceId);
    const name = value(form, "name");
    const type = value(form, "type");
    const color = value(form, "color");
    if (!name || name.length > 80)
      throw new Error("Enter a category name of 80 characters or fewer.");
    if (type !== "expense" && type !== "income")
      throw new Error("Choose an expense or income category.");
    if (!categoryColors.has(color)) throw new Error("Choose a valid category color.");
    const categoryId = value(form, "categoryId");
    if (categoryId && !/^[a-f0-9]{24}$/i.test(categoryId))
      throw new Error("Built-in categories cannot be edited.");
    await api(categoryId ? `/categories/${categoryId}` : "/categories", {
      method: categoryId ? "PATCH" : "POST",
      body: JSON.stringify({ name, type, color }),
    });
  } catch (error) {
    return errorState(error);
  }
  revalidate(workspaceId);
  return { message: "Category saved. Mobile will refresh it automatically." };
}

export async function deleteCategory(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  try {
    workspaceId = recordId(form, "workspaceId");
    await requirePersonalWorkspace(workspaceId);
    if (value(form, "confirmed") !== "yes")
      throw new Error("Confirm category deletion before continuing.");
    await api(`/categories/${recordId(form, "categoryId")}`, {
      method: "DELETE",
    });
  } catch (error) {
    return errorState(error);
  }
  revalidate(workspaceId);
  return { message: "Category deleted. Existing transaction labels are unchanged." };
}

export async function saveBudget(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  try {
    workspaceId = recordId(form, "workspaceId");
    await requirePersonalWorkspace(workspaceId);
    const category = value(form, "category");
    if (!category || category.length > 80)
      throw new Error("Choose a valid expense category.");
    const limit = decimalToMinor(value(form, "limit"), "PHP") / 100;
    const budgetId = value(form, "budgetId");
    if (budgetId && !/^[a-f0-9]{24}$/i.test(budgetId))
      throw new Error("Invalid budget. Reload and try again.");
    await api(budgetId ? `/budgets/${budgetId}` : "/budgets", {
      method: budgetId ? "PATCH" : "POST",
      body: JSON.stringify({ category, limit, period: "monthly" }),
    });
  } catch (error) {
    return errorState(error);
  }
  revalidate(workspaceId);
  return { message: "Budget saved. Mobile will refresh it automatically." };
}

export async function deleteBudget(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  try {
    workspaceId = recordId(form, "workspaceId");
    await requirePersonalWorkspace(workspaceId);
    if (value(form, "confirmed") !== "yes")
      throw new Error("Confirm budget deletion before continuing.");
    await api(`/budgets/${recordId(form, "budgetId")}`, { method: "DELETE" });
  } catch (error) {
    return errorState(error);
  }
  revalidate(workspaceId);
  return { message: "Budget deleted." };
}

export async function createSavingsGoal(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  try {
    workspaceId = recordId(form, "workspaceId");
    await requirePersonalWorkspace(workspaceId);
    const name = value(form, "name");
    const targetAmount = Number(value(form, "targetAmount"));
    const targetDate = value(form, "targetDate");
    if (!name || name.length > 80)
      throw new Error("Enter a goal name of 80 characters or fewer.");
    if (!Number.isFinite(targetAmount) || targetAmount <= 0)
      throw new Error("Enter a positive target amount.");
    if (
      targetDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) ||
        new Date(`${targetDate}T00:00:00Z`).toISOString().slice(0, 10) !==
          targetDate)
    )
      throw new Error("Choose a valid target date.");
    await api("/savings-goals", {
      method: "POST",
      body: JSON.stringify({
        name,
        targetAmount,
        targetDate: targetDate || undefined,
        asset: "XLM",
      }),
    });
  } catch (error) {
    return errorState(error);
  }
  revalidate(workspaceId);
  return { message: "Savings tracker created. Mobile will refresh it automatically." };
}

export async function deleteSavingsGoal(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  try {
    workspaceId = recordId(form, "workspaceId");
    await requirePersonalWorkspace(workspaceId);
    if (value(form, "confirmed") !== "yes")
      throw new Error("Confirm goal deletion before continuing.");
    await api(`/savings-goals/${recordId(form, "goalId")}`, {
      method: "DELETE",
    });
  } catch (error) {
    return errorState(error);
  }
  revalidate(workspaceId);
  return { message: "Savings goal deleted." };
}
