import type { LucideIcon } from 'lucide-react'
import { Bike, Car, Footprints, TrainFront } from 'lucide-react'

// Shared between the Home mode strip and the /transport page so both read
// the same four modes instead of keeping two copies in sync by hand.
export type TransportMode = 'car' | 'metro' | 'scooter' | 'walk'

export const TRANSPORT_MODES: {
	id: TransportMode
	label: string
	time: number
	icon: LucideIcon
}[] = [
	{ id: 'car', label: 'Avto', time: 15, icon: Car },
	{ id: 'metro', label: 'Metro', time: 22, icon: TrainFront },
	{ id: 'scooter', label: 'Skuter', time: 18, icon: Bike },
	{ id: 'walk', label: 'Piyoda', time: 27, icon: Footprints },
]

export function isTransportMode(value: string | null): value is TransportMode {
	return value === 'car' || value === 'metro' || value === 'scooter' || value === 'walk'
}
