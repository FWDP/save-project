export function money(minor: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(minor / 100);
}
export function today(timezone = "Asia/Manila") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monthLabel(month: string) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function decimalToMinor(value: string) {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter a positive amount with at most two decimal places.");
  const [major, fraction = ""] = value.trim().split(".");
  const amount = Number(major) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999999999999)
    throw new Error("The amount is outside the supported range.");
  return amount;
}
export function filters(
  params: Record<string, string | string[] | undefined>,
  timezone = "Asia/Manila",
) {
  const query = new URLSearchParams();
  const month =
    typeof params.month === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month)
      ? params.month
      : today(timezone).slice(0, 7);
  query.set("month", month);
  for (const key of ["type", "search", "category", "page", "sort"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  return query;
}
