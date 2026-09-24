import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { TASHKENT_CENTER } from '@/lib/geo'
import { readRouteParams, savedRouteHref } from '@/lib/navigation'
import {
	externalNavigationDestination,
	externalNavigationHref,
	externalNavigationOrigin,
	resolveRouteEndpoint,
	routeEndpointLabel,
	savedRouteLabels,
	supportsExternalNavigation,
} from '@/lib/route-endpoints'

// The hand-off to 2GIS and the saved-route replay: both are where a route
// leaves /transport, and both used to leave it pointing somewhere else.

const coffeeLab = resolveRouteEndpoint('place:coffee-lab', TASHKENT_CENTER)!
const magicCity = resolveRouteEndpoint('magic-city', TASHKENT_CENTER)!
const gps = { lat: 41.3, lng: 69.25 }

const href = (mode: 'car' | 'metro' | 'scooter' | 'walk', origin = gps) =>
	externalNavigationHref({ origin, destination: coffeeLab, mode })

const to = `/to/${coffeeLab.lng},${coffeeLab.lat}`

describe('2GIS route links', () => {
	it('uses 2GIS’s documented routeSearch link, longitude first', () => {
		expect(href('car')).toBe(
			`https://2gis.ru/routeSearch/rsType/car/from/${gps.lng},${gps.lat}${to}`,
		)
	})

	it('maps car, public transport and walking onto 2GIS’s own route types', () => {
		expect(href('car')).toContain('/rsType/car/')
		expect(href('metro')).toContain('/rsType/ctx/')
		expect(href('walk')).toContain('/rsType/pedestrian/')
	})

	it('has no scooter hand-off rather than opening another vehicle’s route', () => {
		expect(href('scooter')).toBeNull()
		expect(supportsExternalNavigation('scooter')).toBe(false)
		expect(supportsExternalNavigation('car')).toBe(true)
	})

	it('never points at Google Maps', () => {
		for (const mode of ['car', 'metro', 'walk'] as const) {
			expect(href(mode)).not.toMatch(/google/)
		}
	})
})

describe('the origin 2GIS is given', () => {
	const me = resolveRouteEndpoint('me', TASHKENT_CENTER)!

	it('passes a real GPS fix', () => {
		const origin = externalNavigationOrigin({ ...me, ...gps }, true)
		expect(origin).toMatchObject(gps)
		expect(href('car', origin!)).toContain(`/from/${gps.lng},${gps.lat}/`)
	})

	it('omits the stand-in city centre so 2GIS uses the device location', () => {
		const origin = externalNavigationOrigin(me, false)
		expect(origin).toBeNull()
		const url = externalNavigationHref({ origin, destination: coffeeLab, mode: 'car' })
		expect(url).toBe(`https://2gis.ru/routeSearch/rsType/car${to}`)
		expect(url).not.toContain(`${TASHKENT_CENTER.lng},${TASHKENT_CENTER.lat}`)
	})

	it('passes a picked origin whether or not GPS is available', () => {
		expect(externalNavigationOrigin(magicCity, false)).toBe(magicCity)
	})

	it('never passes an approximate «me», even if told GPS is ready', () => {
		const approximate = resolveRouteEndpoint('me', null)!
		expect(externalNavigationOrigin(approximate, true)).toBeNull()
	})
})

describe('the destination 2GIS is given', () => {
	it('passes a real fix as «Mening joylashuvim»', () => {
		const me = resolveRouteEndpoint('me', gps)!
		expect(me.approximate).toBe(false)
		const url = externalNavigationHref({
			origin: magicCity,
			destination: externalNavigationDestination(me, true),
			mode: 'car',
		})
		expect(url).toContain(`/to/${gps.lng},${gps.lat}`)
	})

	it('builds no link to the city centre without a fix', () => {
		const me = resolveRouteEndpoint('me', null)!
		expect(externalNavigationDestination(me, false)).toBeNull()
		expect(externalNavigationDestination(me, true)).toBeNull()
		expect(
			externalNavigationHref({ origin: magicCity, destination: null, mode: 'car' }),
		).toBeNull()
	})

	it('passes a picked destination whether or not GPS is available', () => {
		expect(externalNavigationDestination(coffeeLab, false)).toBe(coffeeLab)
	})
})

describe('saved routes', () => {
	it('replays to the destination, not the parking beside it', () => {
		// Coffee Lab's own lot is Amir Temur; the route was to Coffee Lab.
		expect(coffeeLab.parkingId).toBe('amir-temur')
		const replay = readRouteParams(
			new URL(
				savedRouteHref({
					mode: 'walk',
					destinationId: coffeeLab.id,
					parkingId: 'amir-temur',
				}),
				'http://x',
			).searchParams,
		)
		expect(replay).toEqual({ mode: 'walk', destinationId: 'place:coffee-lab', originId: null })
	})

	it('keeps a picked origin', () => {
		const url = new URL(
			savedRouteHref({ mode: 'car', destinationId: coffeeLab.id, originId: 'magic-city' }),
			'http://x',
		)
		expect(readRouteParams(url.searchParams).originId).toBe('magic-city')
	})

	it('still replays a route saved before destinationId existed', () => {
		expect(savedRouteHref({ mode: 'car', parkingId: 'amir-temur' })).toBe(
			'/transport?mode=car&parkingId=amir-temur',
		)
	})

	it('labels «me» by identity, never by the location status of the moment', () => {
		expect(routeEndpointLabel('me')).toBe('Mening joylashuvim')
		expect(routeEndpointLabel('magic-city')).toContain('Magic City')
		expect(routeEndpointLabel('place:missing')).toBeNull()
		expect(
			savedRouteLabels({ from: 'Joylashuv aniqlanmoqda…', to: 'x', originId: 'me', destinationId: coffeeLab.id }),
		).toEqual({ from: 'Mening joylashuvim', to: routeEndpointLabel(coffeeLab.id) })
	})

	it('reads older records without ids, un-freezing old location labels', () => {
		for (const frozen of ['Toshkent markazi (demo joylashuv)', 'Joylashuv aniqlanmoqda…', 'Joriy joylashuvingiz (GPS)'])
			expect(savedRouteLabels({ from: frozen, to: 'Amir Temur' })).toEqual({
				from: 'Mening joylashuvim',
				to: 'Amir Temur',
			})
		// A place that has left the catalog keeps the text it was saved with.
		expect(savedRouteLabels({ from: 'A', to: 'B', originId: 'place:gone', destinationId: 'place:gone' }))
			.toEqual({ from: 'A', to: 'B' })
	})

	it('is saved from /transport with stable endpoint labels', () => {
		const page = readFileSync(
			join(process.cwd(), 'src/app/(app)/transport/page.tsx'),
			'utf8',
		)
		const call = page.slice(page.indexOf('saveRoute({'), page.indexOf("notifyBooking('Marshrut"))
		expect(call).toContain('routeEndpointLabel(originPoint.id)')
		expect(call).not.toMatch(/from: originStatusLabel,/)
	})

	it('is saved from /transport with the destination’s own id', () => {
		const page = readFileSync(
			join(process.cwd(), 'src/app/(app)/transport/page.tsx'),
			'utf8',
		)
		const call = page.slice(page.indexOf('saveRoute({'), page.indexOf('notifyBooking(\'Marshrut'))
		expect(call).toContain('destinationId: destinationPoint.id')
		expect(call).not.toContain('parkingId')
	})
})
