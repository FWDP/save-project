import { api, ApiError } from "@/lib/api";
import { filters, money, monthLabel } from "@/lib/format";
import type { TransactionPage } from "@/lib/types";
import { jsPDF } from "jspdf";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const query = filters(Object.fromEntries(searchParams), "Asia/Manila");
  query.delete("page");
  const file = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = file.internal.pageSize.getWidth();
  const pageHeight = file.internal.pageSize.getHeight();
  let y = 48;

  const write = (text: string, bold = false) => {
    const lines = file.splitTextToSize(text, pageWidth - 96) as string[];
    if (y + lines.length * 16 > pageHeight - 48) {
      file.addPage();
      y = 48;
    }
    file.setFont("helvetica", bold ? "bold" : "normal");
    file.text(lines, 48, y);
    y += lines.length * 16;
  };

  try {
    write(`SAVE Spending Report · ${monthLabel(query.get("month")!)}`, true);
    write(`Generated ${new Date().toLocaleString()}`);
    y += 10;
    const firstQuery = new URLSearchParams(query);
    firstQuery.set("page", "1");
    const first = await api<TransactionPage>(`/ledger/transactions?${firstQuery}`);
    write(`Income: ${money(first.summary.incomeMinor, "PHP")}`);
    write(`Expenses: ${money(first.summary.expenseMinor, "PHP")}`);
    write(`Net balance: ${money(first.summary.balanceMinor, "PHP")}`);
    write(`Transactions (${first.total})`, true);

    let page = first;
    for (let pageNumber = 1; pageNumber <= Math.ceil(first.total / first.pageSize); pageNumber++) {
      if (pageNumber > 1) {
        const nextQuery = new URLSearchParams(query);
        nextQuery.set("page", String(pageNumber));
        page = await api<TransactionPage>(`/ledger/transactions?${nextQuery}`);
      }
      for (const item of page.items) {
        write(`${item.date} · ${item.type.toUpperCase()} · ${item.description}`, true);
        write(`${item.category} · ${item.merchant || "No merchant"} · ${money(item.amountMinor, "PHP")}`);
        y += 5;
      }
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return new Response(error.message, {
        status: error.status,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    throw error;
  }

  const safeMonth = query.get("month")!.replace(/[^0-9-]/g, "");
  return new Response(file.output("arraybuffer"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="save-report-${safeMonth}-PHP.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}