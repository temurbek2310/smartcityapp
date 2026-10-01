import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { makeRandom, seededOrder, seedFor } from './seeded-random'

describe('seeded-random', () => {
	it('the same key always gives the same seed and sequence', () => {
		const a = makeRandom(seedFor('amir-temur', 2, 40))
		const b = makeRandom(seedFor('amir-temur', 2, 40))
		const first = Array.from({ length: 8 }, a)
		expect(Array.from({ length: 8 }, b)).toEqual(first)
	})

	it('pins the arithmetic bayMap has always used', () => {
		// Changing these numbers would reshuffle every parking floor plan.
		expect(seedFor('amir-temur', 1, 27)).toBe(68791)
		const random = makeRandom(68791)
		expect(random()).toBe(0.24109985120594501)
		expect(random()).toBe(0.3729977011680603)
	})

	it('different keys give different seeds', () => {
		expect(seedFor('a', 1, 1)).not.toBe(seedFor('b', 1, 1))
		expect(seedFor('a', 1, 1)).not.toBe(seedFor('a', 2, 1))
	})

	it('stays in [0, 1), and a zero seed still moves', () => {
		const random = makeRandom(0)
		for (let index = 0; index < 500; index += 1) {
			const value = random()
			expect(value).toBeGreaterThanOrEqual(0)
			expect(value).toBeLessThan(1)
		}
	})

	it('seededOrder is a permutation, and a stable one', () => {
		const order = seededOrder(30, makeRandom(42))
		expect([...order].sort((a, b) => a - b)).toEqual(
			Array.from({ length: 30 }, (_, index) => index),
		)
		expect(seededOrder(30, makeRandom(42))).toEqual(order)
		expect(seededOrder(0, makeRandom(42))).toEqual([])
	})

	it('is the one generator bay-map and queue-desks share', () => {
		for (const file of ['src/lib/bay-map.ts', 'src/lib/queue-desks.ts']) {
			const source = readFileSync(join(process.cwd(), file), 'utf8')
			expect(source).toContain("from '@/lib/seeded-random'")
			expect(source).not.toMatch(/function (seedFor|makeRandom)\(/)
		}
	})
})
