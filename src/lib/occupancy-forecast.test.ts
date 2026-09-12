import { describe, expect, it } from 'vitest'

import { PARKINGS } from '@/data/parkings'
import {
	FORECAST_SLOTS,
	bestForecastSlot,
	occupancyForecast,
	peakForecastSlot,
} from './occupancy-forecast'
import type { Parking } from '@/lib/types'

const lot = PARKINGS.find(p => p.id === 'magic-city') as Parking

// The curve is generated from a per-lot peakProfile rather than 56
// hand-written numbers. That only holds up if it is stable and stays in
// range — an unstable chart would twitch on every render and disagree
// between server and client.
describe('occupancyForecast', () => {
	it('returns one point per slot', () => {
		expect(occupancyForecast(lot)).toHaveLength(FORECAST_SLOTS.length)
	})

	it('is deterministic for a given lot', () => {
		expect(occupancyForecast(lot)).toEqual(occupancyForecast(lot))
	})

	it('starts from the lot as it actually stands, not a prediction', () => {
		const [now] = occupancyForecast(lot)
		const occupied = Math.round(
			((lot.totalSpaces - lot.availableSpaces) / lot.totalSpaces) * 100,
		)
		expect(now.label).toBe('Hozir')
		expect(now.percent).toBe(occupied)
	})

	it('keeps every point inside 0-100', () => {
		for (const parking of PARKINGS) {
			for (const point of occupancyForecast(parking)) {
				expect(point.percent).toBeGreaterThanOrEqual(0)
				expect(point.percent).toBeLessThanOrEqual(100)
			}
		}
	})

	it('gives different peak profiles genuinely different shapes', () => {
		// Slot 0 is live occupancy rather than a prediction, so a lot that is
		// full right now peaks at "Hozir" whatever its profile. Compare the
		// forecast slots only.
		const peakOfForecast = (parking: Parking) => {
			const points = occupancyForecast(parking).slice(1)
			return points.indexOf(
				points.reduce((a, b) => (b.percent > a.percent ? b : a)),
			)
		}
		const evening = PARKINGS.find(p => p.peakProfile === 'evening') as Parking
		const morning = PARKINGS.find(p => p.peakProfile === 'morning') as Parking
		expect(peakOfForecast(evening)).toBeGreaterThan(peakOfForecast(morning))
	})
})

describe('slot selectors', () => {
	const points = occupancyForecast(lot)

	it('peak is the highest point', () => {
		expect(peakForecastSlot(points).percent).toBe(
			Math.max(...points.map(p => p.percent)),
		)
	})

	it('best skips "Hozir", since recommending the present says nothing', () => {
		expect(bestForecastSlot(points).index).toBeGreaterThan(0)
		expect(bestForecastSlot(points).percent).toBe(
			Math.min(...points.slice(1).map(p => p.percent)),
		)
	})
})
