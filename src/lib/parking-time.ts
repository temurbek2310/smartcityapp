import { bookingDays, type BookingDay } from "@/lib/service-slots";
import {
  addTashkentDays,
  type DateLike,
  nextTashkentQuarterInstant,
  tashkentDayDiff,
  tashkentDayKey,
  tashkentTime,
  tashkentWallClockInstant,
} from "@/lib/tashkent-time";

// When a parking booking starts, decided outside the sheet so it can be
// tested. The sheet only collects a Tashkent day key and either a HH:mm or
// «Hozir»; the instant comes from here, on Tashkent's clock, so the same tap
// stores the same moment whatever timezone the phone is set to.

export const PARKING_NOW_SLOT = "Hozir";

// «Hozir» is the next quarter-hour at least this far away, so the bay is
// still there by the time the customer drives over.
export const PARKING_NOW_LEAD_MINUTES = 15;

export const PARKING_ARRIVAL_SLOTS = [
  PARKING_NOW_SLOT,
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "14:00",
  "18:00",
  "19:00",
] as const;

// Today, tomorrow and the two days after — the rail the sheet has always
// offered — as Tashkent calendar days, so a chip reading «26-sen» books the
// 26th rather than whatever day the device's own calendar landed on.
export const PARKING_BOOKING_DAY_COUNT = 4;

export function parkingBookingDays(now: DateLike): BookingDay[] {
  return bookingDays(now, PARKING_BOOKING_DAY_COUNT);
}

export type ParkingStartInput = {
  // A Tashkent day key, "2026-09-24".
  dayKey: string;
  // "14:00", or «Hozir».
  time: string;
  now: DateLike;
};

export function parkingStartInstant({ dayKey, time, now }: ParkingStartInput) {
  if (time !== PARKING_NOW_SLOT) return tashkentWallClockInstant(dayKey, time);

  // «Hozir» on a later chip keeps the meaning it always had: the same
  // quarter-hour, that many Tashkent days on.
  const soon = nextTashkentQuarterInstant(now, PARKING_NOW_LEAD_MINUTES);
  const days = tashkentDayDiff(tashkentDayKey(now), dayKey);
  if (days === 0) return soon;
  return tashkentWallClockInstant(
    addTashkentDays(tashkentDayKey(soon), days),
    tashkentTime(soon),
  );
}

// The window this draft would occupy, in the same arithmetic
// the reservation store uses to derive endAt.
export function parkingBookingWindow(input: ParkingStartInput & { hours: number }) {
  const startAt = parkingStartInstant(input);
  return {
    startAt,
    endAt: new Date(startAt.getTime() + input.hours * 3_600_000),
  };
}

// A start that is not after the current moment has gone by — the same rule the
// service slots use. Both sides are absolute instants, so the device's
// timezone plays no part.
export function isParkingStartPast(startAt: DateLike, now: DateLike) {
  return new Date(startAt).getTime() <= new Date(now).getTime();
}
