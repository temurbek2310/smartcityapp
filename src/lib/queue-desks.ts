import { QUEUE_HOURS, desksForService, getQueueService } from '@/data/queue-orgs'
import { isQueueTicketLive } from '@/lib/booking-lifecycle'
import { queueTicketInterval } from '@/lib/booking-conflicts'
import { intervalsOverlap } from '@/lib/reservation'
import { makeRandom, seedFor } from '@/lib/seeded-random'
import { QUEUE_SLOT_STEP_MINUTES } from '@/lib/service-slots'
import {
	type DateLike,
	tashkentDayKey,
	tashkentParts,
} from '@/lib/tashkent-time'
import type { QueueDesk, QueueOrg, QueueTicket } from '@/lib/types'

// The queue's «Схема мест»: which windows, desks and specialists of one line
// are free at a moment, the way bayMap() answers it for a parking level.
//
// Pure and deterministic, for the same two reasons as the floor plan: the
// board is rendered on the server and again on the client, and a desk seen
// free, backed out of and returned to has to still be free. Nothing here reads
// the clock — the moment asked about is always passed in.
//
// There is no live feed of other customers, so who else holds a desk is drawn
// from the organisation's own hourlyLoad at that hour: a busy hour fills more
// desks. The customer's own tickets are real and always win over the draw.

export type DeskState = 'free' | 'busy' | 'booked' | 'mine' | 'closed'

export const DESK_STATES: Record<
	DeskState,
	{ label: string; swatch: string; text: string }
> = {
	free: { label: 'Bo‘sh', swatch: 'bg-ok-bg border-ok', text: 'text-ok' },
	busy: { label: 'Band', swatch: 'bg-card-2 border-line-2', text: 'text-ink-3' },
	booked: {
		label: 'Band qilingan',
		swatch: 'bg-warn-bg border-warn',
		text: 'text-warn',
	},
	mine: { label: 'Sizning navbatingiz', swatch: 'bg-brand-100 border-brand', text: 'text-brand' },
	closed: { label: 'Yopiq', swatch: 'bg-card-2 border-line', text: 'text-ink-3' },
}

// At most this share of desks is drawn as taken, even at a 100% hour, so a
// busy line still reads as busy rather than as shut.
const MAX_TAKEN_SHARE = 0.8

export type DeskSlot = {
	desk: QueueDesk
	state: DeskState
}

export type DeskAvailabilityInput = {
	org: QueueOrg
	serviceId: string
	// The slot's start, or the current moment for a ticket taken live.
	at: DateLike
	// live — «Hozir»: a taken desk is serving someone right now («Band»).
	// scheduled — a later slot: a taken desk is booked by someone else.
	mode: 'live' | 'scheduled'
	// The customer's own tickets. Live ones holding a desk show as «mine».
	tickets?: readonly QueueTicket[]
}

function minutesOf(time: string) {
	const [hours, minutes] = time.split(':').map(Number)
	return hours * 60 + minutes
}

function minuteOfDay(at: DateLike) {
	const { hour, minute } = tashkentParts(at)
	return hour * 60 + minute
}

// How loaded the organisation is at a moment, 0–100, read off hourlyLoad.
// Each QUEUE_HOURS entry covers the hours up to the next one; before the
// first, the first applies, so a place that opens at 08:00 is not read as
// empty for its first hour. 0 means the place is shut at that hour.
export function queueLoadAt(org: Pick<QueueOrg, 'hourlyLoad'>, at: DateLike) {
	const minute = minuteOfDay(at)
	let index = 0
	QUEUE_HOURS.forEach((label, slot) => {
		if (minutesOf(label) <= minute) index = slot
	})
	const load = org.hourlyLoad[index]
	return typeof load === 'number' && Number.isFinite(load)
		? Math.min(100, Math.max(0, load))
		: 0
}

// Whether the doors are open for a service at a moment. A booked slot has to
// end by closing time; a live ticket only has to be taken before it.
export function isQueueOrgOpenAt(
	org: Pick<QueueOrg, 'open' | 'openTime' | 'closeTime' | 'hourlyLoad'>,
	at: DateLike,
	serviceMinutes: number,
	mode: DeskAvailabilityInput['mode'],
) {
	if (!org.open) return false
	const minute = minuteOfDay(at)
	const opens = minutesOf(org.openTime)
	const closes = minutesOf(org.closeTime)
	if (!Number.isFinite(opens) || !Number.isFinite(closes)) return false
	if (minute < opens) return false
	const end = mode === 'live' ? minute : minute + serviceMinutes
	if (mode === 'live' ? end >= closes : end > closes) return false
	return queueLoadAt(org, at) > 0
}

// Whether the customer's own live ticket holds this desk at this moment. A
// booked ticket holds its slot; a live one holds its desk for as long as it
// is live, so it only shows on the live board.
function heldByCustomer(
	desk: QueueDesk,
	input: DeskAvailabilityInput,
	wanted: { start: number; end: number } | null,
) {
	return (input.tickets ?? []).some(ticket => {
		if (!isQueueTicketLive(ticket.status)) return false
		if (ticket.orgId !== input.org.id || ticket.deskId !== desk.id) return false
		const held = queueTicketInterval(ticket)
		if (!held) return input.mode === 'live'
		return Boolean(
			wanted && intervalsOverlap(held.start, held.end, wanted.start, wanted.end),
		)
	})
}

// Every desk that serves the line, in printed order, with its state at `at`.
// Empty when the organisation has no such service.
export function deskAvailability(input: DeskAvailabilityInput): DeskSlot[] {
	const { org, serviceId, at, mode } = input
	const service = getQueueService(org, serviceId)
	if (!service) return []
	const desks = desksForService(org, serviceId)

	const startMs = new Date(at).getTime()
	const wanted = Number.isNaN(startMs)
		? null
		: { start: startMs, end: startMs + service.serviceMinutes * 60_000 }

	if (!wanted || !isQueueOrgOpenAt(org, at, service.serviceMinutes, mode)) {
		return desks.map(desk => ({ desk, state: 'closed' }))
	}

	// One draw per desk and half-hour, keyed on the desk rather than the line,
	// so a window shared by two lines reads the same from either of them.
	const day = tashkentDayKey(at)
	const bucket =
		Math.floor(minuteOfDay(at) / QUEUE_SLOT_STEP_MINUTES) *
		QUEUE_SLOT_STEP_MINUTES
	const takenOdds = (queueLoadAt(org, at) / 100) * MAX_TAKEN_SHARE
	const taken: DeskState = mode === 'live' ? 'busy' : 'booked'

	return desks.map(desk => {
		if (heldByCustomer(desk, input, wanted)) return { desk, state: 'mine' }
		const random = makeRandom(seedFor(`${org.id}:${desk.id}:${day}`, bucket, desk.number))
		return { desk, state: random() < takenOdds ? taken : 'free' }
	})
}

// Only a free desk is a new choice: the customer's own one is already theirs.
export function isDeskSelectable(state: DeskState) {
	return state === 'free'
}

// The desk a booking should default to, so the sheet never opens with nothing
// chosen. `exclude` keeps it off desks already ruled out by the caller.
export function firstFreeDesk(
	slots: readonly DeskSlot[],
	exclude: readonly string[] = [],
) {
	return (
		slots.find(slot => isDeskSelectable(slot.state) && !exclude.includes(slot.desk.id))
			?.desk.id ?? null
	)
}

// «2 / 3 bo‘sh» on a time chip.
export function freeDeskCount(slots: readonly DeskSlot[]) {
	return slots.filter(slot => isDeskSelectable(slot.state)).length
}

// The desk a live ticket taken «Hozir» is sent to when its number comes up.
// The customer does not choose one: the organisation assigns the first desk
// of the line that is free at that moment, or, with every one of them busy,
// the line's first desk. A ticket that already names a desk keeps it.
// Undefined only when the line has no desk at all.
export function assignQueueDesk(
	org: QueueOrg,
	ticket: Pick<QueueTicket, 'id' | 'serviceId' | 'deskId'>,
	at: DateLike,
	tickets: readonly QueueTicket[] = [],
): QueueDesk | undefined {
	const desks = desksForService(org, ticket.serviceId)
	const own = desks.find(desk => desk.id === ticket.deskId)
	if (own) return own
	const board = deskAvailability({
		org,
		serviceId: ticket.serviceId,
		at,
		mode: 'live',
		tickets: tickets.filter(item => item.id !== ticket.id),
	})
	const free = firstFreeDesk(board)
	return desks.find(desk => desk.id === free) ?? desks[0]
}
