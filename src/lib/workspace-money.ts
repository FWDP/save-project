export function currencyDigits(currency: string) {
  return new Intl.NumberFormat('en', { style: 'currency', currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
}
export function workspaceMoney(minor: number, currency: string) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency, currencyDisplay: 'code' })
    .format(minor / 10 ** currencyDigits(currency));
}
export function workspaceAmount(value: string, currency: string) {
  const digits = currencyDigits(currency);
  const pattern = digits ? new RegExp(`^\\d{1,12}(\\.\\d{1,${digits}})?$`) : /^\d{1,12}$/;
  if (!pattern.test(value.trim())) throw new Error(`Enter a positive ${currency} amount with at most ${digits} decimal places.`);
  const [whole, fraction = ''] = value.trim().split('.');
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 999999999999)
    throw new Error('Amount is outside the supported range.');
  return minor;
}
