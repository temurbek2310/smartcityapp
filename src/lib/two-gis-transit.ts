import { distanceKm } from '@/lib/geo'
import {
	HEX_COLOR,
	routeUnavailable,
	type RouteCoordinate,
	type RouteRequest,
	type RouteResult,
	type TransitLeg,
	type TransitLineInfo,
	type TransitVehicle,
} from '@/lib/routing'
import { joinLineSegments, parseWktLineString } from '@/lib/wkt'

// The server's half of a public transport route, kept framework-free like
// lib/two-gis-routing.ts. 2GIS's Public Transport API is its own product:
// another endpoint, another body and a payload built from "movements"
// rather than maneuvers — so it gets its own adapter instead of being forced
// through the car/walking one.

export const TWO_GIS_TRANSIT_ENDPOINT = 'https://routing.api.2gis.com/public_transport/2.0'

// What SmartCity's metro mode may ride. Metro first; the city's surface lines
// are part of the same journey planner, since a metro trip rarely starts at
// a station. 'pedestrian' lets 2GIS walk the ends.
const TWO_GIS_TRANSIT_TYPES = [
	'pedestrian',
	'metro',
	'light_metro',
	'bus',
	'trolleybus',
	'tram',
	'shuttle_bus',
] as const

// One journey is shown; asking for more would be paying for unread answers.
const TWO_GIS_TRANSIT_RESULTS = 3

export function twoGisTransitBody({ origin, destination }: RouteRequest) {
	return {
		source: { name: 'A', point: { lat: origin.lat, lon: origin.lng } },
		target: { name: 'B', point: { lat: destination.lat, lon: destination.lng } },
		transport: [...TWO_GIS_TRANSIT_TYPES],
		max_result_count: TWO_GIS_TRANSIT_RESULTS,
	}
}

// --- What comes back ---------------------------------------------------------
// Only the fields this app reads. Everything is optional because none of it
// is trusted until it has been checked.
type TwoGisGeometry = { selection?: unknown }
type TwoGisTransitRoute = { names?: unknown; subtype?: unknown; color?: unknown }
type TwoGisMovement = {
	type?: unknown
	distance?: unknown
	moving_duration?: unknown
	waiting_duration?: unknown
	waypoint?: { name?: unknown; subtype?: unknown }
	alternatives?: unknown
	routes?: unknown
	metro?: { line_name?: unknown; color?: unknown }
	platforms?: { names?: unknown }
}
type TwoGisJourney = {
	total_distance?: unknown
	total_duration?: unknown
	pedestrian?: unknown
	movements?: unknown
}

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null
}

// --- 2GIS subtype → SmartCity vehicle ------------------------------------------
const TWO_GIS_VEHICLE: Record<string, TransitVehicle> = {
	metro: 'metro',
	light_metro: 'metro',
	premetro: 'metro',
	bus: 'bus',
	trolleybus: 'trolleybus',
	tram: 'tram',
	shuttle_bus: 'shuttle',
}

function vehicleFrom(subtype: unknown): TransitVehicle {
	return (typeof subtype === 'string' && TWO_GIS_VEHICLE[subtype]) || 'other'
}

function colorFrom(value: unknown): string | null {
	return typeof value === 'string' && HEX_COLOR.test(value) ? value : null
}

// A metro ride names its line in `metro`; a surface ride names its route
// number in `routes`. When 2GIS offers several lines for the same stretch
// (bus 6 or trolleybus 8), the first is the one shown — each is a real
// option, and one is enough to take.
function lineInfoFrom(movement: TwoGisMovement): TransitLineInfo | null {
	const routes = Array.isArray(movement.routes) ? (movement.routes as TwoGisTransitRoute[]) : []
	const first = routes.find(route => route && typeof route === 'object')
	const vehicle = vehicleFrom(first?.subtype ?? movement.waypoint?.subtype)

	const metroLine = nonEmptyString(movement.metro?.line_name)
	if (metroLine) {
		return { vehicle: 'metro', name: metroLine, color: colorFrom(movement.metro?.color) }
	}
	const names = Array.isArray(first?.names)
		? (first.names as unknown[]).map(nonEmptyString).filter((name): name is string => name !== null)
		: []
	if (names.length === 0) return null
	return { vehicle, name: names.join(', '), color: colorFrom(first?.color) }
}

// A movement's line: every geometry piece of its first alternative, in
// order. null when any piece is unreadable, [] when there is none at all.
function movementGeometry(movement: TwoGisMovement): RouteCoordinate[] | null {
	if (movement.alternatives === undefined) return []
	if (!Array.isArray(movement.alternatives)) return null
	const alternative = movement.alternatives[0] as { geometry?: unknown } | undefined
	if (!alternative || alternative.geometry === undefined) return []
	if (!Array.isArray(alternative.geometry)) return null
	const segments: RouteCoordinate[][] = []
	for (const item of alternative.geometry as TwoGisGeometry[]) {
		const points = parseWktLineString(item?.selection)
		if (!points) return null
		segments.push(points)
	}
	return joinLineSegments(segments)
}

// The length of 2GIS's own line, for a leg that states no distance.
function lineLengthMeters(line: RouteCoordinate[]) {
	let meters = 0
	for (let index = 1; index < line.length; index += 1) {
		const [lngA, latA] = line[index - 1]
		const [lngB, latB] = line[index]
		meters += distanceKm({ lat: latA, lng: lngA }, { lat: latB, lng: lngB }) * 1000
	}
	return Math.round(meters)
}

// The legs of one journey, or null the moment one cannot be read. 2GIS ends
// every journey with an arrival movement that carries no line — that is the
// finish marker, not a leg, and is the only movement ever left out.
function collectLegs(movements: TwoGisMovement[]): TransitLeg[] | null {
	const legs: TransitLeg[] = []
	for (let index = 0; index < movements.length; index += 1) {
		const movement = movements[index]
		if (!movement || typeof movement !== 'object') return null
		const geometry = movementGeometry(movement)
		if (geometry === null) return null

		if (geometry.length === 0) {
			if (movement.waypoint?.subtype === 'finish') continue
			// A movement with no line and no length is a zero step; one that
			// claims a length but has no line would leave a hole in the route.
			if (!isNonNegativeNumber(movement.distance) || movement.distance === 0) continue
			return null
		}
		if (geometry.length < 2) return null

		const type =
			movement.type === 'passage' ? 'ride'
			: movement.type === 'crossing' ? 'transfer'
			: movement.type === 'walkway' ? 'walk'
			: null
		if (!type) return null

		if (!isNonNegativeNumber(movement.moving_duration)) return null
		const waiting = isNonNegativeNumber(movement.waiting_duration) ? movement.waiting_duration : 0
		const distanceMeters = isNonNegativeNumber(movement.distance)
			? movement.distance
			: lineLengthMeters(geometry)

		if (type !== 'ride') {
			legs.push({
				type,
				durationSeconds: movement.moving_duration + waiting,
				distanceMeters,
				geometry,
				lineInfo: null,
				fromStop: null,
				toStop: null,
				stopCount: null,
			})
			continue
		}

		const lineInfo = lineInfoFrom(movement)
		if (!lineInfo) return null
		// Intermediate stops are listed; the one you get off at is the next
		// movement's waypoint.
		const intermediate = Array.isArray(movement.platforms?.names) ? movement.platforms.names.length : null
		legs.push({
			type,
			durationSeconds: movement.moving_duration + waiting,
			distanceMeters,
			geometry,
			lineInfo,
			fromStop: nonEmptyString(movement.waypoint?.name),
			toStop: nonEmptyString(movements[index + 1]?.waypoint?.name),
			stopCount: intermediate === null ? null : intermediate + 1,
		})
	}
	return legs
}

export function normalizeTwoGisTransitResponse(data: unknown, request: RouteRequest): RouteResult {
	if (data === null || data === undefined) return routeUnavailable('no_route')
	// An array of journeys, or it is not an answer (2GIS's error bodies are
	// objects).
	if (!Array.isArray(data)) return routeUnavailable('upstream')
	if (data.length === 0) return routeUnavailable('no_route')

	// The first journey that actually rides something, in 2GIS's order. A
	// walking-only answer is a walking route — SmartCity has a real one of those
	// under «Piyoda» — and is not presented as public transport.
	let sawTransit = false
	for (const item of data) {
		const journey = item as TwoGisJourney | null
		if (!journey || typeof journey !== 'object') continue
		if (journey.pedestrian === true) continue
		sawTransit = true
		if (!isNonNegativeNumber(journey.total_distance) || !isNonNegativeNumber(journey.total_duration)) continue
		if (!Array.isArray(journey.movements)) continue
		const legs = collectLegs(journey.movements as TwoGisMovement[])
		if (!legs || !legs.some(leg => leg.type === 'ride')) continue
		const geometry = joinLineSegments(legs.map(leg => leg.geometry))
		if (geometry.length < 2) continue
		return {
			status: 'ok',
			source: '2gis',
			mode: request.mode,
			distanceMeters: journey.total_distance,
			durationSeconds: journey.total_duration,
			geometry,
			alternatives: [],
			maneuvers: [],
			traffic: [],
			transitLegs: legs,
		}
	}
	// Journeys that ride but none of which could be read is the provider
	// failing; only walking (or nothing) is no public transport route.
	return routeUnavailable(sawTransit ? 'upstream' : 'no_route')
}
