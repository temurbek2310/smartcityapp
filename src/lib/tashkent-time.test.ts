import { describe, expect, it } from 'vitest'

import { formatDateTime, formatTime } from '@/lib/format'

import {
	addTashkentDays,
	nextTashkentQuarterInstant,
	tashkentDayDiff,
	tashkentDayKey,
	tashkentDayKeys,
	tashkentHour,
	tashkentParts,
	tashkentTime,
	tashkentWallClockInstant,
	UZ_TIME_ZONE,
	UZ_UTC_OFFSET,
} from './tashkent-time'

// These rules must not depend on the machine running them. `npm run test:tz`
// runs this file under Asia/Tashkent, UTC, America/New_York and a half-hour
// zone; the guard below proves each of those runs really changed the host
// zone rather than silently running four times in one.
const at = (value: string) => new Date(value)
const iso = (value: Date) => value.toISOString()

describe('host timezone', () => {
	it('is the one the matrix asked for', () => {
		const requested = process.env.TZ
		if (!requested) return
		// Compared canonically: ICU reports Asia/Kolkata as Asia/Calcutta.
		const canonical = new Intl.DateTimeFormat('en-US', { timeZone: requested })
			.resolvedOptions().timeZone
		expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(canonical)
	})
})

describe('canonical zone', () => {
	it('is Tashkent at a fixed +05:00', () => {
		expect(UZ_TIME_ZONE).toBe('Asia/Tashkent')
		expect(UZ_UTC_OFFSET).toBe('+05:00')
	})

	it('has no daylight saving: +05:00 in January and July alike', () => {
		for (const day of ['2026-01-15', '2026-07-15']) {
			expect(tashkentWallClockInstant(day, '12:00').getTime()).toBe(
				Date.parse(`${day}T07:00:00.000Z`),
			)
		}
	})
})

describe('wall clock → instant', () => {
	it('24 Sep 2026 14:00 Tashkent is 09:00Z', () => {
		expect(iso(tashkentWallClockInstant('2026-09-24', '14:00'))).toBe(
			'2026-09-24T09:00:00.000Z',
		)
	})

	it('Tashkent midnight is 19:00Z the evening before', () => {
		expect(iso(tashkentWallClockInstant('2026-09-25', '00:00'))).toBe(
			'2026-09-24T19:00:00.000Z',
		)
	})

	it('round-trips through the day key and time', () => {
		const instant = tashkentWallClockInstant('2026-09-24', '23:45')
		expect(tashkentDayKey(instant)).toBe('2026-09-24')
		expect(tashkentTime(instant)).toBe('23:45')
	})
})

describe('instant → wall clock', () => {
	it('reads the Tashkent parts regardless of the device', () => {
		expect(tashkentParts('2026-09-24T09:00:00.000Z')).toEqual({
			year: 2026,
			month: 9,
			day: 24,
			hour: 14,
			minute: 0,
		})
	})

	it('puts 19:30Z on the next Tashkent day', () => {
		expect(tashkentDayKey('2026-09-24T19:30:00.000Z')).toBe('2026-09-25')
		expect(tashkentDayKey('2026-09-24T18:59:00.000Z')).toBe('2026-09-24')
	})

	it('tashkentHour: 09:00Z counts as 14, midnight as 0', () => {
		expect(tashkentHour('2026-09-24T09:00:00.000Z')).toBe(14)
		expect(tashkentHour('2026-09-24T19:00:00.000Z')).toBe(0)
		expect(tashkentHour('2026-09-24T18:59:00.000Z')).toBe(23)
	})
})

describe('calendar days', () => {
	it('adds whole Tashkent days across month and year ends', () => {
		expect(addTashkentDays('2026-09-24', 1)).toBe('2026-09-25')
		expect(addTashkentDays('2026-09-30', 1)).toBe('2026-10-01')
		expect(addTashkentDays('2026-12-31', 1)).toBe('2027-01-01')
		expect(addTashkentDays('2026-03-01', -1)).toBe('2026-02-28')
	})

	it('counts the days between two keys', () => {
		expect(tashkentDayDiff('2026-09-24', '2026-09-24')).toBe(0)
		expect(tashkentDayDiff('2026-09-24', '2026-09-27')).toBe(3)
		expect(tashkentDayDiff('2026-12-31', '2027-01-01')).toBe(1)
	})

	it('starts the list on the Tashkent day, even when UTC is still on yesterday', () => {
		// 00:30 Tashkent on the 25th is 19:30Z on the 24th.
		expect(tashkentDayKeys(at('2026-09-24T19:30:00.000Z'), 3)).toEqual([
			'2026-09-25',
			'2026-09-26',
			'2026-09-27',
		])
	})
})

describe('nextTashkentQuarterInstant', () => {
	const next = (tashkent: string, lead = 15) =>
		iso(nextTashkentQuarterInstant(at(`${tashkent}+05:00`), lead))

	it('rounds up to the quarter after the lead', () => {
		expect(next('2026-09-24T14:07:00')).toBe(iso(at('2026-09-24T14:30:00+05:00')))
		expect(next('2026-09-24T14:52:00')).toBe(iso(at('2026-09-24T15:15:00+05:00')))
	})

	it('leaves an exact quarter where the lead lands it', () => {
		expect(next('2026-09-24T14:00:00')).toBe(iso(at('2026-09-24T14:15:00+05:00')))
		expect(next('2026-09-24T14:00:00', 0)).toBe(iso(at('2026-09-24T14:00:00+05:00')))
	})

	it('ignores seconds, the way the sheet always has', () => {
		expect(next('2026-09-24T14:00:59')).toBe(iso(at('2026-09-24T14:15:00+05:00')))
	})

	it('crosses Tashkent midnight onto the next day', () => {
		expect(next('2026-09-24T23:55:00')).toBe(iso(at('2026-09-25T00:15:00+05:00')))
		expect(next('2026-09-24T23:45:00')).toBe(iso(at('2026-09-25T00:00:00+05:00')))
		expect(next('2026-12-31T23:50:00')).toBe(iso(at('2027-01-01T00:15:00+05:00')))
	})
})

describe('legacy stored instants', () => {
	// One localStorage blob, no schema version: an old record cannot say which
	// device wrote it, so it is read exactly as the instant it names.
	it('reads a stored Z timestamp as its own instant, never as Tashkent wall clock', () => {
		const stored = '2026-09-24T14:00:00.000Z'
		expect(new Date(stored).toISOString()).toBe(stored)
		expect(formatTime(stored)).toBe('19:00')
		expect(formatDateTime(stored)).toBe('24-sen, 2026, 19:00')
		expect(tashkentHour(stored)).toBe(19)
	})

	it('honours an explicit offset a stored value carries', () => {
		expect(formatTime('2026-09-24T14:00:00.000+05:00')).toBe('14:00')
	})
})
