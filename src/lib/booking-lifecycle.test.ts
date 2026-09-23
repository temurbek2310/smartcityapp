import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { queueTicketJourney, serviceBookingJourney } from './booking-journey'
import {
	FALLBACK_CINEMA_MINUTES,
	FALLBACK_CLINIC_MINUTES,
	FALLBACK_EVENT_MINUTES,
	FALLBACK_TABLE_MINUTES,
	arriveQueueTicket,
	cancelQueueTicket,
	expectedEndAt,
	isQueueTicketLive,
	isReservationLive,
	reconcileBookingLifecycles,
	reconcileServiceBookings,
	serveQueueTicket,
} from './booking-lifecycle'
import { bookingRows, isOpen } from './bookings'
import { initialState } from './initial-state'
import { slotInstant } from './service-slots'
import type {
	QueueTicket,
	Reservation,
	ServiceBooking,
	ServiceBookingKind,
} from './types'

const MIN = 60_000
// A table at 18:00 Tashkent on 23 September, stored the way the sheet stores
// it: the ISO string of the +05:00 instant.
const START = slotInstant('2026-09-23', '18:00').toISOString()
const START_MS = Date.parse(START)
const AT = new Date('2026-09-23T20:00:00.000Z')

const ticket = (patch: Partial<QueueTicket> = {}): QueueTicket => ({
	id: 't1',
	orgId: 'coffee-lab',
	serviceId: 'table',
	number: 'A-23',
	position: 0,
	initialPosition: 6,
	etaMinutes: 0,
	initialEtaMinutes: 18,
	windowNumber: 2,
	notify: true,
	status: 'waiting',
	createdAt: '2026-09-23T10:00:00.000Z',
	...patch,
})

const booking = (patch: Partial<ServiceBooking> = {}): ServiceBooking => ({
	id: 's1',
	kind: 'table',
	refId: 'caravan',
	title: 'Caravan',
	subtitle: '2 kishi · 18:00',
	code: 'TB-1234',
	whenLabel: 'Bugun, 18:00',
	startAt: START,
	status: 'active',
	createdAt: '2026-09-23T08:00:00.000Z',
	...patch,
})

const reservation = (patch: Partial<Reservation> = {}): Reservation => ({
	id: 'r1',
	parkingId: 'amir-temur',
	userPhone: '+998901234567',
	startAt: '2026-09-20T06:30:00.000Z',
	endAt: '2026-09-20T08:30:00.000Z',
	durationHours: 2,
	pricePerHour: 12000,
	estimatedTotal: 24000,
	status: 'reserved',
	createdAt: '2026-09-20T05:00:00.000Z',
	...patch,
})

const rowsFor = (patch: Partial<Parameters<typeof bookingRows>[0]>) =>
	bookingRows({
		reservations: [],
		queueTickets: [],
		serviceBookings: [],
		...patch,
	})

const dest = { hasDestination: true }

describe('queue lifecycle', () => {
	it('walks waiting → called → arrived → served', () => {
		const called = ticket({ status: 'called' })
		const arrived = arriveQueueTicket(called)
		expect(arrived.status).toBe('arrived')
		expect(arrived.closedAt).toBeUndefined()

		const served = serveQueueTicket(arrived, AT)
		expect(served.status).toBe('served')
		expect(served.closedAt).toBe(AT.toISOString())
	})

	it('Men keldim checks in — it never serves', () => {
		const arrived = arriveQueueTicket(ticket({ status: 'called' }))
		expect(arrived.status).toBe('arrived')
		expect(arrived.status).not.toBe('served')
	})

	it('only a called ticket can arrive, only an arrived one can be served', () => {
		for (const status of ['waiting', 'arrived', 'served', 'cancelled'] as const) {
			const t = ticket({ status })
			expect(arriveQueueTicket(t)).toBe(t)
		}
		for (const status of ['waiting', 'called', 'served', 'cancelled'] as const) {
			const t = ticket({ status })
			expect(serveQueueTicket(t, AT)).toBe(t)
		}
	})

	it('cancels any live ticket, arrived included, and nothing terminal', () => {
		for (const status of ['waiting', 'called', 'arrived'] as const) {
			expect(cancelQueueTicket(ticket({ status }), AT).status).toBe('cancelled')
		}
		for (const status of ['served', 'cancelled'] as const) {
			const t = ticket({ status, closedAt: '2026-09-22T10:00:00.000Z' })
			expect(cancelQueueTicket(t, AT)).toBe(t)
		}
	})

	it('A–F: waiting, called and arrived are Faol; served and cancelled are Tarix', () => {
		const live = ['waiting', 'called', 'arrived'] as const
		const over = ['served', 'cancelled'] as const
		for (const status of live) {
			expect(isQueueTicketLive(status)).toBe(true)
			const [row] = rowsFor({ queueTickets: [ticket({ status })] })
			expect(isOpen(row)).toBe(true)
			expect(row.cancellable).toBe(true)
		}
		for (const status of over) {
			expect(isQueueTicketLive(status)).toBe(false)
			const [row] = rowsFor({ queueTickets: [ticket({ status })] })
			expect(isOpen(row)).toBe(false)
			expect(row.cancellable).toBe(false)
		}
	})

	it('an arrived row reads as at the window, not as finished', () => {
		const [row] = rowsFor({ queueTickets: [ticket({ status: 'arrived' })] })
		expect(row.status).toBe('active')
		expect(row.statusLabel).toBe('Faol')
		expect(row.subtitle).toContain('2-oyna')
		expect(row.whenLabel).toBe('Kelganingiz qayd etildi')
	})

	it('reads an unknown persisted status as history rather than crashing', () => {
		const [row] = rowsFor({
			queueTickets: [ticket({ status: 'bogus' as QueueTicket['status'] })],
		})
		expect(row.statusLabel).toBe('Bekor qilindi')
		expect(isOpen(row)).toBe(false)
	})
})

describe('queue actions per status', () => {
	it('B: called leads with Men keldim', () => {
		expect(queueTicketJourney(ticket({ status: 'called' }), dest).primary).toBe(
			'arrived',
		)
	})

	it('D: arrived leads with Navbatni kuzatish, and offers no route or Men keldim', () => {
		const journey = queueTicketJourney(ticket({ status: 'arrived' }), dest)
		expect(journey.stage).toBe('active')
		expect(journey.primary).toBe('track')
		expect(journey.secondary).not.toContain('arrived')
		expect(journey.secondary).not.toContain('directions')
		expect(journey.secondary).toContain('cancel')
	})

	it('served and cancelled have no operational primary and no Yo‘nalish', () => {
		for (const status of ['served', 'cancelled'] as const) {
			const journey = queueTicketJourney(ticket({ status }), dest)
			expect(journey.primary).toBeNull()
			expect(journey.secondary).toEqual(['share'])
		}
	})
})

describe('expectedEndAt', () => {
	it.each<[ServiceBookingKind, number]>([
		['table', FALLBACK_TABLE_MINUTES],
		['clinic', FALLBACK_CLINIC_MINUTES],
		['cinema', FALLBACK_CINEMA_MINUTES],
		['event', FALLBACK_EVENT_MINUTES],
	])('%s falls back to %i minutes after the start', (kind, minutes) => {
		expect(expectedEndAt(booking({ kind }))).toBe(START_MS + minutes * MIN)
	})

	it('uses the MVP defaults the policy names', () => {
		expect([
			FALLBACK_TABLE_MINUTES,
			FALLBACK_CLINIC_MINUTES,
			FALLBACK_CINEMA_MINUTES,
			FALLBACK_EVENT_MINUTES,
		]).toEqual([120, 60, 180, 240])
	})

	it('a stored duration beats the fallback', () => {
		expect(
			expectedEndAt(booking({ kind: 'cinema', durationMinutes: 95 })),
		).toBe(START_MS + 95 * MIN)
	})

	it('a stored end time beats both', () => {
		const endAt = '2026-09-23T13:45:00.000Z'
		expect(
			expectedEndAt(booking({ kind: 'event', endAt, durationMinutes: 500 })),
		).toBe(Date.parse(endAt))
	})

	it('ignores an unusable duration or end and falls back', () => {
		for (const patch of [
			{ durationMinutes: 0 },
			{ durationMinutes: -5 },
			{ durationMinutes: Number.NaN },
			{ endAt: 'not a date' },
		]) {
			expect(expectedEndAt(booking(patch))).toBe(
				START_MS + FALLBACK_TABLE_MINUTES * MIN,
			)
		}
	})

	it('reads the stored instant as-is, without reinterpreting a timezone', () => {
		// 18:00 at +05:00 is 13:00Z; the table ends 20:00 Tashkent = 15:00Z.
		expect(new Date(expectedEndAt(booking())!).toISOString()).toBe(
			'2026-09-23T15:00:00.000Z',
		)
	})

	it('a legacy booking with no startAt ends a full day after it was made, plus its duration', () => {
		const created = '2026-09-20T08:00:00.000Z'
		expect(
			expectedEndAt(booking({ startAt: undefined, createdAt: created })),
		).toBe(Date.parse(created) + 24 * 60 * MIN + FALLBACK_TABLE_MINUTES * MIN)
	})

	it('nothing to anchor on means no end', () => {
		expect(
			expectedEndAt(booking({ startAt: undefined, createdAt: 'garbage' })),
		).toBeNull()
	})
})

describe('automatic completion', () => {
	it('table at 18:00: Faol before its end, Tarix from the end onwards', () => {
		const end = START_MS + FALLBACK_TABLE_MINUTES * MIN
		const before = reconcileServiceBookings([booking()], end - MIN)
		expect(before[0].status).toBe('active')
		expect(isOpen(rowsFor({ serviceBookings: before })[0])).toBe(true)

		const after = reconcileServiceBookings([booking()], end)
		expect(after[0].status).toBe('completed')
		const [row] = rowsFor({ serviceBookings: after })
		expect(isOpen(row)).toBe(false)
		expect(row.statusLabel).toBe('Yakunlandi')
		expect(row.cancellable).toBe(false)
	})

	it.each<[ServiceBookingKind, number]>([
		['cinema', FALLBACK_CINEMA_MINUTES],
		['clinic', FALLBACK_CLINIC_MINUTES],
		['event', FALLBACK_EVENT_MINUTES],
	])('%s completes exactly at its expected end', (kind, minutes) => {
		const end = START_MS + minutes * MIN
		expect(reconcileServiceBookings([booking({ kind })], end - 1)[0].status).toBe(
			'active',
		)
		expect(reconcileServiceBookings([booking({ kind })], end)[0].status).toBe(
			'completed',
		)
	})

	it('cancelled stays cancelled and completed stays completed', () => {
		const later = START_MS + 10 * 24 * 60 * MIN
		const cancelled = booking({ id: 'c', status: 'cancelled' })
		const completed = booking({ id: 'd', status: 'completed' })
		const input = [cancelled, completed]
		const out = reconcileServiceBookings(input, later)
		expect(out).toBe(input)
		expect(out.map(item => item.status)).toEqual(['cancelled', 'completed'])
	})

	it('returns the same array when nothing is due, and is idempotent', () => {
		const input = [booking()]
		expect(reconcileServiceBookings(input, START_MS)).toBe(input)

		const once = reconcileServiceBookings(input, START_MS + 1_000 * MIN)
		expect(once).not.toBe(input)
		const twice = reconcileServiceBookings(once, START_MS + 1_001 * MIN)
		expect(twice).toBe(once)
	})

	it('a completed service booking offers no arrival or ticket action', () => {
		const journey = serviceBookingJourney(
			{ status: 'completed', startAt: START },
			START_MS,
			dest,
		)
		expect(journey.primary).toBeNull()
		expect(journey.secondary).not.toContain('present')
		expect(journey.secondary).not.toContain('directions')
	})
})

describe('reconcileBookingLifecycles', () => {
	const now = Date.parse('2026-09-23T07:00:00.000Z')
	const yesterday = (time: string) => slotInstant('2026-09-22', time).toISOString()

	// What the provider builds on hydration: the defaults under a stored blob.
	const hydrated = (parsed: Record<string, unknown>) => ({
		...initialState,
		...parsed,
		hydrated: true,
	})

	it('moves stale bookings of every kind to history without anyone opening them', () => {
		const state = hydrated({
			serviceBookings: [
				booking({ id: 'table', kind: 'table', startAt: yesterday('18:00') }),
				booking({ id: 'cinema', kind: 'cinema', startAt: yesterday('20:00') }),
				booking({ id: 'clinic', kind: 'clinic', startAt: yesterday('11:30') }),
				booking({ id: 'event', kind: 'event', startAt: yesterday('19:00') }),
			],
		})
		const next = reconcileBookingLifecycles(state, now)
		expect(next.serviceBookings.map(item => item.status)).toEqual([
			'completed',
			'completed',
			'completed',
			'completed',
		])
		expect(bookingRows(next).every(row => !isOpen(row))).toBe(true)
	})

	it('reconciles a legacy booking with no startAt once its day is long gone', () => {
		const state = hydrated({
			serviceBookings: [
				booking({ startAt: undefined, createdAt: '2026-09-20T08:00:00.000Z' }),
			],
		})
		expect(
			reconcileBookingLifecycles(state, now).serviceBookings[0].status,
		).toBe('completed')
	})

	it('never touches parking, however long ago its time passed', () => {
		const reservations = [
			reservation({ id: 'a', status: 'reserved' }),
			reservation({ id: 'b', status: 'active' }),
		]
		const state = hydrated({ reservations })
		const next = reconcileBookingLifecycles(state, now)
		expect(next).toBe(state)
		expect(next.reservations.every(item => isReservationLive(item.status))).toBe(
			true,
		)
	})

	it('leaves queue tickets to their own events, and old statuses hydrate as-is', () => {
		const queueTickets = (['waiting', 'called', 'served', 'cancelled'] as const).map(
			(status, i) => ticket({ id: `t${i}`, status }),
		)
		const state = hydrated({ queueTickets })
		expect(reconcileBookingLifecycles(state, now)).toBe(state)
		expect(
			bookingRows(state).map(row => [row.code && row.id, row.statusLabel]),
		).toEqual(
			expect.arrayContaining([
				['t0', 'Kutilmoqda'],
				['t1', 'Faol'],
				['t2', 'Yakunlandi'],
				['t3', 'Bekor qilindi'],
			]),
		)
	})

	it('returns the same state when nothing is due, so an idle tick writes nothing', () => {
		const state = hydrated({
			serviceBookings: [booking({ startAt: slotInstant('2026-09-24', '18:00').toISOString() })],
		})
		expect(reconcileBookingLifecycles(state, now)).toBe(state)
		expect(reconcileBookingLifecycles(state, now + 60 * MIN)).toBe(state)
	})

	it('adds no notifications', () => {
		const state = hydrated({
			serviceBookings: [booking({ startAt: yesterday('18:00') })],
		})
		const next = reconcileBookingLifecycles(state, now)
		expect(next.notifications).toBe(state.notifications)
	})

	it('tolerates a blob with no serviceBookings key at all', () => {
		const state = { serviceBookings: undefined as unknown as ServiceBooking[] }
		expect(reconcileBookingLifecycles(state, now)).toBe(state)
	})
})

describe('the provider', () => {
	const source = readFileSync(
		join(process.cwd(), 'src/context/app-context.tsx'),
		'utf8',
	)

	it('reconciles on hydration and on one shared interval', () => {
		// Hydration wraps the restored state; the tick wraps the current one.
		expect(source).toMatch(/setState\(\s*reconcileBookingLifecycles\(\s*\{/)
		expect(source).toMatch(
			/setState\(\(current\) => reconcileBookingLifecycles\(current, Date\.now\(\)\)\)/,
		)
		expect(source).toContain('LIFECYCLE_TICK_MS')
		expect(source).toMatch(/clearInterval\(timer\)/)
	})

	it('wires Men keldim to the arrive transition, not to served', () => {
		for (const file of [
			'src/components/queues/queue-ticket-card.tsx',
			'src/components/booking/booking-detail.tsx',
		]) {
			const ui = readFileSync(join(process.cwd(), file), 'utf8')
			expect(ui).toContain('arriveQueueTicket(ticket.id)')
			expect(ui).not.toContain('completeQueueTicket')
		}
	})
})
