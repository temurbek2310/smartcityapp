import { describe, expect, it } from 'vitest'

import { occupancyTone, parkingAvailability } from './availability'
import type { Parking } from '@/lib/types'

const lot = (availableSpaces: number, totalSpaces = 100) =>
	({ availableSpaces, totalSpaces }) as Parking

// Two readings of the same number that answer different questions, which is
// why both exist: "can I park here" from free spaces, and "how busy is this
// hour" from an occupancy percentage.
describe('parkingAvailability', () => {
	it('reports the free percentage', () => {
		expect(parkingAvailability(lot(30)).percent).toBe(30)
	})

	it('flags a full lot', () => {
		expect(parkingAvailability(lot(0)).full).toBe(true)
		expect(parkingAvailability(lot(1)).full).toBe(false)
	})

	it('bands comfortable, tight and critical', () => {
		expect(parkingAvailability(lot(40)).tone.bar).toBe('bg-ok')
		expect(parkingAvailability(lot(20)).tone.bar).toBe('bg-warn')
		expect(parkingAvailability(lot(5)).tone.bar).toBe('bg-bad')
	})

	it('treats a full lot as critical however the percentage rounds', () => {
		expect(parkingAvailability(lot(0)).tone.bar).toBe('bg-bad')
	})

	it('survives a lot with no capacity rather than dividing by zero', () => {
		expect(parkingAvailability(lot(0, 0)).percent).toBe(0)
	})
})

describe('occupancyTone', () => {
	it('is the inverse reading: low load is good', () => {
		expect(occupancyTone(10)).toBe('bg-ok')
		expect(occupancyTone(50)).toBe('bg-warn')
		expect(occupancyTone(80)).toBe('bg-load-high')
		expect(occupancyTone(95)).toBe('bg-bad')
	})

	it('bands on the documented boundaries', () => {
		expect(occupancyTone(39)).toBe('bg-ok')
		expect(occupancyTone(40)).toBe('bg-warn')
		expect(occupancyTone(69)).toBe('bg-warn')
		expect(occupancyTone(70)).toBe('bg-load-high')
		expect(occupancyTone(89)).toBe('bg-load-high')
		expect(occupancyTone(90)).toBe('bg-bad')
	})
})
