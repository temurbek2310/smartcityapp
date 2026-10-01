import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
	ACTION_LABELS,
	ARRIVAL_WINDOW_MINUTES,
	ARRIVAL_WINDOW_MS,
	arrivalStage,
	presentActionLabel,
	queueTicketJourney,
	reservationJourney,
	serviceBookingJourney,
} from '@/lib/booking-journey'
import { routeHref } from '@/lib/navigation'

// Fixed clocks only: every case names its own `now` relative to one start.
const START = '2026-09-23T14:00:00.000Z'
const startMs = Date.parse(START)
const minutes = (value: number) => value * 60_000
const at = (offsetMinutes: number) => startMs + minutes(offsetMinutes)

const dest = { hasDestination: true }
const noDest = { hasDestination: false }

describe('arrival window', () => {
	it('is one named 30-minute constant', () => {
		expect(ARRIVAL_WINDOW_MINUTES).toBe(30)
		expect(ARRIVAL_WINDOW_MS).toBe(minutes(30))
	})

	it('is upcoming before the window, arrival from the threshold on', () => {
		expect(arrivalStage(START, at(-120))).toBe('upcoming')
		expect(arrivalStage(START, at(-30) - 1)).toBe('upcoming')
		expect(arrivalStage(START, at(-30))).toBe('arrival')
		expect(arrivalStage(START, at(-20))).toBe('arrival')
		// Late is still arriving; closing the window is the lifecycle's job.
		expect(arrivalStage(START, at(10))).toBe('arrival')
	})

	it('reads nothing from a missing or invalid time', () => {
		expect(arrivalStage(undefined, at(0))).toBeNull()
		expect(arrivalStage('not a date', at(0))).toBeNull()
		expect(arrivalStage(START, null)).toBeNull()
	})

	it('honours the offset a stored instant carries', () => {
		// 19:00 Tashkent is 14:00Z — the same instant as START.
		expect(arrivalStage('2026-09-23T19:00:00.000+05:00', at(-20))).toBe(
			'arrival',
		)
	})
})

describe('parking', () => {
	const reserved = { status: 'reserved' as const, startAt: START }

	it('A: two hours early leads with Yo‘nalish, entry only secondary', () => {
		const journey = reservationJourney(reserved, at(-120), dest)
		expect(journey.stage).toBe('upcoming')
		expect(journey.primary).toBe('directions')
		expect(journey.secondary).toEqual(['enter', 'share', 'cancel'])
	})

	it('B: twenty minutes before leads with Parkingga kirish', () => {
		const journey = reservationJourney(reserved, at(-20), dest)
		expect(journey.stage).toBe('arrival')
		expect(journey.primary).toBe('enter')
		expect(journey.secondary).toEqual(['directions', 'share', 'cancel'])
	})

	it('switches exactly at the threshold', () => {
		expect(reservationJourney(reserved, at(-30) - 1, dest).primary).toBe(
			'directions',
		)
		expect(reservationJourney(reserved, at(-30), dest).primary).toBe('enter')
	})

	it('C: active leads with Parkingdan chiqish', () => {
		const journey = reservationJourney(
			{ status: 'active', startAt: START },
			at(60),
			dest,
		)
		expect(journey.stage).toBe('active')
		expect(journey.primary).toBe('exit')
		expect(journey.secondary).toEqual(['extend', 'directions', 'share'])
		expect(journey.secondary).not.toContain('cancel')
	})

	it('D: completed offers the receipt and no entry or exit', () => {
		const journey = reservationJourney(
			{ status: 'completed', startAt: START },
			at(0),
			dest,
		)
		expect(journey.stage).toBe('completed')
		expect(journey.primary).toBe('receipt')
		expect(journey.secondary).not.toContain('enter')
		expect(journey.secondary).not.toContain('exit')
	})

	it('E: cancelled has no operational action at all', () => {
		const journey = reservationJourney(
			{ status: 'cancelled', startAt: START },
			at(-20),
			dest,
		)
		expect(journey.stage).toBe('cancelled')
		expect(journey.primary).toBeNull()
		expect(journey.secondary).toEqual([])
	})

	it('falls back to the status while the clock is unknown or the time is bad', () => {
		for (const journey of [
			reservationJourney(reserved, null, dest),
			reservationJourney({ status: 'reserved', startAt: 'bad' }, at(0), dest),
		]) {
			expect(journey.stage).toBe('upcoming')
			expect(journey.basis).toBe('status')
			expect(journey.primary).toBe('directions')
		}
	})

	it('promotes entry when there is nowhere to route to', () => {
		expect(reservationJourney(reserved, at(-120), noDest).primary).toBe('enter')
	})

	it('names entry and exit plainly', () => {
		expect(ACTION_LABELS.enter).toBe('Parkingga kirish')
		expect(ACTION_LABELS.exit).toBe('Parkingdan chiqish')
		expect(ACTION_LABELS.directions).toBe('Yo‘nalish')
	})
})

describe('service bookings', () => {
	const table = { status: 'active' as const, startAt: START }

	it('F: a table two hours early leads with Yo‘nalish', () => {
		const journey = serviceBookingJourney(table, at(-120), dest)
		expect(journey.stage).toBe('upcoming')
		expect(journey.primary).toBe('directions')
		expect(journey.secondary).toEqual(['present', 'share', 'cancel'])
	})

	it('G: near the time leads with showing the booking', () => {
		const journey = serviceBookingJourney(table, at(-10), dest)
		expect(journey.stage).toBe('arrival')
		expect(journey.primary).toBe('present')
		expect(journey.secondary).toEqual(['directions', 'share', 'cancel'])
	})

	it('K/L: cinema follows the same window with its own wording', () => {
		expect(serviceBookingJourney(table, at(-45), dest).primary).toBe(
			'directions',
		)
		expect(serviceBookingJourney(table, at(-5), dest).primary).toBe('present')
		expect(presentActionLabel('cinema')).toBe('Chiptani ko‘rsatish')
		expect(presentActionLabel('event')).toBe('Chiptani ko‘rsatish')
		expect(presentActionLabel('table')).toBe('Bronni ko‘rsatish')
		expect(presentActionLabel('clinic')).toBe('Bronni ko‘rsatish')
	})

	it('keeps Yo‘nalish first for a booking stored without a start time', () => {
		for (const startAt of [undefined, 'garbage']) {
			const journey = serviceBookingJourney(
				{ status: 'active', startAt },
				at(0),
				dest,
			)
			expect(journey.basis).toBe('status')
			expect(journey.primary).toBe('directions')
		}
	})

	it('offers nothing operational once completed or cancelled', () => {
		for (const status of ['completed', 'cancelled'] as const) {
			const journey = serviceBookingJourney({ status, startAt: START }, at(0), dest)
			expect(journey.primary).toBeNull()
			expect(journey.secondary).toEqual(['share'])
		}
	})
})

describe('queue tickets', () => {
	it('H: a long wait leads with Yo‘nalish', () => {
		const journey = queueTicketJourney({ status: 'waiting', etaMinutes: 45 }, dest)
		expect(journey.stage).toBe('upcoming')
		expect(journey.primary).toBe('directions')
		expect(journey.secondary).toContain('track')
	})

	it('J: close to the turn leads with Navbatni kuzatish', () => {
		const journey = queueTicketJourney(
			{ status: 'waiting', etaMinutes: ARRIVAL_WINDOW_MINUTES },
			dest,
		)
		expect(journey.stage).toBe('arrival')
		expect(journey.primary).toBe('track')
		expect(journey.secondary[0]).toBe('directions')
	})

	it('I: a called number leads with the existing Men keldim', () => {
		const journey = queueTicketJourney({ status: 'called', etaMinutes: 0 }, dest)
		expect(journey.stage).toBe('active')
		expect(journey.primary).toBe('arrived')
		expect(ACTION_LABELS.arrived).toBe('Men keldim')
	})

	it('falls back to the status when the estimate is unusable', () => {
		const journey = queueTicketJourney(
			{ status: 'waiting', etaMinutes: Number.NaN },
			dest,
		)
		expect(journey.basis).toBe('status')
		expect(journey.primary).toBe('directions')
	})

	it('a closed ticket has no operational action', () => {
		for (const status of ['served', 'cancelled'] as const) {
			expect(queueTicketJourney({ status, etaMinutes: 0 }, dest).primary).toBeNull()
		}
	})
})

describe('queue tickets booked ahead', () => {
	const booked = { status: 'scheduled' as const, etaMinutes: 0, scheduledAt: START }

	it('far from its slot, leads with Yo‘nalish', () => {
		const journey = queueTicketJourney(booked, dest, at(-120))
		expect(journey.stage).toBe('upcoming')
		expect(journey.basis).toBe('time')
		expect(journey.primary).toBe('directions')
		expect(journey.secondary).toEqual(['track', 'share', 'cancel'])
	})

	it('inside the arrival window, leads with the line it is about to join', () => {
		const journey = queueTicketJourney(booked, dest, at(-ARRIVAL_WINDOW_MINUTES))
		expect(journey.stage).toBe('arrival')
		expect(journey.primary).toBe('track')
		expect(journey.secondary[0]).toBe('directions')
	})

	it('without a clock or a readable slot, falls back to the status', () => {
		for (const journey of [
			queueTicketJourney(booked, dest),
			queueTicketJourney({ ...booked, scheduledAt: undefined }, dest, at(0)),
		]) {
			expect(journey.stage).toBe('upcoming')
			expect(journey.basis).toBe('status')
			expect(journey.primary).toBe('directions')
		}
	})

	it('offers no Men keldim before it has been called', () => {
		const journey = queueTicketJourney(booked, dest, at(0))
		expect([journey.primary, ...journey.secondary]).not.toContain('arrived')
	})

	it('with no destination, the line leads', () => {
		expect(queueTicketJourney(booked, noDest, at(-120)).primary).toBe('track')
	})
})

describe('Yo‘nalish', () => {
	it('still routes straight to /transport', () => {
		expect(routeHref({ destinationId: 'parking:x', mode: 'car' })).toMatch(
			/^\/transport\?/,
		)
	})

	it('goes through useDirections on every detail page, with no sheet', () => {
		const root = process.cwd()
		for (const file of [
			'src/app/(app)/reservation/[id]/page.tsx',
			'src/components/booking/booking-detail.tsx',
		]) {
			const source = readFileSync(join(root, file), 'utf8')
			expect(source).toContain('useDirections')
			expect(source).not.toMatch(/DirectionsSheet|Marshrutni ko/)
		}
	})
})
