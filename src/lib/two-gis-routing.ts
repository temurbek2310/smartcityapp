import { z } from 'zod'

import { isInsideUzbekistan } from '@/lib/geo'
import {
	normalizeRouteRequest,
	routeUnavailable,
	type RouteCoordinate,
	type RouteRequest,
	type RouteResult,
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

// --- What a caller may ask for ---------------------------------------------
// Only points inside Uzbekistan, and only by car for now. Anything else is
// refused before a paid request is made, so the endpoint is not a general-
// purpose routing proxy for the rest of the world.
const coordinateSchema = z
	.strictObject({
		lat: z.number().min(-90).max(90),
		lng: z.number().min(-180).max(180),
	})
	.refine(isInsideUzbekistan, { message: 'outside Uzbekistan' })

const requestSchema = z.strictObject({
	origin: coordinateSchema,
	destination: coordinateSchema,
	// Car only until each other mode gets its own phase. Omitting it means
	// car, which is what the endpoint has always routed.
	mode: z.literal('car').default('car'),
})

export function parseDirectionsRequest(body: unknown): RouteRequest | null {
	const parsed = requestSchema.safeParse(body)
	if (!parsed.success) return null
	return normalizeRouteRequest(parsed.data)
}

// --- What is sent ------------------------------------------------------------
// `output: 'detailed'` is what makes 2GIS return the per-maneuver geometry;
// the summary output has distance and duration only.
export function twoGisRoutingBody({ origin, destination }: RouteRequest) {
	return {
		points: [
			{ type: 'stop', lon: origin.lng, lat: origin.lat },
			{ type: 'stop', lon: destination.lng, lat: destination.lat },
		],
		transport: 'driving',
		route_mode: 'fastest',
		output: 'detailed',
	}
}

// --- What comes back ---------------------------------------------------------
// Only the fields this app reads. Everything is optional because none of it
// is trusted until it has been checked.
type TwoGisGeometry = { selection?: unknown }
type TwoGisManeuver = { outcoming_path?: { geometry?: unknown } }
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
// road-following segments, then the connector to the exact destination.
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
	}
}
