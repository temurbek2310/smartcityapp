import type { Reservation } from "@/lib/types";

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
