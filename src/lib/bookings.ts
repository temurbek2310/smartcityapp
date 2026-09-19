import { getParking } from '@/data/parkings'
import { getQueueOrg } from '@/data/queue-orgs'
import { formatDateTime, formatTime, formatUZS } from '@/lib/format'
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
	// Where "Ochish" goes. Absent when the booking opens a QR sheet instead.
	href?: string
	qrValue?: string
	amountLabel?: string
	// What a "Takrorlash" from history should reopen.
	repeat?: { kind: BookingKind; refId: string }
	// Whether cancelling this row actually cancels anything. These mirror the
	// guards the store itself applies, so a screen can no longer offer a
	// «Bekor» that calls a mutation the reducer will refuse — which is how an
	// active parking session came to report "Bron bekor qilindi" while its
	// timer kept running.
	cancellable: boolean
	// How an open booking that cannot be cancelled is ended instead. A parking
	// session the driver has already entered is closed by leaving the lot, not
	// by cancelling a reservation that has already been honoured.
	exitHref?: string
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

function fromReservation(reservation: Reservation): BookingRow {
	const parking = getParking(reservation.parkingId)
	const status: BookingRowStatus =
		reservation.status === 'active'
			? 'active'
			: reservation.status === 'reserved'
				? 'upcoming'
				: reservation.status === 'completed'
					? 'done'
					: 'cancelled'

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
		href:
			reservation.status === 'active'
				? `/session/${reservation.id}`
				: reservation.status === 'completed'
					? `/receipt/${reservation.id}`
					: `/reservation/${reservation.id}`,
		amountLabel: formatUZS(reservation.finalTotal ?? reservation.estimatedTotal),
		repeat: { kind: 'parking', refId: reservation.parkingId },
		// app-context's cancelReservation() only mutates a 'reserved' booking.
		cancellable: reservation.status === 'reserved',
		// Already inside: the way out is the exit QR on the session screen.
		exitHref:
			reservation.status === 'active'
				? `/session/${reservation.id}?exit=1`
				: undefined,
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
		// The organisation, not the bare screen: /queues opens on QUEUE_ORGS[0]
		// otherwise, so a ticket taken anywhere else led to someone else's queue.
		href: `/queues?org=${ticket.orgId}`,
		qrValue: `BSPACE:QUEUE:${ticket.id}`,
		repeat: { kind: 'queue', refId: ticket.orgId },
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
		qrValue: `BSPACE:${booking.kind.toUpperCase()}:${booking.code}`,
		repeat: { kind: booking.kind, refId: booking.refId },
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
