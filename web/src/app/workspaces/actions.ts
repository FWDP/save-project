"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { decimalToMinor } from "@/lib/format";
import type { ActionState, Workspace, Transaction } from "@/lib/types";
function id(form: FormData, key: string) {
  const value = String(form.get(key) ?? "");
  if (!/^[a-f0-9]{24}$/i.test(value))
    throw new Error("Invalid workspace or record. Reload the page.");
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
export async function createWorkspace(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspace: Workspace;
  try {
    workspace = await api<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({
        name: String(form.get("name") ?? "").trim(),
        kind: String(form.get("kind")),
        currency: String(form.get("currency") || "PHP"),
        clientMutationId: String(form.get("clientMutationId")),
      }),
    });
  } catch (error) {
    return errorState(error);
  }
  revalidatePath("/");
  redirect(`/w/${workspace.id}/overview`);
}
export async function saveTransaction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  let date: string;
  try {
    workspaceId = id(form, "workspaceId");
    date = String(form.get("date"));
    const workspace = await api<Workspace>(`/workspaces/${workspaceId}`);
    const payload = {
      type: String(form.get("type")),
      amountMinor: decimalToMinor(
        String(form.get("amount") ?? ""),
        workspace.currency,
      ),
      description: String(form.get("description") ?? "").trim(),
      category: String(form.get("category") ?? "").trim(),
      merchant: String(form.get("merchant") ?? "").trim(),
      date,
      clientMutationId: String(form.get("clientMutationId")),
    };
    const editing = Boolean(form.get("transactionId"));
    await api<Transaction>(
      `/workspaces/${workspaceId}/transactions${editing ? `/${id(form, "transactionId")}` : ""}`,
      {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(
          editing
            ? { ...payload, revision: Number(form.get("revision")) }
            : payload,
        ),
      },
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/w/${workspaceId}`, "layout");
  redirect(
    `/w/${workspaceId}/transactions?month=${encodeURIComponent(date.slice(0, 7))}`,
  );
}
export async function removeTransaction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  let workspaceId: string;
  try {
    workspaceId = id(form, "workspaceId");
    if (form.get("confirmed") !== "yes")
      return { error: "Confirm deletion before continuing." };
    await api(
      `/workspaces/${workspaceId}/transactions/${id(form, "transactionId")}`,
      {
        method: "DELETE",
        body: JSON.stringify({ revision: Number(form.get("revision")) }),
      },
    );
  } catch (error) {
    return errorState(error);
  }
  revalidatePath(`/w/${workspaceId}`, "layout");
  redirect(`/w/${workspaceId}/transactions`);
}
