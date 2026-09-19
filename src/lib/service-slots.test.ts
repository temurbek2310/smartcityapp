import { describe, expect, it } from 'vitest'

import {
	addDays,
	bookingDays,
	BOOKING_DAY_COUNT,
	daySlots,
	defaultBookingSelection,
	firstOpenSlot,
	resolveSlotTime,
	serviceWhenLabel,
	slotInstant,
	slotTimes,
} from './service-slots'

// Every timestamp here is written with an explicit +05:00 so the expectations
// read as Tashkent wall clock — which is what the customer picks — and stay
// true whatever timezone the machine running the tests is set to.
const at = (value: string) => new Date(value)

const FRIDAY_NOON = at('2026-09-18T12:00:00+05:00')
const FRIDAY_EVENING = at('2026-09-18T19:10:00+05:00')
const FRIDAY_LATE = at('2026-09-18T23:30:00+05:00')

describe('slot grid', () => {
	it('runs the service window in half hours', () => {
		const times = slotTimes()
		expect(times[0]).toBe('10:00')
		expect(times.at(-1)).toBe('22:00')
		expect(times).toContain('19:30')
		expect(new Set(times).size).toBe(times.length)
	})

	it('maps a day and time onto the Tashkent instant', () => {
		// 19:30 in Tashkent is 14:30 UTC, all year.
		expect(slotInstant('2026-09-18', '19:30').toISOString()).toBe(
			'2026-09-18T14:30:00.000Z',
		)
	})

	it('shifts day keys by whole calendar days', () => {
		expect(addDays('2026-09-18', 1)).toBe('2026-09-19')
		expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
		expect(addDays('2026-09-18', 0)).toBe('2026-09-18')
	})
})

describe('bookingDays', () => {
	it('offers today plus the rest of the week, named the way a customer would', () => {
		const days = bookingDays(FRIDAY_NOON)
		expect(days).toHaveLength(BOOKING_DAY_COUNT)
		expect(days[0]).toEqual({ key: '2026-09-18', label: 'Bugun' })
		expect(days[1]).toEqual({ key: '2026-09-19', label: 'Ertaga' })
		// Past the two days with names, a date says more than "3 kundan keyin".
		expect(days[2]).toEqual({ key: '2026-09-20', label: '20-sen' })
		expect(days.at(-1)?.key).toBe('2026-09-24')
	})

	it('reads the day from Tashkent, not from UTC', () => {
		// 21:00 UTC is already the next morning in Tashkent.
		expect(bookingDays(at('2026-09-18T21:00:00Z'))[0].key).toBe('2026-09-19')
	})
})

describe('past times', () => {
	it('closes the slots today has already gone past and leaves the rest', () => {
		const slots = daySlots('2026-09-18', FRIDAY_EVENING)
		const closed = slots.filter(slot => slot.past).map(slot => slot.time)
		const open = slots.filter(slot => !slot.past).map(slot => slot.time)

		expect(closed).toContain('10:00')
		expect(closed).toContain('19:00')
		expect(open).toEqual(['19:30', '20:00', '20:30', '21:00', '21:30', '22:00'])
	})

	it('treats the slot standing on the current minute as gone', () => {
		const slots = daySlots('2026-09-18', at('2026-09-18T19:30:00+05:00'))
		expect(slots.find(slot => slot.time === '19:30')?.past).toBe(true)
		expect(slots.find(slot => slot.time === '20:00')?.past).toBe(false)
	})

	it('never closes a slot on a later day', () => {
		const slots = daySlots('2026-09-19', FRIDAY_EVENING)
		expect(slots.every(slot => !slot.past)).toBe(true)
		expect(firstOpenSlot('2026-09-19', FRIDAY_EVENING)?.time).toBe('10:00')
	})
})

describe('resolveSlotTime', () => {
	it('keeps a chosen time when the new day can still honour it', () => {
		expect(resolveSlotTime('2026-09-19', '20:30', FRIDAY_EVENING)).toBe('20:30')
	})

	it('drops a time the day has already gone past', () => {
		// Tomorrow at 10:30, then back to today: 10:30 this morning is gone, so
		// the selection moves to the earliest time today can still serve.
		expect(resolveSlotTime('2026-09-18', '10:30', FRIDAY_EVENING)).toBe('19:30')
	})

	it('picks the first open time when nothing was chosen yet', () => {
		// Noon exactly, so 12:00 itself is already gone.
		expect(resolveSlotTime('2026-09-18', null, FRIDAY_NOON)).toBe('12:30')
		expect(resolveSlotTime('2026-09-18', 'not-a-slot', FRIDAY_NOON)).toBe('12:30')
	})

	it('reports a day with nothing left rather than returning a past time', () => {
		expect(resolveSlotTime('2026-09-18', '20:00', FRIDAY_LATE)).toBeNull()
	})
})

describe('defaultBookingSelection', () => {
	it('opens on today at the next time it can serve', () => {
		expect(defaultBookingSelection(FRIDAY_EVENING)).toEqual({
			dayKey: '2026-09-18',
			time: '19:30',
		})
	})

	it('opens on tomorrow once today is spent', () => {
		expect(defaultBookingSelection(FRIDAY_LATE)).toEqual({
			dayKey: '2026-09-19',
			time: '10:00',
		})
	})
})

describe('serviceWhenLabel', () => {
	it('names the two days a customer thinks of by name and dates the rest', () => {
		const now = FRIDAY_NOON
		expect(serviceWhenLabel(slotInstant('2026-09-18', '19:30'), now)).toBe(
			'Bugun, 19:30',
		)
		expect(serviceWhenLabel(slotInstant('2026-09-19', '19:30'), now)).toBe(
			'Ertaga, 19:30',
		)
		expect(serviceWhenLabel(slotInstant('2026-09-21', '13:00'), now)).toBe(
			'21-sen, 13:00',
		)
	})

	it('re-reads as today once tomorrow arrives', () => {
		const booked = slotInstant('2026-09-19', '19:30')
		expect(serviceWhenLabel(booked, FRIDAY_NOON)).toBe('Ertaga, 19:30')
		expect(serviceWhenLabel(booked, at('2026-09-19T09:00:00+05:00'))).toBe(
			'Bugun, 19:30',
		)
	})
})
