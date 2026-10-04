import {
  DeleteSavingsGoalForm,
  SavingsGoalForm,
} from "@/components/personal-finance-forms";
import { api } from "@/lib/api";
import type { ApiSavingsGoal } from "@/lib/types";

export default async function SavingsPage() {

  const goals = await api<ApiSavingsGoal[]>("/savings-goals");

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">KEEP YOUR EYES ON THE GOAL</span>
          <h1>Savings goals.</h1>
          <p>Trackers are shared with SAVE Mobile. No funds move from Web.</p>
        </div>
      </div>
      <section className="panel form-panel">
        <div className="panel-heading">
          <div>
            <h2>Create a savings tracker</h2>
            <p>Set an XLM target and optional date.</p>
          </div>
        </div>
        <SavingsGoalForm />
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Your goals</h2>
            <p>{goals.length} goals available to this account.</p>
          </div>
        </div>
        {goals.length ? (
          <div className="overview-grid">
            {goals.map((goal) => {
              const percent = Math.min(
                Math.round(
                  (goal.fundedAmount / Math.max(goal.targetAmount, 1)) * 100,
                ),
                100,
              );
              const linked = Boolean(goal.contractId && goal.vaultGoalId);
              return (
                <article className="panel" key={goal.id}>
                  <div className="panel-heading">
                    <div>
                      <h3>{goal.name}</h3>
                      <p>
                        {goal.status} · {goal.asset} ·{" "}
                        {linked ? "Testnet vault linked" : "Tracker only"}
                      </p>
                    </div>
                    <strong>{percent}%</strong>
                  </div>
                  <p className="amount">
                    {goal.fundedAmount.toLocaleString("en-US", {
                      maximumFractionDigits: 7,
                    })}{" "}
                    /{" "}
                    {goal.targetAmount.toLocaleString("en-US", {
                      maximumFractionDigits: 7,
                    })}{" "}
                    {goal.asset}
                  </p>
                  <progress
                    max="100"
                    value={percent}
                    aria-label={`${goal.name} funding progress`}
                  />
                  <p className="muted">
                    {goal.targetDate
                      ? `Target date: ${goal.targetDate}`
                      : "No target date"}
                    {goal.network ? ` · ${goal.network}` : ""}
                  </p>
                  {linked && (
                    <p className="notice">
                      Vault signing and ledger activity are available in SAVE
                      Mobile. Web does not prepare or sign transactions.
                    </p>
                  )}
                  <DeleteSavingsGoalForm goal={goal} />
                </article>
              );
            })}
          </div>
        ) : (
          <p className="muted">No savings goals yet.</p>
        )}
      </section>
    </>
  );
}
