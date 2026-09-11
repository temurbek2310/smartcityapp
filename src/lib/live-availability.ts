import type { Parking } from '@/lib/types'

// Demo data. data/parkings.ts holds a fixed availableSpaces, so without this
// every "refresh" would leave the numbers exactly where they were and the
// gesture would be theatre. City Goo solves it by mutating its PARKS array
// on pull-to-refresh; mutating a module-level constant makes render output
// depend on history, so instead the jitter is a pure function of the lot and
// a tick counter that the refresh gesture increments.
//
// Deterministic on (id, tick), so a re-render never changes the number —
// only an actual refresh does.
function noise(id: string, tick: number) {
	let hash = 2166136261 ^ tick
	for (let index = 0; index < id.length; index += 1) {
		hash ^= id.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	hash ^= hash >>> 13
	return (hash >>> 0) / 4294967296
}

export function liveAvailability(parking: Parking, tick: number): Parking {
	// Tick 0 is the catalog as authored, so the first paint matches SSR and
	// the seeded FULL lot stays full until someone actually refreshes.
	if (tick === 0) return parking

	// Full lots are deliberately sticky: next-mall exists to exercise the
	// FULL state and the alternative suggestion, and a refresh that quietly
	// freed a space would erase the only way to reach that path.
	if (parking.availableSpaces <= 0) return parking

	const swing = Math.round((noise(parking.id, tick) - 0.5) * 9)
	const availableSpaces = Math.max(
		0,
		Math.min(parking.totalSpaces, parking.availableSpaces + swing),
	)

	return availableSpaces === parking.availableSpaces
		? parking
		: { ...parking, availableSpaces }
}

export function liveAvailabilityAll(parkings: Parking[], tick: number) {
	return tick === 0
		? parkings
		: parkings.map(parking => liveAvailability(parking, tick))
}
