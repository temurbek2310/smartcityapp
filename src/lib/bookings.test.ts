import { describe, expect, it } from 'vitest'

import { bookingRows, isOpen, serviceBookingDraft } from './bookings'
import { tashkentDayKey } from '@/lib/format'
import { serviceWhenLabel, slotInstant } from '@/lib/service-slots'
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

	// Tapping a card is now the only way into a booking, so every status has
	// to name the screen that can actually show it. The detail page covers
	// three of the four, entered included — it offers «Faol sessiyaga
	// qaytish» rather than sending the card straight past itself.
	it.each([
		['reserved' as const, '/reservation/r1'],
		['active' as const, '/reservation/r1'],
		['completed' as const, '/receipt/r1'],
		['cancelled' as const, '/reservation/r1'],
	])('sends a %s parking booking to %s', (status, href) => {
		const [row] = bookingRows({
			...empty,
			reservations: [reservation({ status })],
		})
		expect(row.href).toBe(href)
	})

	// Parking opens a screen; the kinds without one carry a QR instead, which
	// is what their card opens.
	it('gives every row something to open', () => {
		const rows = bookingRows({
			reservations: [reservation()],
			queueTickets: [ticket()],
			serviceBookings: [service()],
		})
		for (const row of rows) expect(row.href ?? row.qrValue).toBeTruthy()

		const [parking] = bookingRows({ ...empty, reservations: [reservation()] })
		expect(parking.qrValue).toBeUndefined()
	})

	it('carries what a Takrorlash should reopen', () => {
		const [row] = bookingRows({ ...empty, serviceBookings: [service()] })
		expect(row.repeat).toEqual({ kind: 'table', refId: 'urban-food' })
	})

	// The reserved instant, not the label the sheet happened to write. A
	// table booked for tomorrow evening used to arrive here still claiming
	// "Bugun, 12:30", because that string was all the booking carried.
	it('shows a table booking at the date and time it was made for', () => {
		const tomorrow = new Date(Date.now() + 86_400_000)
		const [row] = bookingRows({
			...empty,
			serviceBookings: [
				service({
					startAt: slotInstant(tashkentDayKey(tomorrow), '19:30').toISOString(),
					whenLabel: 'Bugun, 12:30',
				}),
			],
		})
		expect(row.whenLabel).toBe('Ertaga, 19:30')
	})

	it('keeps the stored label for a booking saved before instants existed', () => {
		const [row] = bookingRows({
			...empty,
			serviceBookings: [service({ startAt: undefined })],
		})
		expect(row.whenLabel).toBe('Bugun, 12:30')
	})

	// Whichever restaurant the sheet was opened on is the one Bron reopens —
	// the generic shortcut used to book Urban Food whoever was meant.
	it('keeps each restaurant its own refId', () => {
		const rows = bookingRows({
			...empty,
			serviceBookings: [
				service({ id: 's1', refId: 'coffee-lab', title: 'Coffee Lab' }),
				service({ id: 's2', refId: 'urban-food', title: 'Urban Food' }),
			],
		})
		expect(rows.map(row => row.repeat)).toEqual([
			{ kind: 'table', refId: 'coffee-lab' },
			{ kind: 'table', refId: 'urban-food' },
		])
	})

	// The store refuses to cancel anything but a not-yet-entered booking, so a
	// row that says otherwise produces a «Bron bekor qilindi» for a session
	// that keeps running. These mappings are what stops the screen offering it.
	it('only lets a parking booking be cancelled before the driver enters', () => {
		const [reserved] = bookingRows({ ...empty, reservations: [reservation()] })
		expect(reserved.cancellable).toBe(true)

		// An entered session is ended by leaving the lot, not by cancelling.
		// The card opens the booking, whose detail page drops the cancel and
		// points on to the running session instead.
		const [active] = bookingRows({
			...empty,
			reservations: [reservation({ status: 'active' })],
		})
		expect(active.cancellable).toBe(false)
		expect(active.href).toBe('/reservation/r1')
	})

	it.each([
		['completed' as const],
		['cancelled' as const],
	])('offers no cancel on a %s booking', status => {
		const [row] = bookingRows({ ...empty, reservations: [reservation({ status })] })
		expect(row.cancellable).toBe(false)
	})

	it('keeps queue tickets and table bookings cancellable while they are live', () => {
		const [waiting] = bookingRows({ ...empty, queueTickets: [ticket()] })
		const [called] = bookingRows({
			...empty,
			queueTickets: [ticket({ status: 'called', position: 0 })],
		})
		const [served] = bookingRows({
			...empty,
			queueTickets: [ticket({ status: 'served' })],
		})
		expect([waiting.cancellable, called.cancellable, served.cancellable])
			.toEqual([true, true, false])

		const [table] = bookingRows({ ...empty, serviceBookings: [service()] })
		const [gone] = bookingRows({
			...empty,
			serviceBookings: [service({ status: 'cancelled' })],
		})
		expect([table.cancellable, gone.cancellable]).toEqual([true, false])
	})

	it('returns nothing for an empty registry', () => {
		expect(bookingRows(empty)).toEqual([])
	})
})

// The half of the round trip the booking sheet writes. A choice that does
// not survive into here never reaches Bron at all.
describe('serviceBookingDraft', () => {
	const now = new Date('2026-09-18T12:00:00+05:00')

	const draft = (patch: Record<string, unknown> = {}) =>
		serviceBookingDraft({
			kind: 'table',
			refId: 'coffee-lab',
			title: 'Coffee Lab',
			count: 2,
			unit: 'kishi',
			startAt: slotInstant('2026-09-18', '19:30'),
			now,
			...patch,
		})

	it('stores today at a future time as the instant it is', () => {
		const table = draft()
		expect(table.startAt).toBe('2026-09-18T14:30:00.000Z')
		expect(table.whenLabel).toBe('Bugun, 19:30')
		expect(table.subtitle).toBe('2 kishi · 19:30')
	})

	it('stores a booking made for tomorrow as tomorrow', () => {
		const table = draft({ startAt: slotInstant('2026-09-19', '13:00') })
		expect(table.startAt).toBe('2026-09-19T08:00:00.000Z')
		expect(table.whenLabel).toBe('Ertaga, 13:00')
		expect(table.subtitle).toBe('2 kishi · 13:00')
	})

	it('keeps whichever restaurant the sheet was opened on', () => {
		expect(draft().refId).toBe('coffee-lab')
		expect(
			draft({ refId: 'urban-food', title: 'Urban Food' }).refId,
		).toBe('urban-food')
	})

	// What the sheet writes is what the Booking Center reads back.
	it('round-trips into a Bron row at the same date and time', () => {
		const table = draft({ startAt: slotInstant('2026-09-19', '20:00') })
		const [row] = bookingRows({
			...empty,
			serviceBookings: [
				service({ ...table, id: 's9', code: 'TB-9000', status: 'active', createdAt: now.toISOString() }),
			],
		})
		expect(row.title).toBe('Coffee Lab')
		expect(row.subtitle).toBe('2 kishi · 20:00')
		expect(row.repeat).toEqual({ kind: 'table', refId: 'coffee-lab' })
		expect(row.whenLabel).toBe(serviceWhenLabel(table.startAt))
	})

	it('keeps the guest count it was given', () => {
		expect(draft({ count: 6 }).subtitle).toBe('6 kishi · 19:30')
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
