/* Times as the notification settings show and store them ("09:00"). */


/** "09:00" → Date today at that time. */
export const timeToDate = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(Number.isInteger(h) ? h : 9, Number.isInteger(m) ? m : 0, 0, 0);
  return d;
};

export const showTime = (t: string) => timeToDate(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const toKey = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
