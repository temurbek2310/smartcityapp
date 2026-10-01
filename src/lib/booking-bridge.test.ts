import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getParking } from '@/data/parkings'
import { firstFreeBay } from './bay-map'
import { tableParkingHandoff } from './booking-bridge'
import { findOverlappingReservation } from './reservation'
import { slotInstant } from './service-slots'
import type { Reservation, ServiceBooking } from './types'

const MIN = 60_000
const HOUR = 3_600_000
// Coffee Lab names Amir Temur as its lot.
const LOT = getParking('amir-temur')!
const START = slotInstant('2026-09-24', '19:30').toISOString()

const table = (patch: Partial<ServiceBooking> = {}): ServiceBooking => ({
	id: 'booking-1',
	kind: 'table',
	refId: 'coffee-lab',
	title: 'Coffee Lab',
	subtitle: '2 kishi · 19:30',
	code: 'TB-1234',
	whenLabel: 'Ertaga, 19:30',
	startAt: START,
	durationMinutes: 90,
	seatingArea: 'Veranda',
	status: 'upcoming',
	createdAt: '2026-09-23T10:00:00.000Z',
	...patch,
})

const reservation = (patch: Partial<Reservation> = {}): Reservation => ({
	id: 'r1',
	parkingId: 'magic-city',
	userPhone: '+998901234567',
	startAt: slotInstant('2026-09-24', '19:00').toISOString(),
	endAt: slotInstant('2026-09-24', '20:00').toISOString(),
	durationHours: 1,
	pricePerHour: 10000,
	estimatedTotal: 10000,
	status: 'reserved',
	createdAt: '2026-09-23T10:00:00.000Z',
	...patch,
})

describe('table → parking handoff', () => {
	it('books the lot the venue names, at exactly the table’s time block', () => {
		const handoff = tableParkingHandoff(table(), [])!
		expect(handoff.parking.id).toBe('amir-temur')
		expect(handoff.startAt).toBe(START)
		expect(handoff.endAt).toBe(new Date(Date.parse(START) + 90 * MIN).toISOString())
		expect(handoff.durationHours).toBe(1.5)
		expect(handoff.pricePerHour).toBe(LOT.pricePerHour)
		expect(handoff.estimatedTotal).toBe(1.5 * LOT.pricePerHour)
	})

	it('ends where the store will end it: start + durationHours', () => {
		const handoff = tableParkingHandoff(table({ durationMinutes: 180 }), [])!
		expect(Date.parse(handoff.startAt) + handoff.durationHours * HOUR).toBe(
			Date.parse(handoff.endAt),
		)
		expect(handoff.durationHours).toBe(3)
	})

	it('a table saved without a duration hands off its two-hour default', () => {
		expect(
			tableParkingHandoff(table({ durationMinutes: undefined }), [])!.durationHours,
		).toBe(2)
	})

	it('picks the bay the parking sheet would have pre-selected', () => {
		const handoff = tableParkingHandoff(table(), [])!
		expect(handoff.bay).toBe(firstFreeBay(LOT, 1))
		expect(handoff.level).toBe(1)
	})

	it('never hands out a bay the customer already holds', () => {
		const first = firstFreeBay(LOT, 1)!
		const handoff = tableParkingHandoff(table(), [], { excludeBays: [first] })!
		expect(handoff.bay).not.toBe(first)
		expect(handoff.bay).toBe(firstFreeBay(LOT, 1, [first]))
	})

	it('flags the customer’s own parking booking across the same window', () => {
		expect(tableParkingHandoff(table(), [reservation()])!.conflict?.id).toBe('r1')
		// Finished or cancelled bookings, and ones that end as the table
		// starts, stand in nobody's way.
		for (const patch of [
			{ status: 'cancelled' as const },
			{ status: 'completed' as const },
			{ endAt: START },
		]) {
			expect(tableParkingHandoff(table(), [reservation(patch)])!.conflict).toBeUndefined()
		}
	})

	it('what it hands the store clears the store’s own overlap rule', () => {
		const handoff = tableParkingHandoff(table(), [reservation({ status: 'cancelled' })])!
		expect(
			findOverlappingReservation([reservation({ status: 'cancelled' })], {
				startAt: handoff.startAt,
				endAt: Date.parse(handoff.startAt) + handoff.durationHours * HOUR,
			}),
		).toBeUndefined()
	})

	it('has nothing to hand off without a table, a lot or a time', () => {
		expect(tableParkingHandoff(table({ kind: 'cinema' }), [])).toBeNull()
		expect(tableParkingHandoff(table({ refId: 'unknown-venue' }), [])).toBeNull()
		expect(tableParkingHandoff(table({ startAt: undefined }), [])).toBeNull()
		expect(tableParkingHandoff(table({ startAt: 'garbage' }), [])).toBeNull()
	})
})

describe('the success view wiring', () => {
	const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
	const sheet = read('src/components/booking/service-booking-sheet.tsx')
	const offer = read('src/components/booking/table-parking-offer.tsx')

	it('keeps a new table in the sheet and shows the parking offer', () => {
		expect(sheet).toContain('if (dated) return setBooked(attempt.created)')
		// Named by the kind, so a film is never reported as a booked table.
		expect(sheet).toContain('{COPY[booked.kind].done}')
		expect(sheet).toContain("done: 'Stol band qilindi!'")
		expect(sheet).toMatch(/<TableParkingOffer booking=\{booked\}/)
	})

	it('books parking from the handoff alone, then opens the reservation', () => {
		expect(offer).toContain('tableParkingHandoff(booking, reservations')
		expect(offer).toMatch(/createReservation\(\{\s*parkingId: handoff\.parking\.id,\s*startAt: handoff\.startAt,\s*durationHours: handoff\.durationHours,\s*pricePerHour: handoff\.pricePerHour,/)
		expect(offer).toMatch(/saveBookingMeta\(attempt\.created\.id, \{\s*bay: handoff\.bay,\s*level: handoff\.level,/)
		expect(offer).toContain('router.push(reservationHref(attempt.created))')
		expect(offer).toContain('Aynan shu vaqtga avtoturargohdan joy band qilish')
	})
})
