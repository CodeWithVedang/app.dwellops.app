/** Parse a decimal rupee string ("1250.5") into integer paise without floating-point math. */
export function rupeesToPaise(input: string): number {
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) throw new Error(`Invalid amount: ${input}`);
  const rupees = Number(m[1]);
  const paise = Number((m[2] ?? "").padEnd(2, "0"));
  return rupees * 100 + paise;
}

export function formatPaise(paise: number, currency = "INR"): string {
  const rupees = Math.trunc(paise / 100);
  const rem = Math.abs(paise % 100);
  const whole = new Intl.NumberFormat("en-IN").format(rupees);
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${whole}.${rem.toString().padStart(2, "0")}`;
}
