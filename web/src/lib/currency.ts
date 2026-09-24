// Explicit allowlist; precision follows ISO 4217 through the runtime Intl data.
export const CURRENCIES = [
  "PHP",
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  "TWD",
  "HKD",
  "SGD",
  "AUD",
  "CAD",
  "CHF",
  "NZD",
  "INR",
  "KRW",
  "AED",
  "SAR",
  "THB",
  "MYR",
  "IDR",
  "VND",
  "KWD",
  "BHD",
] as const;
export type Currency = (typeof CURRENCIES)[number];
export function currencyDigits(currency: string) {
  if (!(CURRENCIES as readonly string[]).includes(currency))
    throw new Error("Unsupported currency.");
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits!;
}
export function currencyName(currency: string) {
  if (currency === "TWD") return "New Taiwan dollar (NTD)";
  return (
    new Intl.DisplayNames(["en"], { type: "currency" }).of(currency) || currency
  );
}
export function minorToDecimal(minor: number, currency: string) {
  const digits = currencyDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}
