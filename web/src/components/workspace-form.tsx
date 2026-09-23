"use client";
import { useActionState, useState } from "react";
import { createWorkspace } from "@/app/workspaces/actions";
import { Icon } from "./icon";
export function WorkspaceForm({
  mutationId,
  hasPersonal,
}: {
  mutationId: string;
  hasPersonal: boolean;
}) {
  const [state, action, pending] = useActionState(createWorkspace, {});
  const [kind, setKind] = useState(hasPersonal ? "business" : "personal");
  return (
    <form action={action} className="workspace-form">
      <input type="hidden" name="clientMutationId" value={mutationId} />
      <fieldset className="workspace-choices">
        <legend>What would you like to organize?</legend>
        {(!hasPersonal ? ["personal", "business"] : ["business"]).map(
          (value) => (
            <label
              key={value}
              className={`workspace-choice ${kind === value ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
              />
              <Icon name={value === "personal" ? "wallet" : "workspace"} />
              <strong>
                {value === "personal" ? "Personal finances" : "A business"}
              </strong>
              <span>
                {value === "personal"
                  ? "Your everyday spending and goals."
                  : "A separate space for business records."}
              </span>
            </label>
          ),
        )}
      </fieldset>
      <label>
        Workspace name
        <input
          name="name"
          required
          maxLength={80}
          placeholder={
            kind === "personal" ? "My personal finances" : "e.g. Studio North"
          }
        />
      </label>
      <p className="field-help">
        Amounts are recorded in Philippine pesos. Dates use Asia/Manila time.
      </p>
      {state.error && (
        <p className="notice danger" role="alert">
          {state.error}
        </p>
      )}
      <button className="button primary" disabled={pending}>
        {pending ? "Creating workspace…" : "Create workspace"}
        <Icon name="arrow" />
      </button>
    </form>
  );
}
