import { describe, expect, it } from 'vitest'

import {
	estimateFareUZS,
	estimateFuelCostUZS,
	estimateMinutesForMode,
	estimateOptimalSpeedRange,
	fastestMode,
} from './eta'

// Straight-line distance times a fixed per-mode speed. Deliberately an
// approximation — the UI says so — but the orderings below are what the
// transport screen presents as advice, so they have to hold.
describe('estimateMinutesForMode', () => {
	it('takes longer on foot than by car for the same distance', () => {
		expect(estimateMinutesForMode(5, 'walk')).toBeGreaterThan(
			estimateMinutesForMode(5, 'car'),
		)
	})

	it('scales with distance', () => {
		expect(estimateMinutesForMode(10, 'car')).toBeGreaterThan(
			estimateMinutesForMode(1, 'car'),
		)
	})

	it('never returns zero, so a nearby destination still reads as a journey', () => {
		for (const mode of ['car', 'metro', 'scooter', 'walk'] as const) {
			expect(estimateMinutesForMode(0.01, mode)).toBeGreaterThan(0)
		}
	})
})

describe('fastestMode', () => {
	// Returns { mode, minutes } — asserting on the object itself would pass
	// vacuously whatever it contained.
	const all = ['car', 'metro', 'scooter', 'walk'] as const

	it('never picks walking across the city', () => {
		expect(fastestMode(25, [...all]).mode).not.toBe('walk')
	})

	it('only returns a mode it was offered', () => {
		expect(['metro', 'walk']).toContain(fastestMode(5, ['metro', 'walk']).mode)
	})

	it('reports the minutes for the mode it chose', () => {
		const best = fastestMode(8, [...all])
		expect(best.minutes).toBe(estimateMinutesForMode(8, best.mode))
	})

	it('really is the fastest of the options', () => {
		const best = fastestMode(8, [...all])
		for (const mode of all) {
			expect(best.minutes).toBeLessThanOrEqual(estimateMinutesForMode(8, mode))
		}
	})
})

describe('cost estimates', () => {
	it('charges more fuel for a longer drive', () => {
		expect(estimateFuelCostUZS(20)).toBeGreaterThan(estimateFuelCostUZS(2))
	})

	it('never returns a negative fare', () => {
		for (const mode of ['car', 'metro', 'scooter', 'walk'] as const) {
			expect(estimateFareUZS(5, 15, mode)).toBeGreaterThanOrEqual(0)
		}
	})

	it('costs nothing to walk', () => {
		expect(estimateFareUZS(3, 40, 'walk')).toBe(0)
	})
})

describe('estimateOptimalSpeedRange', () => {
	it('returns a range whose floor is below its ceiling', () => {
		const { low, high } = estimateOptimalSpeedRange(10, 20)
		expect(low).toBeLessThan(high)
	})

	it('never advises crawling, however slow the demo route implies', () => {
		// Floored at 20 km/h: "drive at 4 km/h" is not advice.
		expect(estimateOptimalSpeedRange(1, 60).low).toBeGreaterThanOrEqual(20)
	})
})
