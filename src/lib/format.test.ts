import { describe, expect, it } from 'vitest'

import {
	formatDate,
	formatDateTime,
	formatDistance,
	formatDuration,
	formatNumber,
	formatTime,
	formatUZS,
} from './format'

// Chrome ships no CLDR data for `uz`, so these are hand-rolled from uz-Latn
// patterns. Node's full-ICU build hides the problem, which is exactly why
// this file asserts the output rather than trusting Intl.

describe('formatNumber', () => {
	it('groups thousands with a non-breaking space, not a comma', () => {
		// The comma was the live bug: Intl fell back to the root locale.
		expect(formatNumber(12000)).toBe('12\u00a0000')
		expect(formatNumber(1234567)).toBe('1\u00a0234\u00a0567')
	})

	it('leaves values under a thousand ungrouped', () => {
		expect(formatNumber(0)).toBe('0')
		expect(formatNumber(999)).toBe('999')
	})

	it('rounds rather than truncating', () => {
		expect(formatNumber(1499.6)).toBe('1\u00a0500')
	})

	it('keeps the sign on negatives', () => {
		expect(formatNumber(-12000)).toBe('-12\u00a0000')
	})
})

describe('formatUZS', () => {
	it('appends the currency with the uz-Latn turned comma', () => {
		expect(formatUZS(12000)).toBe('12\u00a0000 soʻm')
	})
})

describe('formatDistance', () => {
	it('uses metres below a kilometre', () => {
		expect(formatDistance(0.033)).toBe('33 m')
		expect(formatDistance(0.999)).toBe('999 m')
	})

	it('carries into the whole number instead of printing a tenth of 10', () => {
		// The live bug: rounding the fraction alone produced "2,10 km".
		expect(formatDistance(2.96)).toBe('3,0 km')
		expect(formatDistance(2.95)).toBe('3,0 km')
		expect(formatDistance(9.99)).toBe('10,0 km')
	})

	it('uses a decimal comma and groups the whole part', () => {
		expect(formatDistance(2.0956)).toBe('2,1 km')
		expect(formatDistance(203.3)).toBe('203,3 km')
		expect(formatDistance(1234.5)).toBe('1\u00a0234,5 km')
	})

	it('refuses nonsense rather than rendering NaN', () => {
		expect(formatDistance(Number.NaN)).toBe('—')
		expect(formatDistance(-1)).toBe('—')
	})
})

describe('date formatting', () => {
	// 2026-09-11T11:30 Tashkent (UTC+5).
	const moment = '2026-09-11T06:30:00.000Z'

	it('renders the uz-Latn short date, not the root-locale "2026 M09 11"', () => {
		expect(formatDate(moment)).toBe('11-sen, 2026')
	})

	it('renders time on Tashkent wall clock regardless of host timezone', () => {
		expect(formatTime(moment)).toBe('11:30')
	})

	it('joins date and time the way the reference does', () => {
		expect(formatDateTime(moment)).toBe('11-sen, 2026, 11:30')
	})

	it('pads midnight rather than rendering hour 24', () => {
		// 2026-01-01T00:05 Tashkent.
		expect(formatTime('2025-12-31T19:05:00.000Z')).toBe('00:05')
	})
})

describe('formatDuration', () => {
	it('renders hh:mm:ss zero-padded', () => {
		expect(formatDuration(3_661_000)).toBe('01:01:01')
	})

	it('clamps negatives to zero so an expired timer does not count up', () => {
		expect(formatDuration(-5000)).toBe('00:00:00')
	})
})
