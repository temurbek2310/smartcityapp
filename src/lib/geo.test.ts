import { describe, expect, it } from 'vitest'

import { PARKINGS } from '@/data/parkings'
import { TASHKENT_CENTER, distanceKm, isInsideUzbekistan } from './geo'

// Distance underpins the parking sort, the distance filter, the navigate
// ETA and the queue "when to leave" figure — so if this drifts, four
// features drift with it.
describe('distanceKm', () => {
	it('is zero for a point against itself', () => {
		expect(distanceKm(TASHKENT_CENTER, TASHKENT_CENTER)).toBe(0)
	})

	it('is symmetric', () => {
		const samarkand = { lat: 39.6548, lng: 66.9758 }
		expect(distanceKm(TASHKENT_CENTER, samarkand)).toBeCloseTo(
			distanceKm(samarkand, TASHKENT_CENTER),
			6,
		)
	})

	it('matches the known Tashkent–Samarkand great-circle distance', () => {
		// ~270 km as the crow flies; road distance is longer, which is why
		// this is a straight-line estimate and labelled as one in the UI.
		const samarkand = { lat: 39.6548, lng: 66.9758 }
		expect(distanceKm(TASHKENT_CENTER, samarkand)).toBeGreaterThan(255)
		expect(distanceKm(TASHKENT_CENTER, samarkand)).toBeLessThan(285)
	})

	it('puts the central lots within a few km of the city centre', () => {
		const central = PARKINGS.filter(p => p.city === 'Toshkent')
		for (const parking of central) {
			expect(distanceKm(TASHKENT_CENTER, parking)).toBeLessThan(10)
		}
	})

	it('orders nearer before farther, which is what the sort relies on', () => {
		const amirTemur = PARKINGS.find(p => p.id === 'amir-temur')!
		const bukhara = PARKINGS.find(p => p.id === 'bukhara-center')!
		expect(distanceKm(TASHKENT_CENTER, amirTemur)).toBeLessThan(
			distanceKm(TASHKENT_CENTER, bukhara),
		)
	})
})

describe('isInsideUzbekistan', () => {
	it('accepts every parking in the catalog', () => {
		for (const parking of PARKINGS) {
			expect(isInsideUzbekistan(parking)).toBe(true)
		}
	})

	it('rejects somewhere clearly outside', () => {
		// London. The guard exists so a denied-geolocation fallback does not
		// sort the whole list by a distance from another continent.
		expect(isInsideUzbekistan({ lat: 51.5, lng: -0.12 })).toBe(false)
	})
})
