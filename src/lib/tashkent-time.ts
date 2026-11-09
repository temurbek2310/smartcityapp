// The one clock every SmartCity booking is scheduled on.
//
// A parking bay, a table, a cinema seat and a clinic slot are all physical
// places in Uzbekistan, so «14:00» on a booking means 14:00 in Tashkent —
// never 14:00 wherever the phone happens to think it is. Parking used to
// build its start with setDate()/setHours(), which is the device's own
// timezone: the same tap on a phone set to UTC stored a booking five hours
// later than the one the sheet had shown. Everything that turns a picked day
// and time into an instant, or reads a Tashkent day or hour back out of one,
// lives here instead.
//
// Uzbekistan sits at UTC+05:00 the whole year with no daylight saving, so a
// calendar day plus a HH:mm maps onto exactly one instant without a timezone
// library. The instant is what gets stored (Date.toISOString(), always «Z»);
// nothing here ever produces an offset-less or device-relative timestamp.
//
// Deliberately independent of GPS or the user's position: a booking made
// from Samarkand, or from abroad, is still on Tashkent wall clock.

export const UZ_TIME_ZONE = "Asia/Tashkent";
export const UZ_UTC_OFFSET = "+05:00";

export type DateLike = string | number | Date;

const TASHKENT_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: UZ_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export type TashkentParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

// The Tashkent wall clock an instant falls on.
export function tashkentParts(value: DateLike): TashkentParts {
  const parts = TASHKENT_PARTS.formatToParts(new Date(value));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    // hour12:false still renders midnight as "24" in some engines.
    hour: pick("hour") % 24,
    minute: pick("minute"),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

// "2026-09-11" — the Tashkent calendar day an instant falls on. Not shown to
// anyone; it is the stable key a date picker selects by and slot arithmetic
// builds instants from, so neither has to carry a Date around.
export function tashkentDayKey(value: DateLike) {
  const { year, month, day } = tashkentParts(value);
  return `${year}-${pad(month)}-${pad(day)}`;
}

// 0–23, on Tashkent's clock rather than the device's.
export function tashkentHour(value: DateLike) {
  return tashkentParts(value).hour;
}

// "14:05" — the Tashkent HH:mm an instant falls on.
export function tashkentTime(value: DateLike) {
  const { hour, minute } = tashkentParts(value);
  return `${pad(hour)}:${pad(minute)}`;
}

// The instant a HH:mm on a Tashkent calendar day refers to.
export function tashkentWallClockInstant(dayKey: string, time: string) {
  return new Date(`${dayKey}T${time}:00.000${UZ_UTC_OFFSET}`);
}

// Day keys shift by whole days, never by 24h of elapsed time — anchoring at
// noon keeps the arithmetic away from any edge that could land a day early.
export function addTashkentDays(dayKey: string, days: number) {
  const anchor = tashkentWallClockInstant(dayKey, "12:00");
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return tashkentDayKey(anchor);
}

// Whole Tashkent calendar days from one day key to another.
export function tashkentDayDiff(fromDayKey: string, toDayKey: string) {
  const from = tashkentWallClockInstant(fromDayKey, "12:00").getTime();
  const to = tashkentWallClockInstant(toDayKey, "12:00").getTime();
  return Math.round((to - from) / 86_400_000);
}

// The consecutive Tashkent days starting with the one `now` falls on.
export function tashkentDayKeys(now: DateLike, count: number) {
  const today = tashkentDayKey(now);
  return Array.from({ length: Math.max(1, count) }, (_, index) =>
    index === 0 ? today : addTashkentDays(today, index),
  );
}

// The first quarter-hour on Tashkent's clock at least `leadMinutes` after
// `now` (taken to the whole minute). 14:07 → 14:30, 14:52 → 15:15, 23:55 →
// 00:15 the next Tashkent day. The same `now` gives the same instant on any
// device, because the grid is read off Tashkent wall clock.
export function nextTashkentQuarterInstant(now: DateLike, leadMinutes = 0) {
  const { hour, minute } = tashkentParts(now);
  const target = Math.ceil((hour * 60 + minute + leadMinutes) / 15) * 15;
  const dayKey = addTashkentDays(tashkentDayKey(now), Math.floor(target / 1440));
  const inDay = target % 1440;
  return tashkentWallClockInstant(
    dayKey,
    `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`,
  );
}
