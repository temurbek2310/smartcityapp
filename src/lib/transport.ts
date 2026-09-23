import type { LucideIcon } from 'lucide-react'
import { Bike, Car, Footprints, TrainFront } from 'lucide-react'

import type { LocationStatus } from '@/lib/use-user-location'

// Shared between the Home mode strip and the /transport page so both read
// the same four modes instead of keeping two copies in sync by hand.
export type TransportMode = 'car' | 'metro' | 'scooter' | 'walk'

// No travel time lives here. A duration belongs to a route, and these four
// entries know nothing about where the customer is going — the Home strip
// used to print a fixed «15 daq» per mode with no destination behind it.
// Times come from lib/eta, measured against the destination actually picked.
export const TRANSPORT_MODES: {
	id: TransportMode
	label: string
	icon: LucideIcon
}[] = [
	{ id: 'car', label: 'Avto', icon: Car },
	{ id: 'metro', label: 'Metro', icon: TrainFront },
	{ id: 'scooter', label: 'Skuter', icon: Bike },
	{ id: 'walk', label: 'Piyoda', icon: Footprints },
]

// What a route opens on when nobody has chosen yet — the directions sheet,
// and /transport itself when the link carries no ?mode=. One constant so the
// two can never disagree about where a trip starts.
export const DEFAULT_TRANSPORT_MODE: TransportMode = 'car'

export function isTransportMode(value: string | null): value is TransportMode {
	return value === 'car' || value === 'metro' || value === 'scooter' || value === 'walk'
}

// What both screens print as the start of a route. Every branch that is not a
// real fix names itself as one: nothing may quietly pass the city centre off
// as the customer's own position.
export function originLabel(status: LocationStatus) {
	if (status === 'ready') return 'Joriy joylashuvingiz (GPS)'
	if (status === 'loading') return 'Joylashuv aniqlanmoqda…'
	return 'Toshkent markazi (demo joylashuv)'
}
