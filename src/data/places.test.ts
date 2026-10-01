import { describe, expect, it } from 'vitest'

import {
	DEFAULT_SEATING_AREA,
	PLACES,
	tableBookablePlaces,
	tableSeatingAreas,
} from '@/data/places'

// The generic «Stol bron qilish» picker reads this and nothing else. If it
// ever returns a car park or a museum the customer is offered a table
// somewhere that has none; if it returns nothing the shortcut dead-ends.
describe('tableBookablePlaces', () => {
	it('offers only food venues', () => {
		const list = tableBookablePlaces()
		expect(list.length).toBeGreaterThan(0)
		expect(list.every(place => place.category === 'food')).toBe(true)
	})

	it('offers every food venue in the catalog', () => {
		expect(tableBookablePlaces().map(place => place.id).sort()).toEqual(
			PLACES.filter(place => place.category === 'food')
				.map(place => place.id)
				.sort(),
		)
	})

	it('leaves out malls, parks, clinics and the rest', () => {
		const ids = tableBookablePlaces().map(place => place.id)
		for (const id of [
			'magic-city-place',
			'tashkent-city-park',
			'medical-plaza',
			'chorsu-bazaar',
			'history-museum',
			'cinema-magic',
		]) {
			expect(ids).not.toContain(id)
		}
	})

	it('keeps Urban Food as one option among several rather than the default', () => {
		const ids = tableBookablePlaces().map(place => place.id)
		expect(ids).toContain('urban-food')
		expect(ids).toContain('coffee-lab')
		expect(ids).toContain('basilic-cafe')
		expect(ids.length).toBeGreaterThan(1)
	})

	it('sorts nearest first', () => {
		const distances = tableBookablePlaces().map(place => place.distanceKm)
		expect(distances).toEqual([...distances].sort((a, b) => a - b))
	})

	it('gives every option the name and address the picker prints', () => {
		for (const place of tableBookablePlaces()) {
			expect(place.title.length).toBeGreaterThan(0)
			expect(place.address.length).toBeGreaterThan(0)
			expect(place.subtitle.length).toBeGreaterThan(0)
		}
	})
})

// The seating picker reads the venue's own tags; a venue that names no room
// of its own still has its main hall, and that is the default.
describe('tableSeatingAreas', () => {
	it('always offers the main hall first', () => {
		for (const place of tableBookablePlaces()) {
			expect(tableSeatingAreas(place)[0]).toBe(DEFAULT_SEATING_AREA)
		}
		expect(tableSeatingAreas(undefined)).toEqual([DEFAULT_SEATING_AREA])
	})

	it('adds only the rooms a venue is tagged with', () => {
		expect(tableSeatingAreas({ tags: ['Wi-Fi', 'Veranda'] })).toEqual([
			'Asosiy zal',
			'Veranda',
		])
		expect(tableSeatingAreas({ tags: ['Parking', 'Banket'] })).toEqual([
			'Asosiy zal',
			'Banket zali',
		])
		expect(tableSeatingAreas({ tags: ['Nonushta', 'Wi-Fi'] })).toEqual(['Asosiy zal'])
	})
})
