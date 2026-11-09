import { z } from 'zod'

import { isInsideUzbekistan } from '@/lib/geo'
import {
	type ManeuverType,
	maneuverInstruction,
	normalizeRouteRequest,
	REAL_ROUTING_MODES,
	type RealRoutingMode,
	type RouteAlternative,
	routeUnavailable,
	type RouteCoordinate,
	type RouteManeuver,
	type RouteRequest,
	type RouteResult,
	type TrafficSegment,
	type TrafficSpeed,
} from '@/lib/routing'
import { joinLineSegments, parseWktLineString } from '@/lib/wkt'

// The server's half of /api/directions, kept framework-free so it can be
// tested without Next or the network: what a request may ask for, what is
// sent to 2GIS, and how 2GIS's answer becomes a RouteResult.

// 2GIS's Routing API is a separate product from MapGL JS — its own REST
// endpoint, called server-side only so its key never reaches the browser.
export const TWO_GIS_ROUTING_ENDPOINT = 'https://routing.api.2gis.com/routing/7.0.0/global'

// Long enough for a detailed intercity route, short enough that a stuck
// provider does not hold a customer's screen on a spinner.
export const ROUTING_TIMEOUT_MS = 8000

// --- SmartCity mode → 2GIS transport ---------------------------------------
// The one place a SmartCity mode name meets a 2GIS one. Components, the hook
// and the wire format all speak SmartCity ('car', 'walk', 'scooter'); only the
// body sent upstream says 'driving', 'walking' or 'scooter'. Unrelated to
// the consumer-app deep link in lib/route-endpoints.ts, whose walking type
// is 'pedestrian' and which has no scooter type at all — a different
// product with its own vocabulary.
const TWO_GIS_TRANSPORT = {
	car: 'driving',
	walk: 'walking',
	scooter: 'scooter',
} as const satisfies Record<RoadRoutingMode, string>

// The modes this adapter routes. Metro is public transport — a different
// 2GIS product with a different payload, read by lib/two-gis-transit.ts.
export type RoadRoutingMode = Exclude<RealRoutingMode, 'metro'>

export function isRoadRoutingMode(mode: RealRoutingMode): mode is RoadRoutingMode {
	return mode !== 'metro'
}

// Road types a scooter route should keep off where 2GIS can find a way
// around them. Avoidance preferences, not guarantees: the feasibility check
// saw a restricted route still end on a short stairway when that was the
// only way in. Nothing in the app may present a scooter route as stair-free
// or car-road-free because of these.
const TWO_GIS_FILTERS: Partial<Record<RoadRoutingMode, readonly string[]>> = {
	scooter: ['ban_car_road', 'ban_stairway'],
}

// How many other routes to ask for, per mode. Only the car asks: a driver
// choosing between roads is the case alternatives are for. The scooter
// already comes back with a second route unasked; walking asks for none.
const TWO_GIS_ALTERNATIVES: Partial<Record<RoadRoutingMode, number>> = {
	car: 2,
}

export type TwoGisTransport = (typeof TWO_GIS_TRANSPORT)[RoadRoutingMode]

export function twoGisTransport(mode: RoadRoutingMode): TwoGisTransport {
	return TWO_GIS_TRANSPORT[mode]
}

// --- What a caller may ask for ---------------------------------------------
// Only points inside Uzbekistan, and only the modes that have a real route
// (car, walking, scooter and metro). Anything else is refused before a paid request is
// made, so the endpoint is not a general-purpose routing proxy for the rest
// of the world — and a mode that is not routed is never quietly answered
// with another mode's route.
const coordinateSchema = z
	.strictObject({
		lat: z.number().min(-90).max(90),
		lng: z.number().min(-180).max(180),
	})
	.refine(isInsideUzbekistan, { message: 'outside Uzbekistan' })

const requestSchema = z.strictObject({
	origin: coordinateSchema,
	destination: coordinateSchema,
	// Metro is accepted here and answered by the transit adapter. Omitting
	// the mode means car, which is what the endpoint has always routed.
	mode: z.enum(REAL_ROUTING_MODES).default('car'),
})

export type DirectionsRequest = RouteRequest & { mode: RealRoutingMode }

export function parseDirectionsRequest(body: unknown): DirectionsRequest | null {
	const parsed = requestSchema.safeParse(body)
	if (!parsed.success) return null
	return { ...normalizeRouteRequest(parsed.data), mode: parsed.data.mode }
}

// --- What is sent ------------------------------------------------------------
// `output: 'detailed'` is what makes 2GIS return the per-maneuver geometry;
// the summary output has distance and duration only.
// `route_mode: 'fastest'` is the same for every transport. Filters are sent
// only for the modes that have them — the car and walking bodies are
// exactly what they were before the scooter. `alternative` likewise goes
// with the car alone.
export function twoGisRoutingBody({ origin, destination, mode }: DirectionsRequest & { mode: RoadRoutingMode }) {
	const filters = TWO_GIS_FILTERS[mode]
	const alternative = TWO_GIS_ALTERNATIVES[mode]
	return {
		points: [
			{ type: 'stop', lon: origin.lng, lat: origin.lat },
			{ type: 'stop', lon: destination.lng, lat: destination.lat },
		],
		transport: twoGisTransport(mode),
		route_mode: 'fastest',
		output: 'detailed',
		...(filters ? { filters: [...filters] } : {}),
		...(alternative ? { alternative } : {}),
	}
}

// --- What comes back ---------------------------------------------------------
// Only the fields this app reads. Everything is optional because none of it
// is trusted until it has been checked.
type TwoGisGeometry = { selection?: unknown; color?: unknown; length?: unknown }
type TwoGisManeuver = {
	icon?: unknown
	outcoming_path?: { geometry?: unknown; distance?: unknown }
}
type TwoGisRoute = {
	total_distance?: unknown
	total_duration?: unknown
	begin_pedestrian_path?: { geometry?: TwoGisGeometry }
	end_pedestrian_path?: { geometry?: TwoGisGeometry }
	maneuvers?: unknown
}

// 2GIS reports some failures in the body of a successful HTTP response
// (`"status": "..."`, `"type": "error"`). A route that cannot be built is a
// no-route answer; any other non-OK status is the provider failing.
const NO_ROUTE_STATUS = /NOT_FOUND|NO_ROUTE|ROUTE_NOT/i

// Concatenates every geometry segment 2GIS returns, in order: the pedestrian
// connector from the exact origin to the nearest road, each maneuver's
// road-following segments, then the connector to the exact destination. A
// walking route has the same shape — its maneuvers follow footpaths, and
// the connectors are simply absent when the ends are already on one.
// Returns null the moment any segment is unreadable — a line with a piece
// silently missing would cut straight across the city.
function collectRouteGeometry(route: TwoGisRoute): RouteCoordinate[] | null {
	const selections: unknown[] = []

	if (route.begin_pedestrian_path?.geometry) {
		selections.push(route.begin_pedestrian_path.geometry.selection)
	}
	if (!Array.isArray(route.maneuvers)) return null
	for (const maneuver of route.maneuvers as TwoGisManeuver[]) {
		const geometry = maneuver?.outcoming_path?.geometry
		if (geometry === undefined) continue
		if (!Array.isArray(geometry)) return null
		for (const item of geometry as TwoGisGeometry[]) {
			selections.push(item?.selection)
		}
	}
	if (route.end_pedestrian_path?.geometry) {
		selections.push(route.end_pedestrian_path.geometry.selection)
	}

	const segments: RouteCoordinate[][] = []
	for (const selection of selections) {
		const points = parseWktLineString(selection)
		if (!points) return null
		segments.push(points)
	}

	const line = joinLineSegments(segments)
	return line.length >= 2 ? line : null
}

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

// --- Maneuvers ----------------------------------------------------------------
// 2GIS names each maneuver with an icon ('start', 'crossroad_slightly_left',
// 'ringroad_right', 'finish', …). Its `comment` is English prose and is
// never passed on; the instruction is SmartCity's own sentence for the type.
// Order matters: the qualified turns are matched before the plain ones.
const MANEUVER_ICON_RULES: readonly [RegExp, ManeuverType][] = [
	[/^start$/, 'start'],
	[/^finish$/, 'finish'],
	[/ring|roundabout/, 'roundabout'],
	[/turn_?over|u_?turn|turnaround/, 'u-turn'],
	[/slightly_left/, 'slight-left'],
	[/sharply_left/, 'sharp-left'],
	[/keep_left/, 'keep-left'],
	[/slightly_right/, 'slight-right'],
	[/sharply_right/, 'sharp-right'],
	[/keep_right/, 'keep-right'],
	[/left/, 'left'],
	[/right/, 'right'],
	[/straight|forward/, 'straight'],
]

export function maneuverTypeFromIcon(icon: unknown): ManeuverType {
	if (typeof icon !== 'string') return 'continue'
	return MANEUVER_ICON_RULES.find(([pattern]) => pattern.test(icon))?.[1] ?? 'continue'
}

function collectManeuvers(route: TwoGisRoute): RouteManeuver[] {
	if (!Array.isArray(route.maneuvers)) return []
	return (route.maneuvers as TwoGisManeuver[]).flatMap(maneuver => {
		if (!maneuver || typeof maneuver !== 'object') return []
		const type = maneuverTypeFromIcon(maneuver.icon)
		const distance = maneuver.outcoming_path?.distance
		return [{
			type,
			instruction: maneuverInstruction(type),
			distanceMeters: isNonNegativeNumber(distance) ? distance : 0,
		}]
	})
}

// --- Traffic ------------------------------------------------------------------
// Each road segment carries a congestion `color`, its `length` in metres and
// its WKT line. Colours with no speed in them ('ignore', 'no-data',
// 'closed') and unreadable lines are left out rather than guessed.
// Neighbouring segments at one speed are merged — only true neighbours, so a
// merged line never jumps across a stretch that was left out.
const TRAFFIC_COLOR: Record<string, TrafficSpeed> = {
	fast: 'fast',
	normal: 'normal',
	slow: 'slow',
	'slow-jams': 'slow',
	jam: 'jam',
}

function collectTraffic(route: TwoGisRoute): TrafficSegment[] {
	const segments: TrafficSegment[] = []
	if (!Array.isArray(route.maneuvers)) return segments
	let previous = null as TrafficSegment | null
	for (const maneuver of route.maneuvers as TwoGisManeuver[]) {
		const geometry = maneuver?.outcoming_path?.geometry
		if (!Array.isArray(geometry)) continue
		for (const item of geometry as TwoGisGeometry[]) {
			const speed = typeof item?.color === 'string' ? TRAFFIC_COLOR[item.color] : undefined
			const line = speed && isNonNegativeNumber(item.length) ? parseWktLineString(item.selection) : null
			if (!speed || !line || !isNonNegativeNumber(item.length)) {
				previous = null
				continue
			}
			if (previous?.speed === speed) {
				previous.distanceMeters += item.length
				previous.geometry = joinLineSegments([previous.geometry, line])
			} else {
				previous = { speed, distanceMeters: item.length, geometry: line }
				segments.push(previous)
			}
		}
	}
	return segments
}

// --- Alternatives -------------------------------------------------------------
// Every route after the first, each read with the same all-or-nothing rule
// as the primary. One that fails is dropped on its own; it never fails the
// primary, and the primary never borrows from it.
function collectAlternatives(routes: unknown[]): RouteAlternative[] {
	return routes.flatMap(item => {
		const route = item as TwoGisRoute | null
		if (!route || typeof route !== 'object') return []
		if (!isNonNegativeNumber(route.total_distance) || !isNonNegativeNumber(route.total_duration)) return []
		const geometry = collectRouteGeometry(route)
		if (!geometry) return []
		return [{ distanceMeters: route.total_distance, durationSeconds: route.total_duration, geometry }]
	})
}

export function normalizeTwoGisResponse(data: unknown, request: RouteRequest): RouteResult {
	if (!data || typeof data !== 'object') return routeUnavailable('upstream')
	const body = data as { status?: unknown; type?: unknown; result?: unknown }

	if (body.type === 'error') return routeUnavailable('upstream')
	if (typeof body.status === 'string' && body.status.toUpperCase() !== 'OK') {
		return routeUnavailable(NO_ROUTE_STATUS.test(body.status) ? 'no_route' : 'upstream')
	}

	if (body.result === undefined || body.result === null) return routeUnavailable('no_route')
	if (!Array.isArray(body.result)) return routeUnavailable('upstream')
	if (body.result.length === 0) return routeUnavailable('no_route')

	// The provider's first route is the primary one; the rest become
	// alternatives in the order 2GIS gave them. Nothing here reads the
	// provider's per-route labels ('algorithm') to pick between them.
	const route = body.result[0] as TwoGisRoute | null
	if (!route || typeof route !== 'object') return routeUnavailable('upstream')
	if (!isNonNegativeNumber(route.total_distance) || !isNonNegativeNumber(route.total_duration)) {
		return routeUnavailable('upstream')
	}

	const geometry = collectRouteGeometry(route)
	if (!geometry) return routeUnavailable('upstream')

	return {
		status: 'ok',
		source: '2gis',
		mode: request.mode,
		distanceMeters: route.total_distance,
		durationSeconds: route.total_duration,
		geometry,
		alternatives: collectAlternatives(body.result.slice(1)),
		maneuvers: collectManeuvers(route),
		traffic: collectTraffic(route),
	}
}
