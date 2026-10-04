import {
  Injectable,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { SUPPORTED_CURRENCIES } from "./currencies";
export type FxQuote = {
  base: string;
  target: string;
  rate: number;
  provider: string;
  asOf: string;
  expiresAt: string;
};
const MAX_AGE = 5 * 60_000;
// Decimal rational arithmetic avoids binary rounding before the final minor unit.
export function convertMinor(
  amount: number,
  base: string,
  target: string,
  rate: number,
) {
  if (!Number.isSafeInteger(amount) || !Number.isFinite(rate) || rate <= 0)
    throw new BadRequestException("Invalid conversion amount or rate.");
  const digits = (currency: string) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits!;
  const [mantissa, exponent = "0"] = String(rate).toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const power =
    Number(exponent) - fraction.length + digits(target) - digits(base);
  let numerator = BigInt(Math.abs(amount)) * BigInt(whole + fraction);
  let denominator = 1n;
  if (power >= 0) numerator *= 10n ** BigInt(power);
  else denominator = 10n ** BigInt(-power);
  const rounded = (numerator + denominator / 2n) / denominator;
  const result = Number(rounded) * (amount < 0 ? -1 : 1);
  if (!Number.isSafeInteger(result))
    throw new BadRequestException(
      "Converted amount exceeds the supported range.",
    );
  return result;
}
@Injectable()
export class ExchangeRatesService {
  private cache = new Map<
    string,
    {
      fetchedAt: number;
      asOf: string;
      rates: Record<string, { code: string; value: number }>;
    }
  >();
  private pending = new Map<string, Promise<void>>();
  private retryAfter = new Map<string, number>();
  async quote(base: string, target: string): Promise<FxQuote> {
    if (
      ![base, target].every((code) =>
        (SUPPORTED_CURRENCIES as readonly string[]).includes(code),
      )
    )
      throw new BadRequestException("Unsupported currency.");
    if (base === target)
      return {
        base,
        target,
        rate: 1,
        provider: "identity",
        asOf: new Date().toISOString(),
        expiresAt: new Date(Date.now() + MAX_AGE).toISOString(),
      };
    const key = process.env.CURRENCYAPI_KEY;
    if (!key)
      throw new ServiceUnavailableException(
        "Live exchange rates are not configured yet. Your original-currency report is still available.",
      );
    const cached = this.cache.get(base);
    if (!cached || Date.now() - cached.fetchedAt >= 60_000) {
      if ((this.retryAfter.get(base) ?? 0) > Date.now())
        throw new ServiceUnavailableException(
          "Exchange rates are temporarily unavailable. Please retry in a minute.",
        );
      let pending = this.pending.get(base);
      if (!pending) {
        pending = this.load(base, key).finally(() => this.pending.delete(base));
        this.pending.set(base, pending);
      }
      await pending;
    }
    const snapshot = this.cache.get(base)!;
    const timestamp = Date.parse(snapshot.asOf);
    if (
      !Number.isFinite(timestamp) ||
      timestamp > Date.now() + 60_000 ||
      Date.now() - timestamp > MAX_AGE
    )
      throw new ServiceUnavailableException(
        "The provider rate is too old for live conversion. Check the rate plan or try again later.",
      );
    const row = snapshot.rates[target];
    if (
      !row ||
      row.code !== target ||
      typeof row.value !== "number" ||
      !Number.isFinite(row.value) ||
      row.value <= 0
    )
      throw new ServiceUnavailableException(
        "The provider has no valid rate for this currency pair.",
      );
    return {
      base,
      target,
      rate: row.value,
      provider: "CurrencyAPI",
      asOf: snapshot.asOf,
      expiresAt: new Date(timestamp + MAX_AGE).toISOString(),
    };
  }
  private async load(base: string, key: string) {
    try {
      const response = await fetch(
        `https://api.currencyapi.com/v3/latest?base_currency=${base}`,
        {
          headers: { apikey: key },
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Provider failed");
      const body = await response.json();
      if (
        typeof body.meta?.last_updated_at !== "string" ||
        !body.data ||
        typeof body.data !== "object"
      )
        throw new Error("Invalid provider data");
      this.cache.set(base, {
        fetchedAt: Date.now(),
        asOf: body.meta.last_updated_at,
        rates: body.data,
      });
      this.retryAfter.delete(base);
    } catch {
      this.retryAfter.set(base, Date.now() + 60_000);
      throw new ServiceUnavailableException(
        "Exchange rates are temporarily unavailable. Your saved amounts have not changed.",
      );
    }
  }
}
