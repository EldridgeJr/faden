// Small formatting helpers for the UI. All dates in German time:
// the server runs in UTC, the users are in Germany.

const TIME_ZONE = "Europe/Berlin";

const hourFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

// "en-CA" writes dates as YYYY-MM-DD. We only use it to compare calendar days.
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const shortDateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});
const longDateFormat = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: TIME_ZONE,
});

// "Guten Morgen" until 11:00, "Guten Tag" until 18:00, then "Guten Abend".
export function greeting(now: Date): string {
  // format() would return "09 Uhr" in German. formatToParts gives the bare number.
  const hour = Number(hourFormat.formatToParts(now).find((part) => part.type === "hour")?.value);
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 11 && hour < 18) return "Guten Tag";
  return "Guten Abend";
}

// Whole calendar days between two dates (in German time), not 24-hour blocks.
// 23:59 and 00:01 the next morning are one day apart.
function daysBetween(earlier: Date, later: Date): number {
  const toUtcMidnight = (date: Date) => Date.parse(dayKeyFormat.format(date));
  return Math.round((toUtcMidnight(later) - toUtcMidnight(earlier)) / 86_400_000);
}

// "Heute", "Gestern", "6. Okt." or, in another year, "6. Okt. 2025".
export function formatDay(date: Date, now: Date): string {
  const days = daysBetween(date, now);
  if (days === 0) return "Heute";
  if (days === 1) return "Gestern";
  const sameYear = dayKeyFormat.format(date).slice(0, 4) === dayKeyFormat.format(now).slice(0, 4);
  return (sameYear ? shortDateFormat : longDateFormat).format(date);
}
