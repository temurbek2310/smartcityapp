import { DEMO_DESTINATIONS } from '@/data/demo-transport'
import { getParking, PARKINGS } from '@/data/parkings'
import { distanceKm, type Coordinate } from '@/lib/geo'
import { buildMapObjects, mapObjectKey } from '@/lib/map-objects'
import type { TransportMode } from '@/lib/transport'

export type RouteEndpoint = Coordinate & {
	id: string
	title: string
	address: string
	parkingId: string | null
}

export function nearestParking(point: Coordinate) {
	return [...PARKINGS].sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0]
}

// Keep the endpoint independent of its nearby parking. In particular, GPS
// can be either end of a route, and swapping must preserve both coordinates.
export function resolveRouteEndpoint(id: string, location: Coordinate, gpsLabel = 'Mening joylashuvim'): RouteEndpoint | null {
	if (id === 'me') return { ...location, id, title: gpsLabel, address: '', parkingId: null }
	const saved = DEMO_DESTINATIONS.find(item => item.id === id)
	if (saved) {
		const parking = getParking(saved.parkingId ?? '')
		const point = saved.point ?? parking
		if (!point) return null
		return { lat: point.lat, lng: point.lng, id, title: saved.title,
			address: saved.address ?? '', parkingId: parking?.id ?? null }
	}
	const object = buildMapObjects({ parkings: PARKINGS }).find(item => mapObjectKey(item) === id)
	return object ? { lat: object.lat, lng: object.lng, id, title: object.title,
		address: object.address, parkingId: object.parkingId } : null
}

export function externalNavigationHref(from: Coordinate, to: Coordinate, mode: TransportMode) {
	const travelmode = { car: 'driving', metro: 'transit', scooter: 'bicycling', walk: 'walking' }[mode]
	const query = new URLSearchParams({ api: '1', origin: `${from.lat},${from.lng}`,
		destination: `${to.lat},${to.lng}`, travelmode })
	return `https://www.google.com/maps/dir/?${query}`
}
