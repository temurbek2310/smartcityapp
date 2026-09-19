import { describe, expect, it } from 'vitest'

import { bayMap, firstFreeBay, isBaySelectable } from '@/lib/bay-map'
import { PARKINGS } from '@/data/parkings'

const magicCity = PARKINGS.find(parking => parking.id === 'magic-city')!
const nextMall = PARKINGS.find(parking => parking.id === 'next-mall')!

describe('bayMap', () => {
	it('is stable for the same lot and level', () => {
		const first = bayMap(magicCity, 1)
		const second = bayMap(magicCity, 1)
		expect(second.bays).toEqual(first.bays)
	})

	it('lays out a different plan per level', () => {
		const one = bayMap(magicCity, 1).bays.map(bay => bay.state)
		const two = bayMap(magicCity, 2).bays.map(bay => bay.state)
		expect(two).not.toEqual(one)
	})

	it('splits the lot across its levels', () => {
		const { bays } = bayMap(magicCity, 1)
		expect(bays).toHaveLength(
			Math.round(magicCity.totalSpaces / magicCity.levels),
		)
	})

	it('labels bays by row letter and running number', () => {
		const { bays } = bayMap(magicCity, 1)
		expect(bays[0].id).toBe('A-01')
		expect(bays[5].id).toBe('A-06')
		expect(bays[6].id).toBe('B-07')
	})

	it('leaves exactly this level’s share of the lot pickable', () => {
		const { bays } = bayMap(magicCity, 1)
		const pickable = bays.filter(bay => isBaySelectable(bay.state)).length
		expect(pickable).toBe(
			Math.round(magicCity.availableSpaces / magicCity.levels),
		)
	})

	it('leaves a full lot with nothing pickable at all', () => {
		expect(nextMall.availableSpaces).toBe(0)
		const { bays } = bayMap(nextMall, 1)
		expect(bays.every(bay => bay.state === 'busy')).toBe(true)
	})

	it('marks the held bay as the user’s own', () => {
		const { bays } = bayMap(magicCity, 1, 'A-01')
		expect(bays.find(bay => bay.id === 'A-01')?.state).toBe('mine')
	})

	it('draws EV bays from the free ones rather than adding to them', () => {
		const { bays } = bayMap(magicCity, 1)
		const ev = bays.filter(bay => bay.state === 'ev').length
		expect(ev).toBe(Math.round(magicCity.evChargers / magicCity.levels))
		expect(ev).toBeGreaterThan(0)
	})
})

describe('isBaySelectable', () => {
	it('rejects busy bays and the one already held', () => {
		expect(isBaySelectable('busy')).toBe(false)
		expect(isBaySelectable('mine')).toBe(false)
		expect(isBaySelectable('free')).toBe(true)
		expect(isBaySelectable('ev')).toBe(true)
		expect(isBaySelectable('accessible')).toBe(true)
	})
})

describe('firstFreeBay', () => {
	it('finds a pickable bay on a lot with space', () => {
		const bay = firstFreeBay(magicCity, 1)
		expect(bay).toMatch(/^[A-H]-\d\d$/)
	})

	it('returns null when the level has nothing to pick', () => {
		expect(firstFreeBay(nextMall, 1)).toBeNull()
	})

	// The floor plan draws a bay the customer already holds as «yours» and
	// refuses to select it, so an auto-pick that lands on one opens the sheet
	// on a bay its own confirm button rejects.
	it('skips a bay the customer already holds here', () => {
		const first = firstFreeBay(magicCity, 1)!
		const next = firstFreeBay(magicCity, 1, [first])
		expect(next).not.toBe(first)
		expect(next).toMatch(/^[A-H]-\d\d$/)
	})

	it('returns null when every pickable bay is excluded', () => {
		const { bays } = bayMap(magicCity, 1)
		const all = bays.filter(bay => isBaySelectable(bay.state)).map(bay => bay.id)
		expect(firstFreeBay(magicCity, 1, all)).toBeNull()
	})
})
