import { makeRandom, seededOrder, seedFor } from '@/lib/seeded-random'
import type { Parking } from '@/lib/types'

// City Goo's bayMap(): a deterministic floor plan for one level of a lot.
//
// Deterministic matters twice over. The grid is rendered on the server and
// again on the client, so a Math.random() layout would hydrate into a
// different plan than it painted; and someone who picks bay B-07, backs out
// and returns has to find B-07 still free.
//
// The reference reads its PRNG through Array.sort(), whose comparator is not
// a shuffle and whose result depends on the engine's sort. Here the shuffle
// is an explicit Fisher-Yates over the same cheap LCG, so the plan is stable
// across engines as well as across renders. The seed, the LCG and the
// shuffle live in seeded-random, shared with the queue desk board.

export type BayState = 'free' | 'busy' | 'ev' | 'accessible' | 'mine'

export type Bay = {
	id: string
	state: BayState
	row: number
}

export const BAY_STATES: Record<
	BayState,
	{ label: string; swatch: string; text: string }
> = {
	free: { label: 'Bo‘sh', swatch: 'bg-ok-bg border-ok', text: 'text-ok' },
	busy: { label: 'Band', swatch: 'bg-card-2 border-line-2', text: 'text-ink-3' },
	ev: { label: 'EV quvvatlash', swatch: 'bg-info-bg border-info', text: 'text-info' },
	accessible: {
		label: 'Nogironlar uchun',
		swatch: 'bg-brand-100 border-brand-600',
		text: 'text-brand-600',
	},
	mine: { label: 'Sizning joyingiz', swatch: 'bg-brand-100 border-brand', text: 'text-brand' },
}

const COLUMNS = 6
const ROW_LETTERS = 'ABCDEFGH'

export function bayMap(
	parking: Parking,
	level: number,
	// The bay the user currently holds on this level, if any.
	heldBay?: string | null,
): { bays: Bay[]; rows: number } {
	const levels = Math.max(1, parking.levels)
	if (!Number.isInteger(level) || level < 1 || level > levels) return { bays: [], rows: 0 }
	// Distribute remainders once across the floors: 80 / 3 is 27 + 27 + 26.
	const share = (count: number) => {
		const whole = Math.max(0, Math.floor(count))
		return Math.floor(whole / levels) + (level <= whole % levels ? 1 : 0)
	}
	const total = share(parking.totalSpaces)
	const freeCount = Math.min(total, share(Math.min(parking.availableSpaces, parking.totalSpaces)))

	const bays: Bay[] = Array.from({ length: total }, (_, index) => ({
		id: `${ROW_LETTERS[Math.floor(index / COLUMNS) % ROW_LETTERS.length]}-${String(
			index + 1,
		).padStart(2, '0')}`,
		state: 'busy' as BayState,
		row: Math.floor(index / COLUMNS),
	}))

	const random = makeRandom(seedFor(parking.id, level, total))
	const order = seededOrder(bays.length, random)

	// EV and accessible bays are drawn *from* the free ones, not added on top.
	// The reference carves them out of the remainder, which leaves a lot with
	// zero available spaces still showing pickable EV bays — and makes the
	// grid contradict the "24 of 120 free" the header just printed. Here the
	// non-busy bays always total exactly the available spaces.
	const freeSlice = order.slice(0, Math.min(freeCount, order.length))
	freeSlice.forEach(index => {
		bays[index].state = 'free'
	})

	let cursor = 0
	const evCount = Math.min(
		share(parking.evChargers),
		freeSlice.length,
	)
	freeSlice.slice(cursor, cursor + evCount).forEach(index => {
		bays[index].state = 'ev'
	})
	cursor += evCount

	const accessibleCount = Math.min(
		share(parking.accessibleSpaces),
		Math.max(0, freeSlice.length - cursor),
	)
	freeSlice.slice(cursor, cursor + accessibleCount).forEach(index => {
		bays[index].state = 'accessible'
	})

	if (heldBay) {
		const held = bays.find(bay => bay.id === heldBay)
		if (held) held.state = 'mine'
	}

	return { bays, rows: Math.ceil(total / COLUMNS) }
}

// Whether a bay can be picked. Busy is busy; the one you already hold is not
// a new choice.
export function isBaySelectable(state: BayState) {
	return state === 'free' || state === 'ev' || state === 'accessible'
}

// The first bay a booking should default to, so "Reserve" never opens with
// nothing chosen. `exclude` keeps it off bays the customer already holds
// here: the floor plan draws those as «yours» and refuses to select them, so
// defaulting to one opened the sheet on a bay its own confirm button would
// not accept.
export function firstFreeBay(
	parking: Parking,
	level: number,
	exclude: readonly string[] = [],
) {
	const { bays } = bayMap(parking, level)
	return (
		bays.find(bay => isBaySelectable(bay.state) && !exclude.includes(bay.id))
			?.id ?? null
	)
}
