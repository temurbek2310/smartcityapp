import { describe, expect, it } from 'vitest'

import { joinLineSegments, parseWktLineString } from '@/lib/wkt'

describe('parseWktLineString', () => {
	it('reads a LINESTRING of "lon lat" pairs', () => {
		expect(parseWktLineString('LINESTRING(69.2797 41.3111, 69.2801 41.3120)')).toEqual([
			[69.2797, 41.3111],
			[69.2801, 41.312],
		])
	})

	it('tolerates whitespace and case', () => {
		expect(
			parseWktLineString('  linestring (  69.1   41.2 ,\n 69.3\t41.4  )  '),
		).toEqual([
			[69.1, 41.2],
			[69.3, 41.4],
		])
	})

	it('keeps full decimal precision, negative and signed values', () => {
		expect(parseWktLineString('LINESTRING(-0.1278 51.5074, +2.35222 -48.85661, 1e-3 .5)')).toEqual([
			[-0.1278, 51.5074],
			[2.35222, -48.85661],
			[0.001, 0.5],
		])
	})

	it('reads a single segment of exactly two points', () => {
		expect(parseWktLineString('LINESTRING(1 2, 3 4)')).toHaveLength(2)
	})

	it('refuses empty geometry', () => {
		expect(parseWktLineString('LINESTRING EMPTY')).toBeNull()
		expect(parseWktLineString('LINESTRING()')).toBeNull()
		expect(parseWktLineString('')).toBeNull()
	})

	it('refuses a single point — not a line', () => {
		expect(parseWktLineString('LINESTRING(69.1 41.2)')).toBeNull()
	})

	it('refuses malformed input rather than guessing coordinates', () => {
		for (const wkt of [
			'POINT(69.1 41.2)',
			'LINESTRING(69.1 41.2, 69.3)',
			'LINESTRING(69.1 41.2, 69.3 41.4 12)',
			'LINESTRING(69.1 41.2,, 69.3 41.4)',
			'LINESTRING(69.1 41.2, abc 41.4)',
			'LINESTRING(69.1 41.2, 69.3 41.4',
			'LINESTRING(69.1 41.2, 69.3 41.4) trailing',
			'LINESTRING(69.1 41.2, 200 41.4)',
			'LINESTRING(69.1 41.2, 69.3 95)',
			'LINESTRING(69.1 41.2, NaN 41.4)',
			'LINESTRING(69.1 41.2, Infinity 41.4)',
			'MULTILINESTRING((1 2, 3 4))',
		]) {
			expect(parseWktLineString(wkt), wkt).toBeNull()
		}
	})

	it('refuses non-strings', () => {
		expect(parseWktLineString(undefined)).toBeNull()
		expect(parseWktLineString(null)).toBeNull()
		expect(parseWktLineString(42)).toBeNull()
	})
})

describe('joinLineSegments', () => {
	it('drops the joint two consecutive segments share', () => {
		expect(
			joinLineSegments([
				[[1, 1], [2, 2]],
				[[2, 2], [3, 3]],
				[[3, 3], [4, 4]],
			]),
		).toEqual([[1, 1], [2, 2], [3, 3], [4, 4]])
	})

	it('keeps both ends when segments do not touch', () => {
		expect(
			joinLineSegments([
				[[1, 1], [2, 2]],
				[[2.5, 2.5], [3, 3]],
			]),
		).toEqual([[1, 1], [2, 2], [2.5, 2.5], [3, 3]])
	})

	it('handles one segment and none', () => {
		expect(joinLineSegments([[[1, 1], [2, 2]]])).toEqual([[1, 1], [2, 2]])
		expect(joinLineSegments([])).toEqual([])
	})
})
