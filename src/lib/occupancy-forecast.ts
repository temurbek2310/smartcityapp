import type { Parking, PeakProfile } from '@/lib/types'

// Demo data. City Goo stores eight hand-written percentages per lot; that is
// 56 numbers for seven lots and hundreds once a real dataset arrives, all of
// it unmaintainable. Here each lot declares only *when* it fills up, and the
// curve is generated from that — deterministically, so the chart does not
// twitch between renders or disagree between server and client.

export const FORECAST_SLOTS = [
	'Hozir',
	'12:00',
	'14:00',
	'16:00',
	'18:00',
	'20:00',
	'22:00',
	'00:00',
] as const

// Occupancy percentage across the slots above. The shapes are what actually
// distinguishes one lot from another: a bazaar empties by evening, an arena
// only fills then.
const CURVES: Record<PeakProfile, number[]> = {
	morning: [70, 80, 72, 60, 48, 35, 22, 12],
	midday: [55, 78, 88, 82, 70, 52, 34, 18],
	evening: [40, 52, 60, 70, 84, 92, 78, 45],
	night: [30, 35, 40, 48, 60, 75, 88, 82],
}

// Same technique as City Goo's bayMap(): hash the id, then walk a cheap PRNG
// so a given lot always produces the same wobble.
function seedFrom(id: string) {
	let hash = 2166136261
	for (let index = 0; index < id.length; index += 1) {
		hash ^= id.charCodeAt(index)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}

function makeRandom(seed: number) {
	let state = seed
	return () => {
		state = (state + 0x6d2b79f5) >>> 0
		let t = state
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

export type ForecastPoint = {
	label: string
	percent: number
}

export function occupancyForecast(parking: Parking): ForecastPoint[] {
	const curve = CURVES[parking.peakProfile]
	const random = makeRandom(seedFrom(parking.id))

	return FORECAST_SLOTS.map((label, index) => {
		// The first slot is not a forecast at all — it is the lot as it stands
		// right now, so the chart starts from something the user can verify
		// against the number on the card.
		if (index === 0) {
			const occupied = parking.totalSpaces
				? ((parking.totalSpaces - parking.availableSpaces) /
						parking.totalSpaces) *
					100
				: 0
			return { label, percent: Math.round(Math.max(0, Math.min(100, occupied))) }
		}

		const wobble = Math.round((random() - 0.5) * 14)
		const percent = Math.max(4, Math.min(99, curve[index] + wobble))
		return { label, percent }
	})
}

// The hour a driver should aim for: lowest forecast occupancy, ignoring
// "Hozir" since recommending the present moment says nothing.
export function bestForecastSlot(points: ForecastPoint[]) {
	let best = 1
	for (let index = 2; index < points.length; index += 1) {
		if (points[index].percent < points[best].percent) best = index
	}
	return { index: best, ...points[best] }
}

export function peakForecastSlot(points: ForecastPoint[]) {
	let peak = 0
	for (let index = 1; index < points.length; index += 1) {
		if (points[index].percent > points[peak].percent) peak = index
	}
	return { index: peak, ...points[peak] }
}
