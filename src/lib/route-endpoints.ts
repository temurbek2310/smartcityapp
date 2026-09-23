import type { LucideIcon } from 'lucide-react'

import { DEMO_DESTINATIONS } from '@/data/demo-transport'
import { getParking, PARKINGS } from '@/data/parkings'
import { distanceKm, type Coordinate } from '@/lib/geo'
import { buildMapObjects, mapObjectKey, type MapCatalogKind } from '@/lib/map-objects'
import { searchMatches } from '@/lib/search'
import type { TransportMode } from '@/lib/transport'

// What every route on this screen and every «Yo‘nalish» in the app points
// at. One shape, whatever the customer was looking at when they asked for
// directions — a lot, a café, a queue desk or their own position.
export type RouteEndpointKind = 'me' | 'saved' | MapCatalogKind

export type RouteEndpoint = Coordinate & {
	// Stable and URL-safe: 'me', a saved landmark's id, or mapObjectKey()'s
	// 'kind:id'. This is what routeHref() writes and readRouteParams() reads.
	id: string
	kind: RouteEndpointKind
	title: string
	address: string
	// Where to park on arrival, and which catalog place this is, when either
	// is known. Both stay null rather than being guessed.
	parkingId: string | null
	placeId: string | null
}

export function nearestParking(point: Coordinate) {
	return [...PARKINGS].sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0]
}

// Keep the endpoint independent of its nearby parking. In particular, GPS
// can be either end of a route, and swapping must preserve both coordinates.
export function resolveRouteEndpoint(id: string, location: Coordinate, gpsLabel = 'Mening joylashuvim'): RouteEndpoint | null {
	if (id === 'me') return { ...location, id, kind: 'me', title: gpsLabel, address: '', parkingId: null, placeId: null }
	const saved = DEMO_DESTINATIONS.find(item => item.id === id)
	if (saved) {
		const parking = getParking(saved.parkingId ?? '')
		const point = saved.point ?? parking
		if (!point) return null
		return { lat: point.lat, lng: point.lng, id, kind: 'saved', title: saved.title,
			address: saved.address ?? '', parkingId: parking?.id ?? null, placeId: null }
	}
	const object = buildMapObjects({ parkings: PARKINGS }).find(item => mapObjectKey(item) === id)
	return object ? { lat: object.lat, lng: object.lng, id, kind: object.kind as MapCatalogKind,
		title: object.title, address: object.address, parkingId: object.parkingId,
		placeId: object.kind === 'place' ? object.id : null } : null
}

export type DestinationOption = {
	id: string
	icon: LucideIcon
	title: string
	subtitle: string
}

// A saved landmark's route already ends at its own car park, so that lot does
// not need a second row of its own in the picker.
const SAVED_PARKING_IDS = new Set(
	DEMO_DESTINATIONS.flatMap(item => (item.parkingId ? [item.parkingId] : [])),
)

// The rest of the city: the very objects the map already plots, keyed exactly
// the way resolveRouteEndpoint() reads a key back.
const CATALOG = buildMapObjects({ parkings: PARKINGS }).filter(
	object => !(object.kind === 'parking' && SAVED_PARKING_IDS.has(object.id)),
)

// Enough to find what was typed without turning the sheet into a directory.
const CATALOG_LIMIT = 8

// What the «Qayerga» picker offers. With nothing typed it is the saved
// landmarks alone — the list the sheet has always opened on. A query also
// reaches the catalog, so «Amir Temur» finds the lot itself rather than
// nothing at all, and every row it returns is somewhere the app can route to.
export function destinationOptions({
	query,
	currentLocationLabel,
	excludeId,
}: {
	query: string
	// The live location status /transport already derives from
	// useUserLocation, so the picker never invents a second location system.
	currentLocationLabel: string
	excludeId?: string
}): DestinationOption[] {
	const saved = DEMO_DESTINATIONS.filter(item => item.id !== excludeId).map(
		item => ({
			id: item.id,
			icon: item.icon,
			title: item.title,
			subtitle: item.id === 'me' ? currentLocationLabel : (item.address ?? ''),
		}),
	)

	const needle = query.trim()
	if (!needle) return saved

	return [
		// Match on exactly the text each row shows, so the live location line is
		// searchable too and nothing matches that the user cannot see.
		...saved.filter(row => searchMatches(`${row.title} ${row.subtitle}`, needle)),
		...CATALOG.filter(object =>
			searchMatches(
				`${object.title} ${object.address} ${object.subtitle}`,
				needle,
			),
		)
			.slice(0, CATALOG_LIMIT)
			.map(object => ({
				id: mapObjectKey(object),
				icon: object.icon,
				title: object.title,
				subtitle: object.address,
			})),
	]
}

export function externalNavigationHref(from: Coordinate, to: Coordinate, mode: TransportMode) {
	const travelmode = { car: 'driving', metro: 'transit', scooter: 'bicycling', walk: 'walking' }[mode]
	const query = new URLSearchParams({ api: '1', origin: `${from.lat},${from.lng}`,
		destination: `${to.lat},${to.lng}`, travelmode })
	return `https://www.google.com/maps/dir/?${query}`
}
