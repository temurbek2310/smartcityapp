import { describe, expect, it } from 'vitest'

import {
	QUEUE_ORGS,
	desksForService,
	getQueueDesk,
	getQueueOrg,
	getQueueService,
} from '@/data/queue-orgs'
import {
	DESK_STATES,
	assignQueueDesk,
	type DeskSlot,
	deskAvailability,
	firstFreeDesk,
	freeDeskCount,
	isDeskSelectable,
	isQueueOrgOpenAt,
	queueLoadAt,
} from './queue-desks'
import { queueSlotTimes, slotInstant } from './service-slots'
import type { QueueOrg, QueueTicket } from './types'

const DAY = '2026-09-24'
const at = (time: string, day = DAY) => slotInstant(day, time)

const org = (id: string): QueueOrg => {
	const found = getQueueOrg(id)
	if (!found) throw new Error(`no org ${id}`)
	return found
}

const bank = org('ipoteka-bank')
const gov = org('davlat-xizmat')
const coffee = org('coffee-lab')
const clinic = org('medical-plaza')

const ticket = (patch: Partial<QueueTicket> = {}): QueueTicket => ({
	id: 't1',
	orgId: 'davlat-xizmat',
	serviceId: 'passport',
	number: 'P-14',
	position: 0,
	initialPosition: 0,
	etaMinutes: 0,
	initialEtaMinutes: 0,
	windowNumber: 2,
	notify: true,
	status: 'scheduled',
	createdAt: '2026-09-23T10:00:00.000Z',
	scheduledAt: at('11:00').toISOString(),
	deskId: 'd2',
	...patch,
})

const states = (slots: DeskSlot[]) => slots.map(slot => slot.state)

// --- The catalog the engine reads --------------------------------------------

describe('queue catalog desks', () => {
	it.each(QUEUE_ORGS.map(item => [item.id, item] as const))(
		'%s: every service has exactly its windows in desks',
		(_, item) => {
			for (const service of item.services) {
				expect(desksForService(item, service.id)).toHaveLength(service.windows)
				expect(service.serviceMinutes).toBeGreaterThan(0)
			}
		},
	)

	it.each(QUEUE_ORGS.map(item => [item.id, item] as const))(
		'%s: desk ids and numbers are unique and every desk serves a real line',
		(_, item) => {
			const ids = item.desks.map(desk => desk.id)
			const numbers = item.desks.map(desk => desk.number)
			expect(new Set(ids).size).toBe(ids.length)
			expect(new Set(numbers).size).toBe(numbers.length)
			const services = new Set(item.services.map(service => service.id))
			for (const desk of item.desks) {
				expect(desk.serviceIds.length).toBeGreaterThan(0)
				for (const id of desk.serviceIds) expect(services.has(id)).toBe(true)
				expect(desk.label.trim()).not.toBe('')
			}
		},
	)

	it.each(QUEUE_ORGS.map(item => [item.id, item] as const))(
		'%s: opens before it closes',
		(_, item) => {
			expect(item.openTime).toMatch(/^\d{2}:\d{2}$/)
			expect(item.openTime < item.closeTime).toBe(true)
		},
	)

	it('a specialist carries a role, a window does not need one', () => {
		const doctor = getQueueDesk(clinic, 'd1')
		expect(doctor?.kind).toBe('specialist')
		expect(doctor?.role).toBe('Terapevt')
	})

	it('desks come back in printed order', () => {
		expect(desksForService(gov, 'passport').map(desk => desk.number)).toEqual([1, 2, 3])
	})

	it('lookups miss cleanly', () => {
		expect(getQueueService(bank, 'nope')).toBeUndefined()
		expect(getQueueDesk(bank, undefined)).toBeUndefined()
		expect(getQueueDesk(bank, 'd99')).toBeUndefined()
		expect(desksForService(bank, 'nope')).toEqual([])
	})
})

// --- Load and opening hours ----------------------------------------------------

describe('queueLoadAt', () => {
	it('reads the QUEUE_HOURS bucket the moment falls in', () => {
		// Ipoteka Bank: [30, 55, 72, 68, 80, 45, 0, 0] at 09, 11, 13, 15, 17 …
		expect(queueLoadAt(bank, at('09:00'))).toBe(30)
		expect(queueLoadAt(bank, at('10:59'))).toBe(30)
		expect(queueLoadAt(bank, at('11:00'))).toBe(55)
		expect(queueLoadAt(bank, at('17:30'))).toBe(80)
		expect(queueLoadAt(bank, at('21:00'))).toBe(0)
	})

	it('before the first bucket, the first applies', () => {
		expect(queueLoadAt(coffee, at('08:00'))).toBe(coffee.hourlyLoad[0])
	})
})

describe('isQueueOrgOpenAt', () => {
	it('a booked slot has to end by closing time', () => {
		// Bank closes at 18:00; a 40-minute credit consultation at 17:30 does not fit.
		expect(isQueueOrgOpenAt(bank, at('17:00'), 40, 'scheduled')).toBe(true)
		expect(isQueueOrgOpenAt(bank, at('17:30'), 40, 'scheduled')).toBe(false)
	})

	it('a live ticket only has to be taken before closing', () => {
		expect(isQueueOrgOpenAt(bank, at('17:55'), 40, 'live')).toBe(true)
		expect(isQueueOrgOpenAt(bank, at('18:00'), 40, 'live')).toBe(false)
	})

	it('shut before opening, and shut when the organisation says so', () => {
		expect(isQueueOrgOpenAt(bank, at('08:30'), 10, 'scheduled')).toBe(false)
		expect(isQueueOrgOpenAt({ ...bank, open: false }, at('12:00'), 10, 'live')).toBe(false)
	})
})

// --- The board ------------------------------------------------------------------

describe('deskAvailability', () => {
	const base = { org: gov, serviceId: 'passport', mode: 'scheduled' as const }

	it('lists the line’s desks, in order, one state each', () => {
		const slots = deskAvailability({ ...base, at: at('10:00') })
		expect(slots.map(slot => slot.desk.id)).toEqual(['d1', 'd2', 'd3'])
		for (const slot of slots) expect(Object.keys(DESK_STATES)).toContain(slot.state)
	})

	it('is deterministic: the same slot always draws the same board', () => {
		for (const time of queueSlotTimes(gov, getQueueService(gov, 'passport')!)) {
			expect(deskAvailability({ ...base, at: at(time) })).toEqual(
				deskAvailability({ ...base, at: at(time) }),
			)
		}
	})

	it('holds still within a half-hour, so a live board does not flicker', () => {
		const live = { ...base, mode: 'live' as const }
		expect(states(deskAvailability({ ...live, at: at('10:01') }))).toEqual(
			states(deskAvailability({ ...live, at: at('10:29') })),
		)
	})

	it('a taken desk reads Band live and Bron qilingan for a later slot', () => {
		const times = queueSlotTimes(gov, getQueueService(gov, 'passport')!)
		const scheduled = times.flatMap(time => states(deskAvailability({ ...base, at: at(time) })))
		const live = times.flatMap(time =>
			states(deskAvailability({ ...base, mode: 'live', at: at(time) })),
		)
		expect(scheduled).toContain('booked')
		expect(scheduled).not.toContain('busy')
		expect(live).toContain('busy')
		expect(live).not.toContain('booked')
	})

	it('a busy hour fills more desks than a quiet one, and never every desk all day', () => {
		const all = QUEUE_ORGS.flatMap(item =>
			item.services.flatMap(service =>
				[DAY, '2026-09-25', '2026-09-26'].flatMap(day =>
					queueSlotTimes(item, { ...service, bookable: true }).flatMap(time =>
						states(
							deskAvailability({
								org: item,
								serviceId: service.id,
								mode: 'scheduled',
								at: at(time, day),
							}),
						),
					),
				),
			),
		)
		const open = all.filter(state => state !== 'closed')
		const free = open.filter(state => state === 'free').length / open.length
		expect(free).toBeGreaterThan(0.2)
		expect(free).toBeLessThan(0.8)
	})

	it('every desk is closed outside opening hours', () => {
		expect(states(deskAvailability({ ...base, at: at('07:00') }))).toEqual([
			'closed',
			'closed',
			'closed',
		])
		expect(states(deskAvailability({ ...base, at: at('19:00') }))).toEqual([
			'closed',
			'closed',
			'closed',
		])
	})

	it('nothing for a service the organisation does not have', () => {
		expect(deskAvailability({ ...base, serviceId: 'nope', at: at('10:00') })).toEqual([])
	})

	it('an unreadable moment closes the board rather than guessing', () => {
		expect(states(deskAvailability({ ...base, at: 'not a date' }))).toEqual([
			'closed',
			'closed',
			'closed',
		])
	})

	describe('the customer’s own tickets', () => {
		it('a booked ticket shows as mine across its slot', () => {
			const slots = deskAvailability({
				...base,
				at: at('11:00'),
				tickets: [ticket()],
			})
			expect(slots.find(slot => slot.desk.id === 'd2')?.state).toBe('mine')
		})

		it('a neighbouring slot is not mine once the service has ended', () => {
			// Passport takes 20 minutes: 11:00–11:20 does not reach 11:30.
			const slots = deskAvailability({
				...base,
				at: at('11:30'),
				tickets: [ticket()],
			})
			expect(slots.find(slot => slot.desk.id === 'd2')?.state).not.toBe('mine')
		})

		it('history and other organisations never show as mine', () => {
			for (const held of [
				ticket({ status: 'cancelled' }),
				ticket({ status: 'served' }),
				ticket({ orgId: 'migratsiya' }),
			]) {
				const slots = deskAvailability({ ...base, at: at('11:00'), tickets: [held] })
				expect(states(slots)).not.toContain('mine')
			}
		})

		it('a live ticket holds its desk on the live board only', () => {
			const live = ticket({ status: 'waiting', scheduledAt: undefined })
			expect(
				states(deskAvailability({ ...base, mode: 'live', at: at('11:00'), tickets: [live] })),
			).toContain('mine')
			expect(
				states(deskAvailability({ ...base, at: at('11:00'), tickets: [live] })),
			).not.toContain('mine')
		})

		it('a desk shared by two lines reads the same from either', () => {
			// Medical Plaza's diagnostics room serves both the lab and the
			// scanner. Coffee Lab used to stand here, until a café's only
			// line became the takeaway counter.
			const held = ticket({
				orgId: 'medical-plaza',
				serviceId: 'lab',
				deskId: 'd2',
				scheduledAt: at('12:00').toISOString(),
			})
			const fromScanner = deskAvailability({
				org: clinic,
				serviceId: 'mri',
				mode: 'scheduled',
				at: at('12:00'),
				tickets: [held],
			})
			expect(fromScanner.map(slot => [slot.desk.id, slot.state])).toEqual([['d2', 'mine']])
			for (const time of ['09:00', '13:30', '16:00']) {
				const a = deskAvailability({ org: clinic, serviceId: 'lab', mode: 'scheduled', at: at(time) })
				const b = deskAvailability({ org: clinic, serviceId: 'mri', mode: 'scheduled', at: at(time) })
				expect(states(a)).toEqual(states(b))
			}
		})
	})
})

describe('selection helpers', () => {
	const desk = (id: string) => gov.desks.find(item => item.id === id)!
	const slots: DeskSlot[] = [
		{ desk: desk('d1'), state: 'booked' },
		{ desk: desk('d2'), state: 'free' },
		{ desk: desk('d3'), state: 'free' },
	]

	it('only a free desk is selectable', () => {
		expect(isDeskSelectable('free')).toBe(true)
		for (const state of ['busy', 'booked', 'mine', 'closed'] as const) {
			expect(isDeskSelectable(state)).toBe(false)
		}
	})

	it('firstFreeDesk skips taken and excluded desks', () => {
		expect(firstFreeDesk(slots)).toBe('d2')
		expect(firstFreeDesk(slots, ['d2'])).toBe('d3')
		expect(firstFreeDesk(slots, ['d2', 'd3'])).toBeNull()
		expect(firstFreeDesk([])).toBeNull()
	})

	it('freeDeskCount counts what a time chip shows', () => {
		expect(freeDeskCount(slots)).toBe(2)
		expect(freeDeskCount([])).toBe(0)
	})

	it('every legend label is Uzbek copy', () => {
		expect(DESK_STATES.free.label).toBe('Bo‘sh')
		expect(DESK_STATES.busy.label).toBe('Band')
		expect(DESK_STATES.booked.label).toBe('Band qilingan')
		expect(DESK_STATES.mine.label).toBe('Sizning navbatingiz')
		expect(DESK_STATES.closed.label).toBe('Yopiq')
	})
})

describe('assignQueueDesk', () => {
	const live = (patch: Partial<QueueTicket> = {}) =>
		ticket({ status: 'called', scheduledAt: undefined, deskId: undefined, ...patch })

	it('keeps a desk the ticket already names', () => {
		expect(assignQueueDesk(gov, live({ deskId: 'd3' }), at('11:00'))?.id).toBe('d3')
	})

	it('sends a live ticket to the first free desk of its line', () => {
		const board = deskAvailability({ org: gov, serviceId: 'passport', at: at('11:00'), mode: 'live' })
		const free = firstFreeDesk(board)
		const assigned = assignQueueDesk(gov, live(), at('11:00'))
		expect(assigned?.id).toBe(free ?? desksForService(gov, 'passport')[0].id)
		expect(assigned?.serviceIds).toContain('passport')
	})

	it('falls back to the line’s first desk when none is free', () => {
		// Closed hours read every desk as closed, so none is free.
		const assigned = assignQueueDesk(gov, live(), at('23:00'))
		expect(assigned?.id).toBe(desksForService(gov, 'passport')[0].id)
	})

	it('is undefined for a line with no desks', () => {
		expect(assignQueueDesk(gov, live({ serviceId: 'nope' }), at('11:00'))).toBeUndefined()
	})
})
