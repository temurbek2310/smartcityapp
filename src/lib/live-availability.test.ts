import { describe, expect, it } from 'vitest'

import { PARKINGS } from '@/data/parkings'
import { liveAvailability, liveAvailabilityAll } from './live-availability'
import type { Parking } from '@/lib/types'

const lot = PARKINGS.find(p => p.id === 'magic-city') as Parking
const fullLot = PARKINGS.find(p => p.availableSpaces === 0) as Parking

// Pull-to-refresh reads this. It has to be a pure function of (id, tick):
// if a re-render could change the number, what you see would depend on how
// many times React happened to re-run.
describe('liveAvailability', () => {
	it('returns the catalog untouched at tick 0, so SSR and first paint agree', () => {
		expect(liveAvailability(lot, 0)).toBe(lot)
	})

	it('is stable for a given tick however many times it is called', () => {
		const a = liveAvailability(lot, 7).availableSpaces
		const b = liveAvailability(lot, 7).availableSpaces
		expect(a).toBe(b)
	})

	it('actually moves the number across ticks', () => {
		const moved = Array.from({ length: 40 }, (_, i) =>
			liveAvailability(lot, i + 1).availableSpaces,
		).filter(value => value !== lot.availableSpaces)
		// Not every tick has to move it, but a refresh that never did would
		// make the gesture theatre.
		expect(moved.length).toBeGreaterThan(20)
	})

	it('never exceeds capacity or goes negative', () => {
		for (let tick = 1; tick <= 200; tick += 1) {
			const { availableSpaces } = liveAvailability(lot, tick)
			expect(availableSpaces).toBeGreaterThanOrEqual(0)
			expect(availableSpaces).toBeLessThanOrEqual(lot.totalSpaces)
		}
	})

	it('keeps full lots full', () => {
		// next-mall is the only route to the FULL badge and the alternative
		// suggestion; a refresh that freed a space would erase both paths.
		for (const tick of [1, 2, 3, 7, 19, 55]) {
			expect(liveAvailability(fullLot, tick).availableSpaces).toBe(0)
		}
	})

	it('preserves identity when nothing changed, so React can skip the row', () => {
		const same = liveAvailabilityAll(PARKINGS, 0)
		expect(same).toBe(PARKINGS)
	})

	it('leaves every other field alone', () => {
		const jittered = liveAvailability(lot, 3)
		expect({ ...jittered, availableSpaces: lot.availableSpaces }).toEqual(lot)
	})
})
