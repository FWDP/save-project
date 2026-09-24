import { currencyDigits } from "./currency";
export function money(minor: number, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(minor / 10 ** currencyDigits(currency));
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
export function decimalToMinor(value: string, currency = "PHP") {
  const digits = currencyDigits(currency);
  const pattern = digits
    ? new RegExp(`^\\d{1,12}(\\.\\d{1,${digits}})?$`)
    : /^\d{1,12}$/;
  if (!pattern.test(value.trim()))
    throw new Error(
      `${currency} requires a positive amount with ${digits ? `at most ${digits} decimal places` : "no decimal places"}.`,
    );
  const [major, fraction = ""] = value.trim().split(".");
  const amount =
    Number(major) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
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
