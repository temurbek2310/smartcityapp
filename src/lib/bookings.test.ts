import { describe, expect, it } from 'vitest'

import { bookingRows, isOpen } from './bookings'
import type {
	QueueTicket,
	Reservation,
	ServiceBooking,
} from '@/lib/types'

const reservation = (patch: Partial<Reservation> = {}): Reservation => ({
	id: 'r1',
	parkingId: 'amir-temur',
	userPhone: '+998901234567',
	vehiclePlate: '01 A 777 AA',
	startAt: '2026-09-11T06:30:00.000Z',
	endAt: '2026-09-11T08:30:00.000Z',
	durationHours: 2,
	pricePerHour: 12000,
	estimatedTotal: 24000,
	status: 'reserved',
	createdAt: '2026-09-11T05:00:00.000Z',
	...patch,
})

const ticket = (patch: Partial<QueueTicket> = {}): QueueTicket => ({
	id: 't1',
	orgId: 'coffee-lab',
	serviceId: 'table',
	number: 'A-23',
	position: 12,
	initialPosition: 12,
	etaMinutes: 35,
	initialEtaMinutes: 35,
	windowNumber: 2,
	notify: true,
	status: 'waiting',
	createdAt: '2026-09-11T05:00:00.000Z',
	...patch,
})

const service = (patch: Partial<ServiceBooking> = {}): ServiceBooking => ({
	id: 's1',
	kind: 'table',
	refId: 'urban-food',
	title: 'Urban Food',
	subtitle: '2 kishi · 12:30',
	code: 'TB-1234',
	whenLabel: 'Bugun, 12:30',
	status: 'active',
	createdAt: '2026-09-11T05:00:00.000Z',
	...patch,
})

const empty = { reservations: [], queueTickets: [], serviceBookings: [] }

// Three stores feed one list. The normalising lives here so the Booking
// Center does not branch three ways, which means these mappings are what
// the whole screen depends on.
describe('bookingRows', () => {
	it('merges all three stores', () => {
		const rows = bookingRows({
			reservations: [reservation()],
			queueTickets: [ticket()],
			serviceBookings: [service()],
		})
		expect(rows.map(r => r.kind).sort()).toEqual(['parking', 'queue', 'table'])
	})

	it('orders live things first, then not-yet-started, then the rest', () => {
		const rows = bookingRows({
			reservations: [
				reservation({ id: 'done', status: 'completed' }),
				reservation({ id: 'live', status: 'active' }),
				reservation({ id: 'soon', status: 'reserved' }),
			],
			queueTickets: [],
			serviceBookings: [],
		})
		expect(rows.map(r => r.id)).toEqual(['live', 'soon', 'done'])
	})

	it('shortens the reservation id rather than printing a raw uuid', () => {
		const [row] = bookingRows({
			...empty,
			reservations: [reservation({ id: 'booking-abcdef12345678' })],
		})
		expect(row.code).toBe('12345678')
	})

	it('bills the final total once one exists', () => {
		const [row] = bookingRows({
			...empty,
			reservations: [
				reservation({ status: 'completed', finalTotal: 36000 }),
			],
		})
		// Escaped deliberately: an invisible U+00A0 in a test literal is
		// impossible to tell from a plain space when the assertion fails.
		expect(row.amountLabel).toBe('36\u00a0000 soʻm')
	})

	it('sends a called ticket to the window and a waiting one to its position', () => {
		const [called] = bookingRows({
			...empty,
			queueTickets: [ticket({ status: 'called', position: 0 })],
		})
		expect(called.status).toBe('active')
		expect(called.subtitle).toContain('2-oyna')

		const [waiting] = bookingRows({ ...empty, queueTickets: [ticket()] })
		expect(waiting.status).toBe('upcoming')
		expect(waiting.subtitle).toContain('12')
	})

	it('routes each kind somewhere it can actually be opened', () => {
		const [active] = bookingRows({
			...empty,
			reservations: [reservation({ status: 'active' })],
		})
		expect(active.href).toBe('/session/r1')

		const [done] = bookingRows({
			...empty,
			reservations: [reservation({ status: 'completed' })],
		})
		expect(done.href).toBe('/receipt/r1')
	})

	it('carries what a Takrorlash should reopen', () => {
		const [row] = bookingRows({ ...empty, serviceBookings: [service()] })
		expect(row.repeat).toEqual({ kind: 'table', refId: 'urban-food' })
	})

	it('returns nothing for an empty registry', () => {
		expect(bookingRows(empty)).toEqual([])
	})
})

describe('isOpen', () => {
	it('treats active and upcoming as open, done and cancelled as history', () => {
		const rows = bookingRows({
			...empty,
			reservations: [
				reservation({ id: 'a', status: 'active' }),
				reservation({ id: 'b', status: 'reserved' }),
				reservation({ id: 'c', status: 'completed' }),
				reservation({ id: 'd', status: 'cancelled' }),
			],
		})
		expect(rows.filter(isOpen).map(r => r.id)).toEqual(['a', 'b'])
	})
})
