import type { Parking } from '@/lib/types'

export type AvailabilityTone = {
	text: string
	bar: string
}

export type ParkingAvailability = {
	percent: number
	full: boolean
	tone: AvailabilityTone
}

// One reading of "how free is this lot", shared by the Favorites card, the
// Transport destination card and the Transport route summary — which each
// recomputed it inline. The banding (comfortable ≥30%, tight ≥15%, else
// critical) is the one two of those three already used.
//
// Home's nearby chip deliberately does NOT use this: it bands on absolute
// free spaces ("FULL" / "≤5 joy"), which answers a different question.
export function parkingAvailability(parking: Parking): ParkingAvailability {
	const percent = parking.totalSpaces
		? Math.max(
				0,
				Math.min(
					100,
					Math.round((parking.availableSpaces / parking.totalSpaces) * 100),
				),
			)
		: 0
	const full = parking.availableSpaces <= 0

	const tone: AvailabilityTone =
		!full && percent >= 30
			? { text: 'text-emerald-600', bar: 'bg-emerald-500' }
			: !full && percent >= 15
				? { text: 'text-amber-600', bar: 'bg-amber-500' }
				: { text: 'text-rose-500', bar: 'bg-rose-500' }

	return { percent, full, tone }
}
