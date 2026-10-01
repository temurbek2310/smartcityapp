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
// a queue ticket moving through the window, a queue ticket booked for later
// joining the line as its slot nears, and a table, film, clinic slot or event
// ticket ending once its time is over.
//
// Parking is deliberately absent from the time-based half. Its lifecycle is
// driven by physical events — entering and leaving the lot — and a booking
// whose hour has passed is still one the car may be about to enter.

// --- Live vs. history --------------------------------------------------------

const RESERVATION_LIVE: ReadonlySet<ReservationStatus> = new Set([
	'reserved',
	'active',
])

// scheduled — booked for a later slot; not in line yet. The clock moves it.
// waiting — in line, number not yet reached.
// called  — the number has come up; the customer should go to the window.
// arrived — the customer pressed «Men keldim»: checked in, not yet served.
// served  — the service itself has finished.
// cancelled — ended without service.
const QUEUE_LIVE: ReadonlySet<QueueTicketStatus> = new Set([
	'scheduled',
	'waiting',
	'called',
	'arrived',
])

// upcoming — booked, its start still ahead.
// active   — its start has come; the venue is being used.
const SERVICE_LIVE: ReadonlySet<ServiceBookingStatus> = new Set([
	'upcoming',
	'active',
])

export function isReservationLive(status: ReservationStatus) {
	return RESERVATION_LIVE.has(status)
}

export function isQueueTicketLive(status: QueueTicketStatus) {
	return QUEUE_LIVE.has(status)
}

export function isServiceBookingLive(status: ServiceBookingStatus) {
	return SERVICE_LIVE.has(status)
}

// How many bookings, across all three stores, the customer still holds.
// Logout reads this: with no backend to restore them, a live booking signed
// out of would be a parking QR, a queue ticket or a table gone for good.
export function liveBookingCount(
	state: Pick<BSpaceState, 'reservations' | 'queueTickets' | 'serviceBookings'>,
) {
	return (
		state.reservations.filter(item => isReservationLive(item.status)).length +
		state.queueTickets.filter(item => isQueueTicketLive(item.status)).length +
		state.serviceBookings.filter(item => isServiceBookingLive(item.status)).length
	)
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

// --- Scheduled queue tickets ---------------------------------------------------
// A ticket booked for a later slot waits outside the line until shortly before
// its time, then joins it as an ordinary waiting ticket — from there the
// window's own events move it, exactly like a ticket taken live.
//
// A slot that went by entirely while the app was closed never joins the line
// hours late: once its hold has run out too, it is a no-show and closes as
// cancelled. With the app open the ticket has already joined by then, so
// this only ever catches the stale case.

// How long before its slot a booked ticket joins the line.
export const QUEUE_CHECKIN_LEAD_MINUTES = 15
// How long after its slot a booked ticket that never joined is still honoured.
// The same five minutes a called number is held at the window.
export const QUEUE_NO_SHOW_MINUTES = 5
// The rate the queue is estimated at everywhere: three minutes a person.
export const QUEUE_MINUTES_PER_PERSON = 3

type ScheduledInput = Pick<QueueTicket, 'status' | 'scheduledAt'>

// Where a ticket stands at `now`. Only a scheduled ticket moves on the clock;
// every other status is driven by events and comes back unchanged. A
// scheduled ticket whose time cannot be read stays where it is rather than
// being moved on a guess — the customer can still cancel it.
export function queueTicketStatusAt(
	ticket: ScheduledInput,
	now: number,
): QueueTicketStatus {
	if (ticket.status !== 'scheduled') return ticket.status
	const start = instant(ticket.scheduledAt)
	if (start === null) return 'scheduled'
	if (now >= start + QUEUE_NO_SHOW_MINUTES * MINUTE) return 'cancelled'
	if (now >= start - QUEUE_CHECKIN_LEAD_MINUTES * MINUTE) return 'waiting'
	return 'scheduled'
}

// The ticket as it should stand at `now`, with everything the new status
// implies. Joining the line starts a fresh estimate — the people ahead are the
// minutes left to the slot at the usual rate, and the progress bar starts from
// there. Returns the ticket itself when nothing moved.
export function reconcileQueueTicket(ticket: QueueTicket, now: number): QueueTicket {
	const status = queueTicketStatusAt(ticket, now)
	if (status === ticket.status) return ticket
	if (status === 'cancelled') {
		return { ...ticket, status, closedAt: new Date(now).toISOString() }
	}
	const start = instant(ticket.scheduledAt) ?? now
	const minutesLeft = Math.max(0, Math.ceil((start - now) / MINUTE))
	const position = Math.max(1, Math.round(minutesLeft / QUEUE_MINUTES_PER_PERSON))
	const etaMinutes = position * QUEUE_MINUTES_PER_PERSON
	return {
		...ticket,
		status,
		position,
		initialPosition: position,
		etaMinutes,
		initialEtaMinutes: etaMinutes,
	}
}

// --- Service booking end ---------------------------------------------------

// MVP lifecycle defaults — how long after its start a booking is assumed to be
// over, used ONLY when the booking carries no end time or duration of its own.
// A table's duration is the customer's choice in the sheet; cinema, clinic and
// event have no catalog that knows a running time, so the sheet stores these
// for them. The table figure is also the sheet's pre-selected duration, and
// what a blob persisted before durations existed is read with.
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

// Where a booking stands at `now`, read off its own start and end:
//   before startAt           → upcoming
//   startAt ≤ now < end      → active
//   end ≤ now                → completed
// Cancelled and completed are final and come back unchanged. A legacy blob
// with no startAt has no start to wait for, so it reads as active until the
// end expectedEndAt() bounds it by.
export function serviceBookingStatusAt(
	booking: Pick<
		ServiceBooking,
		'kind' | 'status' | 'startAt' | 'createdAt' | 'endAt' | 'durationMinutes'
	>,
	now: number,
): ServiceBookingStatus {
	if (!isServiceBookingLive(booking.status)) return booking.status
	const end = expectedEndAt(booking)
	if (end !== null && now >= end) return 'completed'
	const start = instant(booking.startAt)
	return start !== null && now < start ? 'upcoming' : 'active'
}

// --- Reconciliation ----------------------------------------------------------
// Everything that changes status on the clock alone, applied in one pass. Run
// after hydration and on a slow interval while the app is open. Every function
// here returns its input by reference when nothing moved, so the caller can
// hand the result straight to setState and an idle tick writes nothing.

export function reconcileServiceBookings(
	bookings: ServiceBooking[],
	now: number,
): ServiceBooking[] {
	let changed = false
	const next = bookings.map(booking => {
		const status = serviceBookingStatusAt(booking, now)
		if (status === booking.status) return booking
		changed = true
		return { ...booking, status }
	})
	return changed ? next : bookings
}

export function reconcileQueueTickets(
	tickets: QueueTicket[],
	now: number,
): QueueTicket[] {
	let changed = false
	const next = tickets.map(ticket => {
		const moved = reconcileQueueTicket(ticket, now)
		if (moved !== ticket) changed = true
		return moved
	})
	return changed ? next : tickets
}

export function reconcileBookingLifecycles<
	S extends Pick<BSpaceState, 'serviceBookings'> &
		Partial<Pick<BSpaceState, 'queueTickets'>>,
>(state: S, now: number): S {
	// A blob from an older build may not have either key at all.
	const serviceBookings = Array.isArray(state.serviceBookings)
		? reconcileServiceBookings(state.serviceBookings, now)
		: state.serviceBookings
	const queueTickets = Array.isArray(state.queueTickets)
		? reconcileQueueTickets(state.queueTickets, now)
		: state.queueTickets
	return serviceBookings === state.serviceBookings &&
		queueTickets === state.queueTickets
		? state
		: { ...state, serviceBookings, queueTickets }
}
