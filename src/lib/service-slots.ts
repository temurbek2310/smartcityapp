import { formatDayMonth, formatTime, tashkentDayKey } from "@/lib/format";

// When a table could be booked for.
//
// The booking sheet used to offer eight hardcoded times, every one of them
// labelled «Bugun»: there was no way to reserve for tomorrow, and after 20:00
// every remaining choice was an hour that had already passed. The stored
// booking only ever carried that label, so Bron repeated whatever the sheet
// had claimed rather than the moment the customer actually picked.
//
// All of the arithmetic here is Tashkent wall-clock. Uzbekistan sits at
// UTC+05:00 the whole year with no daylight saving, so a calendar day plus a
// HH:mm maps onto exactly one instant without a timezone library — and the
// module stays pure, which is what makes the rules testable instead of only
// clickable.

const UZ_UTC_OFFSET = "+05:00";

// The catalog carries no opening hours per venue, so one service window
// covers every restaurant rather than a per-restaurant guess invented here.
// When real hours land, this is the one place that has to learn about them.
const FIRST_SLOT_MINUTES = 10 * 60;
const LAST_SLOT_MINUTES = 22 * 60;
const SLOT_STEP_MINUTES = 30;

// Today plus six. Further out than a date rail stays usable on a phone.
export const BOOKING_DAY_COUNT = 7;

type DateLike = string | number | Date;

const pad = (value: number) => String(value).padStart(2, "0");

// The instant a HH:mm on a Tashkent calendar day refers to.
export function slotInstant(dayKey: string, time: string) {
  return new Date(`${dayKey}T${time}:00.000${UZ_UTC_OFFSET}`);
}

// Day keys shift by whole days, never by 24h of elapsed time — anchoring at
// noon keeps the arithmetic away from any edge that could land a day early.
export function addDays(dayKey: string, days: number) {
  const anchor = slotInstant(dayKey, "12:00");
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return tashkentDayKey(anchor);
}

export function slotTimes() {
  const times: string[] = [];
  for (
    let minutes = FIRST_SLOT_MINUTES;
    minutes <= LAST_SLOT_MINUTES;
    minutes += SLOT_STEP_MINUTES
  ) {
    times.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return times;
}

export type BookingDay = {
  key: string;
  label: string;
};

// The days the sheet offers, starting with the one the customer is standing
// in. The first two read as words because that is how anyone booking dinner
// thinks about them; after that a date says more than «3 kundan keyin».
export function bookingDays(
  now: DateLike = new Date(),
  count = BOOKING_DAY_COUNT,
): BookingDay[] {
  const today = tashkentDayKey(now);
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const key = index === 0 ? today : addDays(today, index);
    return {
      key,
      label:
        index === 0
          ? "Bugun"
          : index === 1
            ? "Ertaga"
            : formatDayMonth(slotInstant(key, "12:00")),
    };
  });
}

export type BookingSlot = {
  time: string;
  iso: string;
  // A time that has already gone by. Only ever true on today, and the sheet
  // shows these disabled rather than hiding them, so the grid does not
  // reshuffle under a thumb as the evening wears on.
  past: boolean;
};

export function daySlots(dayKey: string, now: DateLike = new Date()) {
  const nowMs = new Date(now).getTime();
  return slotTimes().map<BookingSlot>((time) => {
    const at = slotInstant(dayKey, time);
    return {
      time,
      iso: at.toISOString(),
      // The slot standing exactly on the current minute has gone too: there
      // is no reserving a table for the moment you are already in.
      past: at.getTime() <= nowMs,
    };
  });
}

export function firstOpenSlot(dayKey: string, now: DateLike = new Date()) {
  return daySlots(dayKey, now).find((slot) => !slot.past);
}

// What the time selection should be on a given day. A time the customer
// already chose survives a change of date whenever that date still offers it,
// and otherwise falls back to the earliest one left — which is the rule that
// keeps «tomorrow at 10:30» from silently becoming a booking for 10:30 this
// morning on the way back to today. null means the day has nothing left.
export function resolveSlotTime(
  dayKey: string,
  preferred: string | null | undefined,
  now: DateLike = new Date(),
): string | null {
  const slots = daySlots(dayKey, now);
  const kept = slots.find((slot) => slot.time === preferred && !slot.past);
  return (kept ?? slots.find((slot) => !slot.past))?.time ?? null;
}

export type BookingSelection = {
  dayKey: string;
  time: string | null;
};

// Where the sheet opens. Late enough in the evening every slot today is gone,
// so it opens on tomorrow rather than on a day with nothing to pick.
export function defaultBookingSelection(
  now: DateLike = new Date(),
  count = BOOKING_DAY_COUNT,
): BookingSelection {
  const days = bookingDays(now, count);
  for (const day of days) {
    const open = firstOpenSlot(day.key, now);
    if (open) return { dayKey: day.key, time: open.time };
  }
  return { dayKey: days[0].key, time: null };
}

// «Bugun, 19:30» / «Ertaga, 19:30» / «21-sen, 19:30». Derived from the stored
// instant every time it is shown, so a booking made for tomorrow reads as
// today once tomorrow arrives instead of keeping a label that has gone stale.
export function serviceWhenLabel(value: DateLike, now: DateLike = new Date()) {
  const key = tashkentDayKey(value);
  const today = tashkentDayKey(now);
  const time = formatTime(value);

  if (key === today) return `Bugun, ${time}`;
  if (key === addDays(today, 1)) return `Ertaga, ${time}`;
  return `${formatDayMonth(value)}, ${time}`;
}
