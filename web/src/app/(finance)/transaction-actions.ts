"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { decimalToMinor } from "@/lib/format";
import type { ActionState, Transaction } from "@/lib/types";
function id(form: FormData, key: string) {
  const value = String(form.get(key) ?? "");
  if (!/^[a-f0-9]{24}$/i.test(value))
    throw new Error("Invalid record. Reload the page.");
  return value;
}
function errorState(error: unknown): ActionState {
  unstable_rethrow(error);
  return {
    error:
      error instanceof Error
        ? error.message
        : "Could not save. Please try again.",
  };
}
export async function saveTransaction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let date: string;
  try {
    date = String(form.get("date"));
    const payload = {
      type: String(form.get("type")),
      amount: decimalToMinor(
        String(form.get("amount") ?? ""),
        "PHP",
      ) / 100,
      description: String(form.get("description") ?? "").trim(),
      category: String(form.get("category") ?? "").trim(),
      merchant: String(form.get("merchant") ?? "").trim(),
      date,
      clientMutationId: String(form.get("clientMutationId")),
    };
    const editing = Boolean(form.get("transactionId"));
    await api<Transaction>(
      `/transactions${editing ? `/${id(form, "transactionId")}` : ""}`,
      {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(
          editing
            ? { ...Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "clientMutationId")), revision: Number(form.get("revision")) }
            : payload,
        ),
      },
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/", "layout");
  redirect(
    `/transactions?month=${encodeURIComponent(date.slice(0, 7))}`,
  );
}
export async function removeTransaction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    if (form.get("confirmed") !== "yes")
      return { error: "Confirm deletion before continuing." };
    await api(
      `/transactions/${id(form, "transactionId")}`,
      {
        method: "DELETE",
        body: JSON.stringify({ revision: Number(form.get("revision")) }),
      },
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/", "layout");
  redirect(`/transactions`);
}
