import type { TransportMode } from '@/lib/transport'

// SmartCity has no live traffic/transit backend. Every number here is a
// formula derived from a REAL straight-line distance (see lib/geo.ts), not a
// fabricated constant — but it is still an approximation, not a routing
// engine, and callers should present it as such.

// Rough effective urban speed per mode (km/h), already factoring in an
// average number of stops/lights/transfers for that mode.
const MODE_SPEED_KMH: Record<TransportMode, number> = {
	car: 32,
	metro: 34,
	scooter: 21,
	walk: 4.8,
}

export function estimateMinutesForMode(distanceKm: number, mode: TransportMode) {
	const speed = MODE_SPEED_KMH[mode]
	return Math.max(3, Math.round((distanceKm / speed) * 60))
}

export function fastestMode(distanceKm: number, modes: TransportMode[]) {
	return modes.reduce((best, mode) => {
		const minutes = estimateMinutesForMode(distanceKm, mode)
		return minutes < best.minutes ? { mode, minutes } : best
	}, { mode: modes[0], minutes: estimateMinutesForMode(distanceKm, modes[0]) })
}

// Approximate fuel cost for driving, using a typical city consumption and
// fuel price. Not a real receipt — presented next to a "≈" sign in the UI.
const FUEL_L_PER_100KM = 8
const FUEL_PRICE_UZS = 13_500

export function estimateFuelCostUZS(distanceKm: number) {
	const liters = (distanceKm / 100) * FUEL_L_PER_100KM
	return Math.round((liters * FUEL_PRICE_UZS) / 500) * 500
}

// Metro/bus fares are flat regardless of distance in Tashkent; scooter
// rental is unlock + per-minute. Both are real-world-typical constants, not
// randomised placeholders.
export function estimateFareUZS(distanceKm: number, minutes: number, mode: TransportMode) {
	if (mode === 'car') return estimateFuelCostUZS(distanceKm)
	if (mode === 'metro') return 2_000
	if (mode === 'scooter') return 1_800 + minutes * 230
	return 0
}

// A speed band around the real distance/time average, framed as "optimal
// speed to avoid stopping" the way City Goo's driving tip does.
export function estimateOptimalSpeedRange(distanceKm: number, minutes: number) {
	const average = distanceKm / (minutes / 60)
	const low = Math.max(20, Math.round(average - 3))
	const high = Math.round(average + 4)
	return { low, high }
}
