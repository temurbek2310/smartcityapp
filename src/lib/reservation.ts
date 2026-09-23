import type { Reservation, ReservationStatus } from "@/lib/types";

// --- Where a booking lives right now ------------------------------------
// /reservation/[id] is the booking's page for its whole live span. Before
// entry it is the confirmation; after entry the same page renders the
// running session itself. So every entry point — the card in Bron, a
// conflict link, a deep link someone kept, and /session/[id] itself, which
// is now only a shim — lands there, and only a finished booking is described
// somewhere else.
export type ReservationRef = Pick<Reservation, "id" | "status">;

export function reservationHref(reservation: ReservationRef) {
  const screens: Record<ReservationStatus, string> = {
    // Waiting to be used: confirmation, QR, «Parkingga kirish», cancel.
    reserved: `/reservation/${reservation.id}`,
    // Inside. The same page, with the timer, the running bill and the exit
    // in place of the confirmation it has used up.
    active: `/reservation/${reservation.id}`,
    // Paid and gone — the only stage with a screen of its own.
    completed: `/receipt/${reservation.id}`,
    // Read-only notice, still on the detail page.
    cancelled: `/reservation/${reservation.id}`,
  };
  return screens[reservation.status];
}

// Where /reservation/[id] has to hand over to, or null while it is still
// the page that describes this booking — which is every stage but the last.
export function supersededReservationHref(reservation: ReservationRef) {
  const href = reservationHref(reservation);
  return href === `/reservation/${reservation.id}` ? null : href;
}

export function reservationCode(id: string) {
  return `BSPACE:${id}`;
}

export function reservationRemainingMs(reservation: Reservation) {
  return new Date(reservation.endAt).getTime() - Date.now();
}

export function calculateFinalTotal(reservation: Reservation, exitedAt: Date) {
  const started = new Date(reservation.enteredAt ?? reservation.startAt).getTime();
  const elapsedHours = Math.max(1, Math.ceil((exitedAt.getTime() - started) / 3_600_000));
  return elapsedHours * reservation.pricePerHour;
}

// --- Double-booking -----------------------------------------------------
// One driver, one car: holding two parking spaces for the same hour is
// always a mistake, whichever lot, level or bay each one names. The old
// guard compared parking + level + bay and ignored time entirely, which
// blocked a legitimate later booking of the same bay while waving through
// two spaces booked for the same afternoon in different lots.

// A booking the customer still holds. Completed and cancelled ones are
// history and never stand in the way of a new booking.
export function isLiveReservation(reservation: Reservation) {
  return reservation.status === "reserved" || reservation.status === "active";
}

// The booking the customer already holds for one exact car park, if any.
// Matched on the stable parking id and on nothing else — not a name, not an
// address, not whichever lot happens to be nearest — so a booking at one lot
// can never suppress the «Bron qilish» on another. Lives here so there is
// one definition of "already booked", next to the one definition of "live".
export function findLiveReservationForParking(
  reservations: readonly Reservation[],
  parkingId: string | null | undefined,
) {
  if (!parkingId) return undefined;
  return reservations.find(
    (reservation) =>
      reservation.parkingId === parkingId && isLiveReservation(reservation),
  );
}

function msOf(value: string | number | Date) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

// Half-open intervals: a booking occupies [start, end), so one ending at
// 12:00 and the next starting at 12:00 do not overlap. Anything else that
// shares a moment does.
export function intervalsOverlap(
  aStart: string | number | Date,
  aEnd: string | number | Date,
  bStart: string | number | Date,
  bEnd: string | number | Date,
) {
  const starts = [msOf(aStart), msOf(bStart)];
  const ends = [msOf(aEnd), msOf(bEnd)];
  // An unparsable or inverted window cannot be reasoned about; treating it
  // as a clash would block booking outright, so it is ignored instead.
  if ([...starts, ...ends].some(Number.isNaN)) return false;
  if (starts[0] >= ends[0] || starts[1] >= ends[1]) return false;
  return starts[0] < ends[1] && starts[1] < ends[0];
}

// The live booking the customer already holds across this window, if any.
// The first match is enough — the message names one conflict, not a list.
export function findOverlappingReservation(
  reservations: readonly Reservation[],
  window: { startAt: string | number | Date; endAt: string | number | Date },
  options: { ignoreId?: string } = {},
) {
  return reservations.find(
    (reservation) =>
      reservation.id !== options.ignoreId &&
      isLiveReservation(reservation) &&
      intervalsOverlap(
        reservation.startAt,
        reservation.endAt,
        window.startAt,
        window.endAt,
      ),
  );
}
