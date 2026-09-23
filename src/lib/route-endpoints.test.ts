import { describe, expect, it } from 'vitest'

import { DEMO_DESTINATIONS } from '@/data/demo-transport'
import { PARKINGS } from '@/data/parkings'
import { TASHKENT_CENTER } from '@/lib/geo'
import { destinationOptions, resolveRouteEndpoint } from '@/lib/route-endpoints'

const GPS = 'Joriy joylashuvingiz (GPS)'

function options(query: string, excludeId?: string) {
	return destinationOptions({ query, currentLocationLabel: GPS, excludeId })
}

// What the «Qayerga» sheet offers, and — the part that actually matters —
// whether every row it offers is somewhere the route can then be built to.
describe('destinationOptions', () => {
	it('opens on the saved landmarks alone, unchanged', () => {
		expect(options('').map(row => row.id)).toEqual(
			DEMO_DESTINATIONS.map(item => item.id),
		)
		expect(options('   ')).toEqual(options(''))
	})

	it('labels the live-location row with the status the screen already has', () => {
		expect(options('').find(row => row.id === 'me')?.subtitle).toBe(GPS)
	})

	it('drops the row a caller cannot use', () => {
		// Home always routes from the customer's own position, so offering it
		// as the destination too would only ever produce a route of length zero.
		expect(options('', 'me').map(row => row.id)).not.toContain('me')
		expect(options('', 'me')).toHaveLength(DEMO_DESTINATIONS.length - 1)
		expect(options('joylashuv', 'me')).toEqual([])
	})

	it('reaches a parking that is not one of the saved landmarks', () => {
		const hit = options('Amir Temur').find(row => row.id === 'parking:amir-temur')
		expect(hit?.title).toBe('Amir Temur Square Parking')
	})

	it('offers no second row for a landmark that already has one', () => {
		// «Magic City» is a saved row whose route ends at magic-city parking;
		// listing that lot again would be two rows for one destination.
		expect(options('magic').map(row => row.id)).toContain('magic-city')
		expect(options('magic').map(row => row.id)).not.toContain(
			'parking:magic-city',
		)
	})

	it('finds places as well as car parks', () => {
		expect(options('Coffee Lab').map(row => row.id)).toContain(
			'place:coffee-lab',
		)
	})

	it('says nothing rather than guessing when nothing matches', () => {
		expect(options('no-such-destination')).toEqual([])
	})

	it('offers only rows the route can actually be built to', () => {
		const queries = ['', 'parking', 'a', 'Toshkent', 'Coffee', 'Humo']
		for (const query of queries) {
			const rows = options(query)
			for (const row of rows)
				expect(resolveRouteEndpoint(row.id, TASHKENT_CENTER)).not.toBeNull()
		}
	})

	it('keeps the list short enough to read', () => {
		// Every parking in the country matches "parking"; the sheet is a picker,
		// not a directory.
		expect(PARKINGS.length).toBeGreaterThan(8)
		expect(options('parking').length).toBeLessThanOrEqual(
			DEMO_DESTINATIONS.length + 8,
		)
	})
})
