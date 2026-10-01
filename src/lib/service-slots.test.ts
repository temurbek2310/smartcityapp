import { describe, expect, it } from 'vitest'

import {
	addDays,
	bookingDays,
	BOOKING_DAY_COUNT,
	daySlots,
	DEFAULT_TABLE_DURATION,
	durationLabel,
	defaultBookingSelection,
	defaultQueueSelection,
	QUEUE_NOW_SLOT,
	QUEUE_SLOT_STEP_MINUTES,
	queueSlotTimes,
	firstOpenSlot,
	resolveSlotTime,
	SAME_DAY_DEFAULT_SLOT,
	SAME_DAY_SLOTS,
	serviceWhenLabel,
	slotInstant,
	slotTimes,
	TABLE_DURATIONS,
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

describe('cinema and clinic same-day slots', () => {
	const NINE_PM = at('2026-09-24T21:00:00+05:00')
	const today = '2026-09-24'

	it('at 21:00 Tashkent, 12:30 today is past and cannot be picked', () => {
		const slots = daySlots(today, NINE_PM, SAME_DAY_SLOTS)
		expect(slots.map(slot => slot.time)).toEqual([...SAME_DAY_SLOTS])
		expect(slots.find(slot => slot.time === '12:30')?.past).toBe(true)
		expect(slots.every(slot => slot.past)).toBe(true)
	})

	it('no time is left at 21:00, so nothing is selected rather than a past slot', () => {
		expect(resolveSlotTime(today, SAME_DAY_DEFAULT_SLOT, NINE_PM, SAME_DAY_SLOTS)).toBeNull()
	})

	it('mid-afternoon: earlier times close, later ones stay selectable', () => {
		const now = at('2026-09-24T15:10:00+05:00')
		const open = daySlots(today, now, SAME_DAY_SLOTS)
			.filter(slot => !slot.past)
			.map(slot => slot.time)
		expect(open).toEqual(['18:00', '19:00', '20:00'])
		// The default moves to the next valid time instead of staying on 12:30.
		expect(resolveSlotTime(today, SAME_DAY_DEFAULT_SLOT, now, SAME_DAY_SLOTS)).toBe('18:00')
	})

	it('in the morning the default is unchanged', () => {
		const now = at('2026-09-24T09:00:00+05:00')
		expect(resolveSlotTime(today, SAME_DAY_DEFAULT_SLOT, now, SAME_DAY_SLOTS)).toBe('12:30')
		expect(slotInstant(today, '12:30').toISOString()).toBe('2026-09-24T07:30:00.000Z')
	})

	it('the default never lands on a past slot, at any minute of the day', () => {
		for (let minutes = 0; minutes < 24 * 60; minutes += 5) {
			const now = slotInstant(today, '00:00').getTime() + minutes * 60_000
			const time = resolveSlotTime(today, SAME_DAY_DEFAULT_SLOT, now, SAME_DAY_SLOTS)
			if (time) expect(slotInstant(today, time).getTime()).toBeGreaterThan(now)
		}
	})
})

describe('service construction is unchanged', () => {
	it('24 Sep 2026 14:00 is 09:00Z', () => {
		expect(slotInstant('2026-09-24', '14:00').toISOString()).toBe('2026-09-24T09:00:00.000Z')
	})

	it('addDays still shifts by Tashkent calendar days', () => {
		expect(addDays('2026-09-24', 1)).toBe('2026-09-25')
	})

	it('Bugun / Ertaga follow the Tashkent date', () => {
		const booked = slotInstant('2026-09-25', '14:00')
		expect(serviceWhenLabel(booked, at('2026-09-24T23:59:00+05:00'))).toBe('Ertaga, 14:00')
		expect(serviceWhenLabel(booked, at('2026-09-25T00:00:00+05:00'))).toBe('Bugun, 14:00')
	})
})

describe('table durations', () => {
	it('offers one to three hours, two pre-selected as before', () => {
		expect([...TABLE_DURATIONS]).toEqual([60, 90, 120, 180])
		expect(DEFAULT_TABLE_DURATION).toBe(120)
		expect(TABLE_DURATIONS).toContain(DEFAULT_TABLE_DURATION)
	})

	it('labels them in Uzbek, with a decimal comma', () => {
		expect(TABLE_DURATIONS.map(durationLabel)).toEqual([
			'1 soat',
			'1,5 soat',
			'2 soat',
			'3 soat',
		])
	})
})

describe('queue slots', () => {
	const bank = { openTime: '09:00', closeTime: '18:00' }
	const credit = { serviceMinutes: 40, bookable: true }

	it('«Hozir» is the live choice, not a time', () => {
		expect(QUEUE_NOW_SLOT).toBe('Hozir')
		expect(queueSlotTimes(bank, credit)).not.toContain(QUEUE_NOW_SLOT)
	})

	it('runs from opening to the last slot that still ends by closing', () => {
		const times = queueSlotTimes(bank, credit)
		expect(times[0]).toBe('09:00')
		// 17:30 + 40 min would run past 18:00.
		expect(times.at(-1)).toBe('17:00')
		expect(times).toHaveLength(17)
	})

	it('steps on the same half-hour as tables', () => {
		expect(QUEUE_SLOT_STEP_MINUTES).toBe(30)
		expect(queueSlotTimes(bank, { serviceMinutes: 10, bookable: true }).slice(0, 3)).toEqual([
			'09:00',
			'09:30',
			'10:00',
		])
		expect(queueSlotTimes(bank, { serviceMinutes: 10, bookable: true }).at(-1)).toBe('17:30')
	})

	it('a live-only line, or a malformed time, has no slots', () => {
		expect(queueSlotTimes(bank, { serviceMinutes: 5, bookable: false })).toEqual([])
		expect(queueSlotTimes({ openTime: 'soon', closeTime: '18:00' }, credit)).toEqual([])
	})

	it('reads through daySlots, so a time gone by today is past', () => {
		const slots = daySlots('2026-09-18', FRIDAY_NOON, queueSlotTimes(bank, credit))
		expect(slots.find(slot => slot.time === '11:30')?.past).toBe(true)
		expect(slots.find(slot => slot.time === '12:30')?.past).toBe(false)
	})

	it('opens on the first slot still ahead', () => {
		expect(defaultQueueSelection(bank, credit, FRIDAY_NOON)).toEqual({
			dayKey: '2026-09-18',
			time: '12:30',
		})
	})

	it('after closing, opens on tomorrow morning', () => {
		expect(defaultQueueSelection(bank, credit, FRIDAY_EVENING)).toEqual({
			dayKey: '2026-09-19',
			time: '09:00',
		})
	})

	it('a live-only line has nothing to select', () => {
		expect(
			defaultQueueSelection(bank, { serviceMinutes: 5, bookable: false }, FRIDAY_NOON).time,
		).toBeNull()
	})
})
