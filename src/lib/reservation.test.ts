import { describe, expect, it } from 'vitest'

import {
	calculateFinalTotal,
	findOverlappingReservation,
	intervalsOverlap,
	isLiveReservation,
	reservationCode,
	reservationHref,
	supersededReservationHref,
} from './reservation'
import type { Reservation } from '@/lib/types'

function makeReservation(patch: Partial<Reservation> = {}): Reservation {
	return {
		id: 'booking-1',
		parkingId: 'amir-temur',
		userPhone: '+998901234567',
		vehiclePlate: '01 A 777 AA',
		startAt: '2026-09-11T06:30:00.000Z',
		endAt: '2026-09-11T08:30:00.000Z',
		durationHours: 2,
		pricePerHour: 12000,
		estimatedTotal: 24000,
		status: 'active',
		createdAt: '2026-09-11T05:00:00.000Z',
		...patch,
	}
}

// This is the money. It decides what someone is actually charged on exit,
// and the session screen shows the same figure while the car is inside — if
// the two ever disagree the receipt looks like a mistake.
describe('calculateFinalTotal', () => {
	it('meters from actual entry, not from the booked start', () => {
		const reservation = makeReservation({
			enteredAt: '2026-09-11T07:00:00.000Z',
		})
		// One hour inside -> one hour charged, despite a 06:30 booking.
		const exit = new Date('2026-09-11T08:00:00.000Z')
		expect(calculateFinalTotal(reservation, exit)).toBe(12000)
	})

	it('falls back to the booked start when the car never scanned in', () => {
		const reservation = makeReservation({ enteredAt: undefined })
		const exit = new Date('2026-09-11T08:30:00.000Z')
		expect(calculateFinalTotal(reservation, exit)).toBe(24000)
	})

	it('rounds part-hours up, the way a barrier does', () => {
		const reservation = makeReservation({
			enteredAt: '2026-09-11T07:00:00.000Z',
		})
		const exit = new Date('2026-09-11T08:01:00.000Z')
		expect(calculateFinalTotal(reservation, exit)).toBe(24000)
	})

	it('charges a minimum of one hour for a near-instant exit', () => {
		const reservation = makeReservation({
			enteredAt: '2026-09-11T07:00:00.000Z',
		})
		const exit = new Date('2026-09-11T07:00:30.000Z')
		expect(calculateFinalTotal(reservation, exit)).toBe(12000)
	})

	it('never returns a negative charge if the clocks disagree', () => {
		const reservation = makeReservation({
			enteredAt: '2026-09-11T07:00:00.000Z',
		})
		const exit = new Date('2026-09-11T06:00:00.000Z')
		expect(calculateFinalTotal(reservation, exit)).toBeGreaterThan(0)
	})
})

describe('reservationCode', () => {
	it('namespaces the QR payload so a scanner can tell what it is', () => {
		expect(reservationCode('booking-1')).toBe('BSPACE:booking-1')
	})
})

// 10:00–12:00 on the day the other fixtures use.
const TEN = '2026-09-11T10:00:00.000Z'
const TWELVE = '2026-09-11T12:00:00.000Z'

describe('intervalsOverlap', () => {
	it.each([
		['partial overlap', '2026-09-11T11:00:00.000Z', '2026-09-11T13:00:00.000Z', true],
		['complete containment', '2026-09-11T10:30:00.000Z', '2026-09-11T11:30:00.000Z', true],
		['containing the existing one', '2026-09-11T09:00:00.000Z', '2026-09-11T13:00:00.000Z', true],
		['the exact same interval', TEN, TWELVE, true],
		['touching at the end', TWELVE, '2026-09-11T14:00:00.000Z', false],
		['touching at the start', '2026-09-11T08:00:00.000Z', TEN, false],
		['entirely before', '2026-09-11T07:00:00.000Z', '2026-09-11T09:00:00.000Z', false],
		['entirely after', '2026-09-11T13:00:00.000Z', '2026-09-11T15:00:00.000Z', false],
	])('reports %s as %s', (_label, start, end, expected) => {
		expect(intervalsOverlap(TEN, TWELVE, start, end)).toBe(expected)
	})

	it('accepts Dates and epoch millis as well as ISO strings', () => {
		expect(
			intervalsOverlap(
				new Date(TEN),
				Date.parse(TWELVE),
				'2026-09-11T11:00:00.000Z',
				new Date('2026-09-11T13:00:00.000Z'),
			),
		).toBe(true)
	})

	it('never claims a clash for an unparsable or inverted window', () => {
		expect(intervalsOverlap(TEN, TWELVE, 'not-a-date', TWELVE)).toBe(false)
		expect(intervalsOverlap(TEN, TWELVE, TWELVE, TEN)).toBe(false)
	})
})

describe('isLiveReservation', () => {
	it('counts a booking the customer still holds, and nothing else', () => {
		expect(isLiveReservation(makeReservation({ status: 'reserved' }))).toBe(true)
		expect(isLiveReservation(makeReservation({ status: 'active' }))).toBe(true)
		expect(isLiveReservation(makeReservation({ status: 'completed' }))).toBe(false)
		expect(isLiveReservation(makeReservation({ status: 'cancelled' }))).toBe(false)
	})
})

// One driver, one car. The rule is about the hours held, not about how many
// bookings exist or which lot, level or bay each one names.
describe('findOverlappingReservation', () => {
	const existing = makeReservation({
		id: 'held',
		status: 'reserved',
		startAt: TEN,
		endAt: TWELVE,
	})
	const eleventoOne = {
		startAt: '2026-09-11T11:00:00.000Z',
		endAt: '2026-09-11T13:00:00.000Z',
	}

	it('blocks an overlap in a different lot, level and bay', () => {
		// Bay and level live outside the Reservation entirely, so a clash can
		// only ever be decided on time — which is the point.
		const other = { ...existing, parkingId: 'tashkent-city' }
		expect(findOverlappingReservation([other], eleventoOne)?.id).toBe('held')
	})

	it('allows a later booking that only touches the previous one', () => {
		expect(
			findOverlappingReservation([existing], {
				startAt: TWELVE,
				endAt: '2026-09-11T14:00:00.000Z',
			}),
		).toBeUndefined()
	})

	it('allows an unrelated window later the same day', () => {
		expect(
			findOverlappingReservation([existing], {
				startAt: '2026-09-11T15:00:00.000Z',
				endAt: '2026-09-11T16:00:00.000Z',
			}),
		).toBeUndefined()
	})

	it('allows the same hours on another day', () => {
		expect(
			findOverlappingReservation([existing], {
				startAt: '2026-09-12T11:00:00.000Z',
				endAt: '2026-09-12T13:00:00.000Z',
			}),
		).toBeUndefined()
	})

	it.each([['cancelled' as const], ['completed' as const]])(
		'ignores a %s booking over the same hours',
		status => {
			expect(
				findOverlappingReservation([{ ...existing, status }], eleventoOne),
			).toBeUndefined()
		},
	)

	it('blocks while a session is active', () => {
		const running = { ...existing, status: 'active' as const }
		expect(findOverlappingReservation([running], eleventoOne)?.id).toBe('held')
	})

	it('skips the booking being edited when asked to', () => {
		expect(
			findOverlappingReservation([existing], eleventoOne, { ignoreId: 'held' }),
		).toBeUndefined()
	})

	it('finds the clash among bookings that do not overlap', () => {
		const earlier = makeReservation({
			id: 'earlier',
			status: 'reserved',
			startAt: '2026-09-11T06:00:00.000Z',
			endAt: '2026-09-11T07:00:00.000Z',
		})
		expect(
			findOverlappingReservation([earlier, existing], eleventoOne)?.id,
		).toBe('held')
	})

	it('returns nothing when the customer holds no bookings', () => {
		expect(findOverlappingReservation([], eleventoOne)).toBeUndefined()
	})
})

// The detail page owns a booking for its whole live span. /session/[id] is
// a screen the booking opens — the timer, the running bill, the exit QR —
// not a replacement for it, so entering the lot must not cost the customer
// the page that holds the booking's own details and actions.
describe('reservationHref', () => {
	it.each([
		['reserved' as const, '/reservation/booking-1'],
		// Entered, but still the same booking and still its own page.
		['active' as const, '/reservation/booking-1'],
		['completed' as const, '/receipt/booking-1'],
		['cancelled' as const, '/reservation/booking-1'],
	])('sends a %s booking to %s', (status, href) => {
		expect(reservationHref(makeReservation({ status }))).toBe(href)
	})

	it('agrees with what the reservation screen hands over to', () => {
		for (const status of ['reserved', 'active', 'completed', 'cancelled'] as const) {
			const reservation = makeReservation({ status })
			const superseded = supersededReservationHref(reservation)
			// Either this screen is the current one, or the hand-off target is
			// exactly where a Bron card would have gone.
			expect(superseded ?? `/reservation/${reservation.id}`).toBe(
				reservationHref(reservation),
			)
		}
	})
})

describe('supersededReservationHref', () => {
	it('hands a finished booking over to its receipt', () => {
		expect(supersededReservationHref(makeReservation({ status: 'completed' })))
			.toBe('/receipt/booking-1')
	})

	// None of these leave: one is waiting to be used, one is in use, one is
	// the read-only record of a booking that never was. An entered booking
	// staying put is the whole point — it is what makes Back out of a
	// session land on the booking rather than on the list.
	it.each([
		['reserved' as const],
		['active' as const],
		['cancelled' as const],
	])('leaves a %s booking on its detail page', status => {
		expect(supersededReservationHref(makeReservation({ status }))).toBeNull()
	})
})
