import type { QueueTicket, Reservation, ServiceBooking } from '@/lib/types'

// --- What a booking's QR says -------------------------------------------
// One machine format for every booking family, and the only place it is
// spelled:
//
//   SMARTCITY:v1:<type>:<id>
//
// The QR is identity and nothing else. It names which booking object this
// is by its stable stored id — never a display code, a bay, a title or an
// address, and nothing about the customer (name, phone, plate, payment).
// Whoever scans it looks the booking up and reads everything else from
// there, so the same booking draws the same QR on every render, after every
// refresh and at every stage of its lifecycle.
//
// The type is the store the id lives in, not the booking's kind: a table,
// a film, a clinic slot and an event are all one ServiceBooking, and the
// resolved booking says which. Parking's entry and exit share one payload
// for the same reason — the reservation's status says which gate it is at.
//
// The human-facing code on screen (Bron kodi, Navbat raqami) is a separate
// thing, below. The two are never derived from each other.

export const BOOKING_QR_PREFIX = 'SMARTCITY'
export const BOOKING_QR_VERSION = 'v1'

export type BookingQrType = 'reservation' | 'queue' | 'booking'

export type BookingQrTarget = { type: BookingQrType; id: string }

export type ParsedBookingQr = BookingQrTarget & {
	version: typeof BOOKING_QR_VERSION
}

const QR_TYPES: readonly BookingQrType[] = ['reservation', 'queue', 'booking']

// What every store's ids look like — uid() writes `<prefix>-<uuid>`. The
// separator is excluded so an id can never smuggle in a fifth segment.
const ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

function isQrType(value: string): value is BookingQrType {
	return (QR_TYPES as readonly string[]).includes(value)
}

// Null for an id that could not round-trip through the parser — a blob from
// another build, say. The screen then draws no QR rather than one that
// resolves to nothing; it never falls back to a stand-in value.
export function bookingQrPayload({ type, id }: BookingQrTarget): string | null {
	if (!isQrType(type) || typeof id !== 'string' || !ID_PATTERN.test(id)) {
		return null
	}
	return `${BOOKING_QR_PREFIX}:${BOOKING_QR_VERSION}:${type}:${id}`
}

export function reservationQrPayload(reservation: Pick<Reservation, 'id'>) {
	return bookingQrPayload({ type: 'reservation', id: reservation.id })
}

export function queueTicketQrPayload(ticket: Pick<QueueTicket, 'id'>) {
	return bookingQrPayload({ type: 'queue', id: ticket.id })
}

export function serviceBookingQrPayload(booking: Pick<ServiceBooking, 'id'>) {
	return bookingQrPayload({ type: 'booking', id: booking.id })
}

// The contract a scanner will hold the app to. Anything that is not exactly
// a v1 SmartCity payload is null — a scan of someone else's QR is a normal
// event, not an error. An unknown version is refused rather than guessed at,
// so v2 can change the layout without v1 readers misreading it.
export function parseBookingQrPayload(payload: unknown): ParsedBookingQr | null {
	if (typeof payload !== 'string') return null
	// Scanners commonly hand back a trailing newline.
	const parts = payload.trim().split(':')
	if (parts.length !== 4) return null

	const [prefix, version, type, id] = parts
	if (prefix !== BOOKING_QR_PREFIX) return null
	if (version !== BOOKING_QR_VERSION) return null
	if (!isQrType(type)) return null
	if (!ID_PATTERN.test(id)) return null

	return { version, type, id }
}

// --- What a person reads ------------------------------------------------
// The reference printed beside the QR and on the Bron card, for someone to
// read out or type. Each family keeps the concept it already has; nothing
// is invented to make them look alike.

export type BookingReference = { label: string; value: string }

// Parking stores no code of its own. The tail of its id is what the card,
// the banner and the session have always shown — stable, because the id is.
export function reservationReference(
	reservation: Pick<Reservation, 'id'>,
): BookingReference {
	return { label: 'Bron kodi', value: reservation.id.slice(-8).toUpperCase() }
}

// The printed number, e.g. "A-14" — what the window calls out.
export function queueTicketReference(
	ticket: Pick<QueueTicket, 'number'>,
): BookingReference {
	return { label: 'Navbat raqami', value: ticket.number }
}

// The code written when the booking was made, exactly as stored. It is
// random and only ever read by people, so it is never the machine key.
export function serviceBookingReference(
	booking: Pick<ServiceBooking, 'code'>,
): BookingReference {
	return { label: 'Bron kodi', value: booking.code }
}
