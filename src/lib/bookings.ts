import { getParking } from '@/data/parkings'
import { getQueueOrg } from '@/data/queue-orgs'
import { formatDateTime, formatTime, formatUZS } from '@/lib/format'
import { destinationIdFrom } from '@/lib/navigation'
import { reservationHref } from '@/lib/reservation'
import { serviceWhenLabel } from '@/lib/service-slots'
import type {
	BookingKind,
	BSpaceState,
	QueueTicket,
	Reservation,
	ServiceBooking,
	ServiceBookingKind,
} from '@/lib/types'

// Three stores, one list. Parking reservations, queue tickets and the light
// service bookings each keep the shape their own screen needs; the Booking
// Center only ever wants the same eight fields, so the normalising happens
// here rather than in three branches of the page.

export type BookingRowStatus = 'active' | 'upcoming' | 'done' | 'cancelled'

export type BookingRow = {
	id: string
	kind: BookingKind
	title: string
	subtitle: string
	code: string
	whenLabel: string
	status: BookingRowStatus
	statusLabel: string
	// The detail screen this row summarises — where tapping the card goes.
	// Absent for the kinds that have no screen of their own; those open their
	// QR sheet instead.
	href?: string
	qrValue?: string
	amountLabel?: string
	// What a "Takrorlash" from history should reopen.
	repeat?: { kind: BookingKind; refId: string }
	// Where «Yo‘nalish» on this booking's detail goes, resolved through the
	// app's one destination model. Absent when the booking names something
	// the catalogs no longer contain — the detail then offers no directions
	// rather than routing to a stand-in.
	destinationId?: string
	// Whether cancelling this row actually cancels anything. These mirror the
	// guards the store itself applies, so a screen can no longer offer a
	// «Bekor» that calls a mutation the reducer will refuse — which is how an
	// active parking session came to report "Bron bekor qilindi" while its
	// timer kept running.
	cancellable: boolean
}

const STATUS_LABELS: Record<BookingRowStatus, string> = {
	active: 'Faol',
	upcoming: 'Kutilmoqda',
	done: 'Yakunlandi',
	cancelled: 'Bekor qilindi',
}

function row(partial: Omit<BookingRow, 'statusLabel'>): BookingRow {
	return { ...partial, statusLabel: STATUS_LABELS[partial.status] }
}

// Where a parking booking sits in the list's four states, and what to call
// it. Exported because /transport's destination-parking card has to name the
// same booking, and naming it a second way would mean the same reservation
// read «Kutilmoqda» in Bron and something else on the route screen.
export function reservationRowStatus(
	status: Reservation['status'],
): BookingRowStatus {
	if (status === 'active') return 'active'
	if (status === 'reserved') return 'upcoming'
	return status === 'completed' ? 'done' : 'cancelled'
}

export function reservationStatusLabel(status: Reservation['status']) {
	return STATUS_LABELS[reservationRowStatus(status)]
}

function fromReservation(reservation: Reservation): BookingRow {
	const parking = getParking(reservation.parkingId)
	const status = reservationRowStatus(reservation.status)

	return row({
		id: reservation.id,
		kind: 'parking',
		title: parking?.name ?? 'Parking',
		subtitle: `${reservation.durationHours} soat · ${formatTime(reservation.startAt)}–${formatTime(reservation.endAt)}`,
		// The full uuid is unreadable on a card; the tail is what a gate
		// operator would actually be read out.
		code: reservation.id.slice(-8).toUpperCase(),
		whenLabel: formatDateTime(reservation.startAt),
		status,
		// The same rule the reservation screen redirects by, so a card and a
		// deep link can never disagree about where a booking lives.
		href: reservationHref(reservation),
		amountLabel: formatUZS(reservation.finalTotal ?? reservation.estimatedTotal),
		repeat: { kind: 'parking', refId: reservation.parkingId },
		// The lot this booking is for, whatever its stage — an active session
		// still needs to be able to say how to get back to the car.
		destinationId:
			destinationIdFrom({ from: 'parking', parkingId: reservation.parkingId }) ??
			undefined,
		// app-context's cancelReservation() only mutates a 'reserved' booking.
		cancellable: reservation.status === 'reserved',
	})
}

function fromQueueTicket(ticket: QueueTicket): BookingRow {
	const org = getQueueOrg(ticket.orgId)
	const service = org?.services.find(item => item.id === ticket.serviceId)
	const status: BookingRowStatus =
		ticket.status === 'called'
			? 'active'
			: ticket.status === 'waiting'
				? 'upcoming'
				: ticket.status === 'served'
					? 'done'
					: 'cancelled'

	return row({
		id: ticket.id,
		kind: 'queue',
		title: org?.title ?? 'Navbat',
		subtitle:
			ticket.status === 'called'
				? `${service?.title ?? 'Xizmat'} · ${ticket.windowNumber}-oyna`
				: `${service?.title ?? 'Xizmat'} · oldingizda ${ticket.position}`,
		code: ticket.number,
		whenLabel:
			ticket.status === 'called'
				? 'Sizni chaqirishmoqda'
				: ticket.status === 'waiting'
					? `taxminan ${ticket.etaMinutes} daqiqa`
					: formatDateTime(ticket.closedAt ?? ticket.createdAt),
		status,
		// The ticket's own page, the same way a parking booking has one. It
		// used to point at /queues, which is the organisation's screen rather
		// than this booking's — and the ticket's only real detail view was a
		// QR modal in the list.
		href: `/booking/${ticket.id}`,
		qrValue: `BSPACE:QUEUE:${ticket.id}`,
		repeat: { kind: 'queue', refId: ticket.orgId },
		// The venue the number was taken at, not the car park beside it.
		destinationId:
			destinationIdFrom({ from: 'queueOrg', orgId: ticket.orgId }) ?? undefined,
		// closeQueueTicket() accepts both of the live statuses.
		cancellable: ticket.status === 'waiting' || ticket.status === 'called',
	})
}

function fromServiceBooking(booking: ServiceBooking): BookingRow {
	return row({
		id: booking.id,
		kind: booking.kind,
		title: booking.title,
		subtitle: booking.subtitle,
		code: booking.code,
		// The stored instant wins over the stored label: a booking made for
		// tomorrow has to read as tomorrow here, and as "Bugun" once tomorrow
		// comes. Bookings persisted before startAt existed keep their label.
		whenLabel: booking.startAt
			? serviceWhenLabel(booking.startAt)
			: booking.whenLabel,
		status:
			booking.status === 'active'
				? 'active'
				: booking.status === 'completed'
					? 'done'
					: 'cancelled',
		// A table, a film, a clinic slot and an event ticket each get the same
		// full detail page every other booking has.
		href: `/booking/${booking.id}`,
		qrValue: `BSPACE:${booking.kind.toUpperCase()}:${booking.code}`,
		repeat: { kind: booking.kind, refId: booking.refId },
		// The restaurant, cinema or clinic the booking was made at, read back
		// from the refId the sheet stored. A booking whose venue has since
		// left the catalog resolves to nothing and simply offers no route.
		destinationId:
			destinationIdFrom({ from: 'serviceBooking', refId: booking.refId }) ??
			undefined,
		// cancelServiceBooking() only mutates an 'active' booking.
		cancellable: booking.status === 'active',
	})
}

export function bookingRows(
	state: Pick<BSpaceState, 'reservations' | 'queueTickets' | 'serviceBookings'>,
) {
	const rows = [
		...state.reservations.map(fromReservation),
		...state.queueTickets.map(fromQueueTicket),
		...state.serviceBookings.map(fromServiceBooking),
	]

	// Live things first, then what has not started, then the rest — the order
	// someone opening this screen is actually asking about.
	const weight: Record<BookingRowStatus, number> = {
		active: 0,
		upcoming: 1,
		done: 2,
		cancelled: 3,
	}
	return rows.sort((a, b) => weight[a.status] - weight[b.status])
}

export function isOpen(row: BookingRow) {
	return row.status === 'active' || row.status === 'upcoming'
}

// --- The other direction -------------------------------------------------
// What a booking sheet hands the store. It lives next to the row mapping
// above because the two are one round trip: the sheet's choice has to survive
// into the Booking Center, and the half that lost it was this one — the sheet
// wrote «Bugun, 12:30» into a label and kept no record of which venue, day or
// time the customer had actually picked.

export type ServiceBookingDraft = {
	kind: ServiceBookingKind
	// The venue the sheet was opened on, carried through untouched. Nothing
	// here defaults to a restaurant; a booking with no venue is not a booking.
	refId: string
	title: string
	subtitle: string
	whenLabel: string
	startAt: string
}

export function serviceBookingDraft(input: {
	kind: ServiceBookingKind
	refId: string
	title: string
	count: number
	unit: string
	startAt: Date
	now?: string | number | Date
}): ServiceBookingDraft {
	const time = formatTime(input.startAt)
	return {
		kind: input.kind,
		refId: input.refId,
		title: input.title,
		subtitle: `${input.count} ${input.unit} · ${time}`,
		whenLabel: serviceWhenLabel(input.startAt, input.now),
		startAt: input.startAt.toISOString(),
	}
}
