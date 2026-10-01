import { getParking } from '@/data/parkings'
import { getPlace } from '@/data/places'
import { firstFreeBay } from '@/lib/bay-map'
import { expectedEndAt } from '@/lib/booking-lifecycle'
import { findOverlappingReservation } from '@/lib/reservation'
import type { Parking, Reservation, ServiceBooking } from '@/lib/types'

// A table, then the space beside it — the booking this app exists to make.
//
// The parking reservation is not chosen again: it is read off the table the
// customer has just booked. Same start, same end, the lot the restaurant
// names in the catalog, and the bay the parking sheet itself would have
// pre-selected. Pure, so the success view and the tests run the same rule.

const HOUR = 3_600_000

export type TableParkingHandoff = {
	parking: Parking
	// What the store's reservation mutation takes, inherited from the table.
	startAt: string
	endAt: string
	durationHours: number
	pricePerHour: number
	estimatedTotal: number
	// Null when no level has a bay left to give.
	bay: string | null
	level: number
	// The customer's own live parking booking across this window, if any.
	// One car, one space: the store would refuse the handoff anyway.
	conflict: Reservation | undefined
}

type HandoffBooking = Pick<
	ServiceBooking,
	'kind' | 'refId' | 'startAt' | 'endAt' | 'durationMinutes' | 'createdAt'
>

// Null when there is nothing to hand off: not a table, a venue that names
// no lot, or a booking with no start or end to inherit.
export function tableParkingHandoff(
	booking: HandoffBooking,
	reservations: readonly Reservation[],
	options: { excludeBays?: readonly string[] } = {},
): TableParkingHandoff | null {
	if (booking.kind !== 'table' || !booking.startAt) return null
	const place = getPlace(booking.refId)
	const parking = place?.parkingId ? getParking(place.parkingId) : undefined
	if (!parking) return null

	const start = Date.parse(booking.startAt)
	const end = expectedEndAt(booking)
	if (Number.isNaN(start) || end === null || end <= start) return null

	// The first level with a bay, picked the way the parking sheet picks
	// its default, and never a bay the customer already holds.
	let bay: string | null = null
	let level = 1
	for (let candidate = 1; candidate <= parking.levels; candidate += 1) {
		bay = firstFreeBay(parking, candidate, options.excludeBays)
		if (bay) {
			level = candidate
			break
		}
	}

	const durationHours = (end - start) / HOUR
	return {
		parking,
		startAt: new Date(start).toISOString(),
		endAt: new Date(end).toISOString(),
		durationHours,
		pricePerHour: parking.pricePerHour,
		estimatedTotal: durationHours * parking.pricePerHour,
		bay: parking.availableSpaces > 0 ? bay : null,
		level,
		conflict: findOverlappingReservation(reservations, {
			startAt: start,
			endAt: end,
		}),
	}
}
