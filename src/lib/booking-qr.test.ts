import { describe, expect, it } from 'vitest'

import {
	bookingQrPayload,
	parseBookingQrPayload,
	queueTicketQrPayload,
	queueTicketReference,
	reservationQrPayload,
	reservationReference,
	serviceBookingQrPayload,
	serviceBookingReference,
} from './booking-qr'
import { bookingRows, resolveBookingDetail } from './bookings'
import type { QueueTicket, Reservation, ServiceBooking } from '@/lib/types'

const reservation = (patch: Partial<Reservation> = {}): Reservation => ({
	id: 'res-123',
	parkingId: 'magic-city',
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
	id: 'queue-456',
	orgId: 'coffee-lab',
	serviceId: 'table',
	number: '42',
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
	id: 'booking-789',
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

describe('bookingQrPayload', () => {
	it.each([
		['reservation', reservationQrPayload(reservation()), 'BSPACE:v1:reservation:res-123'],
		['queue', queueTicketQrPayload(ticket()), 'BSPACE:v1:queue:queue-456'],
		['booking', serviceBookingQrPayload(service()), 'BSPACE:v1:booking:booking-789'],
	])('encodes a %s by its stable id', (_, payload, expected) => {
		expect(payload).toBe(expected)
	})

	it('is deterministic — the same booking draws the same QR every time', () => {
		expect(reservationQrPayload(reservation())).toBe(
			reservationQrPayload(reservation()),
		)
		// A JSON round trip is what localStorage hydration does to a booking.
		const hydrated = JSON.parse(JSON.stringify(service())) as ServiceBooking
		expect(serviceBookingQrPayload(hydrated)).toBe(serviceBookingQrPayload(service()))
	})

	it('gives two bookings two QRs', () => {
		expect(serviceBookingQrPayload(service({ id: 'booking-1' }))).not.toBe(
			serviceBookingQrPayload(service({ id: 'booking-2' })),
		)
	})

	it('keeps the QR through a status change', () => {
		const live = serviceBookingQrPayload(service())
		expect(serviceBookingQrPayload(service({ status: 'completed' }))).toBe(live)
		expect(serviceBookingQrPayload(service({ status: 'cancelled' }))).toBe(live)
		expect(reservationQrPayload(reservation({ status: 'active' }))).toBe(
			reservationQrPayload(reservation()),
		)
	})

	it('draws no QR for an id it cannot encode, rather than a stand-in', () => {
		expect(bookingQrPayload({ type: 'booking', id: '' })).toBeNull()
		expect(bookingQrPayload({ type: 'booking', id: 'a:b' })).toBeNull()
		expect(
			bookingQrPayload({ type: 'parking' as never, id: 'res-123' }),
		).toBeNull()
	})

	it('encodes nothing about the customer', () => {
		const payload = reservationQrPayload(reservation())!
		expect(payload).not.toContain('+998')
		expect(payload).not.toContain('777')
		expect(payload).not.toContain('magic-city')
	})

	it('encodes one ServiceBooking type whatever the kind', () => {
		for (const kind of ['table', 'cinema', 'clinic', 'event'] as const) {
			expect(serviceBookingQrPayload(service({ kind }))).toBe(
				'BSPACE:v1:booking:booking-789',
			)
		}
	})
})

describe('parseBookingQrPayload', () => {
	it.each([
		['BSPACE:v1:reservation:res-123', 'reservation', 'res-123'],
		['BSPACE:v1:queue:queue-456', 'queue', 'queue-456'],
		['BSPACE:v1:booking:booking-789', 'booking', 'booking-789'],
		// uid()'s real shape.
		[
			'BSPACE:v1:booking:booking-3f2a8c1e-9b7d-4e2f-a1c3-5d6e7f8a9b0c',
			'booking',
			'booking-3f2a8c1e-9b7d-4e2f-a1c3-5d6e7f8a9b0c',
		],
	])('reads %s', (payload, type, id) => {
		expect(parseBookingQrPayload(payload)).toEqual({ version: 'v1', type, id })
	})

	it('round-trips every generated payload', () => {
		for (const payload of [
			reservationQrPayload(reservation()),
			queueTicketQrPayload(ticket()),
			serviceBookingQrPayload(service()),
		]) {
			const parsed = parseBookingQrPayload(payload)!
			expect(bookingQrPayload(parsed)).toBe(payload)
		}
	})

	it('tolerates the trailing newline scanners add', () => {
		expect(parseBookingQrPayload('BSPACE:v1:queue:queue-456\n')?.id).toBe(
			'queue-456',
		)
	})

	it.each([
		['empty string', ''],
		['random text', 'hello world'],
		['a URL', 'https://example.com/booking/1'],
		['wrong prefix', 'CITYGO:v1:booking:booking-789'],
		['lower-case prefix', 'bspace:v1:booking:booking-789'],
		['missing id', 'BSPACE:v1:booking:'],
		['missing id segment', 'BSPACE:v1:booking'],
		['unknown type', 'BSPACE:v1:table:booking-789'],
		['unknown version', 'BSPACE:v2:booking:booking-789'],
		['unversioned', 'BSPACE:booking:booking-789'],
		['extra segment', 'BSPACE:v1:booking:booking-789:extra'],
		['doubled separator', 'BSPACE::v1:booking:booking-789'],
		['wrong separator', 'BSPACE/v1/booking/booking-789'],
		['legacy parking', 'BSPACE:res-123'],
		['legacy queue', 'BSPACE:QUEUE:queue-456'],
		['legacy exit', 'BSPACE:EXIT:res-123'],
		['legacy service', 'BSPACE:TABLE:TB-1234'],
	])('refuses %s without throwing', (_, payload) => {
		expect(parseBookingQrPayload(payload)).toBeNull()
	})

	it.each([null, undefined, 42, {}, []])('refuses a non-string %p', value => {
		expect(parseBookingQrPayload(value)).toBeNull()
	})
})

// The QR is machine identity; the code on screen is for people. Neither is
// derived from the other.
describe('display-code independence', () => {
	it('identifies a ServiceBooking by id, not by its code', () => {
		const booking = service({ id: 'A', code: 'TB-5151' })
		expect(parseBookingQrPayload(serviceBookingQrPayload(booking))?.id).toBe('A')
		expect(serviceBookingReference(booking)).toEqual({
			label: 'Bron kodi',
			value: 'TB-5151',
		})
		// A different code on the same booking changes nothing a scanner sees.
		expect(serviceBookingQrPayload(service({ id: 'A', code: 'CN-9999' }))).toBe(
			serviceBookingQrPayload(booking),
		)
		expect(serviceBookingQrPayload(booking)).not.toContain('5151')
	})

	it('identifies a queue ticket by id, not by its printed number', () => {
		const queue = ticket({ id: 'A', number: '42' })
		expect(parseBookingQrPayload(queueTicketQrPayload(queue))?.id).toBe('A')
		expect(queueTicketQrPayload(queue)).not.toContain('42')
		expect(queueTicketReference(queue)).toEqual({
			label: 'Navbat raqami',
			value: '42',
		})
		expect(queueTicketQrPayload(ticket({ id: 'A', number: '43' }))).toBe(
			queueTicketQrPayload(queue),
		)
	})

	it('identifies a parking booking by reservation, not by lot or bay', () => {
		const parked = reservation({ id: 'A', parkingId: 'magic-city' })
		expect(reservationQrPayload(parked)).toBe('BSPACE:v1:reservation:A')
		expect(
			reservationQrPayload(reservation({ id: 'A', parkingId: 'amir-temur' })),
		).toBe(reservationQrPayload(parked))
		// The bay (A-05) lives in booking meta, which the payload never reads;
		// the human code is the id's tail.
		expect(reservationReference(reservation({ id: 'booking-abcdef12' }))).toEqual({
			label: 'Bron kodi',
			value: 'ABCDEF12',
		})
	})
})

// What the screens actually draw, through the one row normalisation.
describe('booking rows', () => {
	const state = {
		reservations: [reservation()],
		queueTickets: [ticket()],
		serviceBookings: [service()],
	}

	it('carries the shared payload and the human reference separately', () => {
		const rows = Object.fromEntries(bookingRows(state).map(row => [row.id, row]))
		expect(rows['queue-456'].qrValue).toBe('BSPACE:v1:queue:queue-456')
		expect(rows['queue-456']).toMatchObject({ code: '42', codeLabel: 'Navbat raqami' })
		expect(rows['booking-789'].qrValue).toBe('BSPACE:v1:booking:booking-789')
		expect(rows['booking-789']).toMatchObject({
			code: 'TB-1234',
			codeLabel: 'Bron kodi',
		})
		expect(rows['res-123']).toMatchObject({ code: 'RES-123', codeLabel: 'Bron kodi' })
	})

	it('keeps a stored display code exactly as persisted', () => {
		const detail = resolveBookingDetail(state, 'service', 'booking-789')
		expect(detail?.row.code).toBe('TB-1234')
		expect(detail?.source === 'service' && detail.booking).toBe(
			state.serviceBookings[0],
		)
	})

	it('resolves nothing — and so no QR — for a booking that is not there', () => {
		expect(resolveBookingDetail(state, 'service', 'missing')).toBeNull()
		expect(resolveBookingDetail(state, 'queue', 'booking-789')).toBeNull()
	})
})
