import { api, ApiError } from "@/lib/api";
import { CURRENCIES, minorToDecimal } from "@/lib/currency";
import { filters } from "@/lib/format";
import type { ConvertedReport, TransactionPage } from "@/lib/types";
export async function GET(
  request: Request,
) {

  const query = filters(
    Object.fromEntries(new URL(request.url).searchParams),
    "Asia/Manila",
  );
  query.delete("page");
  const target =
    new URL(request.url).searchParams.get("target") || "PHP";
  if (!(CURRENCIES as readonly string[]).includes(target))
    return new Response("Unsupported currency", { status: 400 });
  let data: Pick<TransactionPage, "summary" | "categories" | "total">;
  let transactions: TransactionPage["items"];
  let quote: ConvertedReport["quote"] | undefined;
  try {
    const firstPageQuery = new URLSearchParams(query);
    firstPageQuery.set("page", "1");
    const firstPage = await api<TransactionPage>(`/ledger/transactions?${firstPageQuery}`);
    transactions = [...firstPage.items];
    const pageCount = Math.ceil(firstPage.total / firstPage.pageSize);
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => {
        const pageQuery = new URLSearchParams(query);
        pageQuery.set("page", String(index + 2));
        return api<TransactionPage>(`/ledger/transactions?${pageQuery}`);
      }),
    );
    for (const page of remainingPages) transactions.push(...page.items);

    if (target !== "PHP") {
      query.set("target", target);
      const converted = await api<ConvertedReport>(
        `/ledger/reports/converted?${query}`,
      );
      data = converted;
      quote = converted.quote;
    } else {
      data = firstPage;
    }
  } catch (error) {
    if (error instanceof ApiError)
      return new Response(error.message, {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      });
    throw error;
  }
  const escape = (value: unknown) => {
    const text = String(value);
    return `"${(/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text) ? "'" + text : text).replaceAll('"', '""')}"`;
  };
  const rows = [
    ["Metric", `Amount (${target})`, "Record count"],
    ["Income", minorToDecimal(data.summary.incomeMinor, target), ""],
    ["Expenses", minorToDecimal(data.summary.expenseMinor, target), ""],
    [
      "Net balance",
      minorToDecimal(data.summary.balanceMinor, target),
      data.total,
    ],
    ["Top spending categories (up to 8)", "", ""],
    ...data.categories.map((c) => [
      c.name,
      minorToDecimal(c.amountMinor, target),
      c.count,
    ]),
    ["Transactions in report (recorded in PHP)", "", ""],
    ["Date", "Type", "Description", "Merchant", "Category", "Amount (PHP)"],
    ...transactions.map((item) => [
      item.date,
      item.type,
      item.description,
      item.merchant || "",
      item.category,
      minorToDecimal(item.amountMinor, "PHP"),
    ]),
  ];
  if (quote)
    rows.push(
      [
        "Conversion",
        `${quote.base} to ${quote.target}`,
        "Current-rate estimate; excludes bank fees",
      ],
      ["Rate", String(quote.rate), ""],
      ["Rate timestamp", quote.asOf, ""],
      ["Provider", quote.provider, ""],
      [
        "Rounding",
        "Currency minor units; category rounding may differ from totals",
        "",
      ],
    );
  return new Response(
    rows.map((row) => row.map(escape).join(",")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="save-summary-${query.get("month")}-${target}.csv"`,
        "Cache-Control": "private, no-store",
      },
    },
  );
}
