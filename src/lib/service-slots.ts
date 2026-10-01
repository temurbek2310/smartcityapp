import { FALLBACK_TABLE_MINUTES } from "@/lib/booking-lifecycle";
import { formatDayMonth, formatTime } from "@/lib/format";
import {
  addTashkentDays,
  type DateLike,
  tashkentDayKey,
  tashkentWallClockInstant,
} from "@/lib/tashkent-time";
import type { QueueOrg, QueueService } from "@/lib/types";

// When a table could be booked for.
//
// The booking sheet used to offer eight hardcoded times, every one of them
// labelled «Bugun»: there was no way to reserve for tomorrow, and after 20:00
// every remaining choice was an hour that had already passed. The stored
// booking only ever carried that label, so Bron repeated whatever the sheet
// had claimed rather than the moment the customer actually picked.
//
// All of the arithmetic here is Tashkent wall-clock, through the shared
// helpers in tashkent-time — the module stays pure, which is what makes the
// rules testable instead of only clickable.

// The catalog carries no opening hours per venue, so one service window
// covers every restaurant rather than a per-restaurant guess invented here.
// When real hours land, this is the one place that has to learn about them.
const FIRST_SLOT_MINUTES = 10 * 60;
const LAST_SLOT_MINUTES = 22 * 60;
const SLOT_STEP_MINUTES = 30;

// Today plus six. Further out than a date rail stays usable on a phone.
export const BOOKING_DAY_COUNT = 7;

const pad = (value: number) => String(value).padStart(2, "0");

// The instant a HH:mm on a Tashkent calendar day refers to.
export const slotInstant = tashkentWallClockInstant;

export const addDays = addTashkentDays;

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

// Cinema, clinic and event: today only, at these fixed times, until a real
// schedule exists. Read through daySlots() like the table grid, so a time that
// has gone by today cannot be picked.
export const SAME_DAY_SLOTS = [
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "14:00",
  "18:00",
  "19:00",
  "20:00",
] as const;

// Where the same-day list opens while that time is still ahead.
export const SAME_DAY_DEFAULT_SLOT = "12:30";

// How long a table can be held. Two hours stays the pre-selected answer —
// it is what every table was held for before the customer could choose.
export const TABLE_DURATIONS = [60, 90, 120, 180] as const;
export const DEFAULT_TABLE_DURATION = FALLBACK_TABLE_MINUTES;

// «1 soat», «1,5 soat», «2 soat» — Uzbek writes the decimal with a comma.
export function durationLabel(minutes: number) {
  const hours = minutes / 60;
  return `${String(Number(hours.toFixed(1))).replace(".", ",")} soat`;
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

// `times` defaults to the table service window; cinema and clinic pass their
// own fixed same-day list and get the same past-aware treatment.
export function daySlots(
  dayKey: string,
  now: DateLike = new Date(),
  times: readonly string[] = slotTimes(),
) {
  const nowMs = new Date(now).getTime();
  return times.map<BookingSlot>((time) => {
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
  times: readonly string[] = slotTimes(),
): string | null {
  const slots = daySlots(dayKey, now, times);
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

// --- Queue tickets -------------------------------------------------------------
// A ticket can be taken for right now, the way it always could, or booked for
// a later slot on the same day rail every other booking uses. «Hozir» is not a
// time: it takes the live path, where the organisation assigns a window and
// the place in line is counted from the moment of issue.
export const QUEUE_NOW_SLOT = "Hozir";

// One grid for every organisation, on the same half-hour as tables. A desk is
// held for the service's own serviceMinutes from the slot's start, so a long
// service simply overlaps the next half-hour on that desk.
export const QUEUE_SLOT_STEP_MINUTES = SLOT_STEP_MINUTES;

function minutesOf(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// The bookable starts for one line, from opening until the last slot that
// still ends by closing. Empty for a line that is live-only, or for a malformed
// opening time — nothing is guessed.
export function queueSlotTimes(
  org: Pick<QueueOrg, "openTime" | "closeTime">,
  service: Pick<QueueService, "serviceMinutes" | "bookable">,
): string[] {
  if (!service.bookable) return [];
  const open = minutesOf(org.openTime);
  const last = minutesOf(org.closeTime) - service.serviceMinutes;
  if (!Number.isFinite(open) || !Number.isFinite(last)) return [];
  const times: string[] = [];
  for (let minutes = open; minutes <= last; minutes += QUEUE_SLOT_STEP_MINUTES) {
    times.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return times;
}

// Where the queue sheet's scheduling step opens: the first day with a slot
// still ahead, and that slot. time is null when the whole rail is spent.
export function defaultQueueSelection(
  org: Pick<QueueOrg, "openTime" | "closeTime">,
  service: Pick<QueueService, "serviceMinutes" | "bookable">,
  now: DateLike = new Date(),
  count = BOOKING_DAY_COUNT,
): BookingSelection {
  const times = queueSlotTimes(org, service);
  const days = bookingDays(now, count);
  for (const day of days) {
    const open = daySlots(day.key, now, times).find((slot) => !slot.past);
    if (open) return { dayKey: day.key, time: open.time };
  }
  return { dayKey: days[0].key, time: null };
}
