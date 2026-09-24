import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { arrivalStage, reservationJourney } from '@/lib/booking-journey'
import { formatDateTime, formatTime } from '@/lib/format'
import { findOverlappingReservation } from '@/lib/reservation'
import type { Reservation } from '@/lib/types'

import {
	isParkingStartPast,
	PARKING_ARRIVAL_SLOTS,
	PARKING_NOW_SLOT,
	parkingBookingDays,
	parkingBookingWindow,
	parkingStartInstant,
} from './parking-time'

// The bug this file pins down: the sheet built its start with setDate() and
// setHours() in the device's timezone, so «Bugun 14:00» on a phone set to UTC
// stored 14:00Z — 19:00 in Tashkent. Every expectation below is an absolute
// instant, and `npm run test:tz` runs the file under several host zones.
const tk = (value: string) => new Date(`${value}+05:00`)
const iso = (value: Date) => value.toISOString()

// 24 Sep 2026, 11:00 in Tashkent.
const MORNING = tk('2026-09-24T11:00:00')

describe('explicit day and time', () => {
	it('24-sen 14:00 is 2026-09-24T09:00:00.000Z', () => {
		expect(
			iso(parkingStartInstant({ dayKey: '2026-09-24', time: '14:00', now: MORNING })),
		).toBe('2026-09-24T09:00:00.000Z')
	})

	it('does not depend on the `now` it is read against', () => {
		for (const now of [MORNING, tk('2026-09-20T03:00:00'), Date.parse('2026-09-24T22:00:00Z')]) {
			expect(
				iso(parkingStartInstant({ dayKey: '2026-09-24', time: '14:00', now })),
			).toBe('2026-09-24T09:00:00.000Z')
		}
	})

	it('computes the end the way the store does', () => {
		const { startAt, endAt } = parkingBookingWindow({
			dayKey: '2026-09-24',
			time: '14:00',
			hours: 2,
			now: MORNING,
		})
		expect(iso(startAt)).toBe('2026-09-24T09:00:00.000Z')
		expect(iso(endAt)).toBe('2026-09-24T11:00:00.000Z')
	})
})

describe('day chips', () => {
	it('Bugun, Ertaga and two dates, from the Tashkent calendar', () => {
		expect(parkingBookingDays(MORNING)).toEqual([
			{ key: '2026-09-24', label: 'Bugun' },
			{ key: '2026-09-25', label: 'Ertaga' },
			{ key: '2026-09-26', label: '26-sen' },
			{ key: '2026-09-27', label: '27-sen' },
		])
	})

	it('each chip books the date it displays', () => {
		for (const [index, day] of parkingBookingDays(MORNING).entries()) {
			const start = parkingStartInstant({ dayKey: day.key, time: '14:00', now: MORNING })
			expect(iso(start)).toBe(iso(tk(`${day.key}T14:00:00`)))
			if (index >= 2) expect(formatDateTime(start)).toBe(`${day.label}, 2026, 14:00`)
		}
		const [, ertaga, third] = parkingBookingDays(MORNING)
		expect(
			iso(parkingStartInstant({ dayKey: ertaga.key, time: '14:00', now: MORNING })),
		).toBe('2026-09-25T09:00:00.000Z')
		expect(third.label).toBe('26-sen')
		expect(
			iso(parkingStartInstant({ dayKey: third.key, time: '14:00', now: MORNING })),
		).toBe('2026-09-26T09:00:00.000Z')
	})

	it('rolls over at Tashkent midnight, not UTC or device midnight', () => {
		// 00:10 Tashkent on the 25th — still the 24th in UTC and New York.
		const justAfter = tk('2026-09-25T00:10:00')
		const days = parkingBookingDays(justAfter)
		expect(days[0]).toEqual({ key: '2026-09-25', label: 'Bugun' })
		expect(days[1]).toEqual({ key: '2026-09-26', label: 'Ertaga' })

		// 23:50 Tashkent on the 24th — already the 25th nowhere yet.
		const justBefore = tk('2026-09-24T23:50:00')
		expect(parkingBookingDays(justBefore)[0].key).toBe('2026-09-24')
	})

	it('a later-day slot around midnight is not falsely past', () => {
		const now = tk('2026-09-24T23:50:00')
		const [, ertaga] = parkingBookingDays(now)
		const start = parkingStartInstant({ dayKey: ertaga.key, time: '11:30', now })
		expect(iso(start)).toBe('2026-09-25T06:30:00.000Z')
		expect(isParkingStartPast(start, now)).toBe(false)
	})
})

describe('Hozir', () => {
	const hozir = (now: Date, dayKey = '2026-09-24') =>
		iso(parkingStartInstant({ dayKey, time: PARKING_NOW_SLOT, now }))

	it('is the next Tashkent quarter-hour at least 15 minutes out', () => {
		expect(hozir(tk('2026-09-24T14:07:00'))).toBe(iso(tk('2026-09-24T14:30:00')))
		expect(hozir(tk('2026-09-24T14:52:00'))).toBe(iso(tk('2026-09-24T15:15:00')))
		expect(hozir(tk('2026-09-24T14:00:00'))).toBe(iso(tk('2026-09-24T14:15:00')))
	})

	it('crosses Tashkent midnight', () => {
		expect(hozir(tk('2026-09-24T23:55:00'))).toBe(iso(tk('2026-09-25T00:15:00')))
	})

	it('on a later chip keeps the same quarter, that many days on', () => {
		expect(hozir(tk('2026-09-24T14:07:00'), '2026-09-25')).toBe(
			iso(tk('2026-09-25T14:30:00')),
		)
		expect(hozir(tk('2026-09-24T23:55:00'), '2026-09-25')).toBe(
			iso(tk('2026-09-26T00:15:00')),
		)
	})

	it('is never in the past', () => {
		const now = tk('2026-09-24T14:07:00')
		expect(
			isParkingStartPast(
				parkingStartInstant({ dayKey: '2026-09-24', time: PARKING_NOW_SLOT, now }),
				now,
			),
		).toBe(false)
	})

	it('the sheet shows the time that is stored', () => {
		const start = parkingStartInstant({
			dayKey: '2026-09-24',
			time: PARKING_NOW_SLOT,
			now: tk('2026-09-24T14:07:00'),
		})
		expect(formatTime(start)).toBe('14:30')
	})
})

describe('past check', () => {
	const start = parkingStartInstant({ dayKey: '2026-09-24', time: '14:00', now: MORNING })

	it('14:00 today is fine at 13:40 Tashkent', () => {
		expect(isParkingStartPast(start, tk('2026-09-24T13:40:00'))).toBe(false)
	})

	it('14:00 today is past at 14:01 Tashkent', () => {
		expect(isParkingStartPast(start, tk('2026-09-24T14:01:00'))).toBe(true)
	})

	it('exact boundaries: one ms before is future, the moment itself is past', () => {
		expect(isParkingStartPast(start, start.getTime() - 1)).toBe(false)
		expect(isParkingStartPast(start, start.getTime())).toBe(true)
	})

	it('every fixed arrival slot is on Tashkent time', () => {
		for (const slot of PARKING_ARRIVAL_SLOTS) {
			if (slot === PARKING_NOW_SLOT) continue
			const at = parkingStartInstant({ dayKey: '2026-09-24', time: slot, now: MORNING })
			expect(formatTime(at)).toBe(slot)
		}
	})
})

describe('lifecycle and arrival window', () => {
	const start = iso(parkingStartInstant({ dayKey: '2026-09-24', time: '14:00', now: MORNING }))
	const reserved = { status: 'reserved' as const, startAt: start }
	const dest = { hasDestination: true }

	it('the arrival window opens at 13:30 Tashkent', () => {
		expect(arrivalStage(start, tk('2026-09-24T13:29:59').getTime())).toBe('upcoming')
		expect(arrivalStage(start, tk('2026-09-24T13:30:00').getTime())).toBe('arrival')
	})

	it('13:29 leads with Yo‘nalish, 13:30 with Parkingga kirish', () => {
		expect(reservationJourney(reserved, tk('2026-09-24T13:29:00').getTime(), dest).primary).toBe(
			'directions',
		)
		expect(reservationJourney(reserved, tk('2026-09-24T13:30:00').getTime(), dest).primary).toBe(
			'enter',
		)
	})

	it('stays reserved long after its start — parking never completes on the clock', () => {
		const late = tk('2026-09-25T09:00:00').getTime()
		expect(reservationJourney(reserved, late, dest).stage).toBe('arrival')
	})
})

describe('overlap', () => {
	const existing: Reservation = {
		id: 'a',
		parkingId: 'p1',
		userPhone: '+998900000000',
		...(() => {
			const { startAt, endAt } = parkingBookingWindow({
				dayKey: '2026-09-24',
				time: '12:00',
				hours: 2,
				now: MORNING,
			})
			return { startAt: iso(startAt), endAt: iso(endAt) }
		})(),
		durationHours: 2,
		pricePerHour: 0,
		estimatedTotal: 0,
		status: 'reserved',
		createdAt: iso(MORNING),
	}

	it('A ending at 14:00 and B starting at 14:00 do not clash', () => {
		const b = parkingBookingWindow({ dayKey: '2026-09-24', time: '14:00', hours: 1, now: MORNING })
		expect(findOverlappingReservation([existing], b)).toBeUndefined()
	})

	it('a start inside A clashes', () => {
		const b = parkingBookingWindow({ dayKey: '2026-09-24', time: '13:00', hours: 1, now: MORNING })
		expect(findOverlappingReservation([existing], b)?.id).toBe('a')
	})
})

describe('the sheet', () => {
	const source = readFileSync(
		join(process.cwd(), 'src/components/parking/parking-booking-sheet.tsx'),
		'utf8',
	)

	it('builds no start on the device clock', () => {
		expect(source).not.toMatch(/\.set(Hours|Minutes|Date|Seconds)\(/)
		expect(source).not.toMatch(/\.get(Hours|Minutes|Date|Day|Month|FullYear)\(/)
	})
})
