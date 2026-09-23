import { getParking } from '@/data/parkings'
import { estimateMinutesForMode } from '@/lib/eta'
import { distanceKm } from '@/lib/geo'
import { findLiveReservationForParking } from '@/lib/reservation'
import { nearestParking, type RouteEndpoint } from '@/lib/route-endpoints'
import type { TransportMode } from '@/lib/transport'
import type { Parking, Reservation } from '@/lib/types'

// Somewhere to leave the car once you arrive — and only that. The Transport
// screen used to head this «Manzildagi parkovka» whatever the destination
// was, so a route to Coffee Lab showed Amir Temur Square Parking's occupancy
// under a heading that read as if the car park were the destination.
//
// It is now one of two things, and says which:
//   · 'nearby'      — the destination is a café, a clinic, a queue desk…
//                     and this is a car park near it. Optional context.
//   · 'destination' — the destination *is* this car park. Not a
//                     recommendation at all, so it is never called one.
// Anything else — arriving by metro, on a scooter or on foot — needs no car
// park, and there is nothing honest to show.

export const NEARBY_PARKING_LABEL = 'Manzilga yaqin parking'
export const DESTINATION_PARKING_LABEL = 'Manzil parkingi'

// Closer than this and it is not "near" the destination, it *is* the
// destination: a saved landmark with no coordinates of its own resolves to
// its car park's, and recommending that lot would be recommending the place
// the customer already chose.
const SAME_PLACE_KM = 0.03

// How far a *derived* lot may sit from the destination before it stops being
// somewhere you would walk from — roughly twenty minutes on foot. It only
// applies to the nearest-lot fallback: a parking the catalog deliberately
// pairs with a venue is curated, and is trusted at whatever distance.
const NEAREST_FALLBACK_MAX_KM = 1.5

export type DestinationParking = {
	kind: 'nearby' | 'destination'
	// The heading every mention of this car park on /transport uses, so the
	// summary row, the card and the notice can never word it differently.
	label: string
	parking: Parking
	// Straight-line from the destination to the lot, and the app's own
	// walking estimate for it. Both null when the lot *is* the destination —
	// there is no walk, and printing one would invent it.
	walkKm: number | null
	walkMinutes: number | null
	// The booking the customer already holds for this exact lot, matched by
	// parking id. Cancelled and completed ones are history and do not count,
	// so an old booking never blocks a new one.
	reservation: Reservation | undefined
}

export function destinationParkingFor({
	destination,
	mode,
	reservations,
}: {
	destination: RouteEndpoint
	mode: TransportMode
	reservations: readonly Reservation[]
}): DestinationParking | null {
	const declared = getParking(destination.parkingId ?? '')
	const parking = declared ?? nearestParking(destination)
	if (!parking) return null

	const reservation = findLiveReservationForParking(reservations, parking.id)

	// Case A: the car park *is* where the customer is going. Not a
	// recommendation at all, so the mode rule below does not apply to it —
	// the destination is the destination however you travel to it — and its
	// actions follow whatever booking the customer already holds for it.
	if (destination.kind === 'parking') {
		return {
			kind: 'destination',
			label: DESTINATION_PARKING_LABEL,
			parking,
			walkKm: null,
			walkMinutes: null,
			reservation,
		}
	}

	// Everything past here is a suggestion, and only a driver needs one.
	if (mode !== 'car') return null

	// Near enough to be the same place: a saved landmark with no coordinates
	// of its own resolves to its car park's, so this is the destination
	// rather than something beside it, and is never called "nearby".
	const walkKm = distanceKm(destination, parking)
	if (walkKm < SAME_PLACE_KM) {
		return {
			kind: 'destination',
			label: DESTINATION_PARKING_LABEL,
			parking,
			walkKm: null,
			walkMinutes: null,
			reservation,
		}
	}

	// Case B: a car park near somewhere else. A guess that lands on the other
	// side of town is not a recommendation.
	if (!declared && walkKm > NEAREST_FALLBACK_MAX_KM) return null

	return {
		kind: 'nearby',
		label: NEARBY_PARKING_LABEL,
		parking,
		walkKm,
		walkMinutes: estimateMinutesForMode(walkKm, 'walk'),
		reservation,
	}
}
