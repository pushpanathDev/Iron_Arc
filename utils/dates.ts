/**
 * Always returns Monday of the given date's week
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)

  // Calculate how many days to subtract to reach Monday
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);

  return d;
}

/**
 * Formats a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD key as a LOCAL calendar date (inverse of formatDate).
 * `new Date("YYYY-MM-DD")` would be UTC midnight, which is the previous
 * local day for anyone west of UTC.
 */
export function parseLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Calendar-safe day arithmetic on YYYY-MM-DD keys (no DST drift). */
export function addDays(key: string, n: number): string {
  const d = parseLocalDate(key);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

/** Weeks run Monday to Sunday everywhere (date pickers count Sunday as 0). */
export const FIRST_DAY_OF_WEEK = 1;

export const DAY_MS = 86_400_000;

/** Whole calendar days from one YYYY-MM-DD key to another (positive when `to` is later). */
export const daysBetween = (from: string, to: string) => Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / DAY_MS);

/** "12 Oct" */
export const shortDate = (key: string) => parseLocalDate(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** "Today", "Yesterday", else "Mon, 12 Oct". */
export function dayLabel(key: string, todayKey: string) {
  const diff = daysBetween(key, todayKey);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return parseLocalDate(key).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** "08:15 AM" in local time, for a saved timestamp. */
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
