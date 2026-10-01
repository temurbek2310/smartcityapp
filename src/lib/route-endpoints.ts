import type { LucideIcon } from 'lucide-react'

import { DEMO_DESTINATIONS } from '@/data/demo-transport'
import { getParking, PARKINGS } from '@/data/parkings'
import { getQueueOrg } from '@/data/queue-orgs'
import { distanceKm, type Coordinate } from '@/lib/geo'
import { FALLBACK_CENTRE } from '@/lib/location'
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
	// True only for 'me' without a GPS fix: the point is the city centre,
	// kept so the in-app demo route has somewhere to start. It is never the
	// customer's position and never leaves the app as one.
	approximate: boolean
}

const QUEUE_PREFIX = 'queue:'

export function nearestParking(point: Coordinate) {
	return [...PARKINGS].sort((a, b) => distanceKm(point, a) - distanceKm(point, b))[0]
}

// Keep the endpoint independent of its nearby parking. In particular, GPS
// can be either end of a route, and swapping must preserve both coordinates.
// `position` is the real fix or null; without one, 'me' resolves to the city
// centre flagged `approximate`.
export function resolveRouteEndpoint(id: string, position: Coordinate | null, gpsLabel = 'Mening joylashuvim'): RouteEndpoint | null {
	if (id === 'me') return { ...(position ?? FALLBACK_CENTRE), id, kind: 'me', title: gpsLabel,
		address: '', parkingId: null, placeId: null, approximate: !position }
	const saved = DEMO_DESTINATIONS.find(item => item.id === id)
	if (saved) {
		const parking = getParking(saved.parkingId ?? '')
		const point = saved.point ?? parking
		if (!point) return null
		return { lat: point.lat, lng: point.lng, id, kind: 'saved', title: saved.title,
			address: saved.address ?? '', parkingId: parking?.id ?? null, placeId: null, approximate: false }
	}
	// Queue desks lost their own pin to the place they belong to; a saved route
	// or a link still written as 'queue:<org>' goes to that place.
	if (id.startsWith(QUEUE_PREFIX)) {
		const org = getQueueOrg(id.slice(QUEUE_PREFIX.length))
		const place = org ? resolveRouteEndpoint(`place:${org.placeId}`, position, gpsLabel) : null
		return place ? { ...place, id } : null
	}
	const object = buildMapObjects({ parkings: PARKINGS }).find(item => mapObjectKey(item) === id)
	return object ? { lat: object.lat, lng: object.lng, id, kind: object.kind as MapCatalogKind,
		title: object.title, address: object.address, parkingId: object.parkingId,
		placeId: object.kind === 'place' ? object.id : null, approximate: false } : null
}

// --- Saved routes ---------------------------------------------------------
// A saved route keeps its endpoint ids; its labels are worked out again each
// time it is shown. 'me' is always «Mening joylashuvim» — what it means at the
// moment of saving («aniqlanmoqda…», the demo centre) is not part of the route.
export const MY_LOCATION_TITLE = 'Mening joylashuvim'

// Labels older saves froze from the location state of the moment.
const TRANSIENT_ME_LABELS = new Set([
	'Joriy joylashuvingiz (GPS)',
	'Joylashuv aniqlanmoqda…',
	'Toshkent markazi (demo joylashuv)',
	'Joylashuv aniqlanmagan',
	'Toshkent markazi — taxminiy ko‘rinish',
])

export function routeEndpointLabel(id: string): string | null {
	if (id === 'me') return MY_LOCATION_TITLE
	const point = resolveRouteEndpoint(id, null)
	return point ? [point.title, point.address].filter(Boolean).join(', ') : null
}

// What a saved route reads as in Favorites. Ids win; a record from before
// ids were stored — or one whose place has left the catalog — keeps the text
// it was saved with, except a frozen location status, which becomes the
// stable «Mening joylashuvim».
export function savedRouteLabels(route: {
	from: string
	to: string
	originId?: string
	destinationId?: string
}) {
	const stored = (text: string) => (TRANSIENT_ME_LABELS.has(text) ? MY_LOCATION_TITLE : text)
	return {
		from: (route.originId && routeEndpointLabel(route.originId)) || stored(route.from),
		to: (route.destinationId && routeEndpointLabel(route.destinationId)) || stored(route.to),
	}
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
	// currentLocationLabel() of the shared location state, so the picker
	// never invents a second location system.
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

// --- Hand-off to 2GIS ----------------------------------------------------
// 2GIS's documented route deep link (help.2gis.com, "launching 2GIS
// navigation using deeplink"): /routeSearch/rsType/<type>[/from/<lon>,<lat>]
// /to/<lon>,<lat> on 2gis.ru — longitude first. Served over https rather
// than the dgis:// scheme so it still opens in a browser when the app is not
// installed; with the app, the phone hands the same link to it.
const TWO_GIS_ROUTE_BASE = 'https://2gis.ru/routeSearch/rsType'

// Only the route types 2GIS documents: car, ctx (public transport),
// pedestrian and taxi. It has no scooter type, and passing car or pedestrian
// instead would open a route for a different vehicle under a scooter label,
// so scooter has no hand-off and stays inside B SPACE.
const TWO_GIS_ROUTE_TYPE: Record<TransportMode, string | null> = {
	car: 'car',
	metro: 'ctx',
	scooter: null,
	walk: 'pedestrian',
}

export function supportsExternalNavigation(mode: TransportMode) {
	return TWO_GIS_ROUTE_TYPE[mode] !== null
}

// `origin` is null unless it is a real position: a picked place, or a GPS
// fix. The approximate centre 'me' resolves to without one is not where the
// customer is, so it is never sent — 2GIS, given no departure point, starts
// the route from the device's own location instead. A destination has no
// such fallback: with no real point there is no link at all.
export function externalNavigationHref({
	origin,
	destination,
	mode,
}: {
	origin: Coordinate | null
	destination: Coordinate | null
	mode: TransportMode
}): string | null {
	const type = TWO_GIS_ROUTE_TYPE[mode]
	if (!type || !destination) return null
	const point = ({ lat, lng }: Coordinate) => `${lng},${lat}`
	const from = origin ? `/from/${point(origin)}` : ''
	return `${TWO_GIS_ROUTE_BASE}/${type}${from}/to/${point(destination)}`
}

// Which origin the hand-off may carry: anything the customer picked, and
// their own position only when the GPS actually produced it.
export function externalNavigationOrigin(
	origin: RouteEndpoint,
	gpsReady: boolean,
): Coordinate | null {
	return isRealEndpoint(origin, gpsReady) ? origin : null
}

// «Mening joylashuvim» as the destination — after a swap, say. Only a real
// fix may be sent as `to/`; the city centre would route the customer to a
// place they never asked for.
export function externalNavigationDestination(
	destination: RouteEndpoint,
	gpsReady: boolean,
): Coordinate | null {
	return isRealEndpoint(destination, gpsReady) ? destination : null
}

function isRealEndpoint(endpoint: RouteEndpoint, gpsReady: boolean) {
	return endpoint.kind !== 'me' || (gpsReady && !endpoint.approximate)
}
