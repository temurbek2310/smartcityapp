export const UZ_TIME_ZONE = "Asia/Tashkent";

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

const TASHKENT_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: UZ_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function tashkentParts(value: string | number | Date) {
  const parts = TASHKENT_PARTS.formatToParts(new Date(value));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  return {
    year,
    month,
    day,
    // hour12:false still renders midnight as "24" in some engines.
    hour: pick("hour") % 24,
    minute: pick("minute"),
  };
}

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
  return `${formatNumber(Math.floor(km))},${Math.round((km % 1) * 10)} km`;
}

export function formatDuration(ms: number) {
  const safe = Math.max(0, ms);
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
