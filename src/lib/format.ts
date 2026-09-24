import { tashkentParts } from "@/lib/tashkent-time";

// The canonical zone and day-key helper live in tashkent-time; re-exported so
// display code keeps one import for everything it formats.
export { UZ_TIME_ZONE, tashkentDayKey } from "@/lib/tashkent-time";

// Chrome ships no CLDR data for `uz`, so Intl quietly falls back to the root
// locale: dates came out as "2026 M09 11 11:30" and prices as "12,000".
// Node's full-ICU build does have the data, which is why a passing build never
// caught it. Every Uzbek-facing string is therefore composed here from CLDR's
// uz-Latn patterns. Intl is still used to move a Date onto Tashkent's wall
// clock — that is timezone data, which ships separately and is present.
const MONTHS_SHORT = [
  "yan", "fev", "mar", "apr", "may", "iyn",
  "iyl", "avg", "sen", "okt", "noy", "dek",
];

const pad = (value: number) => String(value).padStart(2, "0");

// uz-Latn groups thousands with a non-breaking space, not a comma.
export function formatNumber(value: number) {
  const rounded = Math.round(value);
  const digits = String(Math.abs(rounded));
  let grouped = "";
  for (let end = digits.length; end > 0; end -= 3) {
    const chunk = digits.slice(Math.max(0, end - 3), end);
    grouped = grouped ? `${chunk} ${grouped}` : chunk;
  }
  return rounded < 0 ? `-${grouped}` : grouped;
}

export function formatUZS(amount: number) {
  return `${formatNumber(amount)} soʻm`;
}

// "11-sen" — the uz-Latn short date, used for day chips.
export function formatDayMonth(value: string | number | Date) {
  const { day, month } = tashkentParts(value);
  return `${day}-${MONTHS_SHORT[month - 1]}`;
}

// "11-sen, 2026"
export function formatDate(value: string | number | Date) {
  return `${formatDayMonth(value)}, ${tashkentParts(value).year}`;
}

export function formatTime(value: string | number | Date) {
  const { hour, minute } = tashkentParts(value);
  return `${pad(hour)}:${pad(minute)}`;
}

// "11-sen, 2026, 11:30"
export function formatDateTime(value: string | number | Date) {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

// "300 m" under a kilometre, "1,2 km" above it — uz-Latn uses a decimal
// comma, and formatNumber() already owns the thousands separator.
export function formatDistance(km: number) {
  if (!Number.isFinite(km) || km < 0) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  // Round first, then split. Rounding the fraction on its own lets it reach
  // 10 and print "2,10 km" instead of carrying into the whole number.
  const [whole, tenth] = (Math.round(km * 10) / 10).toFixed(1).split(".");
  return `${formatNumber(Number(whole))},${tenth} km`;
}

export function formatDuration(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
