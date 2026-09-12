import { describe, expect, it } from 'vitest'

import { calculateFinalTotal, reservationCode } from './reservation'
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
