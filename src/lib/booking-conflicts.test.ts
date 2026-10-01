import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
	FALLBACK_CLINIC_MINUTES,
	FALLBACK_TABLE_MINUTES,
} from './booking-lifecycle'
import {
	FALLBACK_QUEUE_SERVICE_MINUTES,
	QUEUE_DESK_CONFLICT_MESSAGE,
	SERVICE_CONFLICT_MESSAGE,
	findConflictingServiceBooking,
	findLiveQueueTicket,
	findQueueDeskClash,
	queueTicketInterval,
	sameServiceBookingTarget,
	serviceBookingInterval,
} from './booking-conflicts'
import { serviceBookingDraft } from './bookings'
import { findOverlappingReservation } from './reservation'
import { slotInstant } from './service-slots'
import type {
	QueueTicket,
	QueueTicketStatus,
	Reservation,
	ServiceBooking,
	ServiceBookingKind,
	ServiceBookingStatus,
} from './types'

const MIN = 60_000
const DAY = '2026-09-24'
const at = (time: string) => slotInstant(DAY, time).toISOString()

function booking(
	overrides: Partial<ServiceBooking> & { kind?: ServiceBookingKind } = {},
): ServiceBooking {
	return {
		id: 'held',
		kind: 'table',
		refId: 'coffee-lab',
		title: 'Coffee Lab',
		subtitle: '2 kishi · 18:00',
		code: 'TB-1234',
		whenLabel: 'Ertaga, 18:00',
		startAt: at('18:00'),
		status: 'active',
		createdAt: '2026-09-23T10:00:00.000Z',
		...overrides,
	}
}

const request = (
	time: string,
	overrides: Partial<Pick<ServiceBooking, 'kind' | 'refId'>> = {},
) => ({ kind: 'table' as const, refId: 'coffee-lab', startAt: at(time), ...overrides })

describe('sameServiceBookingTarget', () => {
	it('is kind + refId, nothing looser', () => {
		const a = { kind: 'table' as const, refId: 'coffee-lab' }
		expect(sameServiceBookingTarget(a, { kind: 'table', refId: 'coffee-lab' })).toBe(true)
		expect(sameServiceBookingTarget(a, { kind: 'table', refId: 'basilic' })).toBe(false)
		// Same place, different kind of booking.
		expect(sameServiceBookingTarget(a, { kind: 'clinic', refId: 'coffee-lab' })).toBe(false)
	})

	it('never matches on an empty refId', () => {
		expect(
			sameServiceBookingTarget({ kind: 'table', refId: '' }, { kind: 'table', refId: '' }),
		).toBe(false)
	})

	it('ignores titles and labels entirely', () => {
		const held = booking({ title: 'Coffee Lab', whenLabel: 'Bugun, 18:00' })
		expect(
			findConflictingServiceBooking([held], request('19:00', { refId: 'basilic' })),
		).toBeUndefined()
		// A different title for the same stored venue is still the same venue.
		expect(
			findConflictingServiceBooking([{ ...held, title: 'Boshqa nom' }], request('19:00'))?.id,
		).toBe('held')
	})
})

describe('serviceBookingInterval', () => {
	it('uses the kind fallback from lifecycle when no end is stored', () => {
		const table = serviceBookingInterval(booking())
		expect(table).toEqual({
			start: Date.parse(at('18:00')),
			end: Date.parse(at('18:00')) + FALLBACK_TABLE_MINUTES * MIN,
		})
		const clinic = serviceBookingInterval(booking({ kind: 'clinic' }))
		expect(clinic!.end - clinic!.start).toBe(FALLBACK_CLINIC_MINUTES * MIN)
	})

	it('prefers a stored end, then a stored duration', () => {
		expect(serviceBookingInterval(booking({ endAt: at('19:00') }))?.end).toBe(
			Date.parse(at('19:00')),
		)
		expect(serviceBookingInterval(booking({ durationMinutes: 45 }))?.end).toBe(
			Date.parse(at('18:00')) + 45 * MIN,
		)
	})

	it('is null for a legacy booking with no usable start', () => {
		expect(serviceBookingInterval(booking({ startAt: undefined }))).toBeNull()
		expect(serviceBookingInterval(booking({ startAt: 'garbage' }))).toBeNull()
		// An end before the start cannot be reasoned about either.
		expect(serviceBookingInterval(booking({ endAt: at('17:00') }))).toBeNull()
	})
})

describe('table — same restaurant, overlapping live booking', () => {
	// Existing: 18:00–20:00 (the 120-minute table fallback).
	const held = booking()

	it.each([
		['17:00', true], // 17:00–19:00 runs into it
		['18:00', true], // identical
		['19:00', true], // A. starts inside it
		['19:30', true],
		['16:00', false], // 16:00–18:00 ends exactly as it starts
		['20:00', false], // B. starts exactly as it ends
		['21:00', false],
	])('new booking at %s → blocked: %s', (time, blocked) => {
		expect(Boolean(findConflictingServiceBooking([held], request(time)))).toBe(blocked)
	})

	it('C. does not block a different restaurant at the same time', () => {
		expect(
			findConflictingServiceBooking([held], request('18:00', { refId: 'basilic' })),
		).toBeUndefined()
	})

	it.each<ServiceBookingStatus>(['completed', 'cancelled'])(
		'D. ignores a %s booking',
		status => {
			expect(
				findConflictingServiceBooking([booking({ status })], request('18:00')),
			).toBeUndefined()
		},
	)

	it('does not block a different day at the same hour', () => {
		expect(
			findConflictingServiceBooking([held], {
				...request('18:00'),
				startAt: slotInstant('2026-09-25', '18:00').toISOString(),
			}),
		).toBeUndefined()
	})

	it('returns the existing booking, so the UI can link to it', () => {
		const other = booking({ id: 'other', refId: 'basilic' })
		expect(findConflictingServiceBooking([other, held], request('19:00'))).toBe(held)
	})

	it('checks exactly what the sheet stores', () => {
		const draft = serviceBookingDraft({
			kind: 'table',
			refId: 'coffee-lab',
			title: 'Coffee Lab',
			count: 2,
			unit: 'kishi',
			startAt: slotInstant(DAY, '19:00'),
			durationMinutes: FALLBACK_TABLE_MINUTES,
			now: slotInstant(DAY, '09:00'),
		})
		expect(findConflictingServiceBooking([held], draft)?.id).toBe('held')
	})

	it('spans the duration the customer chose, on both sides', () => {
		// A one-hour table ending 17:00 stays clear of the 18:00 booking; a
		// three-hour one starting 15:30 runs into it.
		expect(
			findConflictingServiceBooking([held], { ...request('16:00'), durationMinutes: 60 }),
		).toBeUndefined()
		expect(
			findConflictingServiceBooking([held], { ...request('15:30'), durationMinutes: 180 })?.id,
		).toBe('held')
		// A held 60-minute table (18:00–19:00) leaves 19:00 free.
		expect(
			findConflictingServiceBooking([booking({ durationMinutes: 60 })], request('19:00')),
		).toBeUndefined()
	})

	it('an upcoming booking blocks exactly like a started one', () => {
		expect(
			findConflictingServiceBooking([booking({ status: 'upcoming' })], request('19:00'))?.id,
		).toBe('held')
	})
})

describe('clinic — same clinic, overlapping live booking', () => {
	// 60-minute fallback: 18:00–19:00.
	const held = booking({ kind: 'clinic', refId: 'medical-plaza' })
	const clinic = (time: string, refId = 'medical-plaza') =>
		request(time, { kind: 'clinic', refId })

	it('blocks an overlap', () => {
		expect(findConflictingServiceBooking([held], clinic('18:30'))?.id).toBe('held')
	})

	it('allows the exact boundary', () => {
		expect(findConflictingServiceBooking([held], clinic('19:00'))).toBeUndefined()
		expect(findConflictingServiceBooking([held], clinic('17:00'))).toBeUndefined()
	})

	it('allows a different clinic', () => {
		expect(findConflictingServiceBooking([held], clinic('18:00', 'other-clinic'))).toBeUndefined()
	})

	it.each<ServiceBookingStatus>(['completed', 'cancelled'])('ignores %s', status => {
		expect(
			findConflictingServiceBooking([{ ...held, status }], clinic('18:00')),
		).toBeUndefined()
	})
})

describe('cinema — same showing, not overlap', () => {
	const held = booking({ kind: 'cinema', refId: 'cinema-magic' })
	const cinema = (time: string, refId = 'cinema-magic') =>
		request(time, { kind: 'cinema', refId })

	it('blocks the same cinema at the same start', () => {
		expect(findConflictingServiceBooking([held], cinema('18:00'))?.id).toBe('held')
	})

	it('allows a later showing even inside the 180-minute fallback', () => {
		// Table-style overlap would block this; a different showing is a
		// different ticket.
		expect(findConflictingServiceBooking([held], cinema('19:00'))).toBeUndefined()
		expect(findConflictingServiceBooking([held], cinema('20:00'))).toBeUndefined()
	})

	it('allows the same time at a different cinema', () => {
		expect(findConflictingServiceBooking([held], cinema('18:00', 'cinema-other'))).toBeUndefined()
	})

	it.each<ServiceBookingStatus>(['completed', 'cancelled'])('ignores %s', status => {
		expect(
			findConflictingServiceBooking([{ ...held, status }], cinema('18:00')),
		).toBeUndefined()
	})
})

describe('event — persisted bookings are covered by the same rule', () => {
	const held = booking({ kind: 'event', refId: 'event-jazz' })

	it('blocks the same event at the same time and nothing else', () => {
		const event = (time: string, refId = 'event-jazz') =>
			request(time, { kind: 'event', refId })
		expect(findConflictingServiceBooking([held], event('18:00'))?.id).toBe('held')
		expect(findConflictingServiceBooking([held], event('19:00'))).toBeUndefined()
		expect(findConflictingServiceBooking([held], event('18:00', 'event-other'))).toBeUndefined()
	})
})

describe('legacy and malformed records', () => {
	it('a live booking with no startAt never blocks anything', () => {
		const legacy = booking({ startAt: undefined })
		for (const time of ['10:00', '18:00', '19:00']) {
			expect(findConflictingServiceBooking([legacy], request(time))).toBeUndefined()
		}
	})

	it('an unparsable request is not treated as a clash', () => {
		expect(
			findConflictingServiceBooking([booking()], { ...request('18:00'), startAt: 'nope' }),
		).toBeUndefined()
	})

	it('does not crash on an empty list', () => {
		expect(findConflictingServiceBooking([], request('18:00'))).toBeUndefined()
	})
})

describe('store-level sequence', () => {
	// What createServiceBooking() does to its synchronous list: check, then
	// append. Two identical requests in a row — a double tap before React has
	// re-rendered — leave exactly one booking.
	function create(list: ServiceBooking[], req: ReturnType<typeof request>, id: string) {
		const existing = findConflictingServiceBooking(list, req)
		if (existing) return { list, result: { ok: false as const, existing } }
		const created = booking({ ...req, id })
		return { list: [created, ...list], result: { ok: true as const, created } }
	}

	it('E. a rapid double submit stores one booking and reports the first', () => {
		const first = create([], request('18:00'), 'b1')
		const second = create(first.list, request('18:00'), 'b2')
		expect(first.result.ok).toBe(true)
		expect(second.result).toEqual({ ok: false, existing: first.list[0] })
		expect(second.list).toHaveLength(1)
	})

	it('survives a JSON round trip, the way hydrated localStorage does', () => {
		const stored = JSON.parse(JSON.stringify([booking()])) as ServiceBooking[]
		expect(findConflictingServiceBooking(stored, request('19:00'))?.id).toBe('held')
	})

	it('a cancelled booking frees the slot again (Takrorlash after cancel)', () => {
		const cancelled = [{ ...booking(), status: 'cancelled' as const }]
		expect(create(cancelled, request('18:00'), 'b2').result.ok).toBe(true)
	})
})

describe('messages', () => {
	it('names each kind in Uzbek', () => {
		expect(SERVICE_CONFLICT_MESSAGE.table).toBe('Bu vaqtda ushbu restoranda broningiz mavjud')
		expect(SERVICE_CONFLICT_MESSAGE.clinic).toBe('Bu vaqt uchun faol broningiz mavjud')
		expect(SERVICE_CONFLICT_MESSAGE.cinema).toBe('Bu seans uchun broningiz mavjud')
	})
})

// --- Queue -------------------------------------------------------------------

function ticket(overrides: Partial<QueueTicket> = {}): QueueTicket {
	return {
		id: 't1',
		orgId: 'coffee-lab-queue',
		serviceId: 'takeaway',
		number: 'A-14',
		position: 3,
		initialPosition: 3,
		etaMinutes: 9,
		initialEtaMinutes: 9,
		windowNumber: 1,
		notify: true,
		status: 'waiting',
		createdAt: '2026-09-23T10:00:00.000Z',
		...overrides,
	}
}

describe('findLiveQueueTicket', () => {
	const line = { orgId: 'coffee-lab-queue', serviceId: 'takeaway' }

	it.each<[QueueTicketStatus, boolean]>([
		['scheduled', true], // a line booked ahead is still this line
		['waiting', true], // A
		['called', true], // B
		['arrived', true], // C
		['served', false], // D
		['cancelled', false], // E
	])('same line + %s → blocked: %s', (status, blocked) => {
		expect(Boolean(findLiveQueueTicket([ticket({ status })], line))).toBe(blocked)
	})

	it('F. a different organisation or service is a different line', () => {
		const held = [ticket()]
		expect(findLiveQueueTicket(held, { ...line, orgId: 'bank' })).toBeUndefined()
		expect(findLiveQueueTicket(held, { ...line, serviceId: 'dine-in' })).toBeUndefined()
	})

	it('without a service, answers for the whole organisation', () => {
		expect(findLiveQueueTicket([ticket()], { orgId: 'coffee-lab-queue' })?.id).toBe('t1')
		expect(findLiveQueueTicket([ticket({ status: 'served' })], { orgId: 'coffee-lab-queue' }))
			.toBeUndefined()
	})

	it('finds this organisation’s ticket even behind another one', () => {
		const tickets = [ticket({ id: 'bank', orgId: 'bank' }), ticket({ id: 'mine' })]
		expect(findLiveQueueTicket(tickets, { orgId: 'coffee-lab-queue' })?.id).toBe('mine')
	})

	it('never matches an empty org id', () => {
		expect(findLiveQueueTicket([ticket({ orgId: '' })], { orgId: '' })).toBeUndefined()
	})
})

// --- Queue desks ----------------------------------------------------------------
// Real catalog ids: the slot length comes from the service's serviceMinutes.
// Medical Plaza's diagnostics room (d2) serves both the lab (10 min) and the
// scanner (40 min); Davlat xizmatlari's passport line (20 min) has three
// windows.

describe('queueTicketInterval', () => {
	const slot = (patch: Partial<QueueTicket> = {}) =>
		ticket({ orgId: 'davlat-xizmat', serviceId: 'passport', scheduledAt: at('11:00'), ...patch })

	it('a booked ticket holds its desk for the service’s own length', () => {
		expect(queueTicketInterval(slot())).toEqual({
			start: Date.parse(at('11:00')),
			end: Date.parse(at('11:20')),
		})
	})

	it('a live ticket, or an unreadable time, has no slot', () => {
		expect(queueTicketInterval(slot({ scheduledAt: undefined }))).toBeNull()
		expect(queueTicketInterval(slot({ scheduledAt: 'soon' }))).toBeNull()
	})

	it('a service the catalog lost still holds the grid’s half-hour', () => {
		expect(queueTicketInterval(slot({ serviceId: 'gone' }))?.end).toBe(
			Date.parse(at('11:00')) + FALLBACK_QUEUE_SERVICE_MINUTES * MIN,
		)
	})
})

describe('findQueueDeskClash', () => {
	const held = (patch: Partial<QueueTicket> = {}) =>
		ticket({
			id: 'held',
			orgId: 'medical-plaza',
			serviceId: 'lab',
			deskId: 'd2',
			status: 'scheduled',
			scheduledAt: at('12:00'),
			...patch,
		})
	const ask = (time: string, patch: Partial<QueueTicket> = {}) => ({
		orgId: 'medical-plaza',
		serviceId: 'mri',
		deskId: 'd2',
		scheduledAt: at(time),
		...patch,
	})

	it('the same desk through another line, overlapping, is a clash', () => {
		expect(findQueueDeskClash([held()], ask('12:00'))?.id).toBe('held')
		// The scanner's 40 minutes from 11:55 reach into 12:00–12:10.
		expect(findQueueDeskClash([held()], ask('11:55'))?.id).toBe('held')
	})

	it('back-to-back slots do not clash', () => {
		// The lab holds 12:00–12:10; the next one may start at 12:10.
		expect(findQueueDeskClash([held()], ask('12:10'))).toBeUndefined()
		// The scanner's 40 minutes from 11:20 end exactly at 12:00.
		expect(findQueueDeskClash([held()], ask('11:20'))).toBeUndefined()
	})

	it('another desk or another organisation is free', () => {
		expect(findQueueDeskClash([held()], ask('12:00', { deskId: 'd1' }))).toBeUndefined()
		expect(
			findQueueDeskClash([held({ orgId: 'plov-center' })], ask('12:00')),
		).toBeUndefined()
	})

	it('history never blocks, every live status does', () => {
		for (const status of ['served', 'cancelled'] as const) {
			expect(findQueueDeskClash([held({ status })], ask('12:00'))).toBeUndefined()
		}
		for (const status of ['scheduled', 'waiting', 'called', 'arrived'] as const) {
			expect(findQueueDeskClash([held({ status })], ask('12:00'))?.id).toBe('held')
		}
	})

	it('a live ticket — no slot — neither clashes nor is clashed with', () => {
		expect(
			findQueueDeskClash([held({ scheduledAt: undefined })], ask('12:00')),
		).toBeUndefined()
		expect(findQueueDeskClash([held()], ask('12:00', { scheduledAt: undefined }))).toBeUndefined()
		expect(findQueueDeskClash([held()], ask('12:00', { deskId: undefined }))).toBeUndefined()
	})

	it('names the clash in Uzbek', () => {
		expect(QUEUE_DESK_CONFLICT_MESSAGE).toBe('Bu vaqtda ushbu oynada navbatingiz mavjud')
	})
})

// --- Parking is unchanged ----------------------------------------------------

describe('parking keeps its own rule', () => {
	const reservation = (overrides: Partial<Reservation> = {}): Reservation => ({
		id: 'r1',
		parkingId: 'p1',
		userPhone: '+998',
		startAt: '2026-09-24T10:00:00.000Z',
		endAt: '2026-09-24T12:00:00.000Z',
		durationHours: 2,
		pricePerHour: 5000,
		estimatedTotal: 10000,
		status: 'reserved',
		createdAt: '2026-09-23T10:00:00.000Z',
		...overrides,
	})
	const window = (start: string, end: string) => ({
		startAt: `2026-09-24T${start}:00.000Z`,
		endAt: `2026-09-24T${end}:00.000Z`,
	})

	it('still blocks an overlap in any lot, as before', () => {
		expect(findOverlappingReservation([reservation()], window('11:00', '13:00'))?.id).toBe('r1')
		expect(
			findOverlappingReservation([reservation({ parkingId: 'p2' })], window('11:00', '13:00'))
				?.id,
		).toBe('r1')
	})

	it('still allows the exact boundary and ignores history', () => {
		expect(findOverlappingReservation([reservation()], window('12:00', '14:00'))).toBeUndefined()
		for (const status of ['completed', 'cancelled'] as const) {
			expect(
				findOverlappingReservation([reservation({ status })], window('11:00', '13:00')),
			).toBeUndefined()
		}
	})
})

// --- Wiring --------------------------------------------------------------------
// The rule has to live in the mutation, not only in a screen, and every
// screen has to reach the mutation — no creation path of its own.

describe('enforcement lives in the store', () => {
	const store = readFileSync(join(process.cwd(), 'src/context/app-context.tsx'), 'utf8')

	it('each creating mutation checks its synchronous list before appending', () => {
		expect(store).toMatch(/findOverlappingReservation\(reservationsRef\.current/)
		expect(store).toMatch(/findLiveQueueTicket\(queueTicketsRef\.current/)
		expect(store).toMatch(/findQueueDeskClash\(queueTicketsRef\.current/)
		expect(store).toMatch(/findConflictingServiceBooking\(\s*serviceBookingsRef\.current/)
		expect(store).toContain('reservationsRef.current = [reservation, ...reservationsRef.current]')
		expect(store).toContain('queueTicketsRef.current = [ticket, ...queueTicketsRef.current]')
		expect(store).toContain(
			'serviceBookingsRef.current = [booking, ...serviceBookingsRef.current]',
		)
	})

	function sources(dir: string): string[] {
		return readdirSync(dir).flatMap(name => {
			const path = join(dir, name)
			if (statSync(path).isDirectory()) return sources(path)
			return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : []
		})
	}

	it('only the shared sheets call the creating mutations', () => {
		const callers = (fn: string) =>
			sources(join(process.cwd(), 'src'))
				.filter(path => !path.endsWith('app-context.tsx'))
				.filter(path => readFileSync(path, 'utf8').includes(`${fn}(`))
				.map(path => path.replace(/\\/g, '/').replace(/^.*\/src\//, 'src/'))

		// Home's place sheet, /queues, Bron's «Takrorlash» and «Yangi bron»
		// all open these sheets rather than creating anything themselves.
		expect(callers('takeQueueTicket')).toEqual(['src/components/queues/take-ticket-sheet.tsx'])
		expect(callers('createServiceBooking')).toEqual([
			'src/components/booking/service-booking-sheet.tsx',
		])
		// The table sheet's success view books the lot beside the table in one
		// tap; everything it sends is inherited, and the store checks it.
		expect(callers('createReservation').sort()).toEqual([
			'src/components/booking/table-parking-offer.tsx',
			'src/components/parking/parking-booking-sheet.tsx',
		])
	})
})
