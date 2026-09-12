import { describe, expect, it } from 'vitest'

import { CITY_META } from '@/data/city-meta'
import { DEMO_DESTINATIONS } from '@/data/demo-transport'
import { EVENTS } from '@/data/events'
import { PARKINGS } from '@/data/parkings'
import { PLACES } from '@/data/places'
import { clearAccountStorage } from '@/lib/account-storage'
import { bayMap, isBaySelectable } from '@/lib/bay-map'
import { distanceKm, TASHKENT_CENTER } from '@/lib/geo'
import { buildHomeMapObjects } from '@/lib/home-map'
import { DEFAULT_LAYERS, type MapLayerState } from '@/lib/map-layers'
import { buildMapObjects, mapObjectKey } from '@/lib/map-objects'
import { estimateMinutesForMode } from '@/lib/eta'
import { externalNavigationHref, resolveRouteEndpoint } from '@/lib/route-endpoints'

describe('parity catalogs and map results', () => {
	it('includes the missing catalogs and Andijon', () => {
		expect(PLACES.length).toBeGreaterThanOrEqual(18)
		expect(PARKINGS.filter(parking => parking.city === 'Toshkent')).toHaveLength(8)
		expect(CITY_META.Andijon).toBeDefined()
		expect(PARKINGS.some(parking => parking.city === 'Andijon')).toBe(true)
		for (const record of [...PLACES, ...EVENTS]) {
			if (record.parkingId) expect(PARKINGS.some(parking => parking.id === record.parkingId)).toBe(true)
		}
	})

	it('keeps every catalog object available beyond the first twelve cards', () => {
		const all = buildMapObjects({ parkings: PARKINGS })
		expect(all.length).toBeGreaterThan(12)
		expect(new Set(all.map(mapObjectKey)).size).toBe(all.length)
		for (const category of ['place', 'parking', 'queue', 'event'] as const) {
			expect(buildMapObjects({ parkings: PARKINGS, category }))
				.toEqual(all.filter(object => object.kind === category))
		}
	})

	it('searches names and addresses and opens the selected event', () => {
		const objects = buildMapObjects({ parkings: PARKINGS, query: 'humo' })
		expect(objects.some(object => object.kind === 'place')).toBe(true)
		expect(objects.some(object => object.kind === 'parking')).toBe(true)
		const event = buildMapObjects({ parkings: PARKINGS, category: 'event' }).find(item => item.id === 'concert')!
		expect(event.parkingId).toBe('humo-arena')
		expect(event.href).toBe('/home?event=concert')
		expect(buildMapObjects({ parkings: PARKINGS, query: 'no-such-location' })).toEqual([])
	})
})

describe('Home map layers', () => {
	const options = { parkings: PARKINGS, city: 'Toshkent', category: 'all' as const, origin: TASHKENT_CENTER }
	const off: MapLayerState = { parking: false, transit: false, traffic: false, events: false, bike: false, eco: false }
	it('uses transit markers, not queue organisations, for public transport', () => {
		const objects = buildHomeMapObjects({ ...options, layers: DEFAULT_LAYERS })
		expect(objects.filter(item => item.kind === 'transit')).toHaveLength(2)
		expect(objects.some(item => item.kind === 'queue')).toBe(false)
	})
	it.each([
		['parking', 'parking'], ['transit', 'transit'], ['traffic', 'traffic'], ['events', 'event'], ['bike', 'bike'],
	] as const)('toggles only the %s overlay', (layer, kind) => {
		const before = buildHomeMapObjects({ ...options, layers: off })
		const after = buildHomeMapObjects({ ...options, layers: { ...off, [layer]: true } })
		expect(before.some(item => item.kind === kind)).toBe(false)
		expect(after.filter(item => item.kind === kind).length).toBeGreaterThan(0)
		expect(after.filter(item => item.kind !== kind)).toEqual(before)
	})
	it('applies place categories, saved places and the selected city to pins', () => {
		const filtered = buildHomeMapObjects({ ...options, layers: off, category: 'food', favoritePlaceIds: ['coffee-lab'] })
		expect(filtered.map(item => item.id)).toEqual(['coffee-lab'])
		const favoriteMap = buildHomeMapObjects({
			...options,
			parkings: PARKINGS.filter(parking => parking.id === 'magic-city'),
			layers: { ...off, parking: true },
			category: 'all',
			favoritePlaceIds: ['coffee-lab'],
		})
		expect(favoriteMap.some(item => item.kind === 'parking' && item.id === 'magic-city')).toBe(true)
		const otherCity = buildHomeMapObjects({ ...options, city: 'Andijon', layers: { ...DEFAULT_LAYERS, bike: true, events: true } })
		expect(otherCity.map(item => item.id)).toEqual(['andijan-center'])
	})
})

describe('route endpoints', () => {
	it('resolves all six address-book choices', () => {
		for (const item of DEMO_DESTINATIONS) expect(resolveRouteEndpoint(item.id, TASHKENT_CENTER)?.title).toBe(item.title)
	})
	it('keeps GPS as the destination after swapping with the default route', () => {
		const from = resolveRouteEndpoint('me', TASHKENT_CENTER)!
		const to = resolveRouteEndpoint('magic-city', TASHKENT_CENTER)!
		const reversedFrom = resolveRouteEndpoint(to.id, TASHKENT_CENTER)!
		const reversedTo = resolveRouteEndpoint(from.id, TASHKENT_CENTER)!
		expect(reversedFrom).toEqual(to)
		expect(reversedTo).toEqual(from)
		expect(distanceKm(from, to)).toBeCloseTo(distanceKm(reversedFrom, reversedTo))
		expect(estimateMinutesForMode(distanceKm(from, to), 'walk')).toBeGreaterThan(3)
	})
	it('routes every map object to its own point rather than its linked parking', () => {
		for (const object of buildMapObjects({ parkings: PARKINGS })) {
			const point = resolveRouteEndpoint(mapObjectKey(object), TASHKENT_CENTER)!
			expect(point.title).toBe(object.title)
			expect([point.lat, point.lng]).toEqual([object.lat, object.lng])
		}
	})
	it('preserves named parkings outside the address book when swapped', () => {
		const parking = PARKINGS.find(item => item.id === 'bukhara-center') ?? PARKINGS.find(item => item.city === 'Buxoro')!
		const point = resolveRouteEndpoint(`parking:${parking.id}`, TASHKENT_CENTER)!
		expect(point.parkingId).toBe(parking.id)
		expect(point.lat).toBe(parking.lat)
		expect(resolveRouteEndpoint('parking:missing', TASHKENT_CENTER)).toBeNull()
	})
	it('sends both picked endpoints and transport mode to the external navigator', () => {
		const from = resolveRouteEndpoint('work', TASHKENT_CENTER)!
		const to = resolveRouteEndpoint('me', TASHKENT_CENTER)!
		const url = new URL(externalNavigationHref(from, to, 'walk'))
		expect(url.searchParams.get('origin')).toBe(`${from.lat},${from.lng}`)
		expect(url.searchParams.get('destination')).toBe(`${to.lat},${to.lng}`)
		expect(url.searchParams.get('travelmode')).toBe('walking')
	})
})

describe('parking floor totals', () => {
	it.each(PARKINGS)('preserves all spaces across the levels of $name', parking => {
		const floors = Array.from({ length: parking.levels }, (_, index) => bayMap(parking, index + 1).bays)
		expect(floors.flat()).toHaveLength(parking.totalSpaces)
		expect(floors.flat().filter(bay => isBaySelectable(bay.state))).toHaveLength(parking.availableSpaces)
	})
	it('does not invent a floor or a minimum of six spaces', () => {
		const parking = { ...PARKINGS[0], levels: 1, totalSpaces: 2, availableSpaces: 1 }
		expect(bayMap(parking, 1).bays).toHaveLength(2)
		expect(bayMap(parking, 0).bays).toEqual([])
		expect(bayMap(parking, 2).bays).toEqual([])
	})
})

describe('account deletion', () => {
	it('clears booking metadata and saved places without clearing unrelated storage', () => {
		const data = new Map([
			['b-space-mvp-v1', '{}'], ['citygoo-place-favorites', '["coffee-lab"]'],
			['citygoo-parking-meta-r1', '{"bay":"A-01"}'], ['citygoo-map-layers', '{}'],
			['another-app', 'keep'],
		])
		const storage: Storage = {
			get length() { return data.size }, key: index => [...data.keys()][index] ?? null,
			getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) },
			removeItem: key => { data.delete(key) }, clear: () => data.clear(),
		}
		clearAccountStorage(storage)
		expect([...data.entries()]).toEqual([['another-app', 'keep'], ['citygoo-place-favorites', '[]']])
	})
})
