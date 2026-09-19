import { describe, expect, it } from 'vitest'

import {
	displayUzbekPlate,
	formatUzbekPlate,
	NO_PLATE,
	normalizeUzbekPlate,
} from './plate'

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

// The crash these guard against: /session/[id] read a reservation whose
// profile had no plate to copy, and formatting undefined took the whole
// screen down — an entire booking unreachable over a missing field.
//
// The types say `string`, but these two functions read persisted state, and
// nothing validates what comes back out of localStorage.
describe('a plate that is not there', () => {
	const missing = [undefined, null, '', '   ', '---'] as const

	it('normalises to empty instead of throwing', () => {
		for (const value of missing) {
			expect(() => normalizeUzbekPlate(value)).not.toThrow()
			expect(normalizeUzbekPlate(value)).toBe('')
		}
	})

	it('formats to empty instead of throwing', () => {
		for (const value of missing) {
			expect(() => formatUzbekPlate(value)).not.toThrow()
			expect(formatUzbekPlate(value)).toBe('')
		}
	})

	// The registration field has to stay empty while it is being typed into,
	// so the em dash belongs to the read-only screens rather than to the
	// formatter every keystroke goes through.
	it('shows a dash only where a value is being displayed', () => {
		for (const value of missing) {
			expect(displayUzbekPlate(value)).toBe(NO_PLATE)
		}
		expect(displayUzbekPlate(undefined, 'Kiritilmagan')).toBe('Kiritilmagan')
	})

	it('leaves a real plate exactly as it was', () => {
		expect(displayUzbekPlate('01 A 777 AA')).toBe('01 A 777 AA')
		expect(displayUzbekPlate('01a777aa')).toBe('01 A 777 AA')
		// The digit-third layout still groups its own way.
		expect(displayUzbekPlate('01777AAA')).toBe('01 777 AAA')
	})
})
