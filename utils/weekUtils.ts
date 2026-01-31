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
 * Returns true if weekStart is in the future
 */
export function isFutureWeek(weekStart: Date): boolean {
  const todayWeekStart = getWeekStart(new Date());
  return weekStart > todayWeekStart;
}
