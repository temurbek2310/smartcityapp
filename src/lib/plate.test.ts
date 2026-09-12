import { describe, expect, it } from 'vitest'

import { formatUzbekPlate, normalizeUzbekPlate } from './plate'

// The plate is handed to the venue so security recognises the car on
// arrival, and it is typed on a phone keyboard — so it has to survive
// lowercase, missing spaces and stray punctuation.
describe('normalizeUzbekPlate', () => {
	it('upper-cases and strips everything that is not a letter or digit', () => {
		expect(normalizeUzbekPlate('01 a 777 aa')).toBe('01A777AA')
		expect(normalizeUzbekPlate('01-A-777-AA')).toBe('01A777AA')
	})

	it('caps at the plate length so a runaway paste cannot overflow it', () => {
		expect(normalizeUzbekPlate('01A777AAEXTRA').length).toBeLessThanOrEqual(8)
	})
})

describe('formatUzbekPlate', () => {
	it('groups the letter-third layout', () => {
		expect(formatUzbekPlate('01A777AA')).toBe('01 A 777 AA')
	})

	it('formats progressively, so it is safe on every keystroke', () => {
		expect(formatUzbekPlate('0')).toBe('0')
		expect(formatUzbekPlate('01')).toBe('01')
		expect(formatUzbekPlate('01A')).toBe('01 A')
		expect(formatUzbekPlate('01A7')).toBe('01 A 7')
	})

	it('is idempotent, so reformatting its own output does not drift', () => {
		const once = formatUzbekPlate('01A777AA')
		expect(formatUzbekPlate(once)).toBe(once)
	})
})
