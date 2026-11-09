import { describe, expect, it } from 'vitest'

import { EVENTS } from '@/data/events'
import { PARKINGS } from '@/data/parkings'
import { PLACES } from '@/data/places'
import { QUEUE_ORGS, getQueueOrg } from '@/data/queue-orgs'
import { bookingRows } from '@/lib/bookings'
import { TASHKENT_CENTER } from '@/lib/geo'
import {
	destinationIdFrom,
	readRouteParams,
	routeHref,
	type DestinationSource,
} from '@/lib/navigation'
import { resolveRouteEndpoint } from '@/lib/route-endpoints'
import { TRANSPORT_MODES } from '@/lib/transport'
import type { QueueTicket, Reservation, ServiceBooking } from '@/lib/types'

const BASE = 'https://smartcity.local'

function parse(href: string) {
	return new URL(href, BASE)
}

// What a caller gets back after a round trip through the URL: the same three
// things /transport itself reads out of one.
function roundTrip(href: string) {
	return readRouteParams(parse(href).searchParams)
}

function endpointFor(source: DestinationSource) {
	const id = destinationIdFrom(source)
	return id ? resolveRouteEndpoint(id, TASHKENT_CENTER) : null
}

describe('destinationIdFrom · parkings', () => {
	it('resolves every parking in the catalog to its own point', () => {
		for (const parking of PARKINGS) {
			const point = endpointFor({ from: 'parking', parkingId: parking.id })
			expect(point?.title).toBe(parking.name)
			expect([point?.lat, point?.lng]).toEqual([parking.lat, parking.lng])
			expect(point?.parkingId).toBe(parking.id)
		}
	})

	it('never substitutes another lot for one it does not know', () => {
		expect(destinationIdFrom({ from: 'parking', parkingId: 'no-such-lot' })).toBeNull()
		expect(destinationIdFrom({ from: 'parking', parkingId: null })).toBeNull()
		expect(destinationIdFrom({ from: 'parking', parkingId: undefined })).toBeNull()
	})
})

describe('destinationIdFrom · places', () => {
	it('routes a place to the venue, not to the car park beside it', () => {
		const place = PLACES.find(item => item.id === 'coffee-lab')!
		const point = endpointFor({ from: 'place', placeId: place.id })
		expect(point?.title).toBe(place.title)
		expect([point?.lat, point?.lng]).toEqual([place.lat, place.lng])
		// It still knows where to park on arrival — as a reference, not as the
		// destination itself.
		expect(point?.parkingId).toBe(place.parkingId ?? null)
		expect(point?.placeId).toBe(place.id)
	})

	it('works for every place, booked or not', () => {
		for (const place of PLACES)
			expect(endpointFor({ from: 'place', placeId: place.id })?.title).toBe(
				place.title,
			)
	})

	it('resolves nothing for a place that has left the catalog', () => {
		expect(destinationIdFrom({ from: 'place', placeId: 'removed-venue' })).toBeNull()
	})
})

describe('destinationIdFrom · queue organisations', () => {
	it('sends a desk that names a place to that place', () => {
		const org = getQueueOrg('coffee-lab')!
		expect(org.placeId).toBe('coffee-lab')
		expect(destinationIdFrom({ from: 'queueOrg', orgId: org.id })).toBe(
			'place:coffee-lab',
		)
		// The queue and the venue are one destination, reached either way.
		expect(destinationIdFrom({ from: 'queueOrg', orgId: org.id })).toBe(
			destinationIdFrom({ from: 'place', placeId: 'coffee-lab' }),
		)
	})

	it('sends every desk to its own place — none is left without one', () => {
		for (const org of QUEUE_ORGS) {
			const point = endpointFor({ from: 'queueOrg', orgId: org.id })
			expect(destinationIdFrom({ from: 'queueOrg', orgId: org.id })).toBe(
				`place:${org.placeId}`,
			)
			expect([point?.lat, point?.lng]).toEqual([org.lat, org.lng])
		}
	})

	it('resolves every organisation to somewhere real, and nothing otherwise', () => {
		for (const org of QUEUE_ORGS)
			expect(endpointFor({ from: 'queueOrg', orgId: org.id })).not.toBeNull()
		expect(destinationIdFrom({ from: 'queueOrg', orgId: 'closed-office' })).toBeNull()
	})
})

describe('destinationIdFrom · service bookings', () => {
	it('resolves a table booking back to the restaurant it was made at', () => {
		// The one thing this has to get right: a Basilic Cafe reservation is
		// directions to Basilic Cafe, never to whichever venue sorts first.
		expect(destinationIdFrom({ from: 'serviceBooking', refId: 'basilic-cafe' })).toBe(
			'place:basilic-cafe',
		)
		expect(endpointFor({ from: 'serviceBooking', refId: 'coffee-lab' })?.title).toBe(
			'Coffee Lab',
		)
	})

	it('sends an event ticket to the lot the event is anchored to', () => {
		// An event's map pin is nudged off its venue so two markers do not
		// overlap, so it is not a position to drive to; its parking is real.
		const event = EVENTS[0]
		expect(destinationIdFrom({ from: 'serviceBooking', refId: event.id })).toBe(
			`parking:${event.parkingId}`,
		)
	})

	it('offers no destination for a booking whose venue is gone', () => {
		expect(destinationIdFrom({ from: 'serviceBooking', refId: 'deleted-venue' })).toBeNull()
	})
})

describe('bookingRows destinations', () => {
	const reservation: Reservation = {
		id: 'r1', parkingId: 'tashkent-city', userPhone: '+998900000000',
		startAt: '2026-09-20T10:00:00.000Z', endAt: '2026-09-20T12:00:00.000Z',
		durationHours: 2, pricePerHour: 5000, estimatedTotal: 10000,
		status: 'active', createdAt: '2026-09-20T09:00:00.000Z',
	}
	const ticket: QueueTicket = {
		id: 't1', orgId: 'coffee-lab', serviceId: 'table', number: 'A-14',
		position: 3, initialPosition: 5, etaMinutes: 12, initialEtaMinutes: 20,
		windowNumber: 1, notify: true, status: 'waiting',
		createdAt: '2026-09-20T09:00:00.000Z',
	}
	const table: ServiceBooking = {
		id: 's1', kind: 'table', refId: 'basilic-cafe', title: 'Basilic Cafe',
		subtitle: '2 kishi · 19:00', code: 'TB-001', whenLabel: 'Bugun, 19:00',
		status: 'active', createdAt: '2026-09-20T09:00:00.000Z',
	}
	const orphan: ServiceBooking = { ...table, id: 's2', refId: 'deleted-venue' }

	const rows = bookingRows({
		reservations: [reservation],
		queueTickets: [ticket],
		serviceBookings: [table, orphan],
	})
	const byId = Object.fromEntries(rows.map(row => [row.id, row]))

	it('points a parking booking at its own lot, even mid-session', () => {
		expect(byId.r1.destinationId).toBe('parking:tashkent-city')
	})

	it('points a queue ticket at the venue the number was taken at', () => {
		expect(byId.t1.destinationId).toBe('place:coffee-lab')
	})

	it('points a table booking at the restaurant that was booked', () => {
		expect(byId.s1.destinationId).toBe('place:basilic-cafe')
	})

	it('leaves a booking with an unresolvable venue without a route', () => {
		// The detail sheet reads this: no destination means no directions
		// button, rather than a button that goes somewhere else.
		expect(byId.s2.destinationId).toBeUndefined()
	})
})

describe('routeHref', () => {
	it('spells a parking the way the rest of the app links to one', () => {
		const url = parse(routeHref({ mode: 'car', destinationId: 'parking:amir-temur' }))
		expect(url.pathname).toBe('/transport')
		expect(url.searchParams.get('parkingId')).toBe('amir-temur')
		expect(url.searchParams.get('mode')).toBe('car')
		expect(url.searchParams.get('target')).toBeNull()
	})

	it('passes every other destination through as its map-object key', () => {
		const url = parse(routeHref({ mode: 'walk', destinationId: 'place:coffee-lab' }))
		expect(url.searchParams.get('target')).toBe('place:coffee-lab')
		expect(url.searchParams.get('parkingId')).toBeNull()
	})

	it('invents no destination when the caller has none', () => {
		expect(routeHref()).toBe('/transport')
		expect(routeHref({ destinationId: null })).toBe('/transport')
		const url = parse(routeHref({ mode: 'metro' }))
		expect(url.searchParams.get('mode')).toBe('metro')
		expect(url.searchParams.get('target')).toBeNull()
		expect(url.searchParams.get('parkingId')).toBeNull()
	})

	it('carries a named origin but leaves the live position implied', () => {
		expect(parse(routeHref({ destinationId: 'place:coffee-lab', originId: 'me' }))
			.searchParams.get('from')).toBeNull()
		expect(parse(routeHref({ destinationId: 'place:coffee-lab', originId: 'airport' }))
			.searchParams.get('from')).toBe('airport')
	})
})

describe('route URL round trip', () => {
	it('restores mode, destination and origin after a refresh', () => {
		const href = routeHref({
			mode: 'scooter',
			destinationId: 'place:coffee-lab',
			originId: 'airport',
		})
		expect(roundTrip(href)).toEqual({
			mode: 'scooter',
			destinationId: 'place:coffee-lab',
			originId: 'airport',
		})
	})

	it.each(['parking:amir-temur', 'place:coffee-lab', 'queue:davlat-xizmat', 'magic-city'])(
		'round-trips %s back to the same point',
		id => {
			const back = roundTrip(routeHref({ mode: 'car', destinationId: id }))
			expect(back.destinationId).toBe(id)
			expect(resolveRouteEndpoint(back.destinationId!, TASHKENT_CENTER)).toEqual(
				resolveRouteEndpoint(id, TASHKENT_CENTER),
			)
		},
	)

	it('keeps the destination across every change of mode', () => {
		const destinationId = 'place:coffee-lab'
		for (const mode of TRANSPORT_MODES) {
			const back = roundTrip(routeHref({ mode: mode.id, destinationId }))
			expect(back.destinationId).toBe(destinationId)
			expect(back.mode).toBe(mode.id)
		}
	})

	it('keeps the mode across a change of destination', () => {
		const first = roundTrip(routeHref({ mode: 'walk', destinationId: 'place:coffee-lab' }))
		const second = roundTrip(
			routeHref({ mode: first.mode, destinationId: 'parking:eco-park' }),
		)
		expect(second.mode).toBe('walk')
		expect(second.destinationId).toBe('parking:eco-park')
	})

	it('reports "nowhere chosen" rather than a default', () => {
		expect(roundTrip('/transport')).toEqual({
			mode: null,
			destinationId: null,
			originId: null,
		})
		// An unusable mode is dropped, not coerced into a route to somewhere.
		expect(roundTrip('/transport?mode=bus').mode).toBeNull()
	})
})
