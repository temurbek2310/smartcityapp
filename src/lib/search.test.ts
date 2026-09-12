import { describe, expect, it } from 'vitest'

import {
	findAddresses,
	highlightParts,
	searchMatches,
	streetOf,
} from '@/lib/search'

describe('searchMatches', () => {
	it('matches on the whole string', () => {
		expect(searchMatches('Plov Center', 'plov cen')).toBe(true)
	})

	it('falls back to any token over two characters', () => {
		expect(searchMatches('Plov Center', 'plov markaz')).toBe(true)
	})

	it('ignores short tokens so "a b" does not match everything', () => {
		expect(searchMatches('Plov Center', 'xy zw')).toBe(false)
	})

	it('is false for an empty query', () => {
		expect(searchMatches('Plov Center', '   ')).toBe(false)
	})
})

describe('streetOf', () => {
	it('drops the house number', () => {
		expect(streetOf('Amir Temur ko‘chasi, 88')).toBe('Amir Temur ko‘chasi')
	})

	it('leaves an address with no comma alone', () => {
		expect(streetOf('Chorsu')).toBe('Chorsu')
	})
})

describe('findAddresses', () => {
	const entries = [
		{ address: 'Amir Temur ko‘chasi, 88', parkingId: 'amir-temur' },
		{ address: 'Amir Temur ko‘chasi, 60', parkingId: 'amir-temur' },
		{ address: 'Nukus ko‘chasi, 12', parkingId: 'next-mall' },
		// No parking to route to, so it cannot be offered as a destination.
		{ address: 'Navoiy ko‘chasi, 24', parkingId: null },
	]

	it('groups entries by street and counts them', () => {
		const hits = findAddresses('ko‘chasi', entries)
		expect(hits[0]).toEqual({
			street: 'Amir Temur ko‘chasi',
			parkingId: 'amir-temur',
			count: 2,
		})
	})

	it('skips entries with nowhere to route', () => {
		expect(findAddresses('Navoiy', entries)).toEqual([])
	})

	it('returns nothing when the street does not match', () => {
		expect(findAddresses('Bobur', entries)).toEqual([])
	})
})

describe('highlightParts', () => {
	it('splits around a direct match', () => {
		expect(highlightParts('Coffee Lab', 'ffee')).toEqual([
			'Co',
			'ffee',
			' Lab',
		])
	})

	it('is case-insensitive but preserves the original casing', () => {
		expect(highlightParts('Coffee Lab', 'COFFEE')).toEqual([
			'',
			'Coffee',
			' Lab',
		])
	})

	it('falls back to the longest matching token', () => {
		expect(highlightParts('Plov Center', 'markaz plov')).toEqual([
			'',
			'Plov',
			' Center',
		])
	})

	it('marks nothing when the query does not appear', () => {
		expect(highlightParts('Coffee Lab', 'zzz')).toEqual(['Coffee Lab', '', ''])
	})

	it('marks nothing for an empty query', () => {
		expect(highlightParts('Coffee Lab', '')).toEqual(['Coffee Lab', '', ''])
	})
})
