const dateTime = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export const formatDateTime = (d: Date): string => dateTime.format(d);

/** "in 3 h", "2 d ago" — coarse relative time for due dates and activity. */
export function relativeTime(d: Date, now = new Date()): string {
  const diffMin = Math.round((d.getTime() - now.getTime()) / 60000);
  const abs = Math.abs(diffMin);
  const [n, unit] = abs < 60 ? [abs, "min"] : abs < 60 * 48 ? [Math.round(abs / 60), "h"] : [Math.round(abs / 1440), "d"];
  return diffMin >= 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;
}
