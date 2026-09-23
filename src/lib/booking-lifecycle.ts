import type {
	BSpaceState,
	QueueTicket,
	QueueTicketStatus,
	ReservationStatus,
	ServiceBooking,
	ServiceBookingKind,
	ServiceBookingStatus,
} from '@/lib/types'

// What each booking status means, and when a booking stops being live.
//
// The Booking Center, the queue screen, the detail pages and the store all
// used to spell their own "is this still going?" list. They live here now,
// together with the only transitions that are not a direct customer action:
// a queue ticket moving through the window, and a table, film, clinic slot or
// event ticket ending once its time is over.
//
// Parking is deliberately absent from the time-based half. Its lifecycle is
// driven by physical events — entering and leaving the lot — and a booking
// whose hour has passed is still one the car may be about to enter.

// --- Live vs. history --------------------------------------------------------

const RESERVATION_LIVE: ReadonlySet<ReservationStatus> = new Set([
	'reserved',
	'active',
])

// waiting — in line, number not yet reached.
// called  — the number has come up; the customer should go to the window.
// arrived — the customer pressed «Men keldim»: checked in, not yet served.
// served  — the service itself has finished.
// cancelled — ended without service.
const QUEUE_LIVE: ReadonlySet<QueueTicketStatus> = new Set([
	'waiting',
	'called',
	'arrived',
])

const SERVICE_LIVE: ReadonlySet<ServiceBookingStatus> = new Set(['active'])

export function isReservationLive(status: ReservationStatus) {
	return RESERVATION_LIVE.has(status)
}

export function isQueueTicketLive(status: QueueTicketStatus) {
	return QUEUE_LIVE.has(status)
}

export function isServiceBookingLive(status: ServiceBookingStatus) {
	return SERVICE_LIVE.has(status)
}

// --- Queue transitions -----------------------------------------------------
// Pure, so the store and the tests run the same rule. Each returns the ticket
// untouched when the move does not apply, which is what lets the store skip a
// write — and a notification — for a tap that changed nothing.

// «Men keldim»: the customer is at the window. It checks them in; it does not
// claim the service is over.
export function arriveQueueTicket(ticket: QueueTicket): QueueTicket {
	return ticket.status === 'called' ? { ...ticket, status: 'arrived' } : ticket
}

// The service finished. Only a checked-in customer can have been served.
export function serveQueueTicket(ticket: QueueTicket, now: Date): QueueTicket {
	return ticket.status === 'arrived'
		? { ...ticket, status: 'served', closedAt: now.toISOString() }
		: ticket
}

export function cancelQueueTicket(ticket: QueueTicket, now: Date): QueueTicket {
	return isQueueTicketLive(ticket.status)
		? { ...ticket, status: 'cancelled', closedAt: now.toISOString() }
		: ticket
}

// --- Service booking end ---------------------------------------------------

// MVP lifecycle defaults — how long after its start a booking is assumed to be
// over, used ONLY when the booking carries no end time or duration of its own.
// No catalog in this app knows a film's running time, an appointment's length
// or when an event finishes, so without these a booking would sit in «Faol»
// forever. They decide when a booking moves to history and nothing else: they
// are never shown to the customer as a duration.
export const FALLBACK_TABLE_MINUTES = 120
export const FALLBACK_CLINIC_MINUTES = 60
export const FALLBACK_CINEMA_MINUTES = 180
export const FALLBACK_EVENT_MINUTES = 240

export const FALLBACK_SERVICE_DURATION_MINUTES: Record<
	ServiceBookingKind,
	number
> = {
	table: FALLBACK_TABLE_MINUTES,
	clinic: FALLBACK_CLINIC_MINUTES,
	cinema: FALLBACK_CINEMA_MINUTES,
	event: FALLBACK_EVENT_MINUTES,
}

// Bookings persisted before startAt existed carry only createdAt. The sheet
// of that era offered today's slots alone, so the booked time fell on the day
// it was made — at most a day after createdAt. Adding that day on top of the
// kind's duration can only ever finish such a booking late, never early.
const LEGACY_START_UNKNOWN_MS = 24 * 60 * 60_000

const MINUTE = 60_000

function instant(value: string | undefined) {
	if (!value) return null
	const ms = Date.parse(value)
	return Number.isNaN(ms) ? null : ms
}

type EndInput = Pick<
	ServiceBooking,
	'kind' | 'startAt' | 'createdAt' | 'endAt' | 'durationMinutes'
>

// When a service booking is over, as an epoch ms. Priority:
//   1. an explicit stored end time;
//   2. a stored duration from the start;
//   3. the kind's fallback duration from the start.
// Stored instants are read exactly as persisted — no timezone is re-applied.
// Null when there is nothing to anchor on, and such a booking is never
// completed by time.
export function expectedEndAt(booking: EndInput): number | null {
	const explicit = instant(booking.endAt)
	if (explicit !== null) return explicit

	const start = instant(booking.startAt)
	if (start !== null) {
		const minutes =
			typeof booking.durationMinutes === 'number' &&
			Number.isFinite(booking.durationMinutes) &&
			booking.durationMinutes > 0
				? booking.durationMinutes
				: FALLBACK_SERVICE_DURATION_MINUTES[booking.kind]
		return start + minutes * MINUTE
	}

	const created = instant(booking.createdAt)
	if (created === null) return null
	return (
		created +
		LEGACY_START_UNKNOWN_MS +
		FALLBACK_SERVICE_DURATION_MINUTES[booking.kind] * MINUTE
	)
}

export function isServiceBookingOver(booking: ServiceBooking, now: number) {
	if (!isServiceBookingLive(booking.status)) return false
	const end = expectedEndAt(booking)
	return end !== null && now >= end
}

// --- Reconciliation ----------------------------------------------------------
// Everything that changes status on the clock alone, applied in one pass. Run
// after hydration and on a slow interval while the app is open. Both functions
// return their input by reference when nothing moved, so the caller can hand
// the result straight to setState and an idle tick writes nothing.

export function reconcileServiceBookings(
	bookings: ServiceBooking[],
	now: number,
): ServiceBooking[] {
	let changed = false
	const next = bookings.map(booking => {
		if (!isServiceBookingOver(booking, now)) return booking
		changed = true
		return { ...booking, status: 'completed' as const }
	})
	return changed ? next : bookings
}

export function reconcileBookingLifecycles<
	S extends Pick<BSpaceState, 'serviceBookings'>,
>(state: S, now: number): S {
	// A blob from an older build may not have the key at all.
	if (!Array.isArray(state.serviceBookings)) return state
	const serviceBookings = reconcileServiceBookings(state.serviceBookings, now)
	return serviceBookings === state.serviceBookings
		? state
		: { ...state, serviceBookings }
}
