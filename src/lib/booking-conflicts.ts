import {
	expectedEndAt,
	isQueueTicketLive,
	isServiceBookingLive,
} from '@/lib/booking-lifecycle'
import { intervalsOverlap } from '@/lib/reservation'
import type {
	QueueTicket,
	ServiceBooking,
	ServiceBookingKind,
} from '@/lib/types'

// "You already have this one." The rule every creation path shares, so a
// booking cannot be duplicated by coming at it from a different screen, a
// stale sheet, or two taps before a re-render.
//
// It is deliberately NOT a personal calendar. A table at Coffee Lab and a
// table at Basilic at the same hour are two different bookings; only the
// same bookable target is compared. Parking keeps its own, broader rule in
// lib/reservation (one car, one space at a time, across every lot) and is
// not routed through here.
//
// Identity is built from stored stable ids only — never a title, a label, an
// address or a formatted date. What a ServiceBooking actually persists is
// kind + refId (the venue's place id) + startAt; there is no film, session,
// doctor or clinic-service id to be more precise with, so none is invented.

// --- Service bookings --------------------------------------------------------

type ServiceTarget = Pick<ServiceBooking, 'kind' | 'refId'>

// The same venue booked for the same kind of thing. An empty refId matches
// nothing: a record that names no venue cannot be the venue asked for.
export function sameServiceBookingTarget(a: ServiceTarget, b: ServiceTarget) {
	return Boolean(a.refId) && a.kind === b.kind && a.refId === b.refId
}

// How two bookings for the same target clash.
//   overlap — the venue is held for a span: a table, a clinic slot. Any
//             overlap of [start, end) is the same booking twice.
//   session — the booking is for one showing that starts at a fixed moment:
//             a film, an event. Only the same start is a duplicate; a later
//             showing is a different ticket even while the fallback duration
//             of the first would still be running.
export const SERVICE_CONFLICT_MODE: Record<
	ServiceBookingKind,
	'overlap' | 'session'
> = {
	table: 'overlap',
	clinic: 'overlap',
	cinema: 'session',
	event: 'session',
}

type IntervalInput = Pick<
	ServiceBooking,
	'kind' | 'startAt' | 'endAt' | 'durationMinutes'
>

// The span a booking holds, as epoch ms, or null when it cannot be placed in
// time. The end is lifecycle's expectedEndAt() — stored end, then stored
// duration, then the kind's fallback — so "how long does a table last" has
// one answer for both history and conflicts.
//
// A booking without a usable startAt yields null. Those are blobs persisted
// before startAt existed: their real time is unknown (lifecycle only bounds it
// to "within a day of createdAt"), and guessing would risk blocking a
// legitimate booking on the strength of a made-up hour. They are left out of
// conflict checks rather than treated as clashing.
export function serviceBookingInterval(booking: IntervalInput) {
	const start = booking.startAt ? Date.parse(booking.startAt) : Number.NaN
	if (Number.isNaN(start)) return null
	// createdAt only matters to expectedEndAt() when startAt is missing, which
	// has already been ruled out above.
	const end = expectedEndAt({ ...booking, createdAt: '' })
	if (end === null || end <= start) return null
	return { start, end }
}

export type ServiceBookingRequest = ServiceTarget & IntervalInput

// The live booking that makes this request a duplicate, if any. Cancelled
// and completed bookings are history and never stand in the way.
export function findConflictingServiceBooking(
	bookings: readonly ServiceBooking[],
	request: ServiceBookingRequest,
): ServiceBooking | undefined {
	const wanted = serviceBookingInterval(request)
	if (!wanted) return undefined
	const mode = SERVICE_CONFLICT_MODE[request.kind]

	return bookings.find(booking => {
		if (!isServiceBookingLive(booking.status)) return false
		if (!sameServiceBookingTarget(booking, request)) return false
		const held = serviceBookingInterval(booking)
		if (!held) return false
		return mode === 'session'
			? held.start === wanted.start
			: intervalsOverlap(held.start, held.end, wanted.start, wanted.end)
	})
}

// What the customer is told, per kind.
export const SERVICE_CONFLICT_MESSAGE: Record<ServiceBookingKind, string> = {
	table: 'Bu vaqtda ushbu restoranda broningiz mavjud',
	clinic: 'Bu vaqt uchun faol broningiz mavjud',
	cinema: 'Bu seans uchun broningiz mavjud',
	event: 'Bu tadbir uchun broningiz mavjud',
}

// --- Queue tickets -----------------------------------------------------------
// A queue is not scheduled: there is no interval, only "am I already in this
// line". One live ticket (waiting, called or arrived) per organisation and
// service; served and cancelled free the line up again. Two different
// services at the same organisation are two different lines.

type QueueTarget = { orgId: string; serviceId?: string }

// The live ticket for this line, if any. Without a serviceId it answers "any
// live ticket at this organisation", which is what an organisation-level
// screen shows.
export function findLiveQueueTicket(
	tickets: readonly QueueTicket[],
	target: QueueTarget,
): QueueTicket | undefined {
	if (!target.orgId) return undefined
	return tickets.find(
		ticket =>
			isQueueTicketLive(ticket.status) &&
			ticket.orgId === target.orgId &&
			(target.serviceId === undefined || ticket.serviceId === target.serviceId),
	)
}

export const QUEUE_CONFLICT_MESSAGE = 'Bu navbatda faol chiptangiz mavjud'

// --- Mutation result ---------------------------------------------------------
// What a creating mutation hands back. A clash is an expected answer, not an
// error, so it is a value the caller branches on rather than an exception.

export type BookingAttempt<T> =
	{ ok: true; created: T } | { ok: false; reason: 'conflict'; existing: T }
