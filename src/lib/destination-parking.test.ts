import { describe, expect, it } from 'vitest'

import { PARKINGS } from '@/data/parkings'
import {
	DESTINATION_PARKING_LABEL,
	NEARBY_PARKING_LABEL,
	destinationParkingFor,
} from '@/lib/destination-parking'
import { bookingRows, reservationStatusLabel } from '@/lib/bookings'
import { TASHKENT_CENTER } from '@/lib/geo'
import { destinationIdFrom } from '@/lib/navigation'
import { reservationHref } from '@/lib/reservation'
import { resolveRouteEndpoint } from '@/lib/route-endpoints'
import { TRANSPORT_MODES, type TransportMode } from '@/lib/transport'
import type { Reservation } from '@/lib/types'

function endpoint(source: Parameters<typeof destinationIdFrom>[0]) {
	return resolveRouteEndpoint(destinationIdFrom(source)!, TASHKENT_CENTER)!
}

const coffeeLab = endpoint({ from: 'place', placeId: 'coffee-lab' })
const registan = endpoint({ from: 'parking', parkingId: 'samarkand-registan' })
// A saved landmark with no coordinates of its own: it resolves to its car
// park's point, so that lot is the destination rather than near it.
const magicCity = resolveRouteEndpoint('magic-city', TASHKENT_CENTER)!

function reservation(parkingId: string, status: Reservation['status']): Reservation {
	return {
		id: `r-${parkingId}-${status}`, parkingId, userPhone: '+998900000000',
		startAt: '2026-09-20T10:00:00.000Z', endAt: '2026-09-20T12:00:00.000Z',
		durationHours: 2, pricePerHour: 12000, estimatedTotal: 24000,
		status, createdAt: '2026-09-20T09:00:00.000Z',
	}
}

function suggest(
	destination = coffeeLab,
	mode: TransportMode = 'car',
	reservations: Reservation[] = [],
) {
	return destinationParkingFor({ destination, mode, reservations })
}

describe('when a nearby parking is worth offering', () => {
	it('offers one beside a café reached by car', () => {
		const result = suggest()
		expect(result?.kind).toBe('nearby')
		expect(result?.label).toBe(NEARBY_PARKING_LABEL)
		expect(result?.parking.id).toBe('amir-temur')
	})

	it('leaves the café as the destination', () => {
		// The card is context, not a redirect: nothing here changes where the
		// route ends, and the suggestion knows it is a separate place.
		expect(suggest()?.parking.id).not.toBe(coffeeLab.placeId)
		expect(coffeeLab.title).toBe('Coffee Lab')
	})

	it.each(TRANSPORT_MODES.filter(mode => mode.id !== 'car').map(mode => mode.id))(
		'offers nothing to someone arriving by %s',
		mode => {
			expect(suggest(coffeeLab, mode)).toBeNull()
		},
	)

	it.each(TRANSPORT_MODES.map(mode => mode.id))(
		'still shows a parking destination to someone arriving by %s',
		mode => {
			// The mode rule is about whether a *recommendation* is useful. The
			// destination is the destination however you travel to it, and its
			// booking state has to stay reachable.
			expect(suggest(registan, mode)?.kind).toBe('destination')
		},
	)

	it('offers no second car park when the destination is already one', () => {
		const result = suggest(registan)
		// Still shown — you can book the lot you are driving to — but never
		// described as a car park "near" the car park.
		expect(result?.kind).toBe('destination')
		expect(result?.label).toBe(DESTINATION_PARKING_LABEL)
		expect(result?.label).not.toBe(NEARBY_PARKING_LABEL)
		expect(result?.parking.id).toBe('samarkand-registan')
	})

	it('treats a landmark sitting on its own car park the same way', () => {
		expect(suggest(magicCity)?.kind).toBe('destination')
	})
})

describe('the walking context', () => {
	it('measures the real gap between the two points', () => {
		const result = suggest()!
		expect(result.walkKm).toBeGreaterThan(0)
		// Coffee Lab and Amir Temur Square Parking are about a hundred metres
		// apart in the catalog — a walk, not a drive.
		expect(result.walkKm!).toBeLessThan(0.5)
		expect(result.walkMinutes).toBeGreaterThan(0)
	})

	it('claims no walk when the car park is the destination', () => {
		const result = suggest(registan)!
		expect(result.walkKm).toBeNull()
		expect(result.walkMinutes).toBeNull()
	})

	it('offers nothing when the closest lot is not within walking distance', () => {
		// Far outside every city in the catalog, with no parking of its own:
		// the nearest lot is a guess, and a guess that far away is not a
		// recommendation.
		const remote = { ...coffeeLab, parkingId: null, lat: 39.6, lng: 66.9 }
		expect(destinationParkingFor({ destination: remote, mode: 'car', reservations: [] })).toBeNull()
	})

	it('trusts a pairing the catalog states, however far apart', () => {
		// A declared parkingId is curated data, not a nearest-lot guess.
		const declared = { ...coffeeLab, lat: 41.6, lng: 69.6 }
		expect(destinationParkingFor({ destination: declared, mode: 'car', reservations: [] })?.parking.id)
			.toBe('amir-temur')
	})
})

describe('a booking the customer already holds', () => {
	it('is found for the suggested lot, whichever live status it has', () => {
		for (const status of ['reserved', 'active'] as const) {
			const result = suggest(coffeeLab, 'car', [reservation('amir-temur', status)])
			expect(result?.reservation?.status).toBe(status)
		}
	})

	it('ignores a finished or cancelled one, so booking is offered again', () => {
		for (const status of ['completed', 'cancelled'] as const) {
			const result = suggest(coffeeLab, 'car', [reservation('amir-temur', status)])
			expect(result?.reservation).toBeUndefined()
		}
	})

	it('ignores a live booking for some other lot', () => {
		const other = PARKINGS.find(parking => parking.id !== 'amir-temur')!
		expect(suggest(coffeeLab, 'car', [reservation(other.id, 'active')])?.reservation)
			.toBeUndefined()
	})

	it('matches on the parking id rather than on the destination', () => {
		const result = suggest(registan, 'car', [reservation('samarkand-registan', 'reserved')])
		expect(result?.reservation?.parkingId).toBe('samarkand-registan')
	})
})

describe('the wording', () => {
	it('never uses the old heading', () => {
		for (const label of [NEARBY_PARKING_LABEL, DESTINATION_PARKING_LABEL])
			expect(label).not.toContain('parkovka')
		expect(NEARBY_PARKING_LABEL).toBe('Manzilga yaqin parking')
	})
})


// --- The bug this fixes -------------------------------------------------
// Booking Registan, opening the booking, tapping Yo‘nalish → Marshrutni
// ko‘rish lands on /transport with Registan as the destination. Its card
// used to offer «Bron qilish» for a lot the customer had already booked.

describe('the destination parking a customer has already booked', () => {
	const held = (status: Reservation['status']) =>
		suggest(registan, 'car', [reservation('samarkand-registan', status)])

	it.each(['reserved', 'active'] as const)(
		'detects the live %s booking for that exact lot',
		status => {
			const result = held(status)
			expect(result?.kind).toBe('destination')
			expect(result?.reservation?.parkingId).toBe('samarkand-registan')
			expect(result?.reservation?.status).toBe(status)
		},
	)

	it.each(['reserved', 'active'] as const)(
		'opens the very reservation that exists, for a %s booking',
		status => {
			const result = held(status)!
			// Not a new booking and not a second detail screen: the href the
			// rest of the app already sends this reservation to.
			expect(reservationHref(result.reservation!)).toBe(
				reservationHref(reservation('samarkand-registan', status)),
			)
			expect(reservationHref(result.reservation!)).toContain('/reservation/')
		},
	)

	it.each(['completed', 'cancelled'] as const)(
		'lets a new booking be made once the old one is %s',
		status => {
			expect(held(status)?.reservation).toBeUndefined()
		},
	)

	it('is unaffected by a live booking at a different lot', () => {
		// Matched on the stable id, never on a name, an address or a position
		// in the list — so Registan being booked cannot silence Magic City.
		const magicCityParking = endpoint({ from: 'parking', parkingId: 'magic-city' })
		const result = destinationParkingFor({
			destination: magicCityParking,
			mode: 'car',
			reservations: [reservation('samarkand-registan', 'reserved')],
		})
		expect(result?.parking.id).toBe('magic-city')
		expect(result?.reservation).toBeUndefined()
	})

	it('offers nothing to open when nothing is held', () => {
		expect(suggest(registan)?.reservation).toBeUndefined()
	})

	it('names the state in the words the rest of the app uses', () => {
		expect(reservationStatusLabel('reserved')).toBe(
			bookingRows({ reservations: [reservation('samarkand-registan', 'reserved')],
				queueTickets: [], serviceBookings: [] })[0].statusLabel,
		)
		expect(reservationStatusLabel('active')).toBe(
			bookingRows({ reservations: [reservation('samarkand-registan', 'active')],
				queueTickets: [], serviceBookings: [] })[0].statusLabel,
		)
	})
})
