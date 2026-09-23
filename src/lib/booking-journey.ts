import type {
	QueueTicket,
	Reservation,
	ServiceBooking,
	ServiceBookingKind,
} from '@/lib/types'

// «What should I do next?» — answered once, for every booking detail page.
//
// Each page used to hardcode its own button row, so a parking booking two
// hours away offered «Kirishni boshlash» as loudly as it would at the gate,
// and every service booking led with «Yo‘nalish» even while the customer was
// standing at the counter. The rules live here instead; the pages only draw
// whichever action this names as primary, and the rest as secondary.
//
// The stage is derived, never stored. It is recomputed from the booking's
// persisted status, its persisted start instant and the current time, so a
// refresh — or a page left open across the threshold — lands on the same
// answer without anything new in localStorage.

// How long before a booking's start the customer counts as arriving. One
// value for every kind, so parking, a table and a film all tip over together.
export const ARRIVAL_WINDOW_MINUTES = 30
export const ARRIVAL_WINDOW_MS = ARRIVAL_WINDOW_MINUTES * 60_000

export type JourneyStage =
	| 'upcoming'
	| 'arrival'
	| 'active'
	| 'completed'
	| 'cancelled'

// Every action a booking detail page can offer. Only the ones a page already
// had a working handler for — nothing here is a new mutation.
export type BookingActionId =
	| 'directions' // «Yo‘nalish» → /transport
	| 'enter' // parking: enterReservation()
	| 'exit' // parking: the exit QR sheet
	| 'extend' // parking: extendReservation(+1h)
	| 'receipt' // parking: the finished booking's receipt
	| 'present' // service booking: its QR, large, for staff
	| 'arrived' // queue: «Men keldim» — arriveQueueTicket(), called → arrived
	| 'track' // queue: the organisation's live queue
	| 'share'
	| 'cancel'

// Share and cancel stay reachable, but they are never what the customer is
// on the page to do, so they are never promoted.
const PRIMARY_ELIGIBLE: ReadonlySet<BookingActionId> = new Set([
	'directions',
	'enter',
	'exit',
	'extend',
	'receipt',
	'present',
	'arrived',
	'track',
])

export type BookingJourney = {
	stage: JourneyStage
	// Null when nothing operational is left — a cancelled booking, say.
	primary: BookingActionId | null
	// In display order. Never contains the primary.
	secondary: BookingActionId[]
	// What the stage was read from: a real start time, or only the status
	// because the booking has no usable timestamp (or the clock has not
	// ticked yet on the first render).
	basis: 'time' | 'status'
}

export const ACTION_LABELS: Record<
	Exclude<BookingActionId, 'present'>,
	string
> = {
	directions: 'Yo‘nalish',
	enter: 'Parkingga kirish',
	exit: 'Parkingdan chiqish',
	extend: '+1 soat',
	receipt: 'Chekni ko‘rish',
	arrived: 'Men keldim',
	track: 'Navbatni kuzatish',
	share: 'Ulashish',
	cancel: 'Bronni bekor qilish',
}

// A film or an event is a ticket; a table or a clinic slot is a booking.
const PRESENT_LABELS: Record<ServiceBookingKind, string> = {
	table: 'Bronni ko‘rsatish',
	clinic: 'Bronni ko‘rsatish',
	cinema: 'Chiptani ko‘rsatish',
	event: 'Chiptani ko‘rsatish',
}

export function presentActionLabel(kind: ServiceBookingKind) {
	return PRESENT_LABELS[kind]
}

// Before the window, or inside it. Null when either instant cannot be read —
// callers fall back to the status alone rather than guess a time. The window
// stays open past the start itself: a customer ten minutes late is still
// arriving, and closing it is the lifecycle's job, not this helper's.
export function arrivalStage(
	startAt: string | undefined,
	now: number | null,
): 'upcoming' | 'arrival' | null {
	if (!startAt || now === null || !Number.isFinite(now)) return null
	const start = Date.parse(startAt)
	if (Number.isNaN(start)) return null
	return now >= start - ARRIVAL_WINDOW_MS ? 'arrival' : 'upcoming'
}

type Availability = {
	// Whether «Yo‘nalish» resolves anywhere. A booking whose venue left the
	// catalog offers no directions rather than a stand-in.
	hasDestination: boolean
}

function journey(
	stage: JourneyStage,
	basis: BookingJourney['basis'],
	ordered: BookingActionId[],
	{ hasDestination }: Availability,
): BookingJourney {
	const actions = ordered.filter(
		action => action !== 'directions' || hasDestination,
	)
	const primary =
		actions[0] && PRIMARY_ELIGIBLE.has(actions[0]) ? actions[0] : null
	return {
		stage,
		primary,
		secondary: primary ? actions.slice(1) : actions,
		basis,
	}
}

// --- Parking --------------------------------------------------------------
// The one booking with a real entry and exit. Early entry stays possible —
// enterReservation() deliberately meters an early arrival from the moment
// the car is inside — it is only not the headline until the window opens.
export function reservationJourney(
	reservation: Pick<Reservation, 'status' | 'startAt'>,
	now: number | null,
	availability: Availability,
): BookingJourney {
	switch (reservation.status) {
		case 'reserved': {
			const timed = arrivalStage(reservation.startAt, now)
			const stage = timed ?? 'upcoming'
			return journey(
				stage,
				timed ? 'time' : 'status',
				stage === 'arrival'
					? ['enter', 'directions', 'share', 'cancel']
					: ['directions', 'enter', 'share', 'cancel'],
				availability,
			)
		}
		case 'active':
			// The way back to the car still matters while it is parked.
			return journey(
				'active',
				'status',
				['exit', 'extend', 'directions', 'share'],
				availability,
			)
		case 'completed':
			return journey('completed', 'status', ['receipt'], availability)
		case 'cancelled':
			return journey('cancelled', 'status', [], availability)
	}
}

// --- Table, cinema, clinic, event -----------------------------------------
// No check-in exists for these yet, so arriving means showing the code the
// staff will scan. A booking persisted before startAt existed has no time to
// read and simply keeps «Yo‘nalish» first.
export function serviceBookingJourney(
	booking: Pick<ServiceBooking, 'status' | 'startAt'>,
	now: number | null,
	availability: Availability,
): BookingJourney {
	if (booking.status === 'cancelled') {
		return journey('cancelled', 'status', ['share'], availability)
	}
	if (booking.status === 'completed') {
		return journey('completed', 'status', ['share'], availability)
	}
	const timed = arrivalStage(booking.startAt, now)
	const stage = timed ?? 'upcoming'
	return journey(
		stage,
		timed ? 'time' : 'status',
		stage === 'arrival'
			? ['present', 'directions', 'share', 'cancel']
			: ['directions', 'present', 'share', 'cancel'],
		availability,
	)
}

// --- Queue ---------------------------------------------------------------
// A ticket has no start time; its clock is the estimate of when the number
// comes up. The same window applies to it: far off, the customer still has
// to get there; close, they are watching the line; called, «Men keldim»
// checks them in; arrived, they are at the window and follow the queue until
// the service is done. Only served and cancelled are over.
export function queueTicketJourney(
	ticket: Pick<QueueTicket, 'status' | 'etaMinutes'>,
	availability: Availability,
): BookingJourney {
	switch (ticket.status) {
		case 'waiting': {
			const known = Number.isFinite(ticket.etaMinutes)
			const stage =
				known && ticket.etaMinutes <= ARRIVAL_WINDOW_MINUTES
					? 'arrival'
					: 'upcoming'
			return journey(
				stage,
				known ? 'time' : 'status',
				stage === 'arrival'
					? ['track', 'directions', 'share', 'cancel']
					: ['directions', 'track', 'share', 'cancel'],
				availability,
			)
		}
		case 'called':
			return journey(
				'active',
				'status',
				['arrived', 'directions', 'track', 'share', 'cancel'],
				availability,
			)
		// Already standing at the window: no route left to take, and nothing
		// to press but keep an eye on the line.
		case 'arrived':
			return journey(
				'active',
				'status',
				['track', 'share', 'cancel'],
				availability,
			)
		case 'served':
			return journey('completed', 'status', ['share'], availability)
		case 'cancelled':
			return journey('cancelled', 'status', ['share'], availability)
	}
}
