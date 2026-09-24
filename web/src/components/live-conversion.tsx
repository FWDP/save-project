"use client";
import { useEffect, useState } from "react";
import { convertedReport } from "@/app/workspaces/exchange-actions";
import { CURRENCIES, currencyName } from "@/lib/currency";
import { money } from "@/lib/format";
import type { ConvertedReport } from "@/lib/types";
export function LiveConversion({
  workspaceId,
  currency,
  query,
}: {
  workspaceId: string;
  currency: string;
  query: string;
}) {
  const [target, setTarget] = useState(currency);
  const [result, setResult] = useState<{
    data?: ConvertedReport;
    error?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let expiry: ReturnType<typeof setTimeout>;
    const update = async () => {
      if (target === currency) return;
      setLoading(true);
      try {
        const response = await convertedReport(workspaceId, target, query);
        if (cancelled) return;
        clearTimeout(expiry);
        const remaining = response.data
          ? Date.parse(response.data.quote.expiresAt) - Date.now()
          : 0;
        if (response.data && remaining <= 0)
          setResult({
            error: "This rate has expired. Refresh to get a current rate.",
          });
        else {
          setResult(response);
          if (response.data)
            expiry = setTimeout(
              () =>
                setResult({
                  error:
                    "This rate has expired. Refresh to get a current rate.",
                }),
              remaining,
            );
        }
      } catch {
        if (!cancelled)
          setResult({ error: "Conversion is unavailable. Please try again." });
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(update, 60_000);
        }
      }
    };
    void update();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(expiry);
    };
  }, [workspaceId, currency, target, query, refresh]);
  const data = result.data;
  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="panel-heading">
        <div>
          <h2>Live currency conversion</h2>
          <p>
            Estimate this report in another currency using current market rates.
          </p>
        </div>
      </div>
      <div className="panel-bottom">
        <label>
          Convert report to
          <select
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setResult({});
            }}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code} · {currencyName(code)}
              </option>
            ))}
          </select>
        </label>
        {target === currency ? (
          <p className="muted">
            Choose another currency to fetch a live rate. Saved records stay in{" "}
            {currency}.
          </p>
        ) : (
          <>
            <button
              className="button secondary"
              disabled={loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              {loading ? "Fetching rate…" : "Refresh rate"}
            </button>
            {result.error && (
              <p className="notice danger" role="alert">
                {result.error}
              </p>
            )}
            {data && (
              <div aria-live="polite">
                <p>
                  1 {currency} ={" "}
                  {data.quote.rate.toLocaleString("en", {
                    maximumSignificantDigits: 10,
                  })}{" "}
                  {target}
                </p>
                <p className="muted">
                  {data.quote.provider} · Rate as of{" "}
                  {new Date(data.quote.asOf).toLocaleString()} · Refreshes every
                  minute
                </p>
                <dl className="report-stats">
                  <div>
                    <dt>Estimated income</dt>
                    <dd>{money(data.summary.incomeMinor, target)}</dd>
                  </div>
                  <div>
                    <dt>Estimated expenses</dt>
                    <dd>{money(data.summary.expenseMinor, target)}</dd>
                  </div>
                  <div>
                    <dt>Estimated net balance</dt>
                    <dd>{money(data.summary.balanceMinor, target)}</dd>
                  </div>
                </dl>
                <a
                  className="button secondary"
                  href={`/w/${workspaceId}/reports/export?${query}&target=${target}`}
                >
                  Export converted summary
                </a>
                <p className="muted">
                  Current-rate estimate, including older records. Bank fees and
                  spreads are excluded. Original records stay in {currency}.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
